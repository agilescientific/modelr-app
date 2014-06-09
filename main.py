#!/usr/bin/env python
# -*- coding: utf-8 -*-
# modelr web app
# Agile Geoscience
# 2012-2014
#

from google.appengine.ext import webapp as webapp2
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import db
from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext import blobstore
from google.appengine.api import images
from google.appengine.api import urlfetch
from google.appengine.api import users

# For image serving
import cloudstorage as gcs

from PIL import Image, ImageFilter
import numpy as np

from jinja2 import Environment, FileSystemLoader
import time
from os.path import join, dirname
import os

import hashlib
import logging
import urllib
import urllib2

import stripe

import json
import base64
import re
import StringIO

from xml.etree import ElementTree

from default_rocks import default_rocks
from ModAuth import AuthExcept, get_cookie_string, signup, signin, \
     verify, verify_signup, initialize_user, reset_password, \
     forgot_password, send_message, make_user, cancel_subscription
     
from ModelrDb import Rock, Scenario, User, ModelrParent, Group, \
     GroupRequest, ActivityLog, VerifyUser, ModelServedCount,\
     ImageModel, Forward2DModel, Issue, EarthModel

# Jinja2 environment to load templates
env = Environment(loader=FileSystemLoader(join(dirname(__file__),
                                               'templates')))


# Retry can help overcome transient urlfetch or GCS issues,
# such as timeouts.
my_default_retry_params = gcs.RetryParams(initial_delay=0.2,
                                          max_delay=5.0,
                                          backoff_factor=2,
                                          max_retry_period=15)

# All requests to GCS using the GCS client within current GAE request
# and current thread will use this retry params as default. If a
# default is not set via this mechanism, the library's built-in
# default will be used. Any GCS client function can also be given a
# more specific retry params that overrides the default.
# Note: the built-in default is good enough for most cases. We
# override retry_params here only for demo purposes.
gcs.set_default_retry_params(my_default_retry_params)



#=====================================================================
# Define Global Variables
#=====================================================================
# Ancestor dB for all of modelr. Allows for strongly consistent
# database queries. (all entities update together, so every page is
# is sync)
ModelrRoot = ModelrParent.all().get()
if ModelrRoot is None:
    ModelrRoot = ModelrParent()
    ModelrRoot.put()

# Check if we are running the dev server
if os.environ.get('SERVER_SOFTWARE','').startswith('Development'):
    LOCAL = True
    logging.debug("[*] Debug info activated")
    stripe.verify_ssl_certs = False
else:
    LOCAL = False

# Initialize the model served counter
models_served = ModelServedCount.all().ancestor(ModelrRoot).get()
if models_served is None:
    models_served = ModelServedCount(count=0, parent=ModelrRoot)
    models_served.put()
    
# Put in the default rock database under the admin account.
# The admin account is set up so every user can view our default
# scenarios and rocks
admin_id = 0
admin_user = User.all().ancestor(ModelrRoot).filter("user_id =",
                                                    admin_id).get()
# Create the admin account
if admin_user is None:
    password = "Mod3lrAdm1n"
    email="admin@modelr.io"
    
    admin_user = make_user(user_id=admin_id, email=email,
                           password=password,
                           parent=ModelrRoot)
    
# Create the public group. All users are automatically entitled
# to part of this group.
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
# Global Variables
#====================================================================
# Secret API key from Stripe dashboard

PRICE = 900
tax_dict = {"AB":0.05,
            "BC":0.05,
            "MB":0.05,
            "NB":0.13,
            "NL":0.13,
            "NT":0.05,
            "NS":0.15,
            "NU":0.05,
            "ON":0.13,
            "PE":0.14,
            "QC":0.05,
            "SK":0.05,
            "YT":0.05}

UR_STATUS_DICT = {'0': 'paused',
                  '1': 'not checked yet',
                  '2': 'up',
                  '8': 'seems down',
                  '9': 'down'
                 }

# Helper function
def RGBToString(rgb_tuple):
    """
    Convert a color to a css readable string
    """
    
    color = 'rgb(%s,%s,%s)'% rgb_tuple
    return color


class ModelrPageRequest(webapp2.RequestHandler):
    """
    Base class for modelr app pages. Allows commonly used functions
    to be inherited to other pages.
    """
    
    # For the plot server
    # Ideally this should be settable by an admin_user console.
    if LOCAL is True:
        HOSTNAME = "http://127.0.0.1:8081"
    else:
        HOSTNAME = "https://www.modelr.org"
    
    def get_base_params(self, **kwargs):
        '''
        get the default parameters used in base_template.html
        '''
        
        user=self.verify()
        
        if user:
            email_hash = hashlib.md5(user.email).hexdigest()
        else:
            email_hash=''

        default_rock = dict(vp=0,vs=0, rho=0, vp_std=0,
                            rho_std=0, vs_std=0,
                            description='description',
                            name='name', group='public')
        
        params = dict(logout=users.create_logout_url(self.request.uri),
                      HOSTNAME=self.HOSTNAME,
                      current_rock = default_rock,
                      email_hash=email_hash)
        
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
        
        self.redirect('/dashboard#scenarios')

    
