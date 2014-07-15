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

from os import system


class Compressor(object):
  """Runs external executable with given input file and produce output file
  """

  LZMA_CMD = 'lzma -7 -c "%s" > "%s"'
  GZIP_CMD = 'gzip -9 - <"%s"  >"%s"'

  def __init__(self, cmd):
    self.cmd = cmd

  def compress(self, input, output):
    status = system(self.cmd % (input, output))
    if status != 0:
      raise Exception('creating xz')
