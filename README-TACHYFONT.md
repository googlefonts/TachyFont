TachyFont files
===============

base
----

The preprocessed skeleton.

1. prepend info for client side processing
   * Code: base_header.py: BaseHeaderPrepare.prepare
1. zero hmtx/lsb and/or vmtx/tsb
   * Code: base_fonter.py: __zero_mtx
1. zero out glyph data
   * CFF code: base_fonter.py: __end_char_strings, __fill_char_strings, __zero_charset_fmt
   * TTF code: base_fonter.py: __zero_glyf
1. sparsify loca table
    * Code: base_fonter.py: __segment_table
1. zero cmaps
    * Code: base_fonter.py: __zero_cmaps
1. rle to shrink large blocks of zeros
    * Code: base_fonter.py: __rle

NOTE: the base is **not** compressed

closure_idx
-----------

Data about related / possibly-needed glyphs.

1. length is proportional to the number of glyphs (which is contiguous from 0 - (n-1))
1. offset & size of closure list in closure_data

* Code: closure.py: dump_closure_map

closure_data
------------
Arrays of glyphs that might be used with a given glyph (ligatures, GSUB, etc).

1. array of possibly-needed glyphs

* Code: closure.py: dump_closure_map

codepoints
----------

An array of the Unicode codepoints in the font

1. convert to an associative map codepoint:gid at runtime

* Code: preprocess.py: cmap_dump.

gids
----

The primary glyph for each codepoint in codepoints

* Code: proprocess.py: cmap_dump.

glyph_data
----------

The per-glyph data.

1. exact same order and length as the font's glyph data

* Code: preprocess.py: serial_glyphs, _serial_Glyf/_serial_Cff

glyph_table
-----------

Array of glyphs' data.

1. offset
1. length
1. hmtx/lsb and/or vmtx/tsb

* Code: preprocess.py: serial_glyphs, _serial_Glyf/_serial_Cff
