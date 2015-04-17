/**
 * Utility TachyFont test routines.
 *
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Author: bstell@google.com (Brian Stell)
 */

goog.provide('tachyfont_misc_utils');



/**
 * A debug utility routine to display bytes in hexascii.
 *
 * @param {string} name The variable name of the data.
 * @param {ArrayBuffer} bytes The data bytes.
 */
tachyfont_misc_utils.hexdump = function(name, bytes) {
  var numChars = 8;
  console.log('  var ' + name + ' = [');
  var uint8Bytes = new Uint8Array(bytes);
  for (var i = 0; i < bytes.byteLength; i += numChars) {
    var formattedOutput = '   ';
    for (var j = 0; j < numChars; j++) {
      if (i + j < uint8Bytes.length) {
        var aByte = uint8Bytes[i + j];
        formattedOutput += ' 0x' + ('00' + aByte.toString(16)).substr(-2) + ',';
      } else {
        formattedOutput += '      ';
      }
    }
    formattedOutput += ' // ';
    formattedOutput += '0x' + ('00000000' + i.toString(16)).substr(-4) +
        ' / ' + ('        ' + i.toString(10)).substr(-5) + '   ';
    for (var j = 0; j < numChars; j++) {
      if (i + j < uint8Bytes.length) {
        var aByte = uint8Bytes[i + j];
        if (aByte >= 0x20 && aByte <= 0x7f) {
          formattedOutput += String.fromCharCode(aByte);
        } else {
          formattedOutput += '.';
        }
      } else {
        formattedOutput += ' ';
      }
    }
    console.log(formattedOutput);
  }
  console.log('  ];');
};
