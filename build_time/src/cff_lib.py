'''
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
'''

from fontTools.misc.py23 import *
import struct


def readCard8(file):
  return byteord(file.read(1))

def readCard16(file):
  value, = struct.unpack('>H', file.read(2))
  return value

class INDEX():
  def __init__(self, file):
    self.file = file
    self.start = file.tell()
    self.count = readCard16(file)
    self.offset_size = offset_size = readCard8(file)
    self.offset_array = file.tell()
    self.offsets = offsets = []
    self.pad = pad = b'\0' * (4 - offset_size)

    for i in range(self.count+1):
      offset_bytes = pad + file.read(offset_size)
      offset, = struct.unpack('>L', offset_bytes)
      offsets.append(int(offset))

    self.data_start = file.tell() - 1 # Offset start one position back
    self.past_end = self.data_start + offsets[self.count]
    # Pretend we read the file
    file.seek(self.past_end)

  def getInfo(self):
    return (self.start, self.count, self.offset_size, self.past_end)

  def getCount(self):
    return self.count

  def showItems(self, msg, start, end):
    if start < 0 or end < 0:
      print('invalid start({0}) or end({1})'.format(start, end))
      return
    old_pos = self.file.tell()
    print(msg)
    for i in xrange(start, end):
      if i < self.count:
        size = self.offsets[i+1] - self.offsets[i]
        self.file.seek(self.data_start + self.offsets[i])
        data = self.file.read(size)
        print('    item {0} = "{1}"'.format(i, data))
      else:
        print('    no more items ...')
        break
    if end < self.count - 1:
      print('    {0} more items ...'.format(self.count - end))
    self.file.seek(old_pos)

  def getItem(self, index):
    if not index < self.count:
      raise RuntimeError('INDEX.getItem: index({0}) >= count({1})'.format(index, self.count))
    # get the data position
    file.seek(self.offset_array + index * self.offset_size)
    data_pos = self.pad + file.read(self.offset_size)
    next_pos = self.pad + file.read(self.offset_size)
    data = self.file.read(next_pos - data_pos)
    return data

class DictINDEX():
  def __init__(self, file):
    self.index = INDEX(file)
    self.dicts = [None] * self.index.count

  def getInfo(self):
    return self.index.getInfo()

  def getDict(self, index):
    if not index < self.index.count:
      raise RuntimeError('invalid index')
    if self.dicts[index] is None:
      indexObj = self.index
      size = indexObj.offsets[index+1] - indexObj.offsets[index]
      old_pos = indexObj.file.tell()
      indexObj.file.seek(indexObj.data_start + indexObj.offsets[index])
      data = indexObj.file.read(size)
      self.dicts[index] = decompileDict(data)
      indexObj.file.seek(old_pos)
    return self.dicts[index]



  def showItems(self, msg, index, start, end):
    if start < 0 or end < 0:
      print('invalid start({0}) or end({1})'.format(start, end))
      return
    print(msg)
    dict = self.getDict(index)
    count = len(dict.keys())
    i = 0
    for key, value in dict.items():
      print('    {0} = {1}'.format(key, value))
      i += 1
      if i >= end:
        print('    {0} more items ...'.format(count - end))
        break
    if i != end:
      print('    no more items ...')

def decompileDict(data):
  i = 0
  data_len = len(data)
  dict = {}
  operands = []
  while i < data_len:
    i, operand, operator = getNextDictToken(data, i, data_len)
    #print('i={0}, operand={1}, operator={2}'.format(i, operand, operator))
    if operand is not None:
      operands.append(operand)
    elif operator is not None:
      if len(operands) == 1:
        dict[operator] = operands[0]
      else:
        dict[operator] = operands
      #print('{0} {1}'.format(operands, operator))
      operands = []

  if i != data_len:
    raise RuntimeError('did not use the whole dict data')

  return dict


def getNextDictToken(data, i, data_len):
  operand = operator = None
  b0 = byteord(data[i])
  i += 1
  if b0 <= 21:
    # Operator
    if b0 != 12:
      if not DictOperators.has_key(b0):
        print('need {0} in DictOperators'.format(b0))
        operator = '<operator {0} missing from dict>'.format(b0)
      else:
        operator = DictOperators[b0]
    else:
      b1 = byteord(data[i])
      i += 1
      if not Dict12Operators.has_key(b1):
        print('need {0} in Dict12Operators'.format(b1))
        operator = '<operator 12 {0} missing from dict>'.format(b1)
      else:
        operator = Dict12Operators[b1]
  elif b0 >= 32:
    if b0 <= 246:
#         print('operand in range -107 to +107')
      operand = b0 - 139
    elif b0 <= 250:
      # Operand in range +108 to +1131
      b1 = byteord(data[i])
      i += 1
      operand = (b0 - 247) * 256 + b1 + 108
    elif b0 <= 254:
