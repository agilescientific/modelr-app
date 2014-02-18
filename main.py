#!/usr/bin/env python
# -*- coding: utf-8 -*-
# modelr web app
# Agile Geoscience
# 2012-2014
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
import stripe

from default_rocks import default_rocks
from ModAuth import AuthExcept, get_cookie_string, signup, signin, \
     verify, verify_signup, initialize_user
     
from ModelrDb import Rock, Scenario, User, ModelrParent, Group, \
     GroupRequest, ActivityLog, VerifyUser

# Jinja2 environment to load templates
env = Environment(loader=FileSystemLoader(join(dirname(__file__),
                                               'templates')))

#=====================================================================
# Define Global Variables
#=====================================================================
# Ancestor dB for all of modelr. Allows for strongly consistent
# database queries
ModelrRoot = ModelrParent.all().get()
if not ModelrRoot:
    ModelrRoot = ModelrParent()
    ModelrRoot.put()
    
# Put in the default rock database
admin_id = 0
admin_user = User.all().filter("user_id =", admin_id).get()
if not admin_user:
    admin_user = User(user_id=admin_user,
                      parent=ModelrRoot)
    admin_user.put()
    
   
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

        activity = "removed_scenario"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
        
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

        activity = "fetched_scenario"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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

        activity = "modified_scenario"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()


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

        activity = "added_rock"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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

        activity = "removed_rock"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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

        activity = "modified_rock"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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

        activity = "viewed_scenario"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
        
        self.response.out.write(html)
 
              
class DashboardHandler(ModelrPageRequest):
    '''
    Display the dashboard page (uses dashboard.html template)
    '''

    def get(self):

        user = self.verify()
        if user is None:
            self.redirect('/signin')
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

        activity = "dashboard"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
        self.response.out.write(html)

class DemoHandler(ModelrPageRequest):
    '''
    Display the dashboard page (uses dashboard.html template)
    '''

    def get(self):

        self.response.headers['Content-Type'] = 'text/html'

        rocks = Rock.all()

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)

        rock_groups = []
            
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

        activity = "dashboard"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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
        activity = "pricing"
        
        if user:
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
                        
        self.response.out.write(html)          
   
   
class HelpHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('help.html')
        html = template.render(template_params)
        activity = "help"
        
        if user:
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
                        
        self.response.out.write(html)          
   
                                                                     
class TermsHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('terms.html')
        html = template.render(template_params)
        activity = "terms"
        
        if user:
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
        
        self.response.out.write(html)          
                                    
          
class PrivacyHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('privacy.html')
        html = template.render(template_params)
        activity = "privacy"
        
        if user:
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
        
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

        activity = "profile_view"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
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
            activity = "joined_group"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
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
            activity = "left_group"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
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
                activity = "created_group"
                ActivityLog(user_id=user.user_id,
                            activity=activity,
                            parent=ModelrRoot).put()
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
            activity = "request_response"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
                    
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
                
                # Show the message page with "Success!"
                template = env.get_template('message.html')
                msg = "Please check your inbox and spam folder for our message. Then click on the link in the email."
                html = template.render(success=msg)
                self.response.out.write(html)
                
            except AuthExcept as e:
                template = env.get_template('signup.html')
                msg = e.msg
                html = template.render(email=email,
                                       error=msg)
                self.response.out.write(html)
                

class EmailAuthentication(ModelrPageRequest):

    def get(self):

        user_id = self.request.get("user_id")
        
        try:
            # Change this to check the user can be validated and
            # get temp_user
            user = verify_signup(user_id, ModelrRoot)
            
        except AuthExcept as e:
            self.redirect('/signup?error=auth_failed')
            return

        params = self.get_base_params(user=user)
        template = env.get_template('checkout.html')
        html = template.render(params)
        self.response.out.write(html)

    def post(self):
        """
        Adds the user to the stripe customer list
        """
        
        # Secret API key from Stripe dashboard
        stripe.api_key = "sk_test_flYdxpXqtIpK68FZSuUyhjg6"

        # Get the credit card details submitted by the form
        token = self.request.get('stripeToken')

        # CLEAN AND PROCESS USER INPUT
        # MORE TO DO HERE
        amount = 900
        
        # Create the charge on Stripe's servers - this will charge the user's card
        try:
            customer = stripe.Customer.create(
            card=token,
            plan="Monthly",
            description="New Modelr subscription"
          )
        except:
            # The card has been declined
            # Let the user know and DON'T UPGRADE USER
            self.response.out.write("Payment failed")
            return

        # get the temp user from the database
        email = self.request.get('stripeEmail')
        
        try:
            initialize_user(email, customer.id, ModelrRoot)
        except:
            # This should never happen. We billed a user then lost
            # them.....
            raise
        
        self.redirect('/signin?verified=true')
                        
        
class SignIn(webapp2.RequestHandler):

    def get(self):       

        status = self.request.get("verified")
        if status == "true":
            msg="Your account has been created and your card has been charged. Welcome to Modelr!"
        else:
            msg = None

        template = env.get_template('signin.html')
        html = template.render(success=msg)
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

                               
class SignOut(ModelrPageRequest):

    def get(self):
        
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        activity = "signout"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
        self.response.headers.add_header('Set-Cookie',
                                         'user=""; Path=/')
        self.redirect('/')
        
        
class StripeHandler(ModelrPageRequest):
    '''
    Handle webhook POSTs from Stripe

    '''

    def post(self):
        pass
        
        
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

        activity = "manage_group"
        ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
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
            self.redirect('/manage_group?selected_group=%s'
                          % group.name)

            activity = "removed_user"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
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
            activity = "abolished_group"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
            self.redirect('/profile')
            return
        
        
app = webapp2.WSGIApplication([('/', MainHandler),
                               ('/dashboard', DashboardHandler),
                               ('/demo', DemoHandler),
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
                               ('/help', HelpHandler),
                               ('/terms', TermsHandler),
                               ('/privacy', PrivacyHandler),
                               ('/signup', SignUp),
                               ('/verify_email', EmailAuthentication),
                               ('/signin', SignIn),
                               ('/signout', SignOut),
                               ('/stripe', StripeHandler),
                               ('/manage_group', ManageGroup)
                               ],
                              debug=True)


def main():

    logging.getLogger().setLevel(logging.DEBUG)
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
