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
from incremental_fonts_utils import prepare_bundle

BASE_DIR = path.dirname(__file__)


class IncrementalFonts(webapp2.RequestHandler):

  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('incremental fonts server under development, try back later')


class GlyphRequest(webapp2.RequestHandler):
  """Service for glyph requests from the server Takes closure of glyphs and returns them as a bundle

  """

  def post(self):
    self.response.headers.add_header('Access-Control-Allow-Origin', '*')

    #HACK 
    #Since GAE is brain dead, it decides using gzip compression only for text 
    #resources and does not allow the application to decide. 
    #Therefore, we set mime_type for binary data as text.
    self.response.headers['Content-Type'] = 'text/richtext'
    self.response.write(prepare_bundle(self.request))


app = webapp2.WSGIApplication([
    ('/incremental_fonts/request', GlyphRequest),
    ('/incremental_fonts/.*', IncrementalFonts)
], debug=True)
