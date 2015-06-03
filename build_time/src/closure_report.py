#!/usr/bin/python
# -*- coding: UTF-8 -*-
"""
  Copyright 2015 Google Inc. All rights reserved.

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
import codecs
import locale
import os
from os import path
from StringIO import StringIO
import zipfile

# Put parent directory of gae_server in PYTHONPATH if you have problems
from gae_server import incremental_fonts_utils


def getfile(data_path, name):
  f = path.join(data_path, name)
  if not path.isfile(f):
      raise ValueError('no %s file in %s' % (name, data_path))
  return f


def gettext(filepath):
  with open(filepath) as f:
    return f.read()


class DirFetch(object):
  def __init__(self, dirpath):
    self.dirpath = dirpath

  def get(self, name):
    return StringIO(gettext(getfile(self.dirpath, name)))


class ZipFetch(object):
  def __init__(self, zippath):
    self.zf = zipfile.ZipFile(zippath)

  def get(self, name):
    return StringIO(self.zf.open(name, 'r').read())


def get_tachy_cmap_and_creader(data_path):
  # if it's a dir, assume it's the temp directory for a font
  if path.isdir(data_path):
    fetcher = DirFetch(data_path)
  elif data_path.endswith('TachyFont.jar'):
    fetcher = ZipFetch(data_path)
  else:
    raise ValueError('%s is not a dir or TachyFont jar' % data_path)

  cp_file = fetcher.get('codepoints')
  gid_file = fetcher.get('gids')
  cidx_file = fetcher.get('closure_idx')
  cdata_file = fetcher.get('closure_data')

  # _build_cmap is 'private' but it's python, so...
  cmap = incremental_fonts_utils._build_cmap(cp_file, gid_file)
  creader = incremental_fonts_utils.ClosureReader(cidx_file, cdata_file)
  return cmap, creader


def resolve_datapath(root, name):
  result = None
  if not path.isdir(root):
    raise ValueError('%s is not a directory' % root)
  for f in os.listdir(root):
    if f.find(name) == -1:
      continue
    fpath = path.join(root, f)
    if not path.isdir(fpath) and not f.endswith('TachyFont.jar'):
      continue
    if result:
      raise ValueError('\'%s\' matches more than one item in %s' % (name, root))
    result = fpath
  return result


def show_closures(root, fontdir, text_list):
  datapath = resolve_datapath(root, fontdir)
  cmap, creader = get_tachy_cmap_and_creader(datapath)

  for text in text_list:
    show_closure(cmap, creader, text)


def show_closure(cmap, creader, text):
  # Assume text is utf-8, possibly with unicode escapes.
  text = cleanstr(text)

  cps = [ord(cp) for cp in text]
  print 'text:', text
  print 'length: ', len(text)
  seen_cps = set()
  seen_gids = set()
  n = 0
  for cp in cps:
    prefix = r'%2d] %6x (%s)' % (n, cp, unichr(cp))
    n += 1
    if cp in seen_cps:
      print '%s: (seen)' % prefix
      continue

    seen_cps.add(cp)
    if not cp in cmap:
      print '%s: <not in cmap>' % prefix
      continue

    gids = creader.read(cmap[cp])
    print '%s: %s' % (prefix, ', '.join([str(gid) for gid in sorted(gids)]))
    seen_gids.update(gids)

  print 'unique cps:', len(seen_cps)
  print 'unique gids:', len(seen_gids)


def cleanstr(text):
  text = codecs.decode(text, 'utf-8')
  uetext = codecs.encode(text, 'unicode-escape')
  uetext = uetext.replace(r'\\u', r'\u')
  uetext = uetext.replace(r'\\U', r'\U') # remember, python requires 8 hex digits...
  return codecs.decode(uetext, 'unicode-escape')


def main():
  default_root = path.abspath(path.relpath('..', __file__))
  default_text = ('\U0001f150人類社会のすべての構成員の固有の尊厳と平等で譲るこ'
                  'とのできない権利とを承認することは、世界における')
  parser = argparse.ArgumentParser()
  parser.add_argument('-r', '--root', help='dir containing font build files (default %s)' %
                      default_root,  default=default_root, metavar='path')
  parser.add_argument('-n', '--name', help='(partial) name of font dir', required=True)
  parser.add_argument('-t', '--texts', help='text to dump', nargs='*',
                      default=[default_text])
  args = parser.parse_args()
  show_closures(args.root, args.name, args.texts)


if __name__ == '__main__':
    locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')
    main()
