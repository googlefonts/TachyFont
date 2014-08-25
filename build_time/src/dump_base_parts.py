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
import sys
import os
import errno
from fontTools.ttLib import TTFont
from compressor import Compressor
from cff_lib import CharSet, decompileDict, DictINDEX, FDSelect, INDEX
from StringIO import StringIO
import argparse
from rle_font import RleFont
from cleanup import cleanup
from base_fonter import BaseFonter
from font_info import FontInfo
from base_header import BaseHeaderPrepare


def main(args):
  """Main program to run preprocessing of the font and dump the base parts
     Arguments:

    font-file
    --output= Output folder of the files, default is current folder
    --hinting=(False|True)  ,default is false
  """
  parser = argparse.ArgumentParser(prog='pyprepfnt')
  parser.add_argument('fontfile',help='Input font file')
  parser.add_argument('--changefont', default=False , action='store_true', help='Font structure has changed, default is True')
  parser.add_argument('--changebase', default=False , action='store_true', help='Base structure has changed, default is True')
  parser.add_argument('--hinting',default=False, action='store_true', help='Enable hinting if specified, no hinting if not present')
  parser.add_argument('--output', default='.' , help='Output folder, default is current folder')

  cmd_args = parser.parse_args(args)

  fontfile = cmd_args.fontfile
  # TODO(bstell) use Logger
  print('preprocess {0}'.format(cmd_args.fontfile))
  basename = os.path.basename(fontfile)
  filename, extension = os.path.splitext(basename)
  output_folder = cmd_args.output+'/'+filename
  try:
      os.makedirs(output_folder)
  except OSError as exception:
      if exception.errno != errno.EEXIST:
          raise
    
  cleanfile = output_folder+'/'+filename + '_clean' + extension
  is_clean = os.path.isfile(cleanfile)
  if not is_clean:
    cleanup(fontfile, cmd_args.hinting, cleanfile)
  
  dump_tables(cleanfile, output_folder)

  print('done')

def dump_tables(fontfile, output):
  font = TTFont(fontfile,lazy=True)
  dump_folder = output + '_tables'
  print('dump results in {0}'.format(dump_folder))
  try:
    os.makedirs(dump_folder)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      raise
    
  header_dict = FontInfo.getInformation(fontfile, FontInfo.TAGS.keys())
  bin_header = BaseHeaderPrepare.prepare(BaseFonter.BASE_VERSION, header_dict)
  print('Base header total size=',len(bin_header))
  
  base_fonter = BaseFonter(fontfile)
  base_dump =  dump_folder + '/base_dump'
  base_fonter.dump_base(base_dump)
  # OpenType tables.
  dump_file = open(base_dump,'r+b')
  tables = font.reader.tables
  for name in font.reader.tables:
    table = tables[name]
    offset = table.offset
    length = table.length
    #print('{0}: offset={1}, length={2}'.format(name, offset, length))
    table_file_name = dump_folder + '/' + name.replace('/', '_')
    table_file = open(table_file_name,'w+b')
    dump_file.seek(offset);
    table_file.write(dump_file.read(length))
    table_file.close()
    rle_table = RleFont(table_file_name)
    rle_table.encode()
    rle_table.write(table_file_name)
    compressor = Compressor(Compressor.GZIP_INPLACE_CMD)
    compressor.compress(table_file_name)
    print('{0}: offset={1:9d}\tlen={2:9d}\tcmp_len={3:9d}'.format(name, offset, length,os.path.getsize(table_file_name+'.gz')))

  print('TODO(bstell) save and compress the CFF parts.')
  if 'CFF ' in font:
    dumpCFFTable(font)

  font.close()

def dumpCFFTable(font):
  cff_reader = font.reader.tables['CFF ']
  cff_data = font.reader['CFF ']
  cff_file = StringIO(cff_data)
  print('cff_reader.offset={0}'.format(cff_reader.offset))
  print('cff_reader.length={0}'.format(cff_reader.length))
 
  cff_file.seek(4) # seek past header
  nameIndex = INDEX(cff_file)
  start, count, offSize, past_end = nameIndex.getInfo()
  print('Name INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  nameIndex.showItems('Name INDEX', 0, 3)
  
  topDictIndex = DictINDEX(cff_file)
  start, count, offSize, past_end = topDictIndex.getInfo()
  print('Top DICT INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  topDictIndex.showItems('Top DICT INDEX', 0, 0, 3)
  # There is only one font in a CID font
  font_dict = topDictIndex.getDict(0)
 
  stringIndex = INDEX(cff_file)
  start, count, offSize, past_end = stringIndex.getInfo()
  print('String INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  stringIndex.showItems('String INDEX', 0, 3)
 
  globalSubrIndex = INDEX(cff_file)
  start, count, offSize, past_end = globalSubrIndex.getInfo()
  print('Global Subr INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  globalSubrIndex.showItems('Global Subr INDEX', 0, 3)
 
  print("CIDFonts do not have an Encodings value")
 
  char_strings_offset = font_dict['CharStrings']
  print('CharStrings = {0}'.format(char_strings_offset))
  cff_file.seek(char_strings_offset)
  charStringsIndex = INDEX(cff_file)
  start, count, offSize, past_end = charStringsIndex.getInfo()
  print('CharStrings INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  num_glyphs = count
 
  charset_offset = font_dict['charset']
  print('charset = {0}'.format(charset_offset))
  cff_file.seek(charset_offset)
  charset = CharSet(cff_file, num_glyphs)
  print('charset: size = {0}'.format(charset.get_size()))
 
  fdselect_offset = font_dict['FDSelect']
  print('FDSelect = {0}'.format(fdselect_offset))
  cff_file.seek(fdselect_offset)
  fdselect = FDSelect(cff_file, num_glyphs)
  print('FDSelect: size = {0}'.format(fdselect.get_size()))
 
  fdarray_offset = font_dict['FDArray']
  print('FDArray = {0}'.format(fdarray_offset))
  cff_file.seek(fdarray_offset)
  fdarray = DictINDEX(cff_file)
  start, count, offSize, past_end = fdarray.getInfo()
  print('Top DICT INDEX: start={0}, count={1}, end={2}'.format(start, count, past_end))
  fdarray.showItems('FDArray', 0, 0, 3)
  fdarray.showItems('FDArray', 1, 0, 3)
  fdcount = count
  subr_len = 0
  for i in range(fdcount):
    private_dict = fdarray.getDict(i)
    length, offset = private_dict['Private']
    #print('private dict {0}: offset={1}, end={2}, length={3}'.format(
    #  i, offset, offset+length, length))
    cff_file.seek(offset)
    data = cff_file.read(length)
    dict = decompileDict(data)
    if 'Subrs' in dict:
      subrs_offset = dict['Subrs']
      cff_file.seek(offset + subrs_offset)
      subrsIndex = INDEX(cff_file)
      start, count, offSize, past_end = subrsIndex.getInfo()
      length = past_end - start
      subr_len += length
      #print('    subrs: start={0}, count={1}, end={2}'.format(
      #  start, count, past_end))
  print('total subr length = {0}'.format(subr_len))




def console_msg(msg):
  pass

if __name__ == '__main__':
  main(sys.argv[1:])
