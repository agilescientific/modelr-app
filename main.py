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
# Initialize the ancestor databases to allow for strongly consistent
# queries
ancestor = Rock()
ancestor.put()

scen_ancestor = Scenario()
scen_ancestor.put()

# Put in the default rock database
admin_user = users.User(email='modelr.app.agile@gmail.com',
                        _user_id='118397192216125159104')

for i in default_rocks:

    rocks = Rock.all()
    rocks.filter("user =", admin_user)
    rocks.filter("name =",i['name'] )
    rocks = rocks.fetch(1)
        
    if rocks:
        rock = rocks[0]
    else:
        rock = Rock()
        rock.user = admin_user
        rock.name = i['name']
            
    rock.vp = float(i['vp'])
    rock.vs = float(i['vs'])
    rock.rho = float(i['rho'])

    rock.vp_std = float(i['vp_std'])
    rock.vs_std = float(i['vs_std'])
    rock.rho_std = float(i['rho_std'])

    rock.put()

providers = {
    'Google'   : 'www.google.com/accounts/o8/id', # shorter alternative: "Gmail.com"
    'Yahoo'    : 'yahoo.com',
    'MyOpenID' : 'myopenid.com'
    # add more here
}
#====================================================================
# 
#====================================================================


def get_gravatar_url(email, default=None, size=40):
    '''
    Get the url of this users gravatar 
    '''
    # construct the url
    gravatar_url = ("http://www.gravatar.com/avatar/" +
                    hashlib.md5(email.lower()).hexdigest() + "?")
    if default:
        gravatar_url += urllib.urlencode({'s':str(size), 'd':default})
    else:
        gravatar_url += urllib.urlencode({'s':str(size)})
    
    return gravatar_url
    
    
class ModelrPageRequest(webapp2.RequestHandler):
    '''
    Base class for modelr app pages.
    '''
    
    # For the plot server
    # Ideally this should be settable by an admin_user console.
    HOSTNAME = "http://server.modelr.org:8081"
    
    def rocks(self):
        '''
        return all the rocks this user has saved
        '''

        rocks = Rock.all()
        rocks.ancestor( ancestor )
        rocks.filter("user =", users.get_current_user())
        
        return rocks

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

    def require_login(self):
        '''
        if a user is not logged in then: 
            Send require_login.html and return None
        otherwise:
            return the current user
        '''
        user = users.get_current_user()
        if not user:
            
            template = env.get_template('require_login.html')
            
            template_params = self.get_base_params()
            template_params.update(
                provider_links={name:users.create_login_url(
                    self.request.uri, federated_identity=uri)
                    for (name, uri) in providers.items()})
            
            html = template.render(template_params)
            
            self.response.out.write(html)
            
        return user


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



class RemoveScenarioHandler(webapp2.RequestHandler):
    '''
    remove a scenario from a users db
    '''
    
    def post(self):
        name = self.request.get('name')
        
        scenarios = Scenario.all()
        scenarios.ancestor( scen_ancestor )
        scenarios.filter("user =", users.get_current_user())
        scenarios.filter("name =", name)
        scenarios = scenarios.fetch(100)
        
        for scenario in scenarios:
            scenario.delete()
            
        self.redirect('/dashboard')

    
class ModifyScenarioHandler(webapp2.RequestHandler):
    '''
    fetch or update a scenario.
    '''

    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        name = self.request.get('name')
        
        scenarios = Scenario.all()
        scenarios.ancestor( scen_ancestor )
        scenarios.filter("user =", users.get_current_user())
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
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')

        name = self.request.get('name')
        
        logging.info(('name', name))
        data = self.request.get('json')
        user = users.get_current_user()
        
        logging.info(data)
        scenarios = Scenario.all()
        scenarios.ancestor( scen_ancestor )
        scenarios.filter("user =", user)
        scenarios.filter("name =", name)
        scenarios = scenarios.fetch(1)
        if scenarios:
            scenario = scenarios[0]
        else:
            scenario = Scenario(parent=scen_ancestor)
            scenario.user = user
            scenario.name = name
            
        scenario.data = data.encode()
        scenario.put()

