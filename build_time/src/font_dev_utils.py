"""
  Copyright 2015 Google Inc. All rights reserved.

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

import string

def display_file(file):
  data = file.read()
  b = bytearray()
  b.extend(data)
  display_bytes(b)
  pass

def display_bytes(bytes):
  lineCount = 8
  as_chars = ''
  print "length =", len(bytes)
  for i in range(len(bytes)):
    if (i % lineCount == 0):
      print "   ",
    print("0x%02x," % (bytes[i])),
    this_char = chr(bytes[i])
    if this_char in string.ascii_letters or this_char in string.digits:
      as_chars += this_char
    else:
      as_chars += '.'
    if (i and (i % lineCount == lineCount - 1)):
      lineStart = i - lineCount + 1
      print "// 0x%04X / %5d" % (lineStart, lineStart),
      print ' ', as_chars
      as_chars = ''
  fill_in = lineCount - (i % lineCount + 1)
  for j in range(fill_in):
    print '     ',
    as_chars += '.'
  lineStart += lineCount
  print "// 0x%04X / %5d" % (lineStart, lineStart),
  print ' ', as_chars
