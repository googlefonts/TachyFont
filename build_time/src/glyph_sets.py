"""
White space character set.
Source: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Awhite_space%3A%5D&abb=on&g=
"""
_white_space_glyphs = [ 0x0020, 0x0085,  0x00A0, 0x202F, 0x205F, 0x3000,
                      (0x0009, 0x000D),(0x2000, 0x200A),(0x2028, 0x2029) ]

"""
Default ignorable character set
Source: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3ADI%3Dyes%3A%5D&abb=on&g=
"""
_default_ignorable_glyphs = [0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 
                            0x17B5, 0x3164, 0xFEFF, 0xFFA0,(0x180B, 0x180E),
                            (0x200B, 0x200F),(0x202A, 0x202E),(0x2060, 0x206F),
                            (0xFE00, 0xFE0F),(0x1D173, 0x1D17A)]


_exceptional_glyph_lists= [ _white_space_glyphs , _default_ignorable_glyphs]

def _expand_range_into_list(bounds,list):
  list.extend(range(bounds[0],bounds[1]+1))
  
def _expand_ranges(bound_list):
  expanded_list = []
  for bound in bound_list:
    if type(bound) is tuple:
      _expand_range_into_list(bound,expanded_list)
    else:
      expanded_list.append(bound)
  return expanded_list
  
def expand_all_lists():
  exception_set = set()
  for l in _exceptional_glyph_lists:
    exception_set.update(set(_expand_ranges(l)))
  return exception_set