class ModifyScenarioHandler(ModelrPageRequest):
    '''
    fetch or update a scenario.
    '''
    def get(self):

        # Get the user but don't redirect. Guests can play with
        # scenarios as well, they just can't post.
        user = self.verify()
        
        self.response.headers['Content-Type'] = 'application/json'
        name = self.request.get('name')

        if user:
            scenarios = Scenario.all()
            scenarios.ancestor(user)
            scenarios.filter("user =", user.user_id)
            scenarios.filter("name =", name)
            scenarios = scenarios.fetch(1)
        else:
            scenarios=[]

        # Get Evan's default scenarios (created with the admin)
        scen = Scenario.all().ancestor(ModelrRoot).filter("user_id =",
                                                          admin_id)
        scen = Scenario.all().filter("name =",name).fetch(100)
        if scen:
            scenarios += scen

        if scenarios:
            logging.info(scenarios[0])
            logging.info(scenarios[0].data)
        
            scenario = scenarios[0]
            self.response.out.write(scenario.data)
        else:
            self.response.out.write('null')

        activity = "fetched_scenario"
        if user:
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrRoot).put()
        return 
        
    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        # Output for successful post reception
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

        # Rewrite if the name exists, create new one if it doesn't
        if scenarios:
            scenario = scenarios[0]
        else:
            scenario = Scenario(parent=user)
            scenario.user = user.user_id
            scenario.name = name
            scenario.group = group

        # Save in Db
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

        # Rewrite if the rock exists
        if rocks:
            rock = rocks[0]
        else:
            rock = Rock(parent=user)
            rock.user = user.user_id

        # Populate the object
        rock.vp = float(self.request.get('vp'))
        rock.vs = float(self.request.get('vs'))
        rock.rho = float(self.request.get('rho'))

        rock.vp_std = float(self.request.get('vp_std'))
        rock.vs_std = float(self.request.get('vs_std'))
        rock.rho_std = float(self.request.get('rho_std'))

        rock.name = self.request.get('name')
        rock.group = self.request.get('group')

        # Save in the database
        rock.put()

        activity = "added_rock"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrRoot).put()
        self.redirect('/dashboard#rocks')
    

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

        # Delete the rock if it exists
        try:
            rock = selected_rock.fetch(1)[0]
            rock.delete()
            
        except IndexError:
            self.redirect('/dashboard#rocks')
        else:
            self.redirect('/dashboard#rocks')
 
                     
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

        # reload the dashboard with the rock selected for editing
        try:
            rock = current_rock[0]
            key = rock.key()
            self.redirect('/dashboard?selected_rock=' +
                          str(key.id()) + '#rocks')
        except IndexError:
            self.redirect('/dashboard#rocks')

               
