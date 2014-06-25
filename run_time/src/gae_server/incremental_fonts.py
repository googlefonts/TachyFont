"""
  Copyright 2014 Google Inc. All rights reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
"""

import webapp2
from os import path
from help import prepare_bundle

BASE_DIR = path.dirname(__file__)


class IncrementalFonts(webapp2.RequestHandler):

  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('Under construction')


class GlyphRequest(webapp2.RequestHandler):
  """Service for glyph requests from the server Takes closure of glyphs and returns them as a bundle

  """

  def post(self):
    self.response.headers[
        'Content-Type'] = 'application/octet-binary;charset=latin1'
    self.response.write(prepare_bundle(self.request))


class BaseRequest(webapp2.RequestHandler):
  """Service for glyph requests from the server Takes closure of glyphs and returns them as a bundle

  """
  def get(self):
    font = self.request.get('font')
    self.response.headers['Content-Type'] = 'application/octet-binary'
    self.response.write(open(BASE_DIR + '/data/' + font + '/base').read())


app = webapp2.WSGIApplication([
    ('/incremental_fonts/request', GlyphRequest),
    ('/incremental_fonts/base', BaseRequest),
    ('/incremental_fonts/.*', IncrementalFonts)
], debug=True)
