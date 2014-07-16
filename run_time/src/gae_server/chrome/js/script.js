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



var global_start_time = Date.now();

var RLE_OPS = {
    0xC0: 'copy',
    0xC8: 'fill'
};
var TEMPORARY_FS_REQUEST_SIZE = 8 * 1024 * 1024;
var EMPTY_FS = false;
var RESULTS = [];

function time_start(msg) {
  console.time('@@@ ' + msg);
  console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('begin ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ begin ' + msg + ' at ' + cur_time);
}

function time_end(msg) {
  console.timeEnd('@@@ ' + msg);
  console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('end ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ end ' + msg + ' at ' + cur_time);
}

function updateResults() {
  var resultsElem = document.getElementById('results');
  var aResult;
  while (resultsElem && (aResult = RESULTS.shift())) {
    resultsElem.appendChild(document.createTextNode(aResult));
    resultsElem.appendChild(document.createElement('br'));
  }
}

function requestURL(url, method, data, headerParams, responseType) {
  // time_start('fetch ' + url)
  return new Promise(function(resolve, reject) {
    var oReq = new XMLHttpRequest();
    oReq.open(method, url, true);
    for (var param in headerParams)
      oReq.setRequestHeader(param, headerParams[param]);
    oReq.responseType = responseType;
    oReq.onload = function(oEvent) {
      if (oReq.status == 200) {
        // time_end('fetch ' + url)
        resolve(oReq.response);
      } else
        reject(oReq.status + ' ' + oReq.statusText);
    };
    oReq.onerror = function() {
      reject(Error('Network Error'));
    };
    oReq.send(data);
  });
}

function requestTemporaryFileSystem(grantedSize) {
  window.requestFileSystem = window.requestFileSystem ||
  window.webkitRequestFileSystem;
  return new Promise(function(resolve, reject) {
    window.requestFileSystem(window.TEMPORARY, grantedSize, resolve, reject);
  });
}

function byteOp(op) {
  var byteCount = op & 0x03;
  var byteOperation = RLE_OPS[op & 0xFC];
  return [
      byteCount, byteOperation
  ];
}

function rleDecode(array_buffer) {
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
    operationInfo = byteOp(byteOperation);

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
}