class ScenarioHandler(ModelrPageRequest):
    '''
      Display the scenario page (uses scenario.html template)
    '''
    def get(self):

        # Check for a user, but allow guests as well
        user = self.verify()

        self.response.headers['Content-Type'] = 'text/html'
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = \
          'X-Request, X-Requested-With'

        # Get the default rocks
        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)
        default_rocks = default_rocks.fetch(100)
        
        # Get the user rocks
        if user:
            rocks = Rock.all().ancestor(user).fetch(100)

            # Get the group rocks
            group_rocks = []
            for group in user.group:
            
                g_rocks = \
                  Rock.all().ancestor(ModelrRoot).filter("group =",
                                                         group)
                group_rocks.append({"name": group.capitalize(),
                                    "rocks": g_rocks.fetch(100)})
                
            # Get the users scenarios
            scenarios = \
                Scenario.all().ancestor(user).filter("user =",
                                            user.user_id).fetch(100)
        else:
            rocks = []
            group_rocks = []
            scenarios = []

        # Get Evan's default scenarios (user id from modelr database)
        scen = Scenario.all().ancestor(ModelrRoot)
        scen = scen.filter("user =", admin_id).fetch(100)
        if scen: 
            scenarios += scen

        if user:
            model_data = EarthModel.all().filter("user =",
                                             user.user_id).fetch(1000)
            earth_models = [{"image_key": i.parent_key().name(),
                         "name": i.name} for i in model_data]

        else:
            earth_models = []
            
        template_params = \
          self.get_base_params(user=user,rocks=rocks,
                               default_rocks=default_rocks,
                               group_rocks=group_rocks,
                               scenarios=scenarios,
                               earth_models=earth_models)
                
        template = env.get_template('scenario.html')

        html = template.render(template_params)

        if user:
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

        # Get all the rocks
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

        # Get all the user scenarios
        scenarios = Scenario.all()
        if not user.user_id == admin_id:
            scenarios.ancestor(user)
        else:
            scenarios.ancestor(ModelrRoot)
            
        scenarios.filter("user =", user.user_id)
        scenarios.order("-date")
        
        for s in scenarios.fetch(100):
            logging.info((s.name, s))

    
        default_image_models = \
          ImageModel.all().filter("user =", admin_id).fetch(100)

        user_image_models = \
          ImageModel.all().filter("user =", user.user_id).fetch(100)

        default_models = [{"image": images.get_serving_url(i.image,
                                                           size=200,
                                                          crop=False),
                           "image_key": str(i.key()),
                           "editable": False,
                           "models": EarthModel.all().ancestor(i).filter("user =", user.user_id).fetch(100)}
                                      for i in default_image_models]

        user_models = [{"image": images.get_serving_url(i.image,
                                                           size=200,
                                                          crop=False),
                           "image_key": str(i.key()),
                           "editable": True,
                           "models": EarthModel.all().ancestor(i).filter("user =", user.user_id).fetch(100)}
                                      for i in user_image_models]
        models = user_models + default_models
        
        template_params.update(rocks=rocks.fetch(100),
                               scenarios=scenarios.fetch(100),
                               default_rocks=default_rocks.fetch(100),
                               rock_groups=rock_groups,
                               models=models)

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

        # Uptime robot API key for modelr.io
        #ur_api_key_modelr_io = 'm775980219-706fc15f12e5b88e4e886992'
        # Uptime Robot API key for modelr.org REL
        #ur_api_key_modelr_org = 'm775980224-e2303a724f89ef0ab886558a'
        # Uptime Robot API key for modelr.org DEV
        #ur_api_key_modelr_org = 'm776083114-e34c154f2239e7c273a04dd4'

        ur_api_key = 'u108622-bd0a3d1e36a1bf3698514173'

        # Uptime Robot IDs
        ur_modelr_io = '775980219'
        ur_modelr_org = '775980224'  # REL, usually

        # Uptime Robot URL
        ur_url = 'http://api.uptimerobot.com/getMonitors'

        params = {'apiKey': ur_api_key,
          'monitors': ur_modelr_io + '-' + ur_modelr_org,
          'customuptimeratio': '30',
          'format': 'json',
          'nojsoncallback':'1',
          'responseTimes':'1'
         }

        # A dict is easily converted to an HTTP-safe query string.
        ur_query = urllib.urlencode(params)

        # Opened URLs are file-like.
        full_url = '{0}?{1}'.format(ur_url, ur_query)
        f = urllib2.urlopen(full_url)
        raw_json = f.read()

        user = self.verify()
        models_served = ModelServedCount.all().get()

        try:
            j = json.loads(raw_json)
            
            ur_ratio = j['monitors']['monitor'][0]['customuptimeratio']
            ur_server_ratio = j['monitors']['monitor'][1]['customuptimeratio']
            ur_server_status_code = j['monitors']['monitor'][1]['status']
            ur_last_response_time = j['monitors']['monitor'][0]['responsetime'][-1]['value']
            ur_last_server_response_time = j['monitors']['monitor'][1]['responsetime'][-1]['value']
            
            ur_server_status = UR_STATUS_DICT[ur_server_status_code].upper()
            
            template_params = \
            self.get_base_params(user=user,
                                 ur_ratio=ur_ratio,
                                 ur_response_time=ur_last_response_time,
                                 ur_server_ratio=ur_server_ratio,
                                 ur_server_status=ur_server_status,
                                 ur_server_response_time=ur_last_server_response_time,
                                 models_served=models_served.count
                                 )
        except:

            template_params = \
            self.get_base_params(user=user,
                                 ur_ratio=None,
                                 ur_response_time=None,
                                 ur_server_ratio=None,
                                 ur_server_status="Unknown",
                                 ur_server_response_time=None,
                                 models_served=models_served.count
                                 )

        
        template = env.get_template('about.html')
        html = template.render(template_params)
        self.response.out.write(html)          


class FeaturesHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)
        template = env.get_template('features.html')
        html = template.render(template_params)
        self.response.out.write(html)      


