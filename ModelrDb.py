from google.appengine.ext import db

"""
Authentication and permissions will be structured similar to linux
wuth groups and users. Group permissions can be added to an item to
allow other users permission to view and edit the item.
"""
class UserID(db.Model):
    next_id = db.IntegerProperty()

class User(db.Model):

    user_id = db.IntegerProperty()
    email = db.EmailProperty()
    password = db.StringProperty()
    salt = db.StringProperty()

class Group(db.Model):
    
    name = db.StringProperty()
    users = db.ListProperty()


class Item(db.Model):
    """
    Base class for items in the modelr database
    """
    
    user = db.UserProperty()
    permissions = db.StringListProperty()
    
class Scenario(Item):
    '''
    Database of Scenarios 
    '''
    name = db.StringProperty(multiline=False)
    
    data = db.BlobProperty()
    date = db.DateTimeProperty(auto_now_add=True)

class Rock(Item):
    """
    Database of Rocks
    """
    
    name = db.StringProperty(multiline=False)
    description = db.StringProperty(multiline=True)
    date = db.DateTimeProperty(auto_now_add=True)

    
    vp = db.FloatProperty()
    vs = db.FloatProperty()
    rho = db.FloatProperty()
    vp_std = db.FloatProperty()
    vs_std = db.FloatProperty()
    rho_std = db.FloatProperty()
