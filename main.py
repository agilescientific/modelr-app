#!/usr/bin/env python
# -*- coding: utf-8 -*-
# modelr web app
# Agile Geoscience
# 2012-2013
#
from google.appengine.api import users
from google.appengine.ext import webapp as webapp2
from google.appengine.ext.webapp.util import run_wsgi_app
from jinja2 import Environment, FileSystemLoader

from os.path import join, dirname
import hashlib
import logging
import urllib
import time

from default_rocks import default_rocks
from ModAuth import AuthExcept, get_cookie_string, signup, signin, \
     verify
from ModelrDb import Rock, Scenario, User

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
    '''
    Base class for modelr app pages.
    '''
    
    # For the plot server
    # Ideally this should be settable by an admin_user console.
    HOSTNAME = "http://server.modelr.org:8081"
    
    def get_base_params(self, user=None, **kwargs):
        '''
        get the default parameters used in base_template.html
        '''

        default_rock = dict(vp=0,vs=0, rho=0, vp_std=0,
                            rho_std=0, vs_std=0,
                            description='description',
                            name = 'name')
        
        params = dict(
                    logout=users.create_logout_url(self.request.uri),
                      HOSTNAME=self.HOSTNAME,
                      current_rock = default_rock)
        
        params.update(kwargs)
        
        return params

    def verify(self):

        cookie = self.request.cookies.get('user')
        
        if cookie is None:
            self.redirect('/signin')
            return
        
        user, password = cookie.split('|')

        if not verify(user, password):
            self.redirect('/signin')
            return

        return User.all().filter("user_id =", int(user)).fetch(1)[0]

class MainHandler(ModelrPageRequest):
    '''
    main page
    '''
    def get(self):
        
        user = users.get_current_user()
        template_params = self.get_base_params(user)
        template = env.get_template('index.html')
        html = template.render(template_params)

        self.response.out.write(html)



class RemoveScenarioHandler(ModelrPageRequest):
    '''
    remove a scenario from a users db
    '''
    
    def post(self):

        user = self.verify()
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
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')

        name = self.request.get('name')
        
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
            
        scenario.data = data.encode()
        scenario.put()

class AddRockHandler(ModelrPageRequest):
    '''
    add a rock 
    '''
    def post(self):

        user = self.verify()
        
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
            rock.name = self.request.get('name')
            
        rock.vp = float(self.request.get('vp'))
        rock.vs = float(self.request.get('vs'))
        rock.rho = float(self.request.get('rho'))

        rock.vp_std = float(self.request.get('vp_std'))
        rock.vs_std = float(self.request.get('vs_std'))
        rock.rho_std = float(self.request.get('rho_std'))

        rock.put()

        self.redirect('/dashboard')
    

class RemoveRockHandler(ModelrPageRequest):

    def post(self):
        user = self.verify()
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
        
        self.response.headers['Content-Type'] = 'text/html'
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = \
          'X-Request, X-Requested-With'
        
        
    
        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)
        rocks = Rock.all().ancestor(user)
        template_params = \
          self.get_base_params(user,
                               rocks=rocks.fetch(100),
                               default_rocks =
                                default_rocks.fetch(100))
        
        template = env.get_template('scenario.html')


        html = template.render(template_params)

        self.response.out.write(html)
        
class DashboardHandler(ModelrPageRequest):
    '''
    Display the dashboard page (uses dashboard.html template)
    '''

    def get(self):

        user = self.verify()

        template_params = self.get_base_params(user)
        
        self.response.headers['Content-Type'] = 'text/html'

        rocks = Rock.all()
        rocks.ancestor(user)
        rocks.filter("user =", user.user_id)
        rocks.order("-date")

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)
            
        scenarios = Scenario.all()
        scenarios.ancestor(user)
        scenarios.filter("user =", user.user_id)
        scenarios.order("-date")
        
        for s in scenarios.fetch(100):
            logging.info((s.name, s))
            
        
        template_params.update(rocks=rocks.fetch(100),
                               scenarios=scenarios.fetch(100),
                               default_rocks =
                                 default_rocks.fetch(100))

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
        user = users.get_current_user()
        template_params = self.get_base_params(user)
        template = env.get_template('about.html')
        html = template.render(template_params)
        self.response.out.write(html)          
                                    
class PricingHandler(ModelrPageRequest):
    def get(self):
        user = users.get_current_user()
        template_params = self.get_base_params(user)
        template = env.get_template('pricing.html')
        html = template.render(template_params)
        self.response.out.write(html)          
          
class ProfileHandler(ModelrPageRequest):
    def get(self):
        user = self.verify()
            
        template_params = self.get_base_params(user)
        template = env.get_template('profile.html')
        html = template.render(template_params)
        self.response.out.write(html)          
                                    
class SettingsHandler(ModelrPageRequest):
    
    def get(self):
        user = self.verify()
            
        template_params = self.get_base_params(user)
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
            signin(email, password)
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
                signup(email, password)
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

        self.response.headers.add_header('Set-Cookie',
                                         'user=""; Path=/')
        self.redirect('/')
        
    
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
                               ('/logout', Logout)
                               ],
                              debug=True)




def main():
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
