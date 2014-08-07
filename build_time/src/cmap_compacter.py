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
from fontTools_wrapper_funcs import _decompile_in_cmap_format_12_13,\
  change_method
from fontTools.ttLib.tables import _c_m_a_p
import struct

class NumberEncoders(object):


  @staticmethod
  def NibbleBin(number):
    assert number > 0,'takes only positive numbers'
    count = 0
    copy_number = number if number != 0 else 1
    while copy_number:
      copy_number >>= 4
      count += 1
    return [count,bin(number)[2:].zfill(count*4)]
        
  @staticmethod
  def NoNString(number):
    result = NumberEncoders.NibbleBin(abs(number))
    if number >= 0:
      result[0] -= 1
    else:
      result[0] += 7
    nibble_count = NumberEncoders.NibbleBin(result[0])
    return [nibble_count,result[1]]
      
  @staticmethod
  def AOE(number):
    if number >= 15:
      return [15,NumberEncoders.NoNString(number)]
    else:
      return [number,None]

class _GOSGenerators(object):
  
  @staticmethod
  def type5(font):
    old_12_method = change_method(_c_m_a_p.cmap_format_12_or_13,_decompile_in_cmap_format_12_13, 'decompile')
    cmapTable = font['cmap']
    table_format_12 = None
    for table in cmapTable.tables:
      if table.format == 12:
        table_format_12 = table
        break
    assert table_format_12,'Format 12 must exist'
    ourData = table_format_12.cmap
    nGroups = len(ourData['startCodes'])
    gos_data = bytearray()
    gos_data.extend(struct.pack('>B',5)) # 32 * 3
    gos_data.extend(struct.pack('>H',nGroups))
    for i in xrange(nGroups):
      gos_data.extend(struct.pack('>LLL',ourData['startCodes'][i],ourData['lengths'][i],ourData['gids'][i]))
    change_method(_c_m_a_p.cmap_format_12_or_13,old_12_method,'decompile')
    return gos_data
  
  @staticmethod
  def type3(font):
    old_12_method = change_method(_c_m_a_p.cmap_format_12_or_13,_decompile_in_cmap_format_12_13, 'decompile')
    cmapTable = font['cmap']
    table_format_12 = None
    for table in cmapTable.tables:
      if table.format == 12:
        table_format_12 = table
        break
    assert table_format_12,'Format 12 must exist'
    
    
    change_method(_c_m_a_p.cmap_format_12_or_13,old_12_method,'decompile')
    return gos_data    
  
GOS_Types = {5:_GOSGenerators.type5,
             3:_GOSGenerators.type3}


class CmapCompacter(object):

  def __init__(self, font):
    self.font = font
    
  def generateGOSType(self,type):
    assert type in GOS_Types
    return GOS_Types[type](self.font)

    