"""
Handler classes that deal with data, and not webpages. These
functions can be called as web apis
"""


from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext import blobstore
from google.appengine.ext import webapp as webapp2

from google.appengine.api import images

# For image serving
import cloudstorage as gcs

from PIL import Image

import time

import logging

import stripe

import json
import StringIO

from constants import admin_id, PRICE, tax_dict

from lib_auth import verify, authenticate, send_message

from lib_db import Rock, Scenario, User, ModelrParent,\
    ActivityLog, ModelServedCount,\
    ImageModel, EarthModel, Fluid, Item, Server, \
    get_items_by_name_and_user, get_all_items_user, deep_delete,\
    get_by_id

from lib_util import posterize, RGBToString


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


class dbAPI(ModelrAPI):

    entity = Item

    def get(self):
        """
        Get the requested item(s) from the user's database
        """

        self.response.headers['Content-Type'] = 'application/json'
        user = self.verify()

        if ("keys" in self.request.arguments()):
            keys = self.request.get("keys")
            items = self.entity.get(keys)
            if type(items) is list:
                output = json.dumps([item.json
                                     for item in items])
            else:
                output = json.dumps(items.json)

        elif ("all" in self.request.arguments()):
            output = json.dumps([item.json
                                 for item in
                                 get_all_items_user(self.entity, user)])
       
        elif ("ls" in self.request.arguments()):
            output = json.dumps([item.simple_json
                                 for item in get_all_items_user(self.entity,
                                                                user)])

        elif ("name" in self.request.arguments()):
            name = self.request.get("name")
            item = get_items_by_name_and_user(self.entity, name, user)
            output = json.dumps(item[0].json)

        elif ("id" in self.request.arguments()):
            item_id = int(self.request.get("id"))
            item = get_by_id(self.entity, item_id, user)
            output = json.dumps(item.json)
        else:
            self.error(502)
            
        self.response.out.write(output)

    @authenticate
    def delete(self, user):

        try:

            key = self.request.get('key')

            item = self.entity.get(key)

            if item.user != user.user_id:
                raise Exception

            # delete item and all its children
            deep_delete(item)
            
            activity = "removed_item"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrParent.all().get()).put()
            
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')
        
        except Exception as e:
            print e
            self.error(502)


class ScenarioHandler(ModelrAPI):
    """
    API to the scenario database
    """
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        # Get the user but don't redirect. Anyone can play with public
        # scenarios.
        user = self.verify()
        name = self.request.get('name')

        if user:
            scenarios = Scenario.all()
            scenarios.ancestor(user)
            scenarios.filter("user =", user.user_id)
            scenarios.filter("name =", name)
            scenarios = scenarios.fetch(1)
        else:
            scenarios = []

        # Get Evan's default scenarios (created with the admin)
        scen = Scenario.all()\
                       .ancestor(ModelrParent.all().get())\
                       .filter("user_id =", admin_id)
        scen = Scenario.all().filter("name =", name).fetch(100)
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


class RockHandler(dbAPI):

    entity = Rock

    @authenticate
    def post(self, user):
        # Adds a rock to the database, will throw an error
        # if the rock name already exists
        try:
            name = self.request.get("name")
            rocks = get_items_by_name_and_user(self.entity, name, user)

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

            fluid_key = self.request.get("rock-fluid")

            if fluid_key != "None":
                rock.fluid_key = Fluid.get(str(fluid_key)).key()

            # Save in the database
            rock.put()

            activity = "added_rock"
            ActivityLog(user_id=user.user_id,
                        activity=activity,
                        parent=ModelrParent.all().get()).put()
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')

        except Exception as e:
            # send error
            print e
            self.error(502)

    @authenticate
    def put(self, user):
        # Updates a rock database object

        # Get the database key from the request
        try:

            key = self.request.get("db_key")

            rock = Rock.get(key)

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

            fluid_key = self.request.get("rock-fluid")

            # This makes sure the fluid exists
            try:
                rock.fluid_key = Fluid.get(fluid_key).key()
            except:
                rock.fluid_key = None
            
            rock.name = self.request.get('name')

            rock.put()

            self.response.headers['Content-Type'] = 'text/plain'
            self.response.out.write('All OK!!')

        except Exception as e:
            # Write out error message
            print e

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')
        return


