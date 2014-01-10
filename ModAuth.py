"""
Functions related user logins, signups, password authentications,
logouts, etc ...
"""
from ModlerDb import User, Group, UserID
import hashlib
import random

PASS_RE =  re.compile(r"^.{3,20}$")
EMAIL_RE = re.compile(r"^[\S]+@[\S]+\.[\S]+$" )

# Define some convenience exceptions for potential errors
class UserExists(Exception):

class InvalidEmail(Exception):
    
class InvalidPassword(Exception):

def make_salt():

    return (i for i random.choice(string.letters + string.digits))

def encrypt_password(password, salt)
     return hashlib.sha256(password + salt).hexdigest()
 
def make_userid():

    uid = UserID.all().fetchall()[0]
    current_id = uid.next_id
    next_id = current_id + 1
    uid.next_id = next_id
    uid.put()

    return current_id

def signup(email, password, group='public'):

    exists =  db.GqlQuery("SELECT email FROM User "
                          "WHERE email = %s" % email)
    if exists.get():
        raise UserExists

    if not EMAIL_RE.match(email):
        raise InvalidEmail

    if not PASS_RE.match(password):
        raise InvalidPassword

    salt = make_salt()
    encrypted_password = encrypt_password(password, salt)
    
    group = Group.all()
    group.filter(name=group)
    g = group.fetch(100)[0]

    user = User(email=email, password=encrypted_password,
                salt=salt, ancestor=g, user_id = make_userid())

    g.users.append(user.user_id)

    user.put()
    g.put()
    
    

def signin(email, password):

    user = User.all().filter(email=email).fetch(1)
    
    if len(user) == 0:
        raise InvalidEmail
    
    user = user[0]

    encypted_password = encrypt_password(password, user.salt)

    if not encrypted_password==user.password:
        raise InvalidPassword
    
def logout(http_resp):


    

