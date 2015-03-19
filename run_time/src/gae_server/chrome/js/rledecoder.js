'use strict';

/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
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

goog.provide('tachyfont.RLEDecoder');

/**
 * tachyfont.RLEDecoder class to decode RLE'd data
 * @constructor
 */
tachyfont.RLEDecoder = function() {};

/**
 * Defined RLE operations
 * @type {Object}
 */
tachyfont.RLEDecoder.RLE_OPS = {
    0xC0: 'copy',
    0xC8: 'fill'
};

/**
 * Masks to interpret byte code
 * @type {Object}
 */
tachyfont.RLEDecoder.MASKS = {
    SIZE: 0x03,
    OP: 0xFC
};

/**
 * Interpret the byte code
 * @param {number} op Byte code
 * @return {Array.<number>} Array of byte cound and operation
 */
tachyfont.RLEDecoder.byteOp = function(op) {
  var byteCount = op & tachyfont.RLEDecoder.MASKS.SIZE;
  var byteOperation =
    tachyfont.RLEDecoder.RLE_OPS[op & tachyfont.RLEDecoder.MASKS.OP];
  return [byteCount, byteOperation];
};

/**
 * Decode given rle encoded data and return decoded data
 * @param {Array.<DataView>} arr Holds the Rle encoded header and font data.
 * @return {DataView} Decoded data
 */
tachyfont.RLEDecoder.rleDecode = function(arr) {
  // time_start('rle');
  var header_data = arr[0];
  var fontdata = arr[1];
  var readOffset = 0;
  var writeOffset = 0;
  var totalSize = fontdata.getUint32(readOffset);
  if (header_data) {
    writeOffset = header_data.byteLength;
    totalSize += writeOffset;
  }
  var fill_byte;
  var byteOperation;
  var operationSize;
  var operationInfo;
  var i;
  readOffset += 4;
  // time_start('rle_alloc');
  var decodedData = new DataView(new ArrayBuffer(totalSize));
  // time_end('rle_alloc');
  if (header_data) {
    for (i = 0; i < header_data.byteLength; i++) {
      decodedData.setUint8(i, header_data.getUint8(i));
    }
  }
  while (writeOffset < totalSize) {
    byteOperation = fontdata.getUint8(readOffset);
    readOffset++;
    operationInfo = tachyfont.RLEDecoder.byteOp(byteOperation);

    if (operationInfo[0] == 0) {
      operationSize = fontdata.getUint8(readOffset);
      readOffset += 1;
    } else if (operationInfo[0] == 1) {
      operationSize = fontdata.getUint16(readOffset);
      readOffset += 2;
    } else if (operationInfo[0] == 2) {
      operationSize = fontdata.getUint32(readOffset);
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
        decodedData.setUint32(writeOffset, fontdata.getUint32(readOffset));
        readOffset += 4;
        writeOffset += 4;
      }
      for (; i < operationSize; i++) {
        decodedData.setUint8(writeOffset, fontdata.getUint8(readOffset));
        readOffset++;
        writeOffset++;
      }
      // time_end('rle copy ' + operationSize);
    } else if (operationInfo[1] == 'fill') {
      fill_byte = fontdata.getUint8(readOffset);
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
  return decodedData;
};