class FeedbackHandler(ModelrPageRequest):
    def get(self):

        user = self.verify()
        template_params = self.get_base_params(user=user)

        # Get the list of issues from GitHub. 
        # First, set up the request.
        gh_api_key = 'token 89c9d30cddd95358b1465d1dacb1b64597b42f89'
        url = 'https://api.github.com/repos/kwinkunks/modelr_app/issues'
        params = {'labels':'wishlist', 'state':'open'}
        query = urllib.urlencode(params)
        full_url = '{0}?{1}'.format(url, query)

        # Now make the request.
        req = urllib2.Request(full_url)
        req.add_header('Authorization', gh_api_key)

        try:
            resp = urllib2.urlopen(req)
            raw_json = resp.read()
            git_data = json.loads(raw_json)
            
        except:
            err_msg = 'Failed to retrieve issues from GitHub. Please check back later.'
            git_data = {}

        else:
            err_msg = ''

            for issue in git_data:

                # Get the user's opinion.
                status = None
                if user:
                    user_issues = Issue.all().ancestor(user)
                    user_issue = user_issues.filter("issue_id =",
                                                    issue["id"]).get()
                    if user_issue:
                        status = user_issue.vote
                    else:
                        Issue(parent=user, issue_id=issue["id"]).put()
                        
                up, down = 0, 0

                if status == 1:
                    up = 'true'
                if status == -1:
                    down = 'true'

                issue.update(status=status,
                             up=up,
                             down=down)

                # Get the count. We have to read the database twice. 
                down_votes = Issue.all().ancestor(ModelrRoot).filter("issue_id =", issue["id"]).filter("vote =", -1).count()
                up_votes = Issue.all().ancestor(ModelrRoot).filter("issue_id =", issue["id"]).filter("vote =", 1).count()
                count = up_votes - down_votes


                issue.update(up_votes=up_votes,
                             down_votes=down_votes,
                             count=count)

        # Write out the results.
        template_params.update(issues=git_data,
                               error=err_msg
                               )

        template = env.get_template('feedback.html')
        html = template.render(template_params)
        self.response.out.write(html)          


    def post(self):

        # This should never happen, because voting
        # links are disabled for non-logged-in users.
        user = self.verify()
        if not user:
            print 'no user'
            return
        
        # Get the data from the ajax call.
        issue_id = int(self.request.get('id'))
        up = self.request.get('up')
        down = self.request.get('down')

        # Set our vote flag to record the user's opinion.
        if up == 'true':
            issue_status = 1
        elif down == 'true':
            issue_status = -1
        else:
            issue_status = 0


        # Put it in the database.
        issue = Issue.all().ancestor(user).filter("issue_id =",
                                                  issue_id).get()
        issue.vote = issue_status
        issue.put()

        # TODO log in the activity log

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
               
    def post(self):

        email = self.request.get('email')
        message = self.request.get('message')

        user = self.verify()
        
        try:
            send_message("User message %s" % email, message)
            template = env.get_template('message.html')
            msg = ("Thank you for your message. " + 
                   "We'll be in touch shortly.")
            html = template.render(success=msg, user=user)
            self.response.out.write(html)
            
        except:
            template = env.get_template('message.html')
            msg = ('Your message was not sent.&nbsp;&nbsp; ' +
                   '<button class="btn btn-default" '+
                   'onclick="goBack()">Go back and retry</button>')
            html = template.render(warning=msg, user=user)
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

        # Check for user cookies
        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        print user.unsubscribed
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

        # Get the user permission requests
        req = \
          GroupRequest.all().ancestor(ModelrRoot).filter("user =",
                                                         user.user_id)
        if req:
            template_params.update(requests=req)

        # Get the users adminstrative requests
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

        # Check for a user
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
            
        
class ForgotHandler(webapp2.RequestHandler):
    """
    Class for forgotten passwords
    """

    def get(self):
        template = env.get_template('forgot.html')
        html = template.render()
        self.response.out.write(html)
        
    def post(self):

        email = self.request.get('email')
        template = env.get_template('message.html')
        
        try:
            forgot_password(email, parent=ModelrRoot)
            
            msg = ("Please check your inbox and spam folder " +
                   "for our message. Then click on the link " +
                   "in the email.")
            html = template.render(success=msg)
            self.response.out.write(html)
        except AuthExcept as e:
            html = template.render(error=e.msg)
            self.response.out.write(html)

class ResetHandler(ModelrPageRequest):
    """
    Class for resetting passwords
    """

    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        current_pword = self.request.get("current_pword")
        new_password = self.request.get("new_password")
        verify = self.request.get("verify")

        template = env.get_template('profile.html')
        
        try:
            reset_password(user,current_pword,new_password,
                           verify)
            msg = ("You reset your password.")
            html = template.render(user=user,success=msg)
            self.response.out.write(html)
        except AuthExcept as e:
            html = template.render(user=user, error=e.msg)
        
class DeleteHandler(ModelrPageRequest):
    """
    Class for deleting account

    There is some placeholder code below, and 
    also see delete_account() in ModAuth.py

    Steps:
    
    1. Ask user if they are sure (Bootstrap modal in JS?)
       http://stackoverflow.com/questions/8982295/confirm-delete-modal-dialog-with-twitter-bootstrap

    2. Suspend Subscription with delete method in Stripe,
       using at_period_end=True (note, this is NOT the default)
       Docs > https://stripe.com/docs/api#cancel_subscription
    
    3. Remove them from MailChimp customer list
       Docs > http://apidocs.mailchimp.com/api/2.0/lists/unsubscribe.php
    
    4. Give them some confirmation by email?
       Some code in bogus function to do this now

    """

    def post(self):

        user = self.verify()
        if user is None:
            self.redirect('/signup')
            return

        template = env.get_template('message.html')
        
        if LOCAL:
            stripe_api_key = "sk_test_RL004upcEo38AaDKIefMGhKF"
            
        else:
            stripe_api_key = "sk_live_e1fBcKwSV6TfDrMqmCQBMWTP"
            
        try:
            cancel_subscription(user, stripe_api_key) 
            msg = "Unsubscribed from Modelr"
            html = template.render(user=user, msg=msg)
            self.response.write(html)
            
        except AuthExcept as e:
            html = template.render(user=user, error=e.msg)
            self.response.write(html)
            

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
            msg = "Password mismatch"
            html = template.render(email=email,
                                   error=msg)
            self.response.out.write(html)
            
        else:
            try:
                signup(email, password, parent=ModelrRoot)
                
                # Show the message page with "Success!"
                template = env.get_template('message.html')
                msg = ("Please check your inbox and spam folder " +
                       "for our message. Then click on the link " +
                       "in the email.")
                html = template.render(success=msg)
                self.response.out.write(html)
                
            except AuthExcept as e:
                template = env.get_template('signup.html')
                msg = e.msg
                html = template.render(email=email,
                                       error=msg)
                self.response.out.write(html)
                

