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
from common import reverse_cmap


class Cleaner(object):
  """A font cleaner which is initialized with
     fontfile : full path to font file
     hinting : True if you want to keep hinting
     exception_set : Do not remove these glyph code points
     predicate : Condition of filter ,takes glyph object as parameter, glyphs 
     satisfy this condition are filtered out"""

  def __init__(self, fontfile, hinting, exception_set, predicate):
    self.fontfile = fontfile
    self.options = Options()
    self.options.hinting = hinting
    self.font = load_font(fontfile, self.options, lazy=False)
    self.exception_set = exception_set
    self.predicate = predicate

  def _invalid_glyphs(self, names):
    glyphs = set()
    glyf_table = self.font['glyf']
    rcmap = reverse_cmap(self.font)
    for name in names:
      if name != '.notdef' and glyf_table[name] and self.predicate(glyf_table[name]) and \
        rcmap[name] not in self.exception_set:
        glyphs.add(name)
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
