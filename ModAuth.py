"""
Functions related user logins, signups, password authentications,
logouts, etc ...
"""
from ModelrDb import User, UserID, Group
import hashlib
import random
import re
import string

PASS_RE =  re.compile(r"^.{3,20}$")
EMAIL_RE = re.compile(r"^[\S]+@[\S]+\.[\S]+$" )

# Define an exception for authentication errors
class AuthExcept(Exception):
    msg = ''

    def __init__(self, msg):
        self.msg = msg

        
def get_cookie_string(email):
    """
    Creates a cookie string to use for authenticating users.
    user_id|encrypted_password
    """

    user = User.all().filter("email =", email).fetch(1)[0]
    name = 'user'
    value = str(user.user_id) + '|' + str(user.password)

    return '%s=%s; Path=/'%(name,value)

def make_salt():
    """
    Create a random string to salt up the encryption
    """
    
    return ''.join(
        [random.choice(string.letters + string.digits)
        for i in range(10)])

def encrypt_password(password, salt):
    """
    Encrypts a password with sha256, but should be upgraded to bcrypt
    once google has that python library in app engine.
    """
    return hashlib.sha256(password + salt).hexdigest()
 
def make_userid():
    """
    Generates the next user id number from the database.
    """

    uid = UserID.all().fetch(1)
    if not len(uid):
        uid = UserID(next_id=1)
    else:
        uid = uid[0]
        
    current_id = uid.next_id
    next_id = current_id + 1
    uid.next_id = next_id

    uid.put()

    return current_id

        
def signup(email, password, group='public', parent=None):
    """
    Checks for valid inputs then adds a user to the User database.
    """

    exists = User.all().filter("email =", email)
    if (exists.fetch(1)):
        raise AuthExcept("Account Exists")

    if not EMAIL_RE.match(email):
        raise AuthExcept("Invalid Email")

    if not PASS_RE.match(password):
        raise AuthExcept("Invalid Password")

    salt = make_salt()
    encrypted_password = encrypt_password(password, salt)
    
    user = User(email=email, password=encrypted_password,
                salt=salt, user_id=make_userid(),
                group=[group], parent=parent)

    g = Group.all().filter("name =", group).fetch(1)
    if not g:
        g = Group(name=group, admin=user.user_id,
                  parent=parent)
    else:
        g = g[0]
        
    g.allowed_users.append(user.user_id)
    
    user.put()
    g.put()

    
def signin(email, password):
    """
    Checks if a email and password are valid. Will throw a AuthExcept
    if they are not.
    """

    user = User.all().filter("email =", email).fetch(1)
    if not user:
        raise AuthExcept('invalid email')
    
    user = user[0]

    encrypted_password = encrypt_password(password, user.salt)

    if not encrypted_password==user.password:
        raise AuthExcept('invalid password')
    
def verify(userid, password, ancestor):
    """
    Verifies that the userid and encrypted password from a cookie
    match the database
    """

    try:
        user = \
          User.all().ancestor(ancestor).filter("user_id =",
                                            int(userid)).fetch(1)[0]
        verified = (user.password == password)
        return user
    except IndexError:
        verified = False

    

    

