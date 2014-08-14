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
import struct
from fontTools.ttLib.tables import _c_m_a_p
import array
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


