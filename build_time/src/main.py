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
import argparse
import errno
import os
import sys
import cleanup
import closure
from preprocess import Preprocess


def main(args):
  """Preprocess a font for use as a TachyFont.

  Args:
    args: list, arguments the user typed.
  Returns:
    Status of the operation.
  """
  parser = argparse.ArgumentParser(prog='pyprepfnt')
  parser.add_argument('fontfile', help='Input font file')
  parser.add_argument('--hinting', default=False, action='store_true',
                      help='Enable hinting if specified, no hinting if not '
                      'present')
  parser.add_argument('--verbose', default=False, action='store_true',
                      help='Extra messages are printed')
  parser.add_argument('--output', default='.',
                      help='Output folder, default is current folder')

  cmd_args = parser.parse_args(args)

  verbose = cmd_args.verbose
  fontfile = cmd_args.fontfile
  # TODO(bstell) use Logger
  # print('preprocess {0}'.format(cmd_args.fontfile))
  basename = os.path.basename(fontfile)
  filename, extension = os.path.splitext(basename)
  output_folder = cmd_args.output+'/'+filename
  # print('put results in {0}'.format(output_folder))
  try:
    os.makedirs(output_folder)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      raise

  cleanfile = output_folder + '/' + filename + '_clean' + extension
  # print('make cleaned up version: {0}'.format(cleanfile))
  cleanup.cleanup(fontfile, cmd_args.hinting, cleanfile)
  closure.dump_closure_map(cleanfile, output_folder)
  if verbose:
    print(filename + ',' + str(os.path.getsize(cleanfile)) + ',', end='')
  # print('start proprocess')
  preprocess = Preprocess(cleanfile, output_folder, verbose)
  # print('build base')
  preprocess.base_font()
  # print('dump cmap')
  preprocess.cmap_dump()
  # print('build glyph data')
  preprocess.serial_glyphs()
  # print('create jar file')
  # jar cf NotoSans-Regular_subset.TachyFont.jar b* c* g*
  jar_cmd = ('cd %s; jar cf %s %s' %
             (output_folder, filename + '.TachyFont.jar', 'base  closure_data '
              'closure_idx codepoints gids  glyph_data  glyph_table'))
  status = os.system(jar_cmd)
  # print('jar command status: ', status)
  return status


if __name__ == '__main__':
  cmd_status = main(sys.argv[1:])
  print('cmd_status =', cmd_status)
  sys.exit(cmd_status)
