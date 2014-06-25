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

import unittest
import webtest
import webapp2
from binascii import a2b_hex
from static_constants import GLYPH_REQUEST_RESPONSE_FOR_NOTO_ABC, NOTO_FONT, ARRAY_ABC
from gae_server.incremental_fonts import GlyphRequest


class AppTest(unittest.TestCase):

  def setUp(self):
    app = webapp2.WSGIApplication([('/', GlyphRequest)])
    self.testapp = webtest.TestApp(app)

  # Test the handler.
  def test_GlyphRequest(self):
    glyph_request = {'font': NOTO_FONT, 'arr': ARRAY_ABC}
    response = self.testapp.post_json('/', glyph_request)
    self.assertEqual(response.body, a2b_hex(GLYPH_REQUEST_RESPONSE_FOR_NOTO_ABC))
    self.assertEqual(response.status_int, 200)
