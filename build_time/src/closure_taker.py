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

from common import build_dict_name_id
from fontTools.subset import Options, Subsetter


class ClosureTaker(object):
  """Takes closure of given glyph names in the given font file
     Return closure list of glyph ids
     Glyph closure: Adding a glyph might require adding other glyph due to
  several reasons:
       -Composite glyphs
       -GSUB lookup lists
  """

  def __init__(self, font):
    self.font = font
    self.glyph_names = []
    self.glyph_codes = []
    aux = build_dict_name_id(self.font)
    self.glyph_name_to_id = aux[0]
    self.glyph_id_to_name = aux[1]

  def add_glyph_names(self, glyph_names):
    self.glyph_names.extend(glyph_names)

  def add_glyph_codes(self, glyph_codes):
    self.glyph_codes.extend(glyph_codes)

  def clear(self):
    self.glyph_names = []
    self.glyph_codes = []

  def closure(self):
    """Takes closure of glyphs specified by glyph_names and glyph_codes.
    """
    options = Options()
    options.notdef_glyph = False
    subsetter = Subsetter(options=options)
    subsetter.populate(glyphs=self.glyph_names, unicodes=self.glyph_codes)
    subsetter._closure_glyphs(self.font)
    gids = sorted(self.glyph_name_to_id[gg] for gg in subsetter.glyphs_all
                  if gg != '.notdef')
    return gids
