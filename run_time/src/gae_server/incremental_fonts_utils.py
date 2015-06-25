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
from datetime import datetime
import json as JSON
import logging
from os import path
from StringIO import StringIO
import struct
import sys
import zipfile

BASE_DIR = path.dirname(__file__)


last_time = None


def elapsed_time(msg, new_start=False):
  """Log the delta time for this operation.

  Args:
    msg: string, the string for this operation
    new_start: bool, if this is a new start time for the operation.
  """
  global last_time
  this_time = datetime.now()
  if last_time is None:
    logging.getLogger().setLevel(logging.INFO)
    last_time = this_time
  if new_start:
    last_time = this_time
  if this_time > last_time:
    logging.info('%s took %s seconds', msg, str(this_time - last_time))
  else:
    logging.info(msg)
  last_time = this_time


def _parse_json(data):
  return JSON.loads(data)


def _parse_array_from_str(data, elem_type, byteorder):
  """Parse an array from a string.

  Parses the given binary string.
  Args:
    data: the binary string.
    elem_type: string, the element type
    byteorder: string, the byte order of the data (eg, big-endian)
  Returns:
    An array of elem_type

  """
  arr = array.array(elem_type)
  arr.fromstring(data)
  if sys.byteorder != byteorder:
    arr.byteswap()
  return arr


def _parse_array_fmt(fmt, count, data):
  """Using struct.unpack_from, parses given binary string as array if given fmt.

  Args:
    fmt: string, the format of the array data.
    count: the count of items in the data.
    data: array, the data to parse.
  Returns:
    A list of the data structures.
  """
  pos = 0
  fmt_size = struct.calcsize(fmt)
  rv = [None] * count
  for i in xrange(count):
    rv[i] = struct.unpack_from(fmt, data, pos)
    pos += fmt_size
  return rv


def _build_cmap(cp_file, gid_file):
  """Build cmap dictionary from codepoints to glyph ids using given files.

  Args:
    cp_file: file, the codepoint file.
    gid_file: file, the glyph IDs file.
  Returns:
    The mapping between codepoints and their primary glyph ID.
  """
  keys = _parse_array_from_str(cp_file.read(), 'I', 'big')
  gids = _parse_array_from_str(gid_file.read(), 'H', 'big')
  cmap = dict.fromkeys(keys)

  for i, key in enumerate(keys):
    cmap[key] = gids[i]
  return cmap


def _parse_glyf_table(file_bytes):
  """Parses given file as glyf table.

  Each entry is a tuples:
  (glyph id, [hmtx lsb], [vmtx tsb], offset, size)

  Args:
    file_bytes: string, the file data.
  Returns:
    The parsed glyph info and data.
  """
  fmt_glyph_table = '>HH'
  has_hmtx = (1 << 0)
  has_vmtx = (1 << 1)
  has_cff = (1 << 2)
  header_size = struct.calcsize(fmt_glyph_table)

  header = buffer(file_bytes[0:header_size])
  (flags, num_glyphs) = struct.unpack(fmt_glyph_table, header)
  fmt_mtx = ''
  if flags & has_hmtx: fmt_mtx += 'h'
  if flags & has_vmtx: fmt_mtx += 'h'
  fmt_entry = '>H' + fmt_mtx + 'LH'
  file_data = buffer(file_bytes[header_size:])
  return (_parse_array_fmt(fmt_entry, num_glyphs, file_data), flags & has_hmtx,
          flags & has_vmtx, flags & has_cff, header_size,
          struct.calcsize(fmt_entry))


def _read_region(file_obj, offset, size):
  prev = file_obj.tell()
  file_obj.seek(offset)
  data = file_obj.read(size)
  file_obj.seek(prev)
  return data


def prepare_bundle(request):
  """Parse requests, then prepares response bundle for glyphs.

  Args:
    request: object, the request object.
  Returns:
    string: the glyph and metadata
  """
  glyph_request = _parse_json(request.body)
  font = glyph_request['font']
  codepoints = glyph_request['arr']
  elapsed_time('prepare_bundle for {0} characters'.format(len(codepoints)),
               True)
  zf = zipfile.ZipFile(BASE_DIR + '/fonts/' + font + '.TachyFont.jar', 'r')
  cp_file = zf.open('codepoints', 'r')
  gid_file = zf.open('gids', 'r')

  cmap = _build_cmap(cp_file, gid_file)
  # Make these seekable.
  cidx_file = StringIO(zf.open('closure_idx', 'r').read())
  cdata_file = StringIO(zf.open('closure_data', 'r').read())
  closure_reader = ClosureReader(cidx_file, cdata_file)
  gids = set()
  for code in codepoints:
    if code in cmap:
      gids.update(closure_reader.read(cmap[code]))

