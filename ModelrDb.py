from google.appengine.ext import db

"""
Authentication and permissions will be structured similar to linux
wuth groups and users. Group permissions can be added to an item to
allow other users permission to view and edit the item.
"""


class ModelrParent(db.Model):
    """
    parent to all of modelr to allow for strongly consistent queries
    """
    
    pass

class UserID(db.Model):
    next_id = db.IntegerProperty()

class User(db.Model):

    user_id = db.IntegerProperty()
    email = db.EmailProperty()
    password = db.StringProperty()
    salt = db.StringProperty()
    group = db.StringListProperty()
    
class Item(db.Model):
    """
    Base class for items in the modelr database
    """
    user = db.IntegerProperty()
    group = db.StringProperty()
    
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

