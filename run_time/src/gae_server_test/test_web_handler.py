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
import unittest
import webtest
from gae_server.incremental_fonts import IncrementalFonts


class AppTest(unittest.TestCase):

  def setUp(self):
    app = webapp2.WSGIApplication([('/', IncrementalFonts)])
    self.testapp = webtest.TestApp(app)

  # Test the handler.
  def testIncrementalFonts(self):
    response = self.testapp.get('/')
    self.assertEqual(response.status_int, 200)
    self.assertEqual(response.normal_body, 'Under construction')
    self.assertEqual(response.content_type, 'text/plain')

