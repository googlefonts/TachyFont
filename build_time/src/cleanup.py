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

from cleaner import Cleaner
from glyph_sets import get_whitespace_list


def clean_invalid_glyphs_and_remove_hinting(fontfile, hinting, output):
  whitespace_list = get_whitespace_list()
  cleaner = Cleaner(fontfile, hinting, whitespace_list)
  cleaner.clean()
  cleaner.save(output)
  cleaner.close()


def cleanup(fontfile, hinting, output):
  """Calls cleanup pipeline Each routine must have three arguments fontfile,hinting and output
  """
  clean_invalid_glyphs_and_remove_hinting(fontfile, hinting, output)
