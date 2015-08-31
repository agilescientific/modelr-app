from google.appengine.ext import db
from google.appengine.ext import blobstore
from constants import admin_id
import json
"""
Authentication and permissions will be structured similar to linux
wuth groups and users. Group permissions can be added to an item to
allow other users permission to view and edit the item.
"""


def get_user(user_id):

    return User.all().filter("user_id =", user_id).get()


def get_by_id(entity, db_id, user):
    """
    Finds by id. Searches under the user, admin user
    """
    # See if user owns it
    item = entity.get_by_id(db_id, parent=user)

    # See if admin owns it
    if not item:
        item = entity.get_by_id(db_id, parent=get_user(admin_id))

    return item


def get_items_by_name_and_user(entity, name, user):
    items = entity.all().filter("name =", name).fetch(1000)

    out_items = [item for item in items if
                 item.user == user.user_id or
                 item.group in user.group]

    return out_items


def get_all_items_user(entity, user):
    """
    Returns entities that the user has permissions for
    """
    admin_items = entity.all().order("name")\
                              .filter("user =", admin_id).fetch(1000)
    user_items = entity.all().order("name")\
                             .ancestor(user).fetch(1000)
    group_items = [item for item in
                   (entity.all().order("name")
                    .ancestor(ModelrParent.all().get())
                    .filter("group =", group)
                    for group in user.group)]

    uniq_items = set(admin_items + user_items + group_items)
    return list(uniq_items)


def simple_item(obj):
    payload = {"name": obj.name,
               "description": obj.description,
               "key": str(obj.key())}
    print payload
    return payload


class ModelrParent(db.Model):
    """
    parent to all of modelr to allow for strongly consistent queries
    """
    pass


class UserID(db.Model):
    next_id = db.IntegerProperty()


class ModelServedCount(db.Model):
    """
    Item to keep track of how many models have been served by modelr
    """
    count = db.IntegerProperty()


class Issue(db.Model):
    """
    Item for GitHub issues for voting
    """
    issue_id = db.IntegerProperty()
    vote = db.IntegerProperty()


class User(db.Model):

    user_id = db.IntegerProperty()
    email = db.EmailProperty()
    password = db.StringProperty()
    salt = db.StringProperty()
    group = db.StringListProperty()
    stripe_id = db.StringProperty()
    tax_code = db.StringProperty()
    unsubscribed = db.BooleanProperty(default=False)


class ActivityLog(db.Model):

    user_id = db.IntegerProperty()
    activity = db.StringProperty()
    date = db.DateTimeProperty(auto_now_add=True)


class VerifyUser(User):
    """
    Temporary user objects to store user information while we wait
    for a confirmation
    """
    temp_id = db.StringProperty()


class Item(db.Model):
    """
    Base class for items in the modelr database
    """
    user = db.IntegerProperty()
    group = db.StringProperty()
    date = db.DateTimeProperty(auto_now_add=True)


class Group(db.Model):

    name = db.StringProperty()
    allowed_users = db.ListProperty(int)
    admin = db.IntegerProperty()


class GroupRequest(db.Model):

    user = db.IntegerProperty()
    group = db.StringProperty()


class ImageModel(Item):
    image = blobstore.BlobReferenceProperty()


class FluidModel(Item):
    image = blobstore.BlobReferenceProperty()
    name = db.StringProperty(multiline=False)


class Model1D(Item):
    name = db.StringProperty(multiline=False)
    data = db.BlobProperty()

    def to_json(self):
        return self.data


class EarthModel(Item):

    name = db.StringProperty(multiline=False)
    data = db.BlobProperty()

    def to_json(self):
        return self.data


class Forward2DModel(Item):

    name = db.StringProperty(multiline=False)
    input_model_key = db.StringProperty()
    output_image = blobstore.BlobReferenceProperty()
    data = db.BlobProperty()


class Scenario(Item):
    '''
    Database of Scenarios
    '''
    name = db.StringProperty(multiline=False)
    data = db.BlobProperty()


class Rock(Item):
    """
    Database of Rocks
    """

    name = db.StringProperty(multiline=False)
    description = db.StringProperty(multiline=True)

    vp = db.FloatProperty()
    vs = db.FloatProperty()
    rho = db.FloatProperty()

    porosity = db.FloatProperty(default=0.2)
    vclay = db.FloatProperty(default=0.5)

    kclay = db.FloatProperty(default=25000000000.)
    kqtz = db.FloatProperty(default=37000000000.)

    vp_std = db.FloatProperty()
    vs_std = db.FloatProperty()
    rho_std = db.FloatProperty()

    fluid_key = db.ReferenceProperty()

    @property
    def simple_json(self):
        dic = simple_item(self)
        try:
            dic["fluid"] = simple_item(self.fluid_key)
        except:
            dic["fluid"] = None

        return json.dumps(dic)

    @property
    def fluid(self):

        try:
            fluid = self.fluid_key
        except:
            fluid = None

        return fluid

    @property
    def fluid_id(self):
        try:
            fid = self.fluid_key.key().id()
            return fid
        except Exception:
            return None

    @property
    def fluid_payload(self):
        fluid = self.fluid
        if self.fluid:
            return json.loads(fluid.json)
        else:
            return None

    @property
    def json(self):

        return json.dumps({"vp": self.vp, "vs": self.vs,
                           "rho": self.rho,
                           "phi": self.porosity,
                           "vclay": self.vclay,
                           "kclay": self.kclay,
                           "kqtz": self.kqtz,
                           "vp_std": self.vp_std,
                           "vs_std": self.vs_std,
                           "rho_std": self.rho_std,
                           "description": self.description,
                           "fluid": self.fluid_payload,
                           "name": self.name,
                           "db_key": str(self.key())})

    @property
    def mu(self):
        """
        Calculates and returns the shear modulus mu
        """
        return (self.rho * self.vs**2.0)

    @property
    def M(self):
        """
        Compression modulus
        """

        return (self.rho * self.vp**2.0)

    @property
    def K(self):
        """
        Calculates and returns the bulk modulus
        """
        return (self.M - (4.0/3)*self.mu)


class Fluid(Item):

    name = db.StringProperty(multiline=False)
    description = db.StringProperty(multiline=True)

    rho_hc = db.FloatProperty(default=250.)
    rho_w = db.FloatProperty(default=1040.)

    khc = db.FloatProperty(default=1500000000.)
    kw = db.FloatProperty(default=2200000000.)

    sw = db.FloatProperty(default=0.3)

    @property
    def json(self):
        return json.dumps({"k_hc": self.khc,
                           "k_w": self.kw,
                           "rho_hc": self.rho_hc,
                           "rho_w": self.rho_w,
                           "sw": self.sw,
                           "name": self.name,
                           "description": self.description,
                           "db_key": str(self.key())})

    @property
    def simple_json(self):
        return json.dumps(simple_item(self))


class Server(db.Model):

    host = db.StringProperty()
