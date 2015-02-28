"""
Handler classes that deal with data, and not webpages. These
functions can be called as web apis
"""


from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext import blobstore
from google.appengine.ext import webapp as webapp2
from google.appengine.ext import db

# For image serving
import cloudstorage as gcs

from PIL import Image
import numpy as np

import time

import logging

import stripe

import json
import base64
import StringIO

from constants import admin_id, LOCAL, PRICE, UR_STATUS_DICT, \
     tax_dict

from lib_auth import AuthExcept, get_cookie_string, signup, signin, \
     verify, authenticate, verify_signup, initialize_user,\
     reset_password, \
     forgot_password, send_message, make_user, cancel_subscription
     
from lib_db import Rock, Scenario, User, ModelrParent, Group, \
     GroupRequest, ActivityLog, VerifyUser, ModelServedCount,\
     ImageModel, Issue, EarthModel, Server, Fluid

from lib_util import posterize, depth2time, akirichards, ricker

from fluidsub import smith_fluidsub

class ModelrAPI(webapp2.RequestHandler):
    """
    Base class for modelr apis. Mostly a skeleton right now
    """

    def verify(self):
        """
        Verify that the current user is a legimate user. Returns the
        user object from the database if true, otherwise returns None.

        TODO: This shouldn't be done with browser cookies
        """

        cookie = self.request.cookies.get('user')
        if cookie is None:
            return

        try:
            user, password = cookie.split('|')
        except ValueError:
            return
        
        return verify(user, password, ModelrParent.all().get())

class ScenarioHandler(ModelrAPI):
    
    def get(self):

        # Get the user but don't redirect. Any can play with public
        # scenarios.
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
        scen = Scenario.all().ancestor(ModelrParent.all().get()).filter("user_id =",
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
                        parent=ModelrParent.all().get()).put()
        return 

    @authenticate
    def delete(self, user):

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
                    parent=ModelrParent.all().get()).put()

        # Output for successful post reception
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')
        

    @authenticate
    def post(self, user):
        
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
                    parent=ModelrParent.all().get()).put()


       
class RockHandler(ModelrAPI):


    def get(self):
        """
        Get the requested rock from the user's database
        """

        name = self.request.get('name')
        key = self.request.get('key')

        user = self.verify()

        ModelrRoot = ModelrParent.all().get()
        admin_user = User.all().ancestor(ModelrRoot).filter("user_id =",
                                       admin_id).get()
        
        if(name):

            rock = Rock.all().filter("name =", name).get()
            if(user):
                u_rock = Rock.all().ancestor(user).filter("name =",
                                                        name).get()
                if(u_rock): rock = u_rock
            
          
            data = rock.json
        elif(key):
            rock = Rock.get_by_id(int(key), parent=admin_user)
            
            u_rock = Rock.get_by_id(int(key), parent=user)
            if(u_rock): rock = u_rock
            data = rock.json
        else:
            raise Exception
        
        self.response.out.write(data)
        

    @authenticate
    def delete(self, user):


        selected_rock = Rock.all()
        selected_rock.ancestor(user)
        selected_rock.filter("user =", user.user_id)
        selected_rock.filter("name =",
                             self.request.get('name'))

        activity = "removed_rock"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrParent.all().get()).put()

        # Delete the rock if it exists
        try:
            rock = selected_rock.fetch(1)[0]
            rock.delete()
        except:
            pass 

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')
            
    @authenticate
    def post(self, user):
        # Adds a rock to the database, will throw an error
        # if the rock name already exists
        
        try:
            
            name = self.request.get("name")
        
            rocks = Rock.all()
            rocks.ancestor(user)
            rocks.filter("user =", user.user_id)
            rocks.filter("name =", name)
            rocks = rocks.fetch(1)

            # Rewrite if the rock exists
            if rocks:
                # write out error message
                raise
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

            rock.porosity = float(self.request.get('porosity'))
            rock.vclay = float(self.request.get('vclay'))

            rock.description = self.request.get('description')
            rock.name = self.request.get('name')
            rock.group = self.request.get('group')

            try:
                fluid_id = self.request.get("rock-fluid")
        
                fluid = Fluid.get_by_id(int(fluid_id),
                                        parent=user)
                rock.fluid_key = fluid.key()
            except Exception as e:
                print e

            # Save in the database
            rock.put()

            activity = "added_rock"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrParent.all().get()).put()
        except Exception as e:
            # send error
            print e
        
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!') 

    @authenticate
    def put(self, user):
        # Updates a rock database object

        # Get the database key from the request
        try:

            key = self.request.get("db_key")

            rock = Rock.get_by_id(int(key), parent=user)
        
            # Update the rock
            rock.vp = float(self.request.get('vp'))
            rock.vs = float(self.request.get('vs'))
            rock.rho = float(self.request.get('rho'))

            rock.vp_std = float(self.request.get('vp_std'))
            rock.vs_std = float(self.request.get('vs_std'))
            rock.rho_std = float(self.request.get('rho_std'))

            rock.porosity = float(self.request.get('porosity'))
            rock.vclay = float(self.request.get('vclay'))
            
            rock.description = self.request.get('description')
            rock.name = self.request.get('name')
            rock.group = self.request.get('group')
         
            try:
                fluid_id = self.request.get("rock-fluid")
                fluid = Fluid.get_by_id(int(fluid_id),
                                        parent=user).key()
                rock.fluid_key = fluid
            except:
                pass
            
            rock.name = self.request.get('name')
         
            rock.put()

            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')
        except Exception as e:
            # Write out error message
            print e
            pass 
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!') 
        return

        
