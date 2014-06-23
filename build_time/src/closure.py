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
import struct
from closure_taker import ClosureTaker
from dumper import Dumper

 
def dumpClosureMap(fontfile, outputfolder):
  """
  Takes closure of each glyph in the font and dump them into the two
  seperate files
  """

  font = TTFont(fontfile)
  closurer = ClosureTaker(font)

  dumpHead = Dumper(outputfolder + '/closure_idx')
  dumpBody = Dumper(outputfolder + '/closure_data')
  bigEndian = '>'
  fmt_offset = '>l'  # offset - length
  fmt_size = '>H'
  fmt_elem = 'H'
  elem_size = struct.calcsize(fmt_elem)
  offset = 0
  for g in font.getGlyphOrder():
    closurer.clear()
    closurer.addGlyphNames([g])
    glyphsClosure = closurer.closure()
    id = closurer.glyphNameToId[g]
    if len(glyphsClosure) != 1 or id not in glyphsClosure: 
      size = elem_size * len(glyphsClosure)
      dumpBody.dumpArray(glyphsClosure, fmt_elem, bigEndian)
      dumpHead.dumpFmt(offset,fmt_offset )
      dumpHead.dumpFmt(size,fmt_size )
      #print id,g,glyphsClosure
      offset += size
    else:
      dumpHead.dumpFmt(-1,fmt_offset)
      dumpHead.dumpFmt(0,fmt_size)

  font.close()
  dumpBody.close()
  dumpHead.close()
