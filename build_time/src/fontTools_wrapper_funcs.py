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
from fontTools.ttLib import getSearchRange
from fontTools.ttLib.tables import _c_m_a_p
import array
import operator
import struct
import sys


def change_method(clazz,new_method,method_name):
  old_method = getattr(clazz,method_name)
  setattr(clazz,method_name, new_method)
  return old_method

def _decompile_in_cmap_format_12_13(self,data,ttFont):
  data = self.data # decompileHeader assigns the data after the header to self.data
  startCodes = []
  codesLen = []
  gids = []
  pos = 0
  for i in range(self.nGroups):
    startCharCode, endCharCode, glyphID = struct.unpack(">LLL",data[pos:pos+12] )
    pos += 12
    lenGroup = 1 + endCharCode - startCharCode
    startCodes.append(startCharCode)
    codesLen.append(lenGroup)
    gids.append(glyphID)
  self.cmap = {'startCodes':startCodes,'lengths':codesLen,'gids':gids}
  self.data = None

def _decompile_in_table_cmap(self, data, ttFont):
  tableVersion, numSubTables = struct.unpack(">HH", data[:4])
  self.tableVersion = int(tableVersion)
  self.tables = tables = []
  for i in range(numSubTables):
    platformID, platEncID, offset = struct.unpack(
        ">HHl", data[4+i*8:4+(i+1)*8])
    platformID, platEncID = int(platformID), int(platEncID)
    format, length = struct.unpack(">HH", data[offset:offset+4])
    if format in [8,10,12,13]:
      format, reserved, length = struct.unpack(">HHL", data[offset:offset+8])
    elif format in [14]:
      format, length = struct.unpack(">HL", data[offset:offset+6])

    if not length:
      print("Error: cmap subtable is reported as having zero length: platformID %s, platEncID %s,  format %s offset %s. Skipping table." % (platformID, platEncID,format, offset))
      continue
    if format not in _c_m_a_p.cmap_classes:
      table = _c_m_a_p.cmap_format_unknown(format)
    else:
      table = _c_m_a_p.cmap_classes[format](format)
    table.platformID = platformID
    table.platEncID = platEncID
    table.offset = offset
    # Note that by default we decompile only the subtable header info;
    # any other data gets decompiled only when an attribute of the
    # subtable is referenced.
    table.decompileHeader(data[offset:offset+int(length)], ttFont)
    tables.append(table)

def _decompile_in_cmap_format_4(self, data, ttFont):

  data = self.data # decompileHeader assigns the data after the header to self.data
  (segCountX2, searchRange, entrySelector, rangeShift) = \
        struct.unpack(">4H", data[:8])
  data = data[8:]
  segCount = segCountX2 // 2

  allCodes = array.array("H")
  allCodes.fromstring(data)
  self.data = data = None

  if sys.byteorder != "big":
    allCodes.byteswap()

  # divide the data
  endCode = allCodes[:segCount]
  allCodes = allCodes[segCount+1:]  # the +1 is skipping the reservedPad field
  startCode = allCodes[:segCount]
  allCodes = allCodes[segCount:]
  idDelta = allCodes[:segCount]
  allCodes = allCodes[segCount:]
  idRangeOffset = allCodes[:segCount]
  glyphIndexArray = allCodes[segCount:]

  self.cmap = {'startCode':startCode,'endCode':endCode,'idDelta':idDelta,
               'idRangeOffset':idRangeOffset,'glyphIdArray':glyphIndexArray}

def _override_method(*clazzes):
  """Returns a decorator function that adds a new method to one or
  more classes."""
  def wrapper(method):
    for clazz in clazzes:
      assert clazz.__name__ != 'DefaultTable', 'Oops, table class not found.'
      #assert not hasattr(clazz, method.__name__), \
      #    "Oops, class '%s' has method '%s'." % (clazz.__name__,
      #                                           method.__name__)
      setattr(clazz, method.__name__, method)
    return None
  return wrapper

#TODO(bstell): move to fontTools_wrapper_funcs
#@_override_method(ttLib.tables._c_m_a_p)
def splitRange(startCode, endCode, cmap):
  startCodes = range(startCode + 1, endCode + 1)
  endCodes = range(startCode, endCode + 1)
  return startCodes, endCodes

  # This code flattens cmap format 4 subtable by not using idRangeOffset /
  # glyphIdArray. This came from
  # fonttools-master/Lib/fontTools/ttLib/tables/_c_m_a_p.py and was modified to
  # not try and determine where idRangeOffset would be more efficient.
  # Flattening the subtable makes the cmap its largest size which means any
  # dynamically built cmap will fit in this space.
  if startCode == endCode:
    return [], [endCode]

  lastID = cmap[startCode]
  orderedBegin = lastCode = startCode
  inOrder = None
  # lastCode
  subRanges = []

  # Gather subranges in which the glyph IDs are consecutive.
  for code in range(startCode + 1, endCode + 1):
    glyphID = cmap[code]

    if glyphID != lastID + 1:
      subRanges.append((orderedBegin, lastCode))
      orderedBegin = code

