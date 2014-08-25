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

from fontTools.misc.py23 import *
import struct


def readCard8(file):
  return byteord(file.read(1))
  # this hack not needed: return ord(file.read(1))

def readCard16(file):
  value, = struct.unpack(">H", file.read(2))
  return value

class INDEX():
  def __init__(self, file):
    self.file = file
    self.start = file.tell()
    self.count = readCard16(file)
    self.offSize = offSize = readCard8(file)
    self.offset_array = file.tell()
    self.offsets = offsets = []
    self.pad = pad = b'\0' * (4 - offSize)

    for i in range(self.count+1):
      offset_bytes = pad + file.read(offSize)
      offset, = struct.unpack(">L", offset_bytes)
      offsets.append(int(offset))

    self.data_start = file.tell() - 1 # Offset start one position back
    self.past_end = self.data_start + offsets[self.count]
    # Pretend we read the file
    file.seek(self.past_end)

  def getInfo(self):
    return (self.start, self.count, self.offSize, self.past_end)

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
      raise RuntimeError("INDEX.getItem: index({0}) >= count({1})".format(index, self.count))
    # get the data position
    file.seek(self.offset_array + index * self.offSize)
    data_pos = self.pad + file.read(self.offSize)
    next_pos = self.pad + file.read(self.offSize)
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
      raise RuntimeError("invalid index")
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
    raise RuntimeError("did not use the whole dict data")

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
      raise RuntimeError("{0} is an invalid number for an operand".format(b0))
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
    print("{0} is an invalid number for an operand".format(b0))
    raise RuntimeError("{0} is an invalid number for an operand".format(b0))
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
    old_pos = file.tell()
    last_sid = 0
    dummy = 1
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
      raise RuntimeError("code not written")
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
        dummy += 1
      if glyphs_covered != numGlyphs:
        print('numGlyphs={0}, glyphs_covered={1}'.format(numGlyphs, glyphs_covered))
        raise RuntimeError("glyphs_covered != numGlyphs")
      self.size = file.tell() - old_pos
      print('num_segments={0}'.format(num_segments))
      print('dsid_1={0}, dsid_2={1}, dsid_3={2}, dsid_4={3}, dsid_5={4}, dsid_other={5}'.format(
        dsid_1, dsid_2, dsid_3, dsid_4, dsid_5, dsid_other))
      print('len_1={0}, len_2={1}, len_3={2}, len_4={3}, len_other={4}'.format(
        len_1, len_2, len_3, len_4, len_other))

    else:
      raise RuntimeError("unrecognized format")

    file.seek(old_pos)

  def getSize(self):
    return self.size

class FDSelect():
  def __init__(self, file, num_glyphs):
    old_pos = file.tell()
    format = readCard8(file)
    if format == 0:
      raise RuntimeError("code not written")
    elif format == 3:
      num_ranges = readCard16(file)
      glyphs_covered = 0 # fdselect does include .notdef
      self.size = 1 + 2 + num_ranges * 3 + 2

    else:
      raise RuntimeError("unrecognized format")

    file.seek(old_pos)

  def getSize(self):
    return self.size

def getIndexInfo(file, pos):
  file.seek(pos)
  count = readCard16(file)
  offSize = readCard8(file)
  file.seek(count * offSize, 1)
  pad = b'\0' * (4 - offSize)
  offset_bytes = file.read(offSize)
  offset_bytes = pad + offset_bytes
  end, = struct.unpack(">L", offset_bytes)
  return (count, offSize, end)


