#!/usr/bin/env python
# -*- coding: utf-8 -*-
# modelr web app
# Agile Geoscience
# 2012-2013
#
from google.appengine.api import users
from google.appengine.ext import webapp as webapp2
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import db


import cgi
from jinja2 import Environment, FileSystemLoader

from os.path import join, dirname
import hashlib
import logging
import urllib
import time

from default_rocks import default_rocks
from ModAuth import AuthExcept, get_cookie_string, signup, signin, \
     verify, verified_signup
     
from ModelrDb import Rock, Scenario, User, ModelrParent, Group, \
     GroupRequest

# Jinja2 environment to load templates
env = Environment(loader=FileSystemLoader(join(dirname(__file__),
                                               'templates')))

#=====================================================================
# Define Global Variables
#=====================================================================

# Put in the default rock database
admin_id = 0
admin_user = User(email='modelr.app.agile@gmail.com',
                  user_id=admin_id)
admin_user.put()


# Ancestor dB for all of modelr. Allows for strongly consistent
# database queries
ModelrRoot = ModelrParent.all().get()
ben = User.all().ancestor(ModelrRoot).filter("email =", "ben.bougher@gmail.com").fetch(1)

for i in ben: i.delete()
if not ModelrRoot:
    ModelrRoot = ModelrParent()
    ModelrRoot.put()
    
public = Group.all().ancestor(ModelrRoot).filter("name =", 'public')
public = public.fetch(1)
if not public:
    public = Group(name='public', admin=admin_user.user_id,
                   parent=ModelrRoot)
    public.put()



# Populate the default rock database.
for i in default_rocks:

    rocks = Rock.all()
    rocks.filter("user =", admin_id)
    rocks.filter("name =",i['name'] )
    rocks = rocks.fetch(1)
        
    if rocks:
        rock = rocks[0]
    else:
        rock = Rock()
        rock.user = admin_id
        rock.name = i['name']
        rock.group = 'public'
            
    rock.vp = float(i['vp'])
    rock.vs = float(i['vs'])
    rock.rho = float(i['rho'])

    rock.vp_std = float(i['vp_std'])
    rock.vs_std = float(i['vs_std'])
    rock.rho_std = float(i['rho_std'])


    
    rock.put()


#====================================================================
# 
#====================================================================
        
class ModelrPageRequest(webapp2.RequestHandler):
    """
    Base class for modelr app pages. Allows commonly used functions
    to be inherited to other pages.
    """
    
    # For the plot server
    # Ideally this should be settable by an admin_user console.
    HOSTNAME = "http://server.modelr.org:8081"
    
    def get_base_params(self, **kwargs):
        '''
        get the default parameters used in base_template.html
        '''

        default_rock = dict(vp=0,vs=0, rho=0, vp_std=0,
                            rho_std=0, vs_std=0,
                            description='description',
                            name='name', group='public')
        
        params = dict(logout=users.create_logout_url(self.request.uri),
                      HOSTNAME=self.HOSTNAME,
                      current_rock = default_rock)
        
        params.update(kwargs)
        
        return params

    def verify(self):
        """
        Verify that the current user is a legimate user. Returns the
        user object from the database if true, otherwise returns None.
        """

        cookie = self.request.cookies.get('user')
        if cookie is None:
            return

        try:
            user, password = cookie.split('|')
        except ValueError:
            return
        
        return verify(user, password, ModelrRoot)
    

class MainHandler(ModelrPageRequest):
    '''
    main page
    '''
    def get(self):

        # Redirect to the dashboard if the user is logged in
        user = self.verify()
        if user:
            self.redirect('/dashboard')
        
        template_params = self.get_base_params()
        template = env.get_template('index.html')
        html = template.render(template_params)

        self.response.out.write(html)



class RemoveScenarioHandler(ModelrPageRequest):
    '''
    remove a scenario from a users db
    '''
    
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
            
        name = self.request.get('name')
        
        scenarios = Scenario.all()
        scenarios.ancestor(user)
        scenarios.filter("user =", user.user_id)
        scenarios.filter("name =", name)
        scenarios = scenarios.fetch(100)
        
        for scenario in scenarios:
            scenario.delete()
            
        self.redirect('/dashboard')

    