class EmailAuthentication(ModelrPageRequest):
    """
    This is where billing and user account creation takes place
    """
    
    def get(self):

        user_id = self.request.get("user_id")
        
        try:
            # Change this to check the user can be validated and
            # get temp_user
            user = verify_signup(user_id, ModelrRoot)
            
        except AuthExcept as e:
            self.redirect('/signup?error=auth_failed')
            return

        if LOCAL:
            stripe_public_key = "pk_test_prdjLqGi2IsaxLrFHQM9F7X4"
        else:
            stripe_public_key = "pk_live_5CZcduRr07BZPG2A5OAhisW9"
            
        msg = "Thank you for verifying your email address."
        params = self.get_base_params(user=user,
                                      stripe_key=stripe_public_key)
        template = env.get_template('checkout.html')
        html = template.render(params, success=msg)
        self.response.out.write(html)

    def post(self):
        """
        Adds the user to the stripe customer list
        """
        email = self.request.get('stripeEmail')
        price = PRICE # set at head of this file

        if LOCAL:
            stripe.api_key = "sk_test_RL004upcEo38AaDKIefMGhKF"
            
        else:
            stripe.api_key = "sk_live_e1fBcKwSV6TfDrMqmCQBMWTP"
            

        # Secret API key for Canada Post postal lookup
        cp_prod = "3a04462597330c85:46c19862981c734ff8f7b2"
        cp_dev = "09b48e3a40e710ed:bb6f209fdecff9af3ec10d"
        cp_key = base64.b64encode(cp_prod)

        # Get the credit card details submitted by the form
        token = self.request.get('stripeToken')

        # Create the customer account
        try:
            customer = \
              stripe.Customer.create(card=token,
                                     email=email,
                                    description="New Modelr customer")

        except:
            self.response.out.write("Payment failed, credit card type not excepted")
        
        # Check the country to see if we need to charge tax
        country = self.request.get('stripeBillingAddressCountry')
        if country == "Canada":
            
            # Get postal code for canada post request
            postal_code = \
              self.request.get('stripeBillingAddressZip').replace(" ",
                                                                  "")
              
            # Hook up to the web api
            params = urllib.urlencode({"d2po": "True",
                                       "postalCode": postal_code,
                                       "maximum": 1})
            cp_url = ("https://soa-gw.canadapost.ca/rs/postoffice?%s"
                      % params)
    
            headers = {"Accept": "application/vnd.cpc.postoffice+xml",
                       "Authorization": "Basic " + cp_key}
            req = urllib2.Request(cp_url, headers=headers)
            result = urllib2.urlopen(req).read()
            xml_root = ElementTree.fromstring(result)

            # This is super hacky, but the only way I could get the
            # XML out
            province = []
            for i in xml_root.iter('{http://www.canadapost.ca/ws/'+
                                   'postoffice}province'):
                province.append(i.text)
            tax_code = province[0]
        
            tax = tax_dict.get(tax_code) * price
        
            # Add the tax to the invoice
            stripe.InvoiceItem.create(customer=customer.id,
                                      amount = int(tax),
                                      currency="usd",
                                      description="Canadian Taxes")
         
                                          
        else:
            tax_code = country
            tax = 0
            
        # Create the charge on Stripe's servers -
        # this will charge the user's card
        try:
            customer.subscriptions.create(plan="Monthly")
        except:
            # The card has been declined
            # Let the user know and DON'T UPGRADE USER
            self.response.out.write("Payment failed")
            return

        # get the temp user from the database
        try:
            initialize_user(email, customer.id, ModelrRoot,
                            tax_code, price, tax)
        except:

            send_message(subject="Registration Failed",
                         message=("Failed to register user %s to " +
                        "Modelr but was billed by Stripe. " +
                        "Customer ID: %s") %(email, customer.id))
            self.response.write("Registration failed. Charges will "
                                + "be cancelled")
            raise
        
        self.redirect('/signin?verified=true')
                        
        
