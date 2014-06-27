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
from fontTools.ttLib import TTFont
from closure_taker import ClosureTaker


class TestClosureTaker(unittest.TestCase):

  def setUp(self):
    """Loads font and initializes ClosureTaker
    """
    self.font = TTFont('test_data/NotoSans-Regular_subset.ttf')
    self.closureTaker = ClosureTaker(self.font)

  def test_c(self):
    """Takes closure of character 'c' Expected result is array: [3]
    """
    self.closureTaker.clear()
    self.closureTaker.add_glyph_names(['c'])
    gids = self.closureTaker.closure()
    self.assertTrue(gids == [3], 'Closure of c is [c]')

  def test_clear(self):
    """Takes closure of cleared input lists Expected result is array: []
    """
    self.closureTaker.clear()
    gids = self.closureTaker.closure()
    self.assertTrue(gids == [], 'Closure of empty is []')

  def tearDown(self):
    """Closes font
    """
    self.font.close()


if __name__ == '__main__':
  unittest.main()
