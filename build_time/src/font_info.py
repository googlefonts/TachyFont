from fontTools.ttLib import TTFont
from info_ops import InfoOps
import sys

class FontInfo(object):
  
  TAGS = {'GLOF': 
            {'desc':'Start of the glyphs data relative to font file start', 
             'fn': InfoOps._getGLOF
             },
          'GLCN': 
            {'desc': 'Number of glyphs in the font', 
             'fn': InfoOps._getGLCN
             },
          'LCOF': 
            {'desc': 'Start of the offsets to glyphs relative to font file start', 
             'fn': InfoOps._getLCOF
             },
          'LCFM': 
            {'desc': 'Offset size of the offsets in loca table', 
             'fn': InfoOps._getLCFM
             },
          'HMOF': 
            {'desc':'Start of the HMTX table relative to font file start', 
             'fn': InfoOps._getHMOF
             },
          'VMOF': 
            {'desc':'Start of the VMTX table relative to font file start', 
             'fn': InfoOps._getVMOF
             },
          'HMMC': 
            {'desc': 'Number of hmetrics in hmtx table', 
             'fn': InfoOps._getHMMC
             },
          'VMMC': 
            {'desc': 'Number of vmetrics in vmtx table', 
             'fn': InfoOps._getVMMC
             },
          'TYPE': 
            {'desc':'Type of the font, either TTF or CFF', 
             'fn': InfoOps._getTYPE
             },
          'CCMP': 
            {'desc':'Compact CMAP', 
             'fn': InfoOps._getCCMP
             },
          'CM12': 
            {'desc':'Start offset and number of groups in cmap format 12 table', 
             'fn': InfoOps._getCM12
             }
        }
  
  @staticmethod
  def getInformation(fontfile, tags):
    font = TTFont(fontfile)
    dict_of_data = {}
    for tag in tags:
      assert tag in FontInfo.TAGS
      result = FontInfo.TAGS[tag]['fn'](font)
      if result:
        dict_of_data[tag] = result
    font.close()
    return dict_of_data


if __name__ == '__main__':
  bin_head = FontInfo.getInformation(sys.argv[1],FontInfo.TAGS.keys())
  pass