class StripeHandler(ModelrAPI):
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
            amount = PRICE 
            event_id = event["data"]["object"]["id"]
            user = User.all().ancestor(ModelrParent.all().get())
            user = user.filter("stripe_id =", stripe_id).fetch(1)

            # Serious issue here, we need to deal with this in a
            # a clever way
            if not user:
                message = ("Failed to find modelr user for stripe " +
                           "user %s, but was invoiced by stripe "
                            % (stripe_id))
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

    
        elif (event["type"] == 'customer.subscription.deleted'):

            # for stripe
            self.response.write("ALL OK")
            
            stripe_id = event["data"]["object"]["customer"]

            user = User.all().ancestor(ModelrParent.all().get())
            user = user.filter("stripe_id =", stripe_id).get()

            # This should never ever happen
            if not user:
                message = ("Failed to find modelr user for stripe " +
                           "user %s, but was invoiced by stripe " 
                            % (stripe_id))
                send_message(subject="Non-existent user canceled",
                             message=message)

                return
            
            user.delete()
            self.response.write("ALL OK")


        elif (event["type"] == 'customer.subscription.created'):

            message = str(event)
            send_message(subject=event["type"],
                         message=message)
            self.response.write("All OK")
            
        # Send an email otherwise. We can trim this down to ones we
        # actually care about.
        else:
            # Too many hooks, too much noise. commented out
            #message = str(event)
            #send_message(subject=event["type"],
            #             message=message)
            self.response.write("ALL OK")

        

    
class Upload(blobstore_handlers.BlobstoreUploadHandler,
             ModelrAPI):
    """
    Handles image uploads from users. Allows them to upload images to
    the blobstore
    """

    @authenticate
    def post(self, user):

        # Get the blob files
        upload_files = self.get_uploads()

        blob_info = upload_files[0]

        # All this is in a try incase the image format isn't accepted
        try:
            # Read the image file
            reader = blobstore.BlobReader(blob_info.key())

            im = Image.open(reader, 'r')
            im = im.convert('RGB').resize((350,350))

            im = posterize(im)
            
            output = StringIO.StringIO()
            im.save(output, format='PNG')
            
            bucket = '/modelr_live_bucket/'
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
            
            self.redirect('/model')

        except Exception as e:
            print e
            self.redirect('/model?error=True')
        



