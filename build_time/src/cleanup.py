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

white_space_glyphs = None
default_ignorable_chars = None



def pop_tables():
  global white_space_glyphs
  white_space_glyphs = list([0x0020, 0x0085, 0x00A0, 0x202F, 0x205F, 0x3000])
  white_space_glyphs.extend(range(0x0009, 0x000D + 1))
  white_space_glyphs.extend(range(0x2000, 0x200A + 1))
  white_space_glyphs.extend(range(0x2028, 0x2029 + 1))
  white_space_glyphs = set(white_space_glyphs)

  global default_ignorable_chars
  default_ignorable_chars = list(
      [0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x3164,
       0xFEFF, 0xFFA0])
  default_ignorable_chars.extend(range(0x180B, 0x180E + 1))
  default_ignorable_chars.extend(range(0x200B, 0x200F + 1))
  default_ignorable_chars.extend(range(0x202A, 0x202E + 1))
  default_ignorable_chars.extend(range(0x2060, 0x206F + 1))
  default_ignorable_chars.extend(range(0xFE00, 0xFE0F + 1))
  default_ignorable_chars.extend(range(0x1D173, 0x1D17A + 1))
  default_ignorable_chars = set(default_ignorable_chars)


def cleanup(fontfile, hinting, output):
  """
  Cleanup routine for now
  Cleaning predicate is numberOfContours is zero
  """
  pop_tables()
  exception_set = white_space_glyphs.union(default_ignorable_chars)
  pred = lambda glyph: glyph.numberOfContours == 0
  cleaner = Cleaner(fontfile, hinting, exception_set, pred)
  cleaner.clean()
  cleaner.save(output)
  cleaner.close()
