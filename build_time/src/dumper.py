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

from struct import pack
from json import dumps


class Dumper(object):
  """
  Dumps the given object or array of objects to the file
  """

  def __init__(self, filename):
    self.file = open(filename, 'wb')

  def dump(self, data):
    """
    Dump given binary string to the file
    """
    self.file.write(data)

  def dump_fmt(self, data, fmt):
    """
    Dump given data to the file using given format
    """
    self.file.write(pack(fmt, data))

  def dump_array(self, arr, fmt_entry, endian):
    """
    Dump given array of data to file using format of each entry in array
    """
    self.file.write(pack(endian + fmt_entry * len(arr), *arr))

  def dump_for_each(self, arr):
    """
    Dump array of data directly to file
    """
    for datum in arr:
      self.file.write(datum)

  def dump_object(self, obj):
    """
    Dump given object as JSON string to the file
    """
    self.file.write(dumps(obj))

  def close(self):
    self.file.close()
