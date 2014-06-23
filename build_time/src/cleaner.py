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

from fontTools.subset import Options, load_font, Subsetter, save_font
from common import reverseCmap


class Cleaner(object):
  """A font cleaner which is initialized with
     fontfile : full path to font file
     hinting : True if you want to keep hinting
     exception_set : Do not remove these glyph code points
     pred : Takes glyph object as parameter and return boolean"""

  def __init__(self, fontfile, hinting, exception_set, pred):
    self.fontfile = fontfile
    self.options = Options()
    self.options.hinting = hinting
    self.font = load_font(fontfile, self.options, lazy=False)
    assert 'glyf' in self.font, 'TrueType font required'
    self.exception_set = exception_set
    self.pred = pred

  def _invalid_glyphs(self, names):
    glyphs = set()
    glfy_table = self.font['glyf']
    rcmap = reverseCmap(self.font)
    for name in names:
      if name != '.notdef' and glfy_table[name] and self.pred(glfy_table[name]) and \
        rcmap[name] not in self.exception_set:
        glyphs.add(name)
    print 'invalid glyphs', glyphs
    return glyphs

  def clean(self):
    """
    Clean the font from invalid glyphs determined by pred except glyphs in
    the exception list
    """
    names = set(self.font.getGlyphOrder())
    names.difference_update(self._invalid_glyphs(names))
    subsetter = Subsetter(options=self.options)
    subsetter.populate(glyphs=names)
    subsetter.subset(self.font)

  def save(self, outputfile):
    save_font(self.font, outputfile, self.options)

  def close(self):
    self.font.close()