#         print('operand in range -1131 to -108')
      b1 = byteord(data[i])
      i += 1
      operand = -(b0 - 251) * 256 - b1 -108
    else:
      raise RuntimeError('{0} is an invalid number for an operand'.format(b0))
  elif b0 == 28:
    # Operand in range -32768 to +32767
    b1 = byteord(data[i])
    b2 = byteord(data[i+1])
    i += 2
    operand = b1 << 8 | b2
  elif b0 == 29:
    # operand in range -(2^31) to +(2^31-1)
    b1 = byteord(data[i])
    b2 = byteord(data[i+1])
    b3 = byteord(data[i+2])
    b4 = byteord(data[i+3])
    i += 4
    operand = b1 << 24 | b2 << 16 | b3 << 8 | b4
  else:
    print('{0} is an invalid number for an operand'.format(b0))
    raise RuntimeError('{0} is an invalid number for an operand'.format(b0))
  return (i, operand, operator)

# These are incomplete
DictOperators = {
  0: 'version',
  1: 'Notice',
  2: 'FullName',
  3: 'FamilyName',
  4: 'Weight',
  5: 'FontBBox',
  6: 'BlueValues',
  7: 'OtherBlues',
  10: 'StdHW',
  11: 'StdVW',
  14: 'XUID',
  15: 'charset',
  17: 'CharStrings',
  18: 'Private',
  19: 'Subrs',
  20: 'defaultWidthX',
  21: 'PostScript'
}

# These are incomplete
Dict12Operators = {
  3: 'UnderlinePosition',
  11: 'BlueFuzz',
  12: 'StemSnapH',
  13: 'StemStapV',
  17: 'LanguageGroup',
  30: 'ROS',
  31: 'CIDFontVersion',
  34: 'CIDCount',
  36: 'FDArray',
  37: 'FDSelect',
  38: 'FontName',
}

class CharSet():
  def __init__(self, file, numGlyphs):
    '''
    This is currently just an analysis routing. It needs some work to make it
    really a charset class.
    '''
    old_pos = file.tell()
    last_sid = 0
    dsid_1 = 0
    dsid_2 = 0
    dsid_3 = 0
    dsid_4 = 0
    dsid_5 = 0
    dsid_other = 0
    len_1 = 0
    len_2 = 0
    len_3 = 0
    len_4 = 0
    len_other = 0
    format = readCard8(file)
    if format == 0:
      raise RuntimeError('code not written')
    elif format == 1 or format == 2:
      num_segments = 0
      glyphs_covered = 1 # charset does not include .notdef
      while glyphs_covered < numGlyphs:
        num_segments += 1
        sid = readCard16(file)
        if format == 1:
          nLeft = readCard8(file)
        else:
          nLeft = readCard16(file)
        #print('sid={0}, delta sid={1}, length={2}'.format(
        #  sid, sid-last_sid, 1 + nLeft))
        delta_sid = sid - last_sid
        if delta_sid < 0:
          raise RuntimeError('delta_sid is < 0')
        if delta_sid < 2:
          dsid_1 += 1
        elif delta_sid < 4:
          dsid_2 += 1
        elif delta_sid < 8:
          dsid_3 += 1
        elif delta_sid < 16:
          dsid_4 += 1
        elif delta_sid < 32:
          dsid_5 += 1
        else:
          dsid_other += 1
        glyphs_covered += 1 + nLeft
        length = 1 + nLeft
        if length < 2:
          len_1 += 1
        elif length < 4:
          len_2 += 1
        elif length < 8:
          len_3 += 1
        elif length < 16:
          len_4 += 1
        else:
          len_other += 1
        last_sid = sid
      if glyphs_covered != numGlyphs:
        print('numGlyphs={0}, glyphs_covered={1}'.format(numGlyphs, glyphs_covered))
        raise RuntimeError('glyphs_covered != numGlyphs')
      self.size = file.tell() - old_pos
      print('num_segments={0}'.format(num_segments))
      print('dsid_1={0}, dsid_2={1}, dsid_3={2}, dsid_4={3}, dsid_5={4}, dsid_other={5}'.format(
        dsid_1, dsid_2, dsid_3, dsid_4, dsid_5, dsid_other))
      print('len_1={0}, len_2={1}, len_3={2}, len_4={3}, len_other={4}'.format(
        len_1, len_2, len_3, len_4, len_other))

    else:
      raise RuntimeError('unrecognized format')

    file.seek(old_pos)

  def get_size(self):
    return self.size

class FDSelect():

  def __init__(self, file, num_glyphs):
    '''
    This is currently an analysis routing. To be real it needs so work.
    Args:
      file: The file to the CFF data.
      instead of 'argv' in order to suppress the complaint of pychecker.

    Raises:
      RuntimeError: The format is unsupported.
    '''
    old_pos = file.tell()
    data_format = readCard8(file)
    if data_format == 0:
      raise RuntimeError('code not written')
    elif data_format == 3:
      num_ranges = readCard16(file)
      # Use glyphs_covered to determine end of FDSelect.
      # glyphs_covered = 0 # fdselect does include .notdef
      self.size = 1 + 2 + num_ranges * 3 + 2

    else:
      raise RuntimeError('unrecognized format')

    file.seek(old_pos)

  def get_size(self):
    return self.size
