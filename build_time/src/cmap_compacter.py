from fontTools_wrapper_funcs import _decompile_in_cmap_format_12_13,\
  change_method
from fontTools.ttLib.tables import _c_m_a_p
import struct



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
    pass
    ourData = table_format_12.cmap
    nGroups = len(ourData['startCodes'])
    gos_data = bytearray()
    gos_data.extend(struct.pack('>B',5)) # 32 * 3
    gos_data.extend(struct.pack('>H',nGroups))
    for i in xrange(nGroups):
      gos_data.extend(struct.pack('>LLL',ourData['startCodes'][i],ourData['lengths'][i],ourData['gids'][i]))
    change_method(_c_m_a_p.cmap_format_12_or_13,old_12_method,'decompile')
    return gos_data
  
GOS_Types = {5:_GOSGenerators.type5}


class CmapCompacter(object):

  def __init__(self, font):
    self.font = font
    
  def generateGOSType(self,type):
    assert type in GOS_Types
    return GOS_Types[type](self.font)

    