class ModelData1DHandler(ModelrAPI):

    @authenticate
    def get(self, user):


        admin_user = User.all()\
                         .filter("user_id =", admin_id).get()
                         
        dt = 0.004
        dz = 1

        rock_data = json.loads(self.request.get('rock_data'))
  
        # all the workings for fluid sub
        
        min_depth = rock_data[0]["depth"]
        max_depth = rock_data[-1]["depth"] + \
          rock_data[-1]["thickness"]

        # Get the well log properties for the rock
        z = np.arange(min_depth, max_depth, dz)
        vp = np.zeros(z.size)
        vs = np.zeros(z.size)
        rho = np.zeros(z.size)
        phi = np.zeros(z.size)
        vclay = np.zeros(z.size)
        kclay = np.zeros(z.size)
        kqtz  = np.zeros(z.size)

        # Initial fluid properties
        sw0 = np.zeros(z.size)
        rhow0 = np.zeros(z.size)
        rhohc0 = np.zeros(z.size)
        kw0 = np.zeros(z.size)
        khc0 = np.zeros(z.size)

        # New fluid properties
        swnew = np.zeros(z.size)
        rhownew = np.zeros(z.size)
        rhohcnew = np.zeros(z.size)
        kwnew = np.zeros(z.size)
        khcnew = np.zeros(z.size)
        
        # Seismic properties
        offset = float(self.request.get("offset"))
        frequency = float(self.request.get("frequency"))
        
        # Loop through each rock layer
        end_index = 0
        for layer in rock_data:

            # A little messy, we should abstract this query at
            # some point
            rock = Rock.get_by_id(int(layer["rock"]["db_key"]),
                                  parent=user)
            if not rock:
                rock = Rock.get_by_id(int(layer["rock"]["db_key"]),
                                      parent=admin_user)
            if not rock:
                rock = Rock.all().filter("name =",
                                         layer["rock"]["name"]).get()
                if (not rock) or not (rock.group in user.group):
                    raise Exception
            
            start_index = end_index
            end_index = start_index + np.ceil(layer["thickness"]/dz)
            if end_index > rho.size:
                end_index = rho.size
            

            vp[start_index:end_index] = rock.vp + \
              np.random.randn(end_index-start_index)*rock.vp_std
            vs[start_index:end_index] = rock.vs + \
              np.random.randn(end_index-start_index)*rock.vs_std
            rho[start_index:end_index] = rock.rho + \
              np.random.randn(end_index-start_index)*rock.rho_std
            phi[start_index:end_index] = rock.porosity
            vclay[start_index:end_index] = rock.vclay
            kqtz[start_index:end_index] = rock.kqtz
            kclay[start_index:end_index] = rock.kclay

            # Set the initial fluid
            try:
                rock_fluid = rock.fluid_key
            
                sw0[start_index:end_index] = rock_fluid.sw
                rhow0[start_index:end_index] = rock_fluid.rho_w
                rhohc0[start_index:end_index] = rock_fluid.rho_hc
                kw0[start_index:end_index] = rock_fluid.kw
                khc0[start_index:end_index] = rock_fluid.khc
            except:
                sw0[start_index:end_index] = 1
                rhow0[start_index:end_index] = 1
                rhohc0[start_index:end_index] = 1
                kw0[start_index:end_index] = 1
                khc0[start_index:end_index] = 1
                swnew[start_index:end_index] = 1
                rhownew[start_index:end_index] = 1
                rhohcnew[start_index:end_index] = 1
                kwnew[start_index:end_index] = 1
                khcnew[start_index:end_index] = 1

            fluid_end = start_index
            for subfluid in layer['subfluids']:

                fluid_start = fluid_end

                fluid_end = fluid_start + \
                  np.ceil(subfluid["thickness"]/dz)

                fluid = subfluid["fluid"]
                
                swnew[fluid_start:fluid_end] = fluid["sw"]
                rhownew[fluid_start:fluid_end] = fluid["rho_w"]
                rhohcnew[fluid_start:fluid_end] = fluid["rho_hc"]
                kwnew[fluid_start:fluid_end] = fluid["k_w"]
                khcnew[fluid_start:fluid_end] = fluid["k_hc"]
            


   
        
        vp_sub,vs_sub,rho_sub = smith_fluidsub(vp, vs, rho, phi,
                                               rhow0,rhohc0,
                                               sw0, swnew, kw0,
                                               khc0, kclay,
                                               kqtz, vclay,
                                               rhownew, rhohcnew,
                                               kwnew, khcnew)

        vp, vs, rho,sw0, t = depth2time(z, vp, vs, rho,sw0,dt)
        vp_sub, vs_sub, rho_sub, sw_sub, t = \
          depth2time(z, vp_sub, vs_sub, rho_sub,swnew,dt)
          

    
        scale = int(self.request.get("height")) * t / np.amax(t)

        offset = 30
        ref = np.nan_to_num(akirichards(vp[0:-1], vs[0:-1], rho[0:-1],
                                        vp[1:], vs[1:], rho[1:],
                                        offset))
        ref_sub = np.nan_to_num(akirichards(vp_sub[0:-1],
                                            vs_sub[0:-1],
                                            rho_sub[0:-1],vp_sub[1:],
                                            vs_sub[1:],
                                            rho_sub[1:],offset))

        wavelet = ricker(0.1, dt, frequency)

        synth = np.convolve(ref,wavelet, mode="same")
        synth_sub = np.convolve(ref_sub,wavelet, mode="same")
        
        output = {"vp": tuple(vp), "vs": tuple(vs),
                  "rho": tuple(rho), "t": tuple(t),
                  "sw": tuple(sw0),
                  "scale": tuple(scale),
                  "vp_sub": tuple(vp_sub),
                  "vs_sub": tuple(vs_sub),
                  "rho_sub": tuple(rho_sub),
                  "reflectivity": tuple(ref),
                  "reflectivity_sub": tuple(ref_sub),
                  "sw_sub": tuple(sw_sub),
                  "synthetic": tuple(synth),
                  "synthetic_sub": tuple(synth_sub)}

        self.response.write(json.dumps(output))
        

