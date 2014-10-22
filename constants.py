from jinja2 import Environment, FileSystemLoader
from os.path import dirname, join
import os
import logging

admin_id = 0

PRICE = 900

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



# Jinja2 environment to load templates
env = Environment(loader=FileSystemLoader(join(dirname(__file__),
                                               'templates')))
# Check if we are running the dev server
if os.environ.get('SERVER_SOFTWARE','').startswith('Development'):
    LOCAL = True
    stripe_api_key = "sk_test_RL004upcEo38AaDKIefMGhKF"
    stripe_public_key = "pk_test_prdjLqGi2IsaxLrFHQM9F7X4"
else:
    LOCAL = False
    stripe_api_key = "sk_live_e1fBcKwSV6TfDrMqmCQBMWTP"
    stripe_public_key = "pk_live_5CZcduRr07BZPG2A5OAhisW9"
