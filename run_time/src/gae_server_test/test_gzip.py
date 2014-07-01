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
from gae_server.help import _gzip
from gae_server_test.static_constants import NOTO_FONT_GZ_PATH, NOTO_FONT_PATH


class AppTest(unittest.TestCase):

  def setUp(self):
    file = open(NOTO_FONT_PATH, 'rb')
    self.content = file.read()
    file.close()
    file = open(NOTO_FONT_GZ_PATH, 'rb')
    self.target = file.read()
    file.close()

  def test_GZip(self):
    self.assertEqual(
        self.target[10:], _gzip(self.content)[10:], 'Compressed contents dont match')
