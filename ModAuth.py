"""
Functions related user logins, signups, password authentications,
logouts, etc ...
"""
from ModelrDb import User, UserID, Group, VerifyUser
from google.appengine.api import mail
import hashlib
import random
import re
import string
import stripe

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

def make_user(email, password, parent=None, user_id=None):

    if User.all().ancestor(parent).filter("email =", email).fetch(1):
        raise AuthExcept("email exists")
    
    if user_id is None:
        user_id = make_userid()
    
    salt = make_salt()
    encrypted_password = encrypt_password(password, salt)
    admin_user = User(user_id=user_id,
                      parent=parent,
                      email=email,
                      password=encrypted_password,
                      salt=salt)
    admin_user.put()

    return admin_user
    
def signup(email, password, parent=None):
    """
    Checks for valid inputs then adds a user to the User database.
    """

    exists = User.all().ancestor(parent).filter("email =", email)
    if (exists.fetch(1)):
        raise AuthExcept("Account Exists")

    if not EMAIL_RE.match(email):
        raise AuthExcept("Invalid Email")

    if not PASS_RE.match(password):
        raise AuthExcept("Invalid Password")

    salt = make_salt()
    encrypted_password = encrypt_password(password, salt)
    temp_id = hashlib.sha256(make_salt()).hexdigest()
    
    # Set up groups. See if the email domain exists
    groups = ['public']
    domain = email.split('@')[1]
    g = Group.all().ancestor(parent).filter("name =",domain).fetch(1)

    if g:
        groups.append(domain)
    
    user = VerifyUser(email=email, password=encrypted_password,
                      salt=salt, temp_id=temp_id,
                      group=groups, parent=parent)
    
    user.put()
    
    mail.send_mail(sender="Hello <hello@modelr.io>",
              to="<%s>" % user.email,
              subject="Modelr email verification",
              body="""
Welcome to Modelr!

We need to verify your email address. Click the link below to validate your account and continue to billing. 

  http://modelr.io/verify_email?user_id=%s

Cheers,
Matt, Evan, and Ben
""" % str(user.temp_id))
    return temp_id

def verify_signup(user_id, parent):
    """
    Checks that a user id is in the queue to be added. The temporary
    user id is sent through email verification. Raises a AuthExcept if
    the id is invalid, otherwise returns the temporary user object
    from the database.

    :param user_id: User id from email verification
    :param parent: Ancestor database of the temporary user

    :returns the temporary user object.
    """

    u = VerifyUser.all().ancestor(parent).filter("temp_id =", user_id)
    verified_user = u.fetch(1)

    # Check for success
    if not verified_user:
        raise AuthExcept("Verification Failed")
       
    return verified_user[0]


def initialize_user(email, stripe_id, parent, tax_code, price, tax):
    """
    Takes a verified user email from the authentication queue and adds
    it to the permanent database with a stripe id.

    :param verified_email: email of the verified user to add.
    :param stripe_id: The stripe customer id of the user.
    :param parent: The ancestor database key to use for the database.
    :param tax_code: The tax code for the user
                     (province abbrieviation)
    """

    verified_filter = \
      VerifyUser.all().ancestor(parent).filter("email =", email)
    verified_user = verified_filter.fetch(1)

    if not verified_user:
        raise AuthExcept("verification failed")

    verified_user = verified_user[0]
    
    # Make new user and populate
    user = User(parent=parent)
    user.user_id = make_userid()
    user.email = verified_user.email
    user.password = verified_user.password
    user.salt = verified_user.salt
    user.group = verified_user.group
    user.stripe_id = stripe_id
    user.tax_code = tax_code

    for group in user.group:
        g = Group.all().ancestor(parent).filter("name =",
                                                group).fetch(1)
        g[0].allowed_users.append(user.user_id)
        g[0].put()
            
    user.put()

    # remove the temporary user from the queue
    verified_user.delete()

    # send a payment confirmation email
    mail.send_mail(sender="Hello <hello@modelr.io>",
              to="<%s>" % user.email,
              subject="Modelr subscription confirmation",
              body="""
Welcome to Modelr!

You are now subscribed to Modelr! Your receipt is below.

To unsubscribe, please reply to this email or log in to Modelr and check your user settings.

Cheers,
Matt, Evan, and Ben


=======================
       modelr.io
=======================
       
  Monthly fee USD{0:.2f}
  
  Sales tax   USD{1:.2f}
  
  Total       USD{2:.2f}
  
========================
 Modelr is a product of
  Agile Geoscience Ltd
  Nova Scotia - Canada
  
 Canada Revenue Agency
 reg # 840217913RT0001
========================
""".format(price/100., tax/100., (price+tax)/100.))
       
def signin(email, password, parent):
    """
    Checks if a email and password are valid. Will throw a AuthExcept
    if they are not.
    """

    user = User.all().ancestor(parent).filter("email =",
                                              email).fetch(1)
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


def send_message(subject, message):
    """
    Sends us a message from a user or non-user.
    """
    
    # send the message
    mail.send_mail(sender="Hello <hello@modelr.io>",
                   to="hello@modelr.io",
                   subject=subject,
                   body=message)


def forgot_password(email, parent):
    """
    Sets a new password after the user forgot it.
    """

    user = User.all().ancestor(parent).filter("email =",
                                              email).fetch(1)
    if not user:
        raise AuthExcept('invalid email')
    
    user = user[0]

    def generate_password(size=8,
                          chars=(string.ascii_uppercase +
                                 string.digits)):
        return ''.join(random.choice(chars) for x in range(size))
        
    new = generate_password()

    # send a new password email
    mail.send_mail(sender="Hello <hello@modelr.io>",
              to="<%s>" % user.email,
              subject="Modelr password reset",
              body="""
Here's your new password!

    %s
    
Please sign in with this new password, and then change it in your
profile page.

  http://modelr.io/signin?redirect=settings

Cheers,
Matt, Evan, and Ben
""" % new
        )

    # Change it in the database
    user.password = encrypt_password(new, user.salt)
    user.put()

def reset_password(user, current_pword, new_password,
                   verify):
    """
    Resets the password at the user's request.
    
    :param user: The user database object requesting the password
                 change.
    :param current_pword: The user's current password to verify.
    :param new_password: The user's new password.
    :param verify: The new password verification.
    """

    # This check should be done in the javascript on the page
    if new_password != verify:
        raise AuthExcept("New password verification failed")

    # Check if the original password matches the database
    if encrypt_password(current_pword, user.salt) != user.password:
        raise AuthExcept("Incorrect password")

    # Update the password in the database
    user.password = encrypt_password(new_password, user.salt)

    # Save it in the database
    user.put()
    
def cancel_subscription(user):
    """
    Delete the user. See notes in DeleteHandler() in main.py
    """

    try:
        stripe_customer = stripe.Customer.retrieve(user.stripe_id)
        stripe_customer.subscriptions.all(limit=1)[0].\
          delete(at_period_end=True)

        user.unsubscribed = True

        # TODO MailChimp
    except Exception as e:
        raise AuthExcept("Failed to unsubscribe user: " + user.email)
    

    
    mail.send_mail(sender="Hello <hello@modelr.io>",
              to="<%s>" % user.email,
              subject="Modelr account deleted",
              body="""
You have unsubscribed from Modelr. Your account will be deleted
at the end of the billing cycle.

Thank you for using Modelr. We hope to meet again some day.

Cheers,
Matt, Evan, and Ben
""")