# def showCFFParts(font):
#   cff_reader = font.reader.tables['CFF ']
#   cff_data = font.reader['CFF ']
#   cff_file = StringIO(cff_data)
#   print('cff_reader.offset={0}'.format(cff_reader.offset))
#   print('cff_reader.length={0}'.format(cff_reader.length))
# 
#   cff_file.seek(4) # seek past header
#   nameIndex = INDEX(cff_file)
#   start, count, offSize, past_end = nameIndex.getInfo()
#   print('Name INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   nameIndex.showItems('Name INDEX', 0, 3)
# 
#   topDictIndex = DictINDEX(cff_file)
#   start, count, offSize, past_end = topDictIndex.getInfo()
#   print('Top DICT INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   topDictIndex.showItems('Top DICT INDEX', 0, 0, 3)
#   # There is only one font in a CID font
#   font_dict = topDictIndex.getDict(0)
# 
#   stringIndex = INDEX(cff_file)
#   start, count, offSize, past_end = stringIndex.getInfo()
#   print('String INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   stringIndex.showItems('String INDEX', 0, 3)
# 
#   globalSubrIndex = INDEX(cff_file)
#   start, count, offSize, past_end = globalSubrIndex.getInfo()
#   print('Global Subr INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   globalSubrIndex.showItems('Global Subr INDEX', 0, 3)
# 
#   print("CIDFonts do not have an Encodings value")
# 
#   char_strings_offset = font_dict['CharStrings']
#   print('CharStrings = {0}'.format(char_strings_offset))
#   cff_file.seek(char_strings_offset)
#   charStringsIndex = INDEX(cff_file)
#   start, count, offSize, past_end = charStringsIndex.getInfo()
#   print('CharStrings INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   num_glyphs = count
# 
#   charset_offset = font_dict['charset']
#   print('charset = {0}'.format(charset_offset))
#   cff_file.seek(charset_offset)
#   charset = CharSet(cff_file, num_glyphs)
#   print('charset: size = {0}'.format(charset.getSize()))
# 
#   fdselect_offset = font_dict['FDSelect']
#   print('FDSelect = {0}'.format(fdselect_offset))
#   cff_file.seek(fdselect_offset)
#   fdselect = FDSelect(cff_file, num_glyphs)
#   print('FDSelect: size = {0}'.format(fdselect.getSize()))
# 
#   fdarray_offset = font_dict['FDArray']
#   print('FDArray = {0}'.format(fdarray_offset))
#   cff_file.seek(fdarray_offset)
#   fdarray = DictINDEX(cff_file)
#   start, count, offSize, past_end = fdarray.getInfo()
#   print('Top DICT INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
#   fdarray.showItems('FDArray', 0, 0, 3)
#   fdarray.showItems('FDArray', 1, 0, 3)
#   fdcount = count
#   subr_len = 0
#   for i in range(fdcount):
#     private_dict = fdarray.getDict(i)
#     length, offset = private_dict['Private']
#     #print('private dict {0}: offset={1}, end={2}, length={3}'.format(
#     #  i, offset, offset+length, length))
#     cff_file.seek(offset)
#     data = cff_file.read(length)
#     dict = decompileDict(data)
#     if 'Subrs' in dict:
#       subrs_offset = dict['Subrs']
#       cff_file.seek(offset + subrs_offset)
#       subrsIndex = INDEX(cff_file)
#       start, count, offSize, past_end = subrsIndex.getInfo()
#       length = past_end - start
#       subr_len += length
#       #print('    subrs: start={0}, count={1}, end={2}'.format(
#       #  start, count, past_end))
#   print('total subr length = {0}'.format(subr_len))
#   dummy = 4
# 
# #   private_dict_offset = font_dict['Private']
# #   print('Private = {0}'.format(private_dict_offset))
# #   cff_file.seek(private_dict_offset)
# #   private_dict = Private(cff_file, num_glyphs)
# #   print('Private: size = {0}'.format(private_dict.getSize()))



