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
from fontTools_wrapper_funcs import change_method,_decompile_in_cmap_format_12_13
from fontTools.ttLib.tables import _c_m_a_p
import struct
import bitarray


def generateDeltaArray(input_arr):
  input_len = len(input_arr)
  assert input_len > 0
  deltas = [None] * input_len
  deltas[0] = input_arr[0]
  idx = 1
  while idx < input_len:
    deltas[idx] = input_arr[idx]-input_arr[idx-1]
    idx+=1
  return deltas

def add_to_extra_if_necessary(gos_data, extra_data, delta_code_result):
  if type(delta_code_result) is list:
    gos_data.extend(delta_code_result[0])
    non_repr = NumberEncoders.NoNString(delta_code_result[1])
    extra_data.extend(non_repr)
  else:
    gos_data.extend(delta_code_result)
      
class NumberEncoders(object):

  @staticmethod
  def NibbleBin(number):
    if number == 0:
      return [1,'0000']
    assert number > 0,'takes only positive numbers'
    count = 0
    copy_number = number
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
    nibble_count = NumberEncoders.NibbleBin(result[0])[1]
    return nibble_count+result[1]
      
  @staticmethod
  def AOE(number, bit_count):
    if number < 2 ** bit_count - 1:
      return bin(number)[2:].zfill(bit_count)
    else:
      return ['1' * bit_count , number]

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
    ourData = table_format_12.cmap
    deltaCodePoints = generateDeltaArray(ourData['startCodes'])
    lengths = ourData['lengths']
    gids = ourData['gids']
    nGroups = len(gids)
    gos_data = bitarray.bitarray(endian='big')
    extra_data = bitarray.bitarray(endian='big')
    gos_data.frombytes(struct.pack('>B',3))
    gos_data.frombytes(struct.pack('>H',nGroups))
    for idx in xrange(nGroups):
      delta_code_result = NumberEncoders.AOE(deltaCodePoints[idx],5)
      add_to_extra_if_necessary(gos_data, extra_data, delta_code_result)
      len_result = NumberEncoders.AOE(lengths[idx],3)
      add_to_extra_if_necessary(gos_data, extra_data, len_result)     
      gos_data.frombytes(struct.pack('>H',gids[idx]))
    
    change_method(_c_m_a_p.cmap_format_12_or_13,old_12_method,'decompile')
    gos_bytes = gos_data.tobytes()
    extra_bytes = extra_data.tobytes()
    return gos_bytes + extra_bytes
  
GOS_Types = {5:_GOSGenerators.type5,
             3:_GOSGenerators.type3}


class CmapCompacter(object):

  def __init__(self, font):
    self.font = font
    
  def generateGOSType(self,type):
    assert type in GOS_Types
    return GOS_Types[type](self.font)

    