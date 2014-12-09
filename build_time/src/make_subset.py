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

import argparse
import os
import sys
from fontTools.subset import load_font
from fontTools.subset import Options
from fontTools.subset import save_font
from fontTools.subset import Subsetter


def main(args):
  """Subset a font (useful for making small test fonts).

  Args:
    args: list, arguments the user typed.
  """
  parser = argparse.ArgumentParser()
  parser.add_argument('fontfile', help='Input font file')
  parser.add_argument('--text', default='',
                      help='Text to include in the subset')
  parser.add_argument('--unicodes', default='',
                      help='Comma separated list of Unicode codepoints (hex) '
                      'to include in the subset; eg, "e7,0xe8,U+00e9"')
  parser.add_argument('--glyphs', default='',
                      help='Comma separated list of glyph IDs (decimal) to '
                      'include in the subset; eg, "1,27"')
  parser.add_argument('--hinting', default=False, action='store_true',
                      help='Enable hinting if specified, no hinting if not '
                      'present')

  cmd_args = parser.parse_args(args)

  options = Options()
  # Definitely want the .notdef glyph and outlines.
  options.notdef_glyph = True
  options.notdef_outline = True
  # Get the item. to keep in the subset.
  text = cmd_args.text
  unicodes_str = cmd_args.unicodes.lower().replace('0x', '').replace('u+', '')
  unicodes = [int(c, 16) for c in unicodes_str.split(',') if c]
  glyphs = [int(c) for c in cmd_args.glyphs.split(',') if c]
  fontfile = cmd_args.fontfile
  options.hinting = cmd_args.hinting  # False => no hinting

  dirname = os.path.dirname(fontfile)
  basename = os.path.basename(fontfile)
  filename, extension = os.path.splitext(basename)
  output_file = dirname + '/' + filename + '_subset' + extension
  font = load_font(fontfile, options, lazy=False)

  subsetter = Subsetter(options)
  subsetter.populate(text=text, unicodes=unicodes, glyphs=glyphs)
  subsetter.subset(font)
  save_font(font, output_file, options)


if __name__ == '__main__':
  main(sys.argv[1:])