class SignIn(webapp2.RequestHandler):

    def get(self):       

        status = self.request.get("verified")
        redirect = self.request.get('redirect')

        if status == "true":
            msg = ("Your account has been created and your card has "
                   "been charged. Welcome to Modelr!" )
      
        else:
            msg = None

        template = env.get_template('signin.html')
        html = template.render(success=msg, redirect=redirect)
        self.response.out.write(html)

    def post(self):

        email = self.request.get('email')
        password = self.request.get('password')
        redirect = self.request.get('redirect').encode('utf-8')

        try:
            signin(email, password, ModelrRoot)
            cookie = get_cookie_string(email)
            self.response.headers.add_header('Set-Cookie', cookie)
    
            if redirect:
                self.redirect(redirect)
            else:
                self.redirect('/')

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
        
        event = json.loads(self.request.body)

        # Get the event id and retrieve it from Stripe
        # anybody can post, doing it this way is more secure
        # event_id = event_json["id"]

        #event = stripe.Event.retrieve(event_id)

        if event["type"] == "invoice.payment_succeeded":

            # For testing, change it to a known user in stripe
            # and use the webhooks testings
            #event["data"]["object"]["customer"] = \
            # "cus_3ZL6yHJqE8DfTx"
            #event["data"]["object"]["total"] = price
            
            stripe_id = event["data"]["object"]["customer"]
            amount = price #event["data"]["object"]["total"]
            event_id = event["data"]["object"]["id"]
            user = User.all().ancestor(ModelrRoot)
            user = user.filter("stripe_id =", stripe_id).fetch(1)

            # Serious issue here, we need to deal with this in a
            # a clever way
            if not user:
                message = ("Failed to find modelr user for stripe " +
                           "user %s, but was invoiced by stripe " +
                           "event %s" % (stripe_id,event_id))
                send_message(subject="Non-existent user invoiced",
                             message=message)
                
                self.response.write("ALL OK")
                return
            
            tax = tax_dict.get(user[0].tax_code, None)
            if not tax:
                self.response.write("ALL OK")
                return

            # Tax them up
            stripe.InvoiceItem.create(customer=stripe_id,
                                      amount = int(amount * tax),
                                      currency="usd",
                                      description="Canadian Taxes")

            self.response.write("ALL OK")

        # 
        elif (event["type"] == 'customer.subscription.deleted'):

            # for stripe
            self.response.write("ALL OK")
            
            stripe_id = event["data"]["object"]["customer"]

            user = User.all().ancestor(ModelrRoot)
            user = user.filter("stripe_id =", stripe_id).get()

            # This should never ever happen
            if not user:
                message = ("Failed to find modelr user for stripe " +
                           "user %s, but was invoiced by stripe " +
                           "event %s" % (stripe_id,event_id))
                send_message(subject="Non-existent user canceled",
                             message=message)

                return
            
            user.delete()
            self.response.write("ALL OK")
            
        # Send an email otherwise. We can trim this down to ones we
        # actually care about.
        else:
            # Too many hooks, too much noise. commented out
            #message = str(event)
            #send_message(subject=event["type"],
            #             message=message)
            self.response.write("ALL OK")

        

class ManageGroup(ModelrPageRequest):
    """
    Manages and administrates group permissions
    """

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
    
class Upload(blobstore_handlers.BlobstoreUploadHandler,
             ModelrPageRequest):
    """
    Handles uploads from users. Allows them to upload images to
    the blobstore
    """


    def closest(self,x,y, pixels):

            if pixels[x,y] in self.best_colours:
                return pixels[x,y]
            if (x == 0): self.x_iterate = 1
            if (y == 0): self.y_iterate = 1
            if (y == (pixels.shape[-1]-1)): self.y_iterate = -1
            if (x == (pixels.shape[0]-1)):
                print "WTF"
                self.x_iterate = -1
            
            return self.closest(x + self.x_iterate, y +
                                self.y_iterate,
                                pixels)
    def posterize(self,image):

        self.x_iterate = -1
        self.y_iterate = -1
        # make a greyscaled version for histograms
        g_im = image.convert('P', palette=Image.ADAPTIVE)
        # Get as a numpy array
        pixels = np.array(g_im)

        count, colours = np.histogram(pixels,
                                      pixels.max()-pixels.min() + 1)

        colours = np.array(colours, dtype=int)
        colours = colours[1:]
        
        # Take only colors that make up 1% of the image
        self.best_colours = colours[count > (.01 * pixels.size)]

        if self.best_colours.size < 2:
            return g_im.convert('P',
                                palette=Image.ADAPTIVE,
                                colors=15)
        
        # find pixels that need adjusting
        fix_index = np.zeros(pixels.shape, dtype=bool)
        for colour in self.best_colours:
            fix_index = np.logical_or(pixels==colour, fix_index)


        fix_index = np.array((np.where(fix_index == False)))

        
        
        for x,y in zip(fix_index[0], fix_index[1]):
                
            pixels[x,y] = self.closest(x,y, pixels)
    
        
        g_im.paste(Image.fromarray(pixels))

        n_colours = self.best_colours.size
        if n_colours > 15: n_colours =15
        return g_im.convert('P',
                            palette=Image.ADAPTIVE,
                            colors=n_colours)
    
    def post(self):

        # Only registered users can do this
        user = ModelrPageRequest.verify(self)
        if user is None:
            self.redirect('/signup')
            return

        # Get the blob files
        upload_files = self.get_uploads()

        blob_info = upload_files[0]

        # All this is in a try incase the image format isn't accepted

        try:
            # Read the image file
            reader = blobstore.BlobReader(blob_info.key())

            im = Image.open(reader, 'r')
            im = im.convert('RGB').resize((480,480))

            im = self.posterize(im)
            
            output = StringIO.StringIO()
            im.save(output, format='PNG')
            
            bucket = '/modelr_bucket/'
            output_filename = (bucket + str(user.user_id) +'/2' +
                               str(time.time()))
        
            gcsfile = gcs.open(output_filename, 'w')
            gcsfile.write(output.getvalue())

            output.close()
            gcsfile.close()

            # Make a blob reference
            bs_file = '/gs' + output_filename
            output_blob_key = blobstore.create_gs_key(bs_file)
        
            ImageModel(parent=user,
                       user=user.user_id,
                       image=output_blob_key).put()
            self.redirect('/section_model')

        except Exception as e:
            print "ERRRRRRRRR", e
            self.redirect('/section_model?error=True')
        

