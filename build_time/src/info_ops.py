from fontTools.cffLib import Index
from fontTools.ttLib import TTFont
from struct import pack
  
  
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
    return pack('>H',font['maxp'].numGlyphs)
  
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
    
    
    
    