#     print('get the glyphOrder')
#     old_glyph_order = self.font.getGlyphOrder() #[:]
# #     copy_old_glyph_order = old_glyph_order[:]
#     print('len(old_glyph_order)={0}'.format(len(old_glyph_order)))
#     print('get the cmap')
#     cmap_table = self.font['cmap']
#     cmap = None
#     try:
#       cmap = cmap_table.getcmap(3, 10).cmap
#     except:
#       print('use cmap 3/1')
#       cmap = cmap_table.getcmap(3, 1).cmap
# 
#     print('create empty new_glyph_order')
#     new_glyph_order = []
#     already_seen = {}
#     already_seen_cnt = 0;
# 
#     # Move the .notdef glyph
#     notdef = old_glyph_order.pop(0)
#     already_seen[notdef] = 1
#     new_glyph_order.append(notdef)
# 
#     print('in cmap glyph order:')
#     print('    take the items out of glyphOrder')
#     print('    append them to new_glyph_order')
# #     cmap_len = len(cmap)
#     #for i in range(cmap_len):
#       #glyph_name = cmap[i]
# 
# #     for k in cmap.keys().sort():
# #       glyph_name = cmap[k]
# # 
# #     cmap_unsorted = cmap.keys()
# #     cmap_sorted = cmap_unsorted[:].sort()
# 
#     cmap_keys = cmap.keys()
#     cmap_keys.sort()
#     for key in cmap_keys:
#       glyph_name = cmap[key]
# #       print('glyph_name={0}'.format(glyph_name))
#       if (already_seen.get(glyph_name)):
#         print('{0} already seen'.format(glyph_name))
#         already_seen_cnt += 1
#         continue
#       already_seen[glyph_name] = 1
# #       old_pos = copy_old_glyph_order.index(glyph_name)
# #       new_pos = len(new_glyph_order)
# #       if old_pos != new_pos:
# #         print('cmap[{0}]: old_pos={1}, new_pos={2}'.format(key, old_pos, new_pos))
#       new_glyph_order.append(glyph_name)
#       old_glyph_order.remove(glyph_name)
# 
#     print('len(old_glyph_order)={0}'.format(len(old_glyph_order)))
#     print('len(new_glyph_order)={0}'.format(len(new_glyph_order)))
#     print('already_seen_cnt={0}'.format(already_seen_cnt))
# #     cmap_glyph_order = [v for k, v in cmap.cmap.iteritems()]
# #     for v for k, v in cmap.iteritems()):
# #       newG = 2
# #       pass
#     print('for the items left in glyphOrder')
#     print('    take the items out of glyphOrder')
#     print('    append them to new_glyph_order')
#     print('    take the items out of glyphOrder')
#     for i in range(len(old_glyph_order)):
#       glyph_name = old_glyph_order.pop(0)
#       new_glyph_order.append(glyph_name)
#       if (already_seen.get(glyph_name)):
#         print('{0} already seen'.format(glyph_name))
#         already_seen_cnt += 1
#       already_seen[glyph_name] = 1
#     print('len(old_glyph_order)={0}'.format(len(old_glyph_order)))
#     print('len(new_glyph_order)={0}'.format(len(new_glyph_order)))
#     print('already_seen_cnt={0}'.format(already_seen_cnt))
# 
#     # this is very aggressive
#     for i in range(len(new_glyph_order)):
#       #old_glyph_order.append(new_glyph_order.pop(0))
#       old_glyph_order.append(new_glyph_order[i])
# 
#     print('set the new_glyph_order')
#     self.font.setGlyphOrder(old_glyph_order)
#     if 'CFF ' in self.font:
#       cff = self.font['CFF ']
#       cff.setGlyphOrder(old_glyph_order)


#     cff_file.seek(charstrings)
#     count = readCard16(cff_file)
#     offSize = readCard8(cff_file)
#     cff_file.seek(count * offSize, 1)
#     pad = b'\0' * (4 - offSize)
#     offset_bytes = cff_file.read(offSize)
#     offset_bytes = pad + offset_bytes
#     end, = struct.unpack(">L", offset_bytes)
#     print('charstrings: start={0}, end={1}, length={2}'.
#           format(charstrings, end, end-charstrings))




#     old_pos = cff_file.tell()
#     topDictIndexIndex = INDEX(cff_file)
#     start, count, offSize, past_end = topDictIndexIndex.getInfo()
#     print('Top DICT INDEX Index: start={0}, count={1}, end={2}'.format(start, count, past_end))
#     cff_file.seek(old_pos)




#     file.seek(count * offSize, 1)
#     
#     offset_bytes = file.read(offSize)
#     offset_bytes = pad + offset_bytes
#     end, = struct.unpack(">L", offset_bytes)
#     return (count, offSize, end)





#     index = self.index
#     old_pos = index.file.tell()
#     for i in xrange(start, end):
#       if i < index.count:
#         size = index.offsets[i+1] - index.offsets[i]
#         index.file.seek(index.data_start + index.offsets[i])
#         data = index.file.read(size)
#         dict = self.decompileDict(data)
#         self.dicts.append(dict)
# #         print('    item {0}: operator={1}, operands="{2}"'.format(
# #             i, operator, operands))
#       else:
#         print('    no more items ...')
#         break
#     if end < index.count - 1:
#       print('    {0} more items ...'.format(index.count - end))
#     index.file.seek(old_pos)


