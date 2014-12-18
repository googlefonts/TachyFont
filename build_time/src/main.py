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
import datetime
import errno
import logging
import os
import sys
import cleanup
import closure
from preprocess import Preprocess


def main(args):
  """Preprocess a font for use as a TachyFont.

  Args:
    args: list, command line arguments.
  Raises:
    ValueError: if build directory cannot be created
  Returns:
    Status of the operation.
  """
  parser = argparse.ArgumentParser(prog='pyprepfnt')
  parser.add_argument('fontfile', help='Input font file')
  parser.add_argument('output_dir', help='Output directory')
  parser.add_argument('--hinting', default=False, action='store_true',
                      help='Retain hinting if set, else strip hinting')
  parser.add_argument('--reuse_clean', default=False, action='store_true',
                      help='Reuse the "clean" file if possible')
  parser.add_argument('--log', default='WARNING',
                      help='Set the logging level; eg, --log=INFO')

  cmd_args = parser.parse_args(args)

  loglevel = getattr(logging, cmd_args.log.upper(), None)
  if not isinstance(loglevel, int):
    raise ValueError('Invalid log level: %s' % loglevel)

  log = logging.getLogger()
  logging_handler = logging.StreamHandler(sys.stdout)
  logging_handler.setLevel(loglevel)
  formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
  logging_handler.setFormatter(formatter)
  log.addHandler(logging_handler)
  log.setLevel(loglevel)

  verbose = loglevel <= logging.DEBUG
  fontfile = cmd_args.fontfile
  # TODO(bstell) use Logger
  log.info('preprocess ' + cmd_args.fontfile)
  basename = os.path.basename(fontfile)
  filename, extension = os.path.splitext(basename)
  cur_time = datetime.datetime.now()
  build_dir = 'tmp-%s' % filename
  if not cmd_args.reuse_clean:
    build_dir = ('%s-%04d-%02d-%02d-%02d-%02d-%02d.%d' %
                 (build_dir, cur_time.year, cur_time.month, cur_time.day,
                  cur_time.hour, cur_time.minute, cur_time.second, os.getpid()))
  output_dir = cmd_args.output_dir
  log.info('put results in ' + output_dir)
  try:
    os.makedirs(build_dir)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      log.error('failed to create build_dir (' + build_dir + ')')
      raise

  cleanfile = filename + '_clean' + extension
  cleanfilepath = build_dir + '/' + cleanfile
  cleanfile_exists = os.path.isfile(cleanfilepath)
  if cmd_args.reuse_clean and cleanfile_exists:
    log.debug('reuse cleaned up version: ' + cleanfilepath)
  else:
    log.debug('make cleaned up version: ' + cleanfilepath)
    cleanup.cleanup(fontfile, cmd_args.hinting, cleanfilepath, verbose)
    log.info(basename + '=' + str(os.path.getsize(fontfile)) + ', ' +
             cleanfilepath + '=' + str(os.path.getsize(cleanfilepath)))
    closure.dump_closure_map(cleanfilepath, build_dir)
  log.debug('start proprocess')
  preprocess = Preprocess(cleanfilepath, build_dir, verbose)
  log.debug('build base')
  preprocess.base_font()
  log.debug('dump cmap')
  preprocess.cmap_dump()
  log.debug('build glyph data')
  preprocess.serial_glyphs()

  log.debug('create jar file')
  tachyfont_file = filename + '.TachyFont.jar'
  sub_files = ('base closure_data closure_idx codepoints gids  glyph_data '
               'glyph_table')
  jar_cmd = 'cd %s; jar cf %s %s' % (build_dir, tachyfont_file, sub_files)
  log.debug('jar_cmd: ' + jar_cmd)
  status = os.system(jar_cmd)
  log.debug('jar command status: ' + str(status))
  if status:
    log.error('jar command status: ' + str(status))
    return status

  log.debug('cp the files to the output directory')
  cp_cmd = ('cd %s; cp %s %s %s' %
            (build_dir, tachyfont_file, cleanfile, output_dir))
  log.debug('cp_cmd: ' + cp_cmd)
  status = os.system(cp_cmd)
  log.debug('cp status ' + str(status))
  if status:
    log.error('cp status = ' + str(status))
    return status

  if cmd_args.reuse_clean:
    log.debug('leaving the build directory: ' + build_dir)
  else:
    log.debug('cleanup the build directory')
    rm_cmd = ('rm -rf %s' % build_dir)
    log.debug('rm_cmd: ' + rm_cmd)
    status = os.system(rm_cmd)
    log.debug('rm status ' + str(status))
    if status:
      log.error('rm status = ' + str(status))
      return status

  log.info('command status = ' + str(status))
  return status


if __name__ == '__main__':
  cmd_status = main(sys.argv[1:])
  sys.exit(cmd_status)
