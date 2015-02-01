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
from struct import pack
from dumper import Dumper


class GlyfSerializer(object):
  """Serializes 'glyf' table for given font file
  """
  # formats
  fmt_TOC = '>4sHH'
  fmt_TOCEntry = '>4sLL'
  fmt_GlyphTable = '>HH'

  # flags
  NONE = 0
  HAS_HMTX = 1 << 0
  HAS_VMTX = 1 << 1
  CMP_NONE = NONE
  CMP_GZIP = (1 << 2) + NONE
  CMP_BROTLI = (1 << 2) + (1 << 2)
  CMP_LZMA = (1 << 2) + (1 << 3)
  CLEAN = NONE
  DIRTY = (1 << 6)

  def __init__(self, fontfile):
    self.font = TTFont(fontfile)

  def prepare_TOC(self):
    """Prepare TOC header and entries as data
    """
    self.TOC = pack(GlyfSerializer.fmt_TOC, self.font.reader.sfntVersion, 0,
                    self.font.reader.numTables)
    self.TOCEntries = []
    tags = sorted(self.font.reader.keys())
    assert len(
        tags) == self.font.reader.numTables, 'Unexpected number of tables'
    for tag in tags:
      entry = self.font.reader.tables[tag]
      TOCEntry = (
          pack(
              GlyfSerializer.fmt_TOCEntry, tag, entry.offset,
              entry.length))
      self.TOCEntries.append(TOCEntry)
    self.tocReady = True

  def __determine_mtx_fmt(self):
    self.fmt_mtx = ''
    self.has_hmtx_ = GlyfSerializer.HAS_HMTX if ('hmtx' in self.font)\
     else GlyfSerializer.NONE
    if self.has_hmtx_:
      self.fmt_mtx += 'h'
      self.HMTX = self.font['hmtx']
    self.has_vmtx_ = GlyfSerializer.HAS_VMTX if ('vmtx' in self.font)\
       else GlyfSerializer.NONE
    if self.has_vmtx_:
      self.fmt_mtx += 'h'
      self.VMTX = self.font['vmtx']

  def prepare_glyf(self):
    """Prepare Glyf table and table entries along with Glyf data
    """
    self.__determine_mtx_fmt()
    self.fmt_GlyphEntry = '>H' + self.fmt_mtx + 'LH'
    assert 'maxp' in self.font
    numGlyphs = self.font['maxp'].numGlyphs
    self.GlyphTable = (
        pack(
            GlyfSerializer.fmt_GlyphTable,
            (
                self.has_hmtx_ | self.has_vmtx_ | GlyfSerializer.CLEAN),
            numGlyphs))
    self.glyphs_info = []
    self.glyphs_data = []
    glyphOrder = self.font.getGlyphOrder()
    assert 'loca' in self.font
    glyf_table_start = self.font.reader.tables['glyf'].offset
    offset_table = self.font['loca'].locations
    for i in xrange(numGlyphs):
      offset = offset_table[i]
      length = offset_table[i + 1] - offset
      self.font.reader.file.seek(glyf_table_start + offset)
      self.glyphs_data.append(self.font.reader.file.read(length))
      args = [i]
      if self.has_hmtx_: args.append(self.HMTX.metrics[glyphOrder[i]][1])
      if self.has_vmtx_: args.append(self.VMTX.metrics[glyphOrder[i]][1])
      args.append(offset)
      args.append(length)
      glyph_info = pack(self.fmt_GlyphEntry, *args)
      self.glyphs_info.append(glyph_info)

    self.glyfReady = True

  def serialize_TOC(self, output_idx, output_data):
    """Dump the TOC data to the file
    """
    # TODO(bstell) remove this is not used anywhere
    if self.tocReady:
      dumper = Dumper(output_idx)
      dumper.dump(self.TOC)
      dumper.close()
      dumper = Dumper(output_data)
      dumper.dumpForEach(self.TOCEntries)
      dumper.close()

  def serialize_glyf(self, output_idx, output_data):
    """Dump the Glyf data to the file
    """
    if self.glyfReady:
      dumper = Dumper(output_idx)
      dumper.dump(self.GlyphTable)
      dumper.dump_for_each(self.glyphs_info)
      dumper.close()
      dumper = Dumper(output_data)
      dumper.dump_for_each(self.glyphs_data)
      dumper.close()

  def close(self):
    self.font.close()