def analyze_cmap():
#     # Analyze the cmap for compression
#     cmap_table = self.font['cmap']
#     f12 = cmap_table.getcmap(3, 10)
#     data = f12.data
# #     format, reserved, length, language, nGroups = struct.unpack(">HHLLL", data[:16])
#     pos = 0
#     last_code = 0
#     last_len = 0
#     last_gid = 0
#     gos_cnt = 0
#     prev_last_gid = 0
#     gos_code16_break = 0
#     gos_code256_break = 0
#     gos_len_break = 0
#     gos_gid_break = 0
#     gos_negative_gid_break = 0
#     i = 0
#     print('i    start  dcode  len  gid    dgid ')
#     for i in range(f12.nGroups):
#       startCharCode, endCharCode, glyphID = struct.unpack(">LLL",data[pos:pos+12] )
#       pos += 12
#       lenGroup = 1 + endCharCode - startCharCode
# #       print('start={0}, end={1}, gid={2}'.format(startCharCode, endCharCode, glyphID))
#       delta_code = startCharCode - last_code
#       delta_len = lenGroup - last_len
#       delta_gid = glyphID - last_gid
#       delta_prev_gid = glyphID - prev_last_gid
#       using_prev = ''
#       if abs(delta_prev_gid) < abs(delta_gid):
# #         delta_gid = delta_prev_gid
#         using_prev = '*'
# 
#       gos_break = False
#       if delta_code > 16:
# #         gos_break = True
#         gos_code16_break += 1
#       if delta_code > 256:
#         gos_break = True
#         gos_code256_break += 1
#       if delta_len > 16:
#         gos_break = True
#         gos_len_break += 1
#       if abs(delta_gid) > 16:
#         gos_break = True
#         gos_gid_break += 1
#         gos_negative_gid_break += 1
#       if gos_break:
#         gos_cnt += 1
#         print('gos {0}: dcode={1} dlen={2}, dgid={3}'.format(
#           gos_cnt, delta_code, delta_len, delta_gid))
# 
#       print('{0:<4} {1:<7} {2:<5} {3:<4} {4:<6} {5:<5}{6}'.format(
#           i, startCharCode, delta_code, lenGroup, glyphID, delta_gid, using_prev))
# 
#       if gos_break:
#         dummy = 4
# 
#       last_code = endCharCode
#       prev_last_gid = last_gid
#       last_gid = glyphID + lenGroup - 1
#       if i and i % 20 == 0:
#         print('\ni    start  dcode  len  gid    dgid ')
#         dummy = 1
# 
# 
#     print('gos_cnt={0}, code16={1}, code256={2}, len={3}, gid={4}, neggid={5}'.format(
#       gos_cnt, gos_code16_break, gos_code256_break, gos_len_break, 
#       gos_gid_break, gos_negative_gid_break))
# 
# #     for i in range(self.nGroups):
# #       startCharCode, endCharCode, glyphID = struct.unpack(">LLL",data[pos:pos+12] )
# #       pos += 12
# #       lenGroup = 1 + endCharCode - startCharCode
# #       charCodes.extend(list(range(startCharCode, endCharCode +1)))
# #       gids.extend(self._computeGIDs(glyphID, lenGroup))
# 
# 
# #     charCodes = list(f12.cmap.keys())
# #     lenCharCodes = len(charCodes)
# # 
# #     names = list(f12.cmap.values())
# #     nameMap = self.font.getReverseGlyphMap()
# #     # do I need a try here?
# #     gids = list(map(operator.getitem, [nameMap]*lenCharCodes, names))
# #     cmap = {}  # code:glyphID mapping
# #     list(map(operator.setitem, [cmap]*len(charCodes), charCodes, gids))
# # 
# #     # Look at the character code points
# #     sortedCharCodes = charCodes
# #     sortedCharCodes.sort()
# #     print('record the delta between code points')
# #     num_points = 16
# #     charcode_deltas = [0] * num_points
# #     last_delta = None
# #     delta_blocks = [0] * num_points
# #     for i in range(lenCharCodes - 1):
# #       delta = sortedCharCodes[i + 1] - sortedCharCodes[i]
# #       if (delta >= num_points):
# #         delta = num_points -1
# # 
# #       if delta != last_delta:
# #         if last_delta:
# #           delta_blocks[last_delta] += 1
# #         last_delta = delta
# # 
# #       charcode_deltas[delta] += 1
# # 
# #     print('char codes')
# #     for i in range(num_points):
# #       print('{0}: {1}'.format(i, charcode_deltas[i]))
# # 
# #     for i in range(num_points):
# #       print('{0}: {1}'.format(i, delta_blocks[i]))
# 
#     # Look at the gids
# #     gid_deltas = [0] * num_points
# #     last_gid_delta = None
# #     delta_gid_blocks = [0] * num_points
# #     for i in range(lenCharCodes - 1):
# #       gid_delta = cmap[sortedCharCodes[i + 1]] - cmap[sortedCharCodes[i]]
# # 
# #       if (gid_delta < 0):
# #         gid_delta = 0
# # 
# #       if (gid_delta >= num_points):
# #         gid_delta = num_points -1
# # 
# #       if gid_delta != last_gid_delta:
# #         if last_gid_delta:
# #           delta_gid_blocks[last_gid_delta] += 1
# #         last_gid_delta = gid_delta
# # 
# #       gid_deltas[gid_delta] += 1
# # 
# #     print('gids')
# #     for i in range(num_points):
# #       print('{0}: {1}'.format(i, gid_deltas[i]))
# # 
# #     for i in range(num_points):
# #       print('{0}: {1}'.format(i, delta_gid_blocks[i]))
# 
# 
# #     print('look for continuous runs of code points')
# #     print('look for continuous runs of gids')
# 
# #     dummy = 0
  pass

