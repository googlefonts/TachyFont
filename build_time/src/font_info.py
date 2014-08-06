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
