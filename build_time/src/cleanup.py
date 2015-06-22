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
from fontTools.ttLib.tables import _c_m_a_p
from fontTools_wrapper_funcs import change_method, _cmap_format_4_compile
from glyph_sets import get_whitespace_and_ignorable_list


def clean_invalid_glyphs_and_remove_hinting(fontfile, hinting, output, verbose):
  whitespace_and_ignorable_list = get_whitespace_and_ignorable_list()
  cleaner = Cleaner(fontfile, hinting, whitespace_and_ignorable_list)
  cleaner.clean(verbose)
  # Flatten cmap format 4 (no idRangeOffset/glyphIdArray) so it is a simple
  # subset of format 12.
  # do we still what this?
  change_method(_c_m_a_p.cmap_format_4,_cmap_format_4_compile, 'compile')
  cleaner.save(output)
  cleaner.close()


def cleanup(fontfile, hinting, output, verbose):
  """Calls cleanup pipeline Each routine must have three arguments fontfile,hinting and output

  """
  clean_invalid_glyphs_and_remove_hinting(fontfile, hinting, output, verbose)
