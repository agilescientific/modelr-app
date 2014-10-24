#!/usr/bin/env python
# -*- coding: utf-8 -*-
# modelr web app
# Agile Geoscience
# 2012-2014
#

from google.appengine.ext import webapp as webapp2
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import users

# For image serving
import cloudstorage as gcs

import urllib
import urllib2

import os

import hashlib
import logging

import stripe

import re

from page_handlers import *
from web_api import *

from lib_auth import AuthExcept, get_cookie_string, signup, signin, \
     verify, authenticate, verify_signup, initialize_user,\
     reset_password, \
     forgot_password, send_message, make_user, cancel_subscription
     
from lib_db import Rock, Scenario, User, ModelrParent, Group, \
     GroupRequest, ActivityLog, VerifyUser, ModelServedCount,\
     ImageModel, Forward2DModel, Issue, EarthModel, Server


from constants import admin_id, env, LOCAL, stripe_api_key

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

# Ancestor dB for all of modelr. Allows for strongly consistent
# database queries. (all entities update together, so every page is
# is sync)
ModelrRoot = ModelrParent.all().get()
if ModelrRoot is None:
    ModelrRoot = ModelrParent()
    ModelrRoot.put()
    
# For the plot server
server = Server.all().ancestor(ModelrRoot).get()
if server is None:
    server = Server(parent=ModelrRoot)

if LOCAL is True:
    server.host =  "http://127.0.0.1:8081"
    logging.debug("[*] Debug info activated")
    stripe.verify_ssl_certs = False
else:
    server.host = "https://www.modelr.org"
server.put()

stripe.api_key = stripe_api_key

#=====================================================================
# Define Global Variables
#=====================================================================




# Initialize the model served counter
models_served = ModelServedCount.all().ancestor(ModelrRoot).get()
if models_served is None:
    models_served = ModelServedCount(count=0, parent=ModelrRoot)
    models_served.put()
    
# Put in the default rock database under the admin account.
# The admin account is set up so every user can view our default
# scenarios and rocks

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



#====================================================================
# Global Variables
#====================================================================
# Secret API key from Stripe dashboard




        

app = webapp2.WSGIApplication([('/', MainHandler),
                               ('/dashboard', DashboardHandler),
                               ('/rock', RockHandler),
                               ('/scenario', ScenarioPageHandler),
                               ('/scenario_db',ScenarioHandler),
                               ('/pricing', PricingHandler),
                               ('/profile', ProfileHandler),
                               ('/settings', SettingsHandler),
                               ('/about', AboutHandler),
                               ('/features', FeaturesHandler),
                               ('/feedback', FeedbackHandler),
                               ('/help/?([-\w]+)?', HelpHandler),
                               ('/terms', TermsHandler),
                               ('/privacy', PrivacyHandler),
                               ('/signup', SignUp),
                               ('/verify_email', EmailAuthentication),
                               ('/signin', SignIn),
                               ('/manage_group', ManageGroup),
                               ('/upload', Upload),
                               ('/model_builder', ModelBuilder),
                               ('/fluid_builder', FluidModelBuilder),
                               ('/model', ModelHandler),
                               ('/image_model', ImageModelHandler),
                               ('/earth_model', EarthModelHandler),
                               ('/fluid_model', FluidModelHandler),
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
