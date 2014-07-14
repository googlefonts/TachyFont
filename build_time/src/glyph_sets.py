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

"""White space character set.

Source: http://www.unicode.org/faq/unsup_char.html See 'White_Space' in
http://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
    TODO(bstell) separate out the patern white space into its own list
"""
_white_space_glyphs = [0x0020, 0x0085, 0x00A0, 0x1680, 0x202F, 0x205F, 0x3000,
                       (0x0009, 0x000D), (0x2000, 0x200A), (0x2028, 0x2029)]

"""Default ignorable character set Source: http://www.unicode.org/L2/L2002/02368-default-ignorable.pdf

    "Default-ignorable code points ... have no visible glyph"
    TODO(bstell) separate out the variation selectors into its own list
"""
_default_ignorable_glyphs = [
    0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x3164, 0xFEFF,
    0xFFA0, (0x180B, 0x180E), (0x200B, 0x200F), (0x202A, 0x202E),
    (0x2060, 0x206F), (0xFE00, 0xFE0F), (0x1D173, 0x1D17A)]


_exceptional_glyph_lists = [_white_space_glyphs, _default_ignorable_glyphs]


def _expand_range_into_list(bounds, list):
  list.extend(range(bounds[0], bounds[1] + 1))


def _expand_ranges(bound_list):
  expanded_list = []
  for bound in bound_list:
    if type(bound) is tuple:
      _expand_range_into_list(bound, expanded_list)
    else:
      expanded_list.append(bound)
  return expanded_list


def get_exceptional_list():
  exception_set = set()
  for l in _exceptional_glyph_lists:
    exception_set.update(set(_expand_ranges(l)))
  return exception_set