class ImageModelHandler(ModelrAPI):

    @authenticate
    def get(self, user):
        
        models = ImageModel.all().ancestor(user).fetch(1000)

    @authenticate
    def delete(self, user):

        image_key = self.request.get("image_key")

        image = ImageModel.get(image_key)
        for i in db.Query().ancestor(image).fetch(1000):
            i.delete()
        
        image.delete()


class FluidHandler(ModelrAPI):

    @authenticate
    def get(self, user):

        ModelrRoot = ModelrParent.all().get()
        admin_user = User.all().ancestor(ModelrRoot).filter("user_id =",
                                       admin_id).get()

        key = self.request.get('key')
              
        fluid = Fluid.get_by_id(int(key), parent=admin_user)
            
        u_fluid = Fluid.get_by_id(int(key), parent=user)
        if(u_fluid): fluid = u_fluid

        data = fluid.json

        self.response.out.write(data)
        
    @authenticate
    def post(self, user):

        try:
            name = self.request.get("name")

            fluids = Fluid.all()
            fluids.ancestor(user)
            fluids.filter("user =", user.user_id)
            fluids.filter("name =", name)
            fluids = fluids.fetch(1)

            # Rewrite if the rock exists
            if fluids:
                # write out error message
                return
            else:
                fluid = Fluid(parent=user)
                fluid.user = user.user_id

            fluid.rho_w = float(self.request.get('rho_w'))
            fluid.rho_hc = float(self.request.get('rho_hc'))

            fluid.kw = float(self.request.get('kw'))
            fluid.khc = float(self.request.get('khc'))

            fluid.sw = float(self.request.get('sw'))
            
            fluid.name = name
            fluid.description = self.request.get("description")
            fluid.group = self.request.get("group")
            fluid.put()
            
            activity = "added_fluid"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrParent.all().get()).put()

        except Exception as e:
            # Handle error
            print e
            self.error(500)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')

    @authenticate
    def put(self, user):

          # Get the database key from the request
        try:

            key = self.request.get("db_key")

            fluid = Fluid.get_by_id(int(key), parent=user)
        
            # Update the fluid
            fluid.rho_w = float(self.request.get('rho_w'))
            fluid.rho_hc = float(self.request.get('rho_hc'))

            fluid.kw = float(self.request.get('kw'))
            fluid.khc = float(self.request.get('khc'))

            fluid.sw = float(self.request.get('sw'))
          
            fluid.description = self.request.get('description')
            fluid.name = self.request.get('name')
            fluid.group = self.request.get('group')

            fluid.name = self.request.get('name')
         
            fluid.put()

            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')
            
        except Exception as e:
            # Write out error message
            print e
            pass 
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!') 
        return

    @authenticate
    def delete(self,user):
      
        key = int(self.request.get("key"))
        selected_fluid = Fluid.get_by_id(key, parent=user)

        try:
            selected_fluid.delete()
        except:
            pass
        
        activity = "removed_fluid"
        ActivityLog(user_id=user.user_id,
                    activity=activity,
                    parent=ModelrParent.all().get()).put()


        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')
        
class EarthModelHandler(ModelrAPI):

    
    def get(self):


        user = self.verify()
        
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

                if user:
                # Check first for a user model with the right name
                    earth_model = earth_model.filter("user =",
                                                     user.user_id)
                    earth_model = earth_model.filter("name =",
                                                 name)

                    earth_model = earth_model.get()
                else:
                    earth_model = None


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

    @authenticate
    def post(self, user):

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

    @authenticate
    def delete(self, user):

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

    
class ModelServed(ModelrAPI):

    def post(self):

        models_served = ModelServedCount.all().get()
        models_served.count += models_served.put()