class AddRockHandler(webapp2.RequestHandler):
    '''
    add a rock 
    '''
    def post(self):
        name = self.request.get('name')
        
        rocks = Rock.all()
        rocks.ancestor( ancestor )
        rocks.filter("user =", users.get_current_user())
        rocks.filter("name =", name)
        rocks = rocks.fetch(1)
        
        if rocks:
            rock = rocks[0]
        else:
            rock = Rock(parent=ancestor)
            rock.user = users.get_current_user()
            rock.name = self.request.get('name')
            
        rock.vp = float(self.request.get('vp'))
        rock.vs = float(self.request.get('vs'))
        rock.rho = float(self.request.get('rho'))

        rock.vp_std = float(self.request.get('vp_std'))
        rock.vs_std = float(self.request.get('vs_std'))
        rock.rho_std = float(self.request.get('rho_std'))

        rock.put()

        self.redirect('/dashboard')
    
        
class ModifyRockHandler(ModelrPageRequest):
    '''
    remove a rock or modify it by name.
    '''
    def post(self):

        user = self.require_login()
        if not user:
            return
        scenarios = Scenario.all()
        scenarios.ancestor( scen_ancestor )
        scenarios.filter("user =", user)
        scenarios.order("-date")
        
        for s in scenarios.fetch(100):
            logging.info((s.name, s))
        all_rocks = Rock.all()
        all_rocks.ancestor( ancestor )
        all_rocks.filter("user =", user)
        selected_rock = Rock.all()
        selected_rock.ancestor( ancestor )
        selected_rock.filter("user =", user)
        selected_rock.filter("name =", self.request.get('name'))     
        template_params = self.get_base_params(user)

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_user)
        
        
        if( self.request.get('action') == 'remove' ):
        
            for rock in selected_rock.fetch(100):
                rock.delete()

            template_params.update(rocks=all_rocks.fetch(100),
                                   scenarios=scenarios.fetch(100),
                                   default_rocks =
                                     default_rocks.fetch(100))
                 
        else:
            current_rock = selected_rock.fetch(100)
            template_params.update(rocks=all_rocks.fetch(100),
                                   scenarios=scenarios.fetch(100),
                                   current_rock=current_rock[0],
                                   default_rocks =
                                     default_rocks.fetch(100))
        
        
        
        template = env.get_template('dashboard.html')
        html = template.render(template_params)

        self.response.out.write(html)
            


    
class ScenarioHandler(ModelrPageRequest):
    '''
    Display the scenario page (uses scenario.html template)
    '''
    def get(self):
        
        self.response.headers['Content-Type'] = 'text/html'
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = 'X-Request, X-Requested-With'
        
        user = self.require_login()
        if not user:
            return


        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_user)
        template_params = self.get_base_params(user,
                                rocks=self.rocks().fetch(100),
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
        self.response.headers['Content-Type'] = 'text/html'

        cookie = self.request.cookies.get('user')
        if cookie is None:
            self.redirect('/signin')
            return
        
        user, password = cookie.split('|')
        print( '+++++++++++++++++++++++++++++++', user)
        if not verify(user, password):
            self.redirect('/signin')
            return
            
        rocks = Rock.all()
        rocks.ancestor( ancestor )
        rocks.filter("user =", user)
        
        rocks.order("-date")

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_user)

        scenarios = Scenario.all()
        scenarios.ancestor( scen_ancestor )
        scenarios.filter("user =", user)
        scenarios.order("-date")
        
        for s in scenarios.fetch(100):
            logging.info((s.name, s))
            
        template_params = self.get_base_params(user)
        template_params.update(rocks=rocks.fetch(100),
                               scenarios=scenarios.fetch(100),
                               default_rocks =
                                 default_rocks.fetch(100))
        
        
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
        user = self.require_login()
        if not user:
            return
            
        template_params = self.get_base_params(user)
        template = env.get_template('profile.html')
        html = template.render(template_params)
        self.response.out.write(html)          
                                    
class SettingsHandler(ModelrPageRequest):
    def get(self):
        user = self.require_login()
        if not user:
            return
            
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
                
            
        
    
app = webapp2.WSGIApplication([('/', MainHandler),
                               ('/dashboard', DashboardHandler),
                               ('/add_rock', AddRockHandler),
                               ('/edit_rock', ModifyRockHandler),
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
                               ('/signin', SignIn)
                               ],
                              debug=True)


   


def main():
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