class ModelBuilder(ModelrPageRequest):

    def get(self):
        
        user = ModelrPageRequest.verify(self)
        if user is None:
            self.redirect('/signup')
            return
    
        params = self.get_base_params(user=user)
        template = env.get_template('model_builder.html')
        html = template.render(params)
        self.response.out.write(html)
        

    def post(self):

        user = ModelrPageRequest.verify(self)
        if user is None:
            self.redirect('/signup')
            return

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')
        
        bucket = '/modelr_bucket/'
        filename = bucket + str(user.user_id) +'/' + str(time.time())

        encoded_image = self.request.get('image').split(',')[1]
        pic = base64.b64decode(encoded_image)
        
        gcsfile = gcs.open(filename, 'w')
        gcsfile.write(pic)

        gcsfile.close()

        bs_file = '/gs' + filename

        blob_key = blobstore.create_gs_key(bs_file)

        ImageModel(parent=user,
                   user=user.user_id, image=blob_key).put()
        # TODO Logging


class ModelHandler(ModelrPageRequest):

    def get(self):
        user = ModelrPageRequest.verify(self)
        if user is None:
            self.redirect('/signup')
            return

        # Make the upload url
        upload_url = blobstore.create_upload_url('/upload')
        
        # Get the model images
        models = \
          ImageModel.all().ancestor(user).\
          order("-date").fetch(100)

        # Get the default models
        default_models = \
          ImageModel.all().ancestor(admin_user).fetch(100)

        # Create the serving urls
        imgs = [images.get_serving_url(i.image, size=1400,
                                       crop=False)
                for i in (models + default_models)]

        keys = [str(i.key()) for i in (models + default_models)]

        # Read in each image to get the RGB colours
        readers = [blobstore.BlobReader(i.image.key())
                   for i in (models + default_models)]
        colors = [[RGBToString(j[1])
                   for j in Image.open(i).convert('RGB').getcolors()]
                  for i in readers]

        # Grab the rocks
        rocks = Rock.all()
        rocks.ancestor(user)
        rocks.filter("user =", user.user_id)
        rocks.order("-date")

        default_rocks = Rock.all()
        default_rocks.filter("user =", admin_id)
        params = self.get_base_params(user=user,
                                      images=imgs,
                                      colors=colors,
                                      keys = keys,
                                      rocks=rocks.fetch(100),
                            default_rocks=default_rocks.fetch(100),
                                      upload_url=upload_url)

        # Check if there was an upload error (see Upload handler)
        if self.request.get("error"):
            params.update(error="Invalid image file")
        
        template = env.get_template('model.html')
        html = template.render(params)
        self.response.out.write(html)


class ImageModelHandler(ModelrPageRequest):

    def get(self):

        user = self.verify()
        if not user:
            self.redirect('/signup')
            return
        
        models = ImageModel.all().ancestor(user).fetch(1000)
    
    def delete(self):

        user = self.verify()
        if not user:
            self.redirect('/signup')
            return

        image_key = self.request.get("image_key")

        print image_key
        image = ImageModel.get(image_key)

        image.delete()

        