#   for _code in codepoints:
#     if _code in cmap:
#       _gid = cmap[_code]
#       _closure_gids = closure_reader.read(cmap[_code])
#       print "  0x%05x (%d): %s" % (_code, _code, tuple(_closure_gids))
#     else:
#       print "code 0x%05x not in the font" % (_code)

  closure_reader.close()

  elapsed_time('gather glyph info')

  glyph_info_file = zf.open('glyph_table', 'r')
  glyph_info = bytearray(glyph_info_file.read())  # Glyph meta data.
  elapsed_time('read glyph table ({0} bytes)'.format(len(glyph_info)))

  data = zf.open('glyph_data', 'r')
  data_bytes = bytearray(data.read())
  elapsed_time('read glyph data ({0} bytes)'.format(len(data_bytes)))

  (glyf_table, has_hmtx, has_vmtx, has_cff, header_size, entry_size) = (
      _parse_glyf_table(glyph_info))
  mtx_count = has_hmtx + (has_vmtx >> 1)
  # Assemble the flag bits.
  flag_mtx = has_hmtx | has_vmtx  | has_cff
  elapsed_time('open & parse glyph table')

  bundle_header = struct.pack('>HB', len(gids), flag_mtx)
  bundle_length = len(bundle_header)
  bundle_length += len(gids) * entry_size

  # Pre-flight to get the length
  for gid in gids:
    assert gid < len(glyf_table)
    bundle_length += glyf_table[gid][mtx_count + 2]  # + 2 to get past glyph gid
  bundle_bytes = bytearray(bundle_length)
  bundle_pos = 0
  length = len(bundle_header)
  bundle_bytes[bundle_pos:bundle_pos+length] = bundle_header
  bundle_pos += length
  elapsed_time('calc bundle length')
  if has_cff:
    delta = -1  # What does -1 mean?
  else:
    delta = 0
  # Copy in the data from glyph_info and data_bytes
  for gid in sorted(gids):
    entry_offset = header_size + gid * entry_size
    bundle_bytes[bundle_pos:bundle_pos + entry_size] = (
        glyph_info[entry_offset:entry_offset + entry_size])
    bundle_pos += entry_size

    data_offset = glyf_table[gid][mtx_count + 1] + delta
    data_size = glyf_table[gid][mtx_count + 2]
    bundle_bytes[bundle_pos:bundle_pos + data_size] = (
        data_bytes[data_offset:data_offset + data_size])
    bundle_pos += data_size
  elapsed_time('build bundle')

  zf.close()
#   print "bundle bytes"
#   lineCount = 8
#   print "length =", len(bundle_bytes)
#   for i in range(len(bundle_bytes)):
#     if (i % lineCount == 0):
#       print " ",
#     print("0x%02x," % (bundle_bytes[i])),
#     if (i and (i % lineCount == lineCount - 1)):
#       lineStart = i - lineCount + 1
#       print " /* 0x%04X - %d */" % (lineStart, lineStart)
#   print ""
  elapsed_time('close files')
  return str(bundle_bytes)


class ClosureReader(object):
  """Class to read list of associated glyphs.

  """
  fmt_idx = '>lH'
  fmt_idx_len = struct.calcsize(fmt_idx)
  fmt_one = 'H'
  fmt_one_len = struct.calcsize(fmt_one)

  def __init__(self, index_file, data_file):
    self.idx = index_file
    self.data_file = data_file

  def read(self, glyph_id):
    """Return closure list of glyph ids for given glyph_id.

    Args:
      self:
      glyph_id: number, the glyph ID.

    Returns:
      list, the list of associated glyph IDs.
    """
    closure_set = set([glyph_id])
    idx_offset = glyph_id * ClosureReader.fmt_idx_len
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
