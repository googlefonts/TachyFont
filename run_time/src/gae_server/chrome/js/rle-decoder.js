'use strict';

/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

/**
 * RLEDecoder class to decode RLE'd data
 * @constructor
 */
function RLEDecoder() {}

/**
 * Defined RLE operations
 * @type {Object}
 */
RLEDecoder.RLE_OPS = {
    0xC0: 'copy',
    0xC8: 'fill'
};

/**
 * Masks to interpret byte code
 * @type {Object}
 */
RLEDecoder.MASKS = {
    SIZE: 0x03,
    OP: 0xFC
};

/**
 * Interpret the byte code
 * @param {byte} op Byte code
 * @return {Array} Array of byte cound and operation
 */
RLEDecoder.byteOp = function(op) {
  var byteCount = op & RLEDecoder.MASKS.SIZE;
  var byteOperation = RLEDecoder.RLE_OPS[op & RLEDecoder.MASKS.OP];
  return [byteCount, byteOperation];
};

/**
 * Decode given array_buffer and return decoded data
 * @param {ArrayBuffer} array_buffer Encoded data
 * @return {ArrayBuffer} Decoded data
 */
RLEDecoder.rleDecode = function(array_buffer) {
  // time_start('rle');
  var readOffset = 0;
  var writeOffset = 0;
  var data = new DataView(array_buffer);
  var totalSize = data.getUint32(readOffset);
  var fill_byte;
  var byteOperation;
  var operationSize;
  var operationInfo;
  var i;
  readOffset += 4;
  // time_start('rle_alloc');
  var decodedData = new DataView(new ArrayBuffer(totalSize));
  // time_end('rle_alloc');
  while (writeOffset < totalSize) {
    byteOperation = data.getUint8(readOffset);
    readOffset++;
    operationInfo = RLEDecoder.byteOp(byteOperation);

    if (operationInfo[0] == 0) {
      operationSize = data.getUint8(readOffset);
      readOffset += 1;
    } else if (operationInfo[0] == 1) {
      operationSize = data.getUint16(readOffset);
      readOffset += 2;
    } else if (operationInfo[0] == 2) {
      operationSize = data.getUint32(readOffset);
      readOffset += 4;
    }
    if (operationInfo[1] == 'copy') {
      // time_start('rle copy ' + operationSize);
      // Each DataView operation is slow so minimize the number of operations.
      // https://code.google.com/p/chromium/issues/detail?id=225811
      var long_len = operationSize & ~3;
      i = 0;
      // This loop tests for "less than" but increments by 4. We know this works
      // because the long_len was forced down to a multiple of 4.
      for (; i < long_len; i += 4) {
        decodedData.setUint32(writeOffset, data.getUint32(readOffset));
        readOffset += 4;
        writeOffset += 4;
      }
      for (; i < operationSize; i++) {
        decodedData.setUint8(writeOffset, data.getUint8(readOffset));
        readOffset++;
        writeOffset++;
      }
      // time_end('rle copy ' + operationSize);
    } else if (operationInfo[1] == 'fill') {
      fill_byte = data.getUint8(readOffset);
      // time_start('rle fill ' + fill_byte + ' ' + operationSize);
      readOffset++;
      if (fill_byte != 0) {
        for (i = 0; i < operationSize; i++) {
          decodedData.setUint8(writeOffset, fill_byte);
          writeOffset++;
        }
      } else {
        writeOffset += operationSize;
      }
      // time_end('rle fill ' + fill_byte + ' ' + operationSize);
    }

  }
  // time_end('rle');
  return decodedData.buffer;
};


