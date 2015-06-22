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
import struct

class BaseHeaderPrepare(object):

  MAGIC = b'BSAC'

  @staticmethod
  def prepare(version,dict_of_objects):
    bin_head = bytearray(BaseHeaderPrepare.MAGIC)
    bin_head.extend(struct.pack('>L',version))
    count = len(dict_of_objects)
    bin_head.extend(struct.pack('>H',count))
    bin_head_data = bytearray()
    running_offset = 0
    for tag, data in dict_of_objects.iteritems():
      assert len(tag) == 4
      bin_head.extend(tag)
      bin_head.extend(struct.pack('>L',running_offset)) #H is small for cmap
      running_offset += len(data)
      bin_head_data.extend(data)
    bin_head.extend(bin_head_data)
    bin_head = bin_head[:4] + struct.pack('>L',len(bin_head)+4) + bin_head[4:]

    return bin_head






