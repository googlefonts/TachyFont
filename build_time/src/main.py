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
  parser.add_argument('--force', default=False, action='store_true',
                      help='Force preprocessing even if the timestamps indicate'
                      ' it is not necessary')
  parser.add_argument('--hinting', default=False, action='store_true',
                      help='Retain hinting if set, else strip hinting')
  parser.add_argument('--reuse_clean', default=False, action='store_true',
                      help='Reuse the "clean" file if possible')
  parser.add_argument('--log', default='WARNING',
                      help='Set the logging level; eg, --log=INFO')
  parser.add_argument('--verbose', default=False, action='store_true',
                      help='Report internal operations')

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
  verbose = cmd_args.verbose

  force_preprocessing = cmd_args.force
  log.debug('force_preprocessing = ' + str(force_preprocessing))

  fontfile = cmd_args.fontfile
  fonttime = os.path.getmtime(fontfile)
  # TODO(bstell) use Logger
  basename = os.path.basename(fontfile)
  log.info('preprocess %s = %d bytes' % (cmd_args.fontfile,
                                         os.path.getsize(cmd_args.fontfile)))
  filename, extension = os.path.splitext(basename)
  cur_time = datetime.datetime.now()
  build_dir = 'tmp-%s' % filename
  if not cmd_args.reuse_clean:
    build_dir = ('%s-%04d-%02d-%02d-%02d-%02d-%02d.%d' %
                 (build_dir, cur_time.year, cur_time.month, cur_time.day,
                  cur_time.hour, cur_time.minute, cur_time.second, os.getpid()))
  output_dir = cmd_args.output_dir
  log.debug('TAR file: ' + output_dir)
  try:
    os.makedirs(build_dir)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      log.error('failed to create build_dir (' + build_dir + ')')
      raise

  log.debug('if reuse_clean then we should compare the source font and final tar')
  cleanfile = filename + '_clean' + extension
  cleanfilepath = build_dir + '/' + cleanfile
  # Decide if we are building the cleaned up version of the font.
  rebuild_clean = not cmd_args.reuse_clean
  cleanfile_exists = os.path.isfile(cleanfilepath)
  if force_preprocessing or not cleanfile_exists:
    rebuild_clean = True
  else:
     cleantime = os.path.getmtime(cleanfilepath)
     if cleantime <= fonttime:
       rebuild_clean = True
  log.debug('rebuild_clean = ' + str(rebuild_clean))
  if rebuild_clean:
    log.debug('cleaned version: ' + cleanfilepath)
    cleanup.cleanup(fontfile, cmd_args.hinting, cleanfilepath, verbose)
    closure.dump_closure_map(cleanfilepath, build_dir)
  else:
    log.debug('reuse cleaned up version: ' + cleanfilepath)
  # Get the latest cleaned up font timestamp.
  cleantime = os.path.getmtime(cleanfilepath)

  # Decide if we are rebuilding the tar file.
  tachyfont_file = filename + '.TachyFont.tar'
  tarfilepath = build_dir + '/' + tachyfont_file
  rebuild_tar = False
  tarfile_exists = os.path.isfile(tarfilepath)
  log.debug('file %s exists: %s' % (tarfilepath, tarfile_exists))
  if force_preprocessing or not tarfile_exists:
    rebuild_tar = True
  else:
    tartime = os.path.getmtime(tarfilepath)
    if tartime <= cleantime:
      rebuild_tar = True
  log.debug('rebuild_tar = ' + str(rebuild_tar))
  if rebuild_tar:
    log.debug('start proprocess')
    preprocess = Preprocess(cleanfilepath, build_dir, verbose)
    log.debug('build base')
    preprocess.base_font()
    log.debug('dump cmap')
    preprocess.cmap_dump()
    log.debug('build glyph data')
    preprocess.serial_glyphs()
    log.debug('write sha-1 fingerprint')
    preprocess.sha1_fingerprint()

    log.debug('create tar file')
    sub_files = ('base closure_data closure_idx codepoints gids  glyph_data '
                 'glyph_table sha1_fingerprint')
    tar_cmd = 'cd %s; tar cf %s %s' % (build_dir, tachyfont_file, sub_files)
    log.debug('tar_cmd: ' + tar_cmd)
    status = os.system(tar_cmd)
    log.debug('tar command status: ' + str(status))
    if status:
      log.error('tar command status: ' + str(status))
      return status
  else:
    log.debug('no need to rebuild intermediate tar file: ' + tarfilepath)
  # Get the latest cleaned up tar timestamp.
  tartime = os.path.getmtime(tarfilepath)


  # Decide if we are copying over the tar file.
  copy_tar = False
  tarcopy_filepath = output_dir + '/' + tachyfont_file
  tarcopy_exists = os.path.isfile(tarcopy_filepath)
  if force_preprocessing or not tarcopy_exists:
    copy_tar = True
  else:
    tarcopytime = os.path.getmtime(tarcopy_filepath)
    if tarcopytime <= tartime:
      copy_tar = True
  log.debug('copy_tar = ' + str(copy_tar))
  if copy_tar:
    log.debug('cp the files to the output directory')
    log.info('cleaned: %s = %d' % (cleanfile, os.path.getsize(cleanfilepath)))
    log.info('Tar: %s/%s' % (output_dir, tachyfont_file))
    cp_cmd = ('cp %s/%s %s/%s %s' %
              (build_dir, tachyfont_file, build_dir, cleanfile, output_dir))
    log.debug('cp_cmd: ' + cp_cmd)
    status = os.system(cp_cmd)
    log.debug('cp status ' + str(status))
    if status:
      log.error('cp status = ' + str(status))
      return status
  else:
    log.debug('the existing tar file is up to date: ' + tarfilepath)


  if cmd_args.reuse_clean:
    log.debug('leaving the build directory: ' + build_dir)
    status = 0
  else:
    log.debug('cleanup the build directory')
    rm_cmd = ('rm -rf %s' % build_dir)
    log.debug('rm_cmd: ' + rm_cmd)
    status = os.system(rm_cmd)
    log.debug('rm status ' + str(status))
    if status:
      log.error('rm status = ' + str(status))
      return status

  log.debug('command status = ' + str(status))
  if status != 0:
    log.info('preprocessing FAILED')
  return status


if __name__ == '__main__':
  cmd_status = main(sys.argv[1:])
  sys.exit(cmd_status)
