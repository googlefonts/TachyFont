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

from common import buildDictNameId
from fontTools.subset import Options, Subsetter


class ClosureTaker(object):
  """Takes closure of given glyph names in the given font file
     Return closure list of glyph ids
     Glyph Id 0 is always in the closure list 
  """

  def __init__(self, font):
    self.font = font
    self.glyphNames = []
    self.glyphCodes = []
    aux = buildDictNameId(self.font)
    self.glyphNameToId = aux[0]
    self.glyphIdToName = aux[1]

  def addGlyphNames(self, glyphNames):
    self.glyphNames.extend(glyphNames)

  def addGlyphCodes(self, glyphCodes):
    self.glyphCodes.extend(glyphCodes)

  def clear(self):
    self.glyphNames = []
    self.glyphCodes = []

  def closure(self):
    """
    After adding some glyphs, this function return GIDs of the closure 
    """
    options = Options()
    options.notdef_glyph = False
    subsetter = Subsetter(options=options)
    subsetter.populate(glyphs=self.glyphNames, unicodes=self.glyphCodes)
    subsetter._closure_glyphs(self.font)
    gids = sorted(self.glyphNameToId[gg] for gg in subsetter.glyphs_all
                  if gg != '.notdef')
    gids.append(0)
    return gids