class ModifyScenarioHandler(ModelrPageRequest):
    '''
    fetch or update a scenario.
    '''
    def get(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
        
        self.response.headers['Content-Type'] = 'application/json'
        name = self.request.get('name')
        
        scenarios = Scenario.all()
        scenarios.ancestor(user)
        scenarios.filter("user =", user.user_id)
        scenarios.filter("name =", name)
        scenarios = scenarios.fetch(1)
        
        logging.info(scenarios[0])
        logging.info(scenarios[0].data)
        if scenarios:
            scenario = scenarios[0]
            self.response.out.write(scenario.data)
        else:
            self.response.out.write('null')
            
        return 
        
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
            
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')

        name = self.request.get('name')
        group = self.request.get('group')
        
        logging.info(('name', name))
        data = self.request.get('json')

        logging.info(data)
        scenarios = Scenario.all()
        scenarios.ancestor(user)
        scenarios.filter("user =", user.user_id)
        scenarios.filter("name =", name)
        scenarios = scenarios.fetch(1)
        
        if scenarios:
            scenario = scenarios[0]
        else:
            scenario = Scenario(parent=user)
            scenario.user = user.user_id
            scenario.name = name
            scenario.group = group
            
        scenario.data = data.encode()
        scenario.put()

class AddRockHandler(ModelrPageRequest):
    '''
    add a rock 
    '''
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
        
        name = self.request.get('name')
        
        rocks = Rock.all()
        rocks.ancestor(user)
        rocks.filter("user =", user.user_id)
        rocks.filter("name =", name)
        rocks = rocks.fetch(1)
        
        if rocks:
            rock = rocks[0]
        else:
            rock = Rock(parent=user)
            rock.user = user.user_id

            
        rock.vp = float(self.request.get('vp'))
        rock.vs = float(self.request.get('vs'))
        rock.rho = float(self.request.get('rho'))

        rock.vp_std = float(self.request.get('vp_std'))
        rock.vs_std = float(self.request.get('vs_std'))
        rock.rho_std = float(self.request.get('rho_std'))

        rock.name = self.request.get('name')
        rock.group = self.request.get('group')
        rock.put()

        self.redirect('/dashboard')
    

class RemoveRockHandler(ModelrPageRequest):

    def post(self):
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
            
        selected_rock = Rock.all()
        selected_rock.ancestor(user)
        selected_rock.filter("user =", user.user_id)
        selected_rock.filter("name =", self.request.get('name'))

        try:
            rock = selected_rock.fetch(1)[0]
            rock.delete()
            
        except IndexError:
            self.redirect('/dashboard')
        else:
            self.redirect('/dashboard')
           
class ModifyRockHandler(ModelrPageRequest):
    '''
     modify a rock it by name.
    '''
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        selected_rock = Rock.all()
        selected_rock.ancestor(user)
        selected_rock.filter("name =", self.request.get('name'))     
      
        current_rock = selected_rock.fetch(1)

        try:
            rock = current_rock[0]
            key = rock.key()
            self.redirect('/dashboard?selected_rock=' + str(key.id()))
        except IndexError:
            self.redirect('/dashboard')

               
class ScenarioHandler(ModelrPageRequest):
    '''
      Display the scenario page (uses scenario.html template)
    '''
    def get(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
        
        self.response.headers['Content-Type'] = 'text/html'
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = \
          'X-Request, X-Requested-With'
        
        
    
        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)
        rocks = Rock.all().ancestor(user)
        template_params = \
          self.get_base_params(user=user,rocks=rocks.fetch(100),
                               default_rocks=default_rocks.fetch(100))
        
        template = env.get_template('scenario.html')


        html = template.render(template_params)

        self.response.out.write(html)
        
class DashboardHandler(ModelrPageRequest):
    '''
    Display the dashboard page (uses dashboard.html template)
    '''

    def get(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        template_params = self.get_base_params(user=user)
        
        self.response.headers['Content-Type'] = 'text/html'

        rocks = Rock.all()
        rocks.ancestor(user)
        rocks.filter("user =", user.user_id)
        rocks.order("-date")

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)

        rock_groups = []
        for name in user.group:
            dic = {'name': name.capitalize(),
                   'rocks':
                    Rock.all().ancestor(ModelrRoot).filter("group =",
                                                    name).fetch(100)}
            rock_groups.append(dic) 
            
        scenarios = Scenario.all()
        scenarios.ancestor(user)
        scenarios.filter("user =", user.user_id)
        scenarios.order("-date")
        
        for s in scenarios.fetch(100):
            logging.info((s.name, s))
            
        
        template_params.update(rocks=rocks.fetch(100),
                               scenarios=scenarios.fetch(100),
                               default_rocks=default_rocks.fetch(100),
                               rock_groups=rock_groups)

        # Check if a rock is being edited
        if self.request.get("selected_rock"):
            rock_id = self.request.get("selected_rock")
            current_rock = Rock.get_by_id(int(rock_id),
                                          parent=user)
            template_params['current_rock'] = current_rock
        
        template = env.get_template('dashboard.html')
        html = template.render(template_params)

        self.response.out.write(html)

class AboutHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('about.html')
        html = template.render(template_params)
        self.response.out.write(html)          
                                    
class PricingHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('pricing.html')
        html = template.render(template_params)
        self.response.out.write(html)          
          
class ProfileHandler(ModelrPageRequest):
    
    def get(self):
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        groups=[]
        for group in user.group:
            g = Group.all().ancestor(ModelrRoot).filter("name =",
                                                        group)
            g = g.fetch(1)
            if g:
                groups.append(g[0])
        
        template_params = self.get_base_params(user=user,
                                               groups=groups)
        
        if self.request.get("createfailed"):
            create_error = "Group name exists"
            template_params.update(create_error=create_error)
        if self.request.get("joinfailed"):
            join_error = "Group does not exists"
            template_params.update(join_error=join_error)

        # Get the user requests
        req = \
          GroupRequest.all().ancestor(ModelrRoot).filter("user =",
                                                         user.user_id)
        if req:
            template_params.update(requests=req)

        # Get the adminstrative requests
        admin_groups = \
          Group.all().ancestor(ModelrRoot).filter("admin =",
                                                  user.user_id)
        admin_groups = admin_groups.fetch(100)
        req = []
        for group in admin_groups:
            # Check for a request
            g_req = GroupRequest.all().ancestor(ModelrRoot)
            g_req = g_req.filter("group =", group.name).fetch(100)
            req = req + \
              [{'group': group.name,
                'user': User.all().filter("user_id =", i.user).get()}
               for i in g_req]
        
        template_params.update(admin_req=req)
        template = env.get_template('profile.html')
        html = template.render(template_params)
        self.response.out.write(html)

    def post(self):
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        err_string = []
        # Join a group
        join_group = self.request.get("join_group")
        if join_group:
            
            try:
                group = Group.all().ancestor(ModelrRoot)
                group = group.filter("name =", join_group).fetch(1)[0]
                if user.user_id in group.allowed_users: 
                    if group.name not in user.group:
                        user.group.append(group.name)
                        user.put()
                else:
                    GroupRequest(user=user.user_id,
                                 group=group.name,
                                 parent=ModelrRoot).put()

            except IndexError:
                err_string.append("joinfailed=1")
               
        # Leave a group
        group = self.request.get("selected_group")
        if group in user.group:
            user.group.remove(group)
            user.put()

        # Create a group
        group = self.request.get("create_group")

        if group:
            if not Group.all().ancestor(ModelrRoot).filter("name =",
                                                    group).fetch(1):
                Group(name=group, admin=user.user_id,
                      allowed_users=[user.user_id],
                      parent=ModelrRoot).put()
                user.group.append(group)
                user.put()
            else:
                err_string.append("createfailed=1")

        # Handle a group request
        request_user = self.request.get("request_user")
       
        if request_user:
            user_id = int(request_user)
            group = self.request.get("request_group")
            if self.request.get("allow") == "True":
                u = User.all().ancestor(ModelrRoot)
                u = u.filter("user_id =", user_id).fetch(1)
                if u:
                    u[0].group.append(group)
                    g = Group.all().ancestor(ModelrRoot)
                    g = g.filter("name =", group).fetch(1)[0]
                    g.allowed_users.append(u[0].user_id)
                    u[0].put()
                    g.put()
                
                    
            g_req = GroupRequest.all().ancestor(ModelrRoot)
            g_req = g_req.filter("user =", user_id)
            g_req = g_req.filter("group =", group).fetch(100)
            for g in g_req:
                g.delete()
                
        err_string = '&'.join(err_string) if err_string else ''
        self.redirect('/profile?' + err_string)
                                    
class SettingsHandler(ModelrPageRequest):
    
    def get(self):
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return
        
        template_params = self.get_base_params(user=user)
        template = env.get_template('settings.html')
        html = template.render(template_params)
        self.response.out.write(html)

class SignIn(webapp2.RequestHandler):

    def get(self):

        template = env.get_template('signin.html')
        html = template.render()
        self.response.out.write(html)

    def post(self):

        email = self.request.get('email')
        password = self.request.get('password')

        try:
            signin(email, password, ModelrRoot)
            cookie = get_cookie_string(email)
            self.response.headers.add_header('Set-Cookie', cookie)
            self.redirect('/dashboard')

        except AuthExcept as e:
            template = env.get_template('signin.html')
            msg = e.msg
            html = template.render(email=email,
                                   error=msg)
            self.response.out.write(html)

        
            
        
class SignUp(webapp2.RequestHandler):
    """
    Class for registering users
    """

    def get(self):

        template = env.get_template('signup.html')
        error = self.request.get("error")
        if error == 'auth_failed':
            error_msg = "failed to authorize user"
            html = template.render(error=error_msg)
        else:
            html = template.render()
        
        self.response.out.write(html)
        
    def post(self):

        email = self.request.get('email')
        password = self.request.get('password')
        verify = self.request.get('verify')

        if password != verify:
            template = env.get_template('signup.html')
            msg = "Password Mismatch"
            html = template.render(email=email,
                                   error=msg)
            self.response.out.write(html)
            
        else:
            try:
                signup(email, password, parent=ModelrRoot)
                self.redirect('signin')
                
            except AuthExcept as e:
                template = env.get_template('signup.html')
                msg = e.msg
                html = template.render(email=email,
                                       error=msg)
                self.response.out.write(html)
                
            
class Logout(ModelrPageRequest):

    def get(self):
        
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        self.response.headers.add_header('Set-Cookie',
                                         'user=""; Path=/')
        self.redirect('/')

class EmailAuthentication(ModelrPageRequest):

    def get(self):

        user_id = self.request.get("user_id")
        
        try:
            verified_signup(int(user_id), ModelrRoot)
        except AuthExcept as e:
            self.redirect('/signup?error=auth_failed')
            return

        self.redirect('/signin')
        
        
class ManageGroup(ModelrPageRequest):

    def get(self):
        
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        group_name = self.request.get("selected_group")

        group = Group.all().ancestor(ModelrRoot)
        group = group.filter("name =", group_name).fetch(1)
        if (not group):
            self.redirect('/profile')
            return

        group = group[0]
        if group.admin != user.user_id:
            self.redirect('/profile')
            return
        
        users = []
        for user_id in group.allowed_users:
            u = User.all().ancestor(ModelrRoot).filter("user_id =",
                                                       user_id)
            u = u.fetch(1)
            if u:
                users.append(u[0])

        params = self.get_base_params(user=user, users=users,
                                      group=group)
        template = env.get_template('manage_group.html')
        html = template.render(params)
        self.response.out.write(html)
        
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        group_name = self.request.get("group")
        group = Group.all().ancestor(ModelrRoot)
        group = group.filter("name =", group_name).fetch(1)[0]
        
        # remove a user
        rm_user = self.request.get("user")
        
        if rm_user:
            u = User.all().ancestor(ModelrRoot)
            u = u.filter("user_id =", int(rm_user)).fetch(1)

            if u and group_name in u[0].group:
                u[0].group.remove(group_name)
                u[0].put()
                group.allowed_users.remove(int(rm_user))
                group.put()
            self.redirect('/manage_group?selected_group=%s' % group.name)
            return
        
        # abolish a group
        if (self.request.get("abolish") == "abolish"):
            for uid in group.allowed_users:
                u = User.all().ancestor(ModelrRoot)
                u = u.filter("user_id =", uid).fetch(1)
                if u and group.name in u[0].group:
                    u[0].group.remove(group.name)
                    u[0].put()
            group.delete()
            self.redirect('/profile')
            return
        
        
app = webapp2.WSGIApplication([('/', MainHandler),
                               ('/dashboard', DashboardHandler),
                               ('/add_rock', AddRockHandler),
                               ('/edit_rock', ModifyRockHandler),
                               ('/remove_rock', RemoveRockHandler),
                               ('/scenario', ScenarioHandler),
                               ('/save_scenario',
                                  ModifyScenarioHandler),
                               ('/edit_scenario',
                                  ModifyScenarioHandler),
                               ('/remove_scenario',
                                  RemoveScenarioHandler),
                               ('/pricing', PricingHandler),
                               ('/profile', ProfileHandler),
                               ('/settings', SettingsHandler),
                               ('/about', AboutHandler),
                               ('/signup', SignUp),
                               ('/signin', SignIn),
                               ('/email_verify', EmailAuthentication),
                               ('/logout', Logout),
                               ('/manage_group', ManageGroup)
                               ],
                              debug=True)




def main():
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
