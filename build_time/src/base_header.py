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
      bin_head.extend(struct.pack('>H',running_offset))
      running_offset += len(data)
      bin_head_data.extend(data)
    bin_head.extend(bin_head_data)
    bin_head = bin_head[:4] + struct.pack('>L',len(bin_head)+4) + bin_head[4:]
    
    return bin_head
      
    
    
              

    