#     if glyphID - 1 == lastID:
#       if inOrder is None or not inOrder:
#         inOrder = 1
#         orderedBegin = lastCode
#     else:
#       if inOrder:
#         inOrder = 0
#         subRanges.append((orderedBegin, lastCode))
#         orderedBegin = None

    lastID = glyphID
    lastCode = code

  #if inOrder:
  subRanges.append((orderedBegin, lastCode))
  assert lastCode == endCode

  # CODE REMOVED
  #   # Now filter out those new subranges that would only make the data bigger.
  #   # A new segment cost 8 bytes, not using a new segment costs 2 bytes per
  #   # character.
  #   newRanges = []
  #   for b, e in subRanges:
  #     if b == startCode and e == endCode:
  #       break  # the whole range, we're fine
  #     if b == startCode or e == endCode:
  #       threshold = 4  # split costs one more segment
  #     else:
  #       threshold = 8  # split costs two more segments
  #     if (e - b + 1) > threshold:
  #       newRanges.append((b, e))
  #   subRanges = newRanges
  #
  if not subRanges:
    return [], [endCode]

  # CODE REMOVED
  #   if subRanges[0][0] != startCode:
  #     subRanges.insert(0, (startCode, subRanges[0][0] - 1))
  #   if subRanges[-1][1] != endCode:
  #     subRanges.append((subRanges[-1][1] + 1, endCode))
  #
  #   # Fill the "holes" in the segments list -- those are the segments in which
  #   # the glyph IDs are _not_ consecutive.
  #   i = 1
  #   while i < len(subRanges):
  #     if subRanges[i-1][1] + 1 != subRanges[i][0]:
  #       subRanges.insert(i, (subRanges[i-1][1] + 1, subRanges[i][0] - 1))
  #       i = i + 1
  #     i = i + 1

  # Transform the ranges into startCode/endCode lists.
  start = []
  end = []
  for b, e in subRanges:
    start.append(b)
    end.append(e)
  start.pop(0)

  assert len(start) + 1 == len(end)
  return start, end

#TODO(bstell): move to fontTools_wrapper_funcs
#@_override_method(ttLib.tables._c_m_a_p.cmap_format_4)
def _cmap_format_4_compile(self, ttFont):
  if self.data:
    return struct.pack(">HHH", self.format, self.length, self.language) + self.data

  charCodes = list(self.cmap.keys())
  charCodes.sort()
  charCodes = charCodes[:256]
  lenCharCodes = len(charCodes)
  if lenCharCodes == 0:
    startCode = [0xffff]
    endCode = [0xffff]
  else:
    charCodes.sort()
    names = list(map(operator.getitem, [self.cmap]*lenCharCodes, charCodes))
    nameMap = ttFont.getReverseGlyphMap()
    try:
      gids = list(map(operator.getitem, [nameMap]*lenCharCodes, names))
    except KeyError:
      nameMap = ttFont.getReverseGlyphMap(rebuild=True)
      try:
        gids = list(map(operator.getitem, [nameMap]*lenCharCodes, names))
      except KeyError:
        # allow virtual GIDs in format 4 tables
        gids = []
        for name in names:
          try:
            gid = nameMap[name]
          except KeyError:
            try:
              if (name[:3] == 'gid'):
                gid = eval(name[3:])
              else:
                gid = ttFont.getGlyphID(name)
            except:
              raise KeyError(name)

          gids.append(gid)
    cmap = {}  # code:glyphID mapping
    list(map(operator.setitem, [cmap]*len(charCodes), charCodes, gids))

    # Build startCode and endCode lists.
    # Split the char codes in ranges of consecutive char codes, then split
    # each range in more ranges of consecutive/not consecutive glyph IDs.
    # See splitRange().
    lastCode = charCodes[0]
    endCode = []
    startCode = [lastCode]
    for charCode in charCodes[1:]:  # skip the first code, it's the first start code
      if charCode == lastCode + 1:
        lastCode = charCode
        continue
      start, end = splitRange(startCode[-1], lastCode, cmap)
      startCode.extend(start)
      endCode.extend(end)
      startCode.append(charCode)
      lastCode = charCode
    start, end = splitRange(startCode[-1], lastCode, cmap)
    startCode.extend(start)
    endCode.extend(end)
    startCode.append(0xffff)
    endCode.append(0xffff)

  #debug_len = len(endCode)
  #debug_pos = 10
  #debug_start = min(debug_pos, debug_len)
  #debug_end = min(debug_pos+10, debug_len)
#   for i in range(debug_start, debug_end):
#     print('a: start/end {0}/{1}'.format(startCode[i], endCode[i] + 1))
  # build up rest of cruft
  idDelta = []
  idRangeOffset = []
  glyphIndexArray = []
  for i in range(len(endCode)-1):  # skip the closing codes (0xffff)
    indices = []
    for charCode in range(startCode[i], endCode[i] + 1):
      indices.append(cmap[charCode])
    if  (indices == list(range(indices[0], indices[0] + len(indices)))):
      idDelta.append((indices[0] - startCode[i]) % 0x10000)
      idRangeOffset.append(0)
    else:
      # someone *definitely* needs to get killed.
      idDelta.append(0)
      idRangeOffset.append(2 * (len(endCode) + len(glyphIndexArray) - i))
      glyphIndexArray.extend(indices)
  idDelta.append(1)  # 0xffff + 1 == (tadaa!) 0. So this end code maps to .notdef
  idRangeOffset.append(0)

  # Insane.
  segCount = len(endCode)
  segCountX2 = segCount * 2
  searchRange, entrySelector, rangeShift = getSearchRange(segCount, 2)

  charCodeArray = array.array("H", endCode + [0] + startCode)
  idDeltaArray = array.array("H", idDelta)
  restArray = array.array("H", idRangeOffset + glyphIndexArray)
  if sys.byteorder != "big":
    charCodeArray.byteswap()
    idDeltaArray.byteswap()
    restArray.byteswap()
  data = charCodeArray.tostring() + idDeltaArray.tostring() + restArray.tostring()

  length = struct.calcsize(_c_m_a_p.cmap_format_4_format) + len(data)
  header = struct.pack(_c_m_a_p.cmap_format_4_format, self.format, length, self.language,
      segCountX2, searchRange, entrySelector, rangeShift)
  return header + data