class ImageModelHandler(dbAPI):

    def get(self):

        user = self.verify()
        if "all" in self.request.arguments():
            models = get_all_items_user(ImageModel, user)

            data = [{"colours": [RGBToString(j[1]) for j in
                                 Image.open(
                                     blobstore.BlobReader(i.image.key()))
                                 .convert('RGB').getcolors()],
                     "image": images.get_serving_url(i.image),
                     "key": str(i.key()),
                     "earth_models": [j.json for j in
                                      EarthModel.all().ancestor(i)
                                      .filter("user =",
                                              user.user_id if user else None)
                                      .fetch(1000)]}
                    for i in models]

        else:
            self.error(502)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(data))

    @authenticate
    def delete(self, user):

        image_key = self.request.get("image_key")

        image = ImageModel.get(image_key)
        
        deep_delete(image)
        

class FluidHandler(dbAPI):

    entity = Fluid

    @authenticate
    def post(self, user):

        try:
            name = self.request.get("name")

            fluids = get_items_by_name_and_user(self.entity, name, user)

            # Rewrite if the rock exists
            if fluids:
                raise Exception
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
            self.error(502)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write('All OK!!')

    @authenticate
    def put(self, user):

        # Get the database key from the request
        try:

            key = self.request.get("db_key")

            fluid = Fluid.get(key)

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


class EarthModelHandler(dbAPI):

    entity = EarthModel

    @authenticate
    def post(self, user):

        try:
         
            data = json.loads(self.request.body)

            name = data["name"]
            image_key = data["image_key"]
            image_model = ImageModel.get(image_key)

            # See if we are overwriting
            earth_model = EarthModel.all().ancestor(image_model)
            earth_model = earth_model.filter('user =', user.user_id)
            earth_model = earth_model.filter('name =', name).get()
       
            if earth_model:
                earth_model.data = json.dumps(data)
                
            else:
                earth_model = EarthModel(user=user.user_id,
                                         data=json.dumps(data),
                                         name=name,
                                         parent=image_model)
            earth_model.put()
        
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json.dumps(earth_model.json))

        except Exception as e:
            # TODO Handle failure
            print "KLASJFDAJLKFSDA", e
            self.error(502)

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

            self.response.out.write(json.dumps({'success': True}))
        except Exception as e:
            print e
            self.response.out.write(json.dumps({'success': False}))
            

class StripeHandler(ModelrAPI):
    '''
    Handle webhook POSTs from Stripe

    '''
    def post(self):
        
        event = json.loads(self.request.body)

        # Get the event id and retrieve it from Stripe
        # anybody can post, doing it this way is more secure
        # event_id = event_json["id"]

        # event = stripe.Event.retrieve(event_id)

        if event["type"] == "invoice.payment_succeeded":

            # For testing, change it to a known user in stripe
            # and use the webhooks testings
            # event["data"]["object"]["customer"] = \
            # "cus_3ZL6yHJqE8DfTx"
            # event["data"]["object"]["total"] = price

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
                                      amount=int(amount * tax),
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
            im = im.convert('RGB').resize((350, 350))

            im = posterize(im)
            
            output = StringIO.StringIO()
            im.save(output, format='PNG')
            
            bucket = '/modelr_live_bucket/'
            output_filename = (bucket + str(user.user_id) + '/2' +
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


class UpdateCreditCardHandler(ModelrAPI):
    @authenticate
    def post(self, user):

        try:
            card_token = self.request.get("card_token")
            stripe_id = user.stripe_id

            # Create the new credit card
            customer = stripe.Customer.retrieve(stripe_id)
            card = customer.sources.create(source=card_token)

            # set as the default credit card
            customer.default_source = card
            customer.save()

            self.response.write(json.dumps({"message":
                                            "successfully updated card"}))

        except stripe.InvalidRequestError as e:
            self.response.write(json.dumps({"message": e.msg}))


class ModelServed(ModelrAPI):

    def post(self):

        models_served = ModelServedCount.all().get()
        models_served.count += 1
        models_served.put()


class BackendServerHandler(ModelrAPI):

    def get(self):

        hostname = Server.all().get().host
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps({'hostname': hostname}))