class EarthModelHandler(ModelrPageRequest):

    def get(self):

        user = self.verify()
        if not user:
            self.redirect('/signup')
            return

        try:
            # Get the root of the model
            input_model_key = self.request.get('image_key')
            input_model = ImageModel.get(str(input_model_key))

            name = self.request.get('name')

            # If the name is provided, return the model, otherwise
            # return a list of the earth model names associated
            # with the model.
            if name:

                earth_model = EarthModel.all().ancestor(input_model)

                # Check first for a user model with the right name
                earth_model = earth_model.filter("user =",
                                                 user.user_id)
                
                earth_model = earth_model.filter("name =",
                                                 name)

                earth_model = earth_model.get()

                if not earth_model:
                    # Check in the defaults
                    earth_model = \
                      EarthModel.all().ancestor(input_model)

                    earth_model = earth_model.filter("user =",
                                                       admin_id)
                    earth_model = earth_model.filter("name =",
                                                       name).get()

                self.response.out.write(earth_model.data)

            else:

                
                earth_models = EarthModel.all().ancestor(input_model)

                def_models = EarthModel.all().ancestor(input_model)
                
                earth_models = earth_models.filter("user =",
                                                  user.user_id)
                def_models = def_models.filter("user =",
                                                 admin_id)
                earth_models.order('-date')
                def_models.order('-date')
                
                earth_models = (earth_models.fetch(100) +
                                def_models.fetch(100))

                output = json.dumps([em.name for em in earth_models])
                self.response.out.write(output)
            
        except Exception as e:
            print e
            self.response.out.write(json.dumps({'failed':True}))

    def post(self):

        user = self.verify()
        if not user:
            return

        try:
            # Get the root of the model
            input_model_key = self.request.get('image_key')
            image_model = ImageModel.get(input_model_key)

            
            name = self.request.get('name')

            # Get the rest of data
            data = self.request.get('json')

            # See if we are overwriting
            earth_model = EarthModel.all().ancestor(image_model)
            earth_model = earth_model.filter('user =', user.user_id)
            earth_model = earth_model.filter('name =', name).get()

            if earth_model:
                earth_model.data = data.encode()
            else:
                earth_model = EarthModel(user=user.user_id,
                                         data=data.encode(),
                                         name=name,
                                         parent=image_model)
            earth_model.put()
        
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')

        except Exception as e:
            # TODO Handle failure
            pass

    def delete(self):

        user = self.verify()
        if not user:
            self.redirect('/signup')

        try:
            # Get the root of the model
            input_model_key = self.request.get('input_image_id')

            name = self.request.get('name')

            image_model = ImageModel.get(input_model_key)

            
            model = EarthModel.all().ancestor(image_model)
            
            model = model.filter("user =", user.user_id)
            model = model.filter("name =", name).get()

            if model:
                model.delete()
                
            self.response.out.write(json.dumps({'success':True}))
        except Exception as e:
            print e
            self.response.out.write(json.dumps({'success':False}))
        

class Forward2DModelHandler(ModelrPageRequest):

    def get(self):
        user = self.verify()
        if not user:
            self.redirect("/signup")

        model_name = self.request.get("name")
            
        # TODO Handle failure

        model = \
          Forward2DModel.all().ancestor(user).filter("name =",
                                                     model_name).get()
        if model is None:
        # TODO
            pass
        key = model.input_model_key
        data = {"input_image_key": str(key),
                "output_image": images.get_serving_url(model.output_image),
                "data": model.data}
        
        self.response.write(json.dumps(data))

        if user:
            ActivityLog(user_id=user.user_id,
                        activity='fetched_forward_model',
                        parent=ModelrRoot).put()
        return

    
class NotFoundPageHandler(ModelrPageRequest):
    def get(self):
        self.error(404)        
        template = env.get_template('404.html')
        html = template.render()
        self.response.out.write(html)


class ModelServed(ModelrPageRequest):

    def post(self):

        models_served.count += 1
        models_served.put()

class AdminHandler(ModelrPageRequest):

    def get(self):
        user = self.verify()

        if not user:
            self.redirect('/')
            
        if not "admin" in user.group:
            self.redirect('/')

        template = env.get_template('admin_site.html')
        html = template.render(user=user)
        self.response.out.write(html)
        
    def post(self):

        user = self.verify()
        
        if not user:
            self.redirect('/')

        if not "admin" in user.group:
            self.redirect('/')
            
        email = self.request.get('email')
        password = self.request.get('password')
        verify = self.request.get('verify')

        if password != verify:
            template = env.get_template('admin_site.html')
            msg = "Password mismatch"
            html = template.render(email=email,
                                   error=msg)
            self.response.out.write(html)
            
        else:
            try:
                new_user = make_user(email=email, password=password,
                                 parent=ModelrRoot)
                template = env.get_template('admin_site.html')
                html = template.render(success="Added User",
                                       email=email, user=user)
                self.response.out.write(html)
                
            except AuthExcept as e:
                template = env.get_template('admin_site.html')
                html = template.render(error=e.msg, user=user,
                                       email=email)
                self.response.out.write(html)


class ServerError(ModelrPageRequest):

    def post(self):

        send_message("Server Down","Scripts did not populate")
    
        
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
                               ('/features', FeaturesHandler),
                               ('/feedback', FeedbackHandler),
                               ('/help', HelpHandler),
                               ('/terms', TermsHandler),
                               ('/privacy', PrivacyHandler),
                               ('/signup', SignUp),
                               ('/verify_email', EmailAuthentication),
                               ('/signin', SignIn),
                               ('/manage_group', ManageGroup),
                               ('/upload', Upload),
                               ('/model_builder', ModelBuilder),
                               ('/model', ModelHandler),
                               ('/image_model', ImageModelHandler),
                               ('/earth_model', EarthModelHandler),
                               ('/forgot', ForgotHandler),
                               ('/reset', ResetHandler),
                               ('/delete', DeleteHandler),
                               ('/signout', SignOut),
                               ('/stripe', StripeHandler),
                               ('/manage_group', ManageGroup),
                               ('/model_served', ModelServed),
                               ('/admin_site', AdminHandler),
                               ('/server_error', ServerError),
                               ('/.*', NotFoundPageHandler)
                               ],
                              debug=False)



def main():

    logging.getLogger().setLevel(logging.DEBUG)
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
