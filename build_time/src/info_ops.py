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
from fontTools.cffLib import Index
from struct import pack
from fontTools_wrapper_funcs import change_method, _decompile_in_table_cmap
from fontTools.ttLib.tables import _c_m_a_p
from cmap_compacter import CmapCompacter

  
  
class InfoOps(object):
    
  @staticmethod
  def _not_implemented(font):
    return None
  
  @staticmethod
  def _getGLOF(font):
    isCFF = 'CFF ' in font
    if isCFF:
      cffTableOffset = font.reader.tables['CFF '].offset
      cffTable = font['CFF '].cff
      assert len(cffTable.fontNames) == 1
      charStringOffset = cffTable[cffTable.fontNames[0]].rawDict['CharStrings']
      inner_file = font.reader.file
      inner_file.seek(cffTableOffset + charStringOffset)
      rawIndexFile = Index(inner_file)
      return pack('>L',rawIndexFile.offsetBase)
    else:
      assert 'glyf' in font
      return pack('>L',font.reader.tables['glyf'].offset)
  
  @staticmethod
  def _getGLCN(font):
    assert 'maxp' in font 
    #for CFF it is also same because, tool supports only CFF which has only one font
    numGlyphs = font['maxp'].numGlyphs
    print(numGlyphs , end=',')
    return pack('>H',numGlyphs)
  
  @staticmethod
  def _getLCOF(font):
    isCFF = 'CFF ' in font
    if isCFF:
      cffTableOffset = font.reader.tables['CFF '].offset
      cffTable = font['CFF '].cff
      assert len(cffTable.fontNames) == 1 #only one font should be present
      charStringOffset = cffTable[cffTable.fontNames[0]].rawDict['CharStrings']
      return pack('>L',cffTableOffset+charStringOffset+2+1) #2byte:count and 1byte:offSize
    else:
      assert 'loca' in font
      return pack('>L',font.reader.tables['loca'].offset)
  
  @staticmethod
  def _getLCFM(font):
    isCFF = 'CFF ' in font
    if isCFF:
      cffTableOffset = font.reader.tables['CFF '].offset
      cffTable = font['CFF '].cff
      assert len(cffTable.fontNames) == 1 #only one font should be present
      charStringOffset = cffTable[cffTable.fontNames[0]].rawDict['CharStrings']
      font.reader.file.seek(cffTableOffset+charStringOffset+2)
      offSize = font.reader.file.read(1)
      return offSize
    else:
      assert 'head' in font
      offSize = 2 if font['head'].indexToLocFormat == 0 else 4
      return pack('B',offSize)
      
  
  @staticmethod
  def _getHMOF(font):
    assert 'hmtx' in font
    return pack('>L',font.reader.tables['hmtx'].offset)
  
  @staticmethod
  def _getVMOF(font):
    if 'vmtx' in font:
      return pack('>L',font.reader.tables['vmtx'].offset)
    return None
  
  @staticmethod
  def _getHMMC(font):
    assert 'hhea' in font
    return pack('>H',font['hhea'].numberOfHMetrics)
  
  @staticmethod
  def _getVMMC(font):
    if 'vhea' in font:
      return pack('>H',font['vhea'].numberOfVMetrics)
    return None
  
  @staticmethod
  def _getTYPE(font):
    if 'glyf' in font:
      return '\1'
    if 'CFF ' in font:
      return '\0'
    return None
  
  @staticmethod
  def _getCCMP(font):
    cmapTables = font['cmap']
    cmap12 = cmapTables.getcmap(3, 10) #format 12
    cmap4 = cmapTables.getcmap(3, 1) #format 4
    if cmap4 and cmap12:
      compacter = CmapCompacter(font)
      data = compacter.generateGOSTypes([2,4])
      return data
    else:
      return None
  
  @staticmethod
  def _getCM12(font):
    old_cmap_method = change_method(_c_m_a_p.table__c_m_a_p, _decompile_in_table_cmap,'decompile')
    cmap_offset = font.reader.tables['cmap'].offset
    cmapTables = font['cmap']
    change_method(_c_m_a_p.table__c_m_a_p,old_cmap_method,'decompile')
    
    cmap12 = cmapTables.getcmap(3, 10) #format 12
    if cmap12:
      offset = cmap_offset + cmap12.offset
      nGroups =cmap12.nGroups
      #print 'cmap12 size',cmap12.length,'bytes'
      return pack('>LL',offset,nGroups)      

    return None

  @staticmethod
  def _getCM04(font):
    old_cmap_method = change_method(_c_m_a_p.table__c_m_a_p, _decompile_in_table_cmap,'decompile')
    cmap_offset = font.reader.tables['cmap'].offset
    cmapTables = font['cmap']
    change_method(_c_m_a_p.table__c_m_a_p,old_cmap_method,'decompile')
    cmap12 = cmapTables.getcmap(3, 10) #format 12
    cmap4 = cmapTables.getcmap(3, 1) #format 4
    if cmap4 and cmap12:
      offset = cmap_offset + cmap4.offset
      length = cmap4.length
      #print 'cmap4 size',cmap4.length,'bytes'
      return pack('>LL',offset,length)      

    return None

  @staticmethod
  def _getCS02(font):
    isCFF = 'CFF ' in font
    if isCFF:
      compacter = CmapCompacter(font)
      data = compacter.generateGOSType(6)
      return data
    else:
      return None
    
    
    
    