# from StringIO import StringIO
# import struct
# from fontTools.cffLib import Index

#     cff_table  = self.font.tables['CFF '].cff
#     print('cff_table.tableOffsets={0}'.format(cff_table.tableOffsets))
#     print('cff_table.topDictIndex={0}'.format(cff_table.topDictIndex))
#     print('cff_table.fontNames[0]={0}'.format(cff_table.fontNames[0]))
#     fontDict = cff_table.topDictIndex[0]
#     print('fontDict.string.getStrings()={0}'.format(fontDict.strings.getStrings()))
#     rawDict = fontDict.rawDict
#     print('rawDict={0}'.format(rawDict.keys()))
#     print('charset={0}'.format(rawDict['charset']))
#     print('FDSelect={0}'.format(rawDict['FDSelect']))
#     fdselect = rawDict['FDSelect']
#     cff_file.seek(fdselect)
#     fdselect_format = readCard8(cff_file)
#     print('FDSelect format = {0}'.format(fdselect_format))
#     if fdselect_format == 3:
#       nranges = readCard16(cff_file)
#       print('nranges={0}'.format(nranges))
#       fdselect_length = 1 + 2 + nranges*3 + 2
#       print('FDSelect length={0}'.format(fdselect_length))
#     print('FDArray={0}'.format(rawDict['FDArray']))
#     fdarray = rawDict['FDArray']
#     charstrings = rawDict['CharStrings']
#     countx, offsizex, endx = getIndexInfo(cff_file, fdarray)
#     # these numbers look wrong
#     print('charstrings: start={0}, end={1}, length={2}'.
#           format(charstrings, endx, endx-charstrings))
# 
#     print('CharStrings={0}'.format(rawDict['CharStrings']))
#     countx, offsizex, endx = getIndexInfo(cff_file, charstrings)
#     print('charstrings: start={0}, end={1}, length={2}'.
#           format(charstrings, endx, endx-charstrings))
# 
#     # compare this method against the other
#     file = self.font.reader.file
#     file.seek(cff_reader.offset + charstrings)
#     count2 = readCard16(file)
#     offSize2 = readCard8(file)
#     pad = b'\0' * (4 - offSize2)
#     file.seek(count2 * offSize2, 1)
#     offset_bytes2 = file.read(offSize2)
#     offset_bytes2 = pad + offset_bytes2
#     end2, = struct.unpack(">L", offset_bytes2)
#     print('charstrings: start={0}, end={1}, length={2}'.
#           format(charstrings, end2, end2-charstrings))
# 
#     #
#     file.seek(cff_reader.offset + charstrings)
#     charstrings_index = Index(file)
#     end3 = charstrings_index.offsets[-1]
#     base_offset = charstrings_index.offsetBase
#     print('charstrings: start={0}, end={1}, length={2}'.
#           format(charstrings, end3, end3 - charstrings))
# 
#     try:
#       print('Encoding={0}'.format(fontDict['Encoding']))
#     except:
#       print('except encoding')
#     try:
#       print('Private={0}'.format(rawDict['Private']))
#     except:
#       print('except private')
#     try:
#       print('Subrs={0}'.format(rawDict['Subrs']))
#     except:
#       print('except subrs')


