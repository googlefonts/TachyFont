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

import array
import sys
import struct
import json as JSON
from os import path

def _parse_json(data):
  return JSON.loads(data)

def _parse_array_from_str(data, type, byteorder):
  """
  Using array.fromstring function , parses given binary string and type
  Returns array of type
  """
  arr = array.array(type)
  arr.fromstring(data)
  if sys.byteorder != byteorder:
    arr.byteswap()
  return arr


def _parse_array_from_file(filename, type, byteorder):
  """
  Using _parse_array_from_str, open given filename and parses it
  Returns array of type
  """
  file = open(filename, 'rb')
  arr = _parse_array_from_str(file.read(), type, byteorder)
  file.close()
  return arr


def _parse_array_fmt(fmt, count, data):
  """
  Using struct.unpack_from, parses given binary string as array if given fmt
  """
  pos = 0
  fmt_size = struct.calcsize(fmt)
  rv = [None] * count
  for i in xrange(count):
    rv[i] = struct.unpack_from(fmt, data, pos)
    pos += fmt_size
  return rv


def _build_cmap(cp_file, gid_file):
  """
  Build cmap dictionary from codepoints to glyph ids using given files
  """
  keys = _parse_array_from_file(cp_file, 'H', 'big')
  gids = _parse_array_from_file(gid_file, 'H', 'big')
  cmap = dict.fromkeys(keys)

  for i, key in enumerate(keys):
    cmap[key] = gids[i]
  return cmap


def _parse_glyf_table(file):
  """
  Parses given file as glyf table, where each entry is such tuples
  (glyph id , [hmtx lsb] ,[vmtx tsb] , offset , size )
  """
  fmt_GlyphTable = '>HH'
  HAS_HMTX = (1 << 0)
  HAS_VMTX = (1 << 1)
  header_size = struct.calcsize(fmt_GlyphTable)
  file.seek(0)
  (flags, numGlyphs) = struct.unpack(fmt_GlyphTable, file.read(header_size))
  fmt_mtx = ''
  if flags & HAS_HMTX: fmt_mtx+='h'
  if flags & HAS_VMTX: fmt_mtx+='h'
  fmt_entry = '>H' + fmt_mtx + 'LH'
  return \
    _parse_array_fmt(fmt_entry, numGlyphs, file.read()), flags & HAS_HMTX, \
    flags & HAS_VMTX, header_size, struct.calcsize(fmt_entry)


def _read_region(file, offset, size):
  prev = file.tell()
  file.seek(offset)
  data = file.read(size)
  file.seek(prev)
  return data

def prepare_bundle(request):
  """Parse requests, then prepares response bundle for glyphs
  """
  glyph_request = _parse_json(request.body)
  font = glyph_request['font']
  codepoints = glyph_request['arr']
  base = path.dirname(path.abspath(__file__)) + '/data/'+font+'/'
  cmap = _build_cmap(base + 'codepoints', base + '/gids')
  closure_reader = ClosureReader(base + '/closure_idx', base + '/closure_data')
  gids = set()
  for code in codepoints:
    if code in cmap:
      gids.update(closure_reader.read(cmap[code]))
  closure_reader.close()

  table = open(base + '/glyph_table', 'rb')
  (glyf_table, has_hmtx, has_vmtx, header_size, entry_size ) = \
  _parse_glyf_table(table)
  mtx_count = has_hmtx + has_vmtx
  flag_mtx = has_hmtx | has_vmtx << 1
  bundle = bytearray()
  data = open(base + '/glyph_data', 'rb')
  bundle.extend(struct.pack('>HB', len(gids), flag_mtx))
  for id in gids:
    entry_offset = header_size + id * entry_size
    bundle.extend(_read_region(table, entry_offset, entry_size))
    data_offset = glyf_table[id][mtx_count + 1]
    data_size = glyf_table[id][mtx_count + 2]
    bundle.extend(_read_region(data, data_offset, data_size))
  table.close()
  data.close()
  return bundle.decode('latin-1')


class ClosureReader(object):
  """
  Class to read closure list of a given glyph id
  Init with serialized closure files
  """
  fmt_idx = '>lH'
  fmt_idx_len = struct.calcsize(fmt_idx)
  fmt_one = 'H'
  fmt_one_len = struct.calcsize(fmt_one)

  def __init__(self, index_file, data_file):
    self.idx = open(index_file, 'rb')
    self.data_file = open(data_file, 'rb')

  def read(self, glyphID):
    """
    Return closure list of glyph ids for given glyphID
    """
    closure_set = set([glyphID])
    idx_offset = glyphID * ClosureReader.fmt_idx_len
    self.idx.seek(idx_offset)
    (offset, size) = struct.unpack(
        ClosureReader.fmt_idx,
        self.idx.read(ClosureReader.fmt_idx_len))
    if offset == -1: return closure_set
    self.data_file.seek(offset)
    arr = (
        _parse_array_from_str(
            self.data_file.read(size),
            ClosureReader.fmt_one, 'big'))
    closure_set.update(arr)
    return closure_set

  def close(self):
    self.idx.close()
    self.data_file.close()
