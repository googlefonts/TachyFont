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

from __future__ import print_function
import sys
import os
import errno
from fontTools.subset import Options
import cleanup
import closure
from preprocess import Preprocess
import argparse


def main(args):
  """Main program to run preprocessing of the font Arguments:

    font-file
    --output= Output folder of the files, default is current folder
    --hinting=(False|True)  ,default is false
  """
  parser = argparse.ArgumentParser(prog='pyprepfnt')
  parser.add_argument('fontfile',help='Input font file')
  parser.add_argument('--hinting', nargs='?', default=False ,type=bool, help='Enable hinting if True, default is False')
  parser.add_argument('--output', nargs='?', default='.' , help='Output folder, default is current folder')
  cmd_args = parser.parse_args(args)

  fontfile = cmd_args.fontfile
  # TODO(bstell) use Logger
  print('preprocess {0}'.format(cmd_args.fontfile))
  basename = os.path.basename(fontfile)
  filename, extension = os.path.splitext(basename)
  output_folder = cmd_args.output+'/'+filename
  print('put results in {0}'.format(output_folder))
  try:
      os.makedirs(output_folder)
  except OSError as exception:
      if exception.errno != errno.EEXIST:
          raise

  cleanfile = output_folder+'/'+filename + '_clean' + extension
  print('make cleaned up version: {0}'.format(cleanfile))
  cleanup.cleanup(fontfile, cmd_args.hinting, cleanfile)

  print('build closure')
  closure.dump_closure_map(cleanfile, output_folder)

  preprocess = Preprocess(cleanfile, output_folder)
  print('build base')
  preprocess.base_font()
  print('dump cmap')
  preprocess.cmap_dump()
  print('build glyph data')
  preprocess.serial_glyphs()
  print('done')

def console_msg(msg):
  pass

if __name__ == '__main__':
  main(sys.argv[1:])
