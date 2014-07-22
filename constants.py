from jinja2 import Environment, FileSystemLoader
from os.path import dirname, join
import os
import logging

admin_id = 0

# Jinja2 environment to load templates
env = Environment(loader=FileSystemLoader(join(dirname(__file__),
                                               'templates')))
# Check if we are running the dev server
if os.environ.get('SERVER_SOFTWARE','').startswith('Development'):
    LOCAL = True
else:
    LOCAL = False
