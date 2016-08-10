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

goog.provide('tachyfont.utils');




/**
 * Create a font identifying string.
 *
 * @param {string} family The font family name;
 * @param {string} weight The font weight;
 * @return {string} The identifier for this font.
 */
// TODO(bstell): merge this with getDbName
tachyfont.utils.fontId = function(family, weight) {
  // TODO(bstell): need to support slant/width/etc.
  var fontId = family + ';' + weight;
  return fontId;
};


/**
 * Convert a codepoint to a string.
 * This duplicates the String.fromCodePoint function in ES6.
 * Chrome supports this function but the Closure compiler does not recognize
 * this.
 * @param {number} codePoint The codepoint.
 * @return {string}
 */
tachyfont.utils.stringFromCodePoint = function(codePoint) {
  if (codePoint <= 0xFFFF) {
    return String.fromCharCode(codePoint);
  } else {
    codePoint -= 0x10000;
    var highSurrogate = (codePoint >> 10) + 0xD800;
    var lowSurrogate = (codePoint & 0x3FF) + 0xDC00;
    return String.fromCharCode(highSurrogate, lowSurrogate);
  }
};


/**
 * Convert a string to an array of characters.
 * This function handles surrogate pairs.
 * @param {string} str The input string.
 * @return {!Array<string>} The array of characters.
 */
tachyfont.utils.stringToChars = function(str) {
  var charArray = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    var cc = c.charCodeAt(0);
    if (cc >= 0xD800 && cc <= 0xDBFF) {
      i += 1;
      c += str.charAt(i);
    }
    charArray.push(c);
  }
  return charArray;
};


/**
 * Convert a char to its codepoint.
 * This function handles surrogate pairs.
 * @param {string} inputChar The input char (string).
 * @return {number} The numeric value.
 */
tachyfont.utils.charToCode = function(inputChar) {
  var cc = inputChar.charCodeAt(0);
  if (cc >= 0xD800 && cc <= 0xDBFF) {
    var high = (cc - 0xD800) << 10;
    var low = inputChar.charCodeAt(1) - 0xDC00;
    var codepoint = high + low + 0x10000;
    return codepoint;
  } else {
    return cc;
  }
};


if (goog.DEBUG) {
  /** @type {boolean} */
  tachyfont.utils.noObfuscate;

  /**
   * Convert a DataView to a hex string.
   * @param {!DataView} dataView
   * @param {number=} opt_offset
   * @param {number=} opt_length
   * @return {string}
   */
  tachyfont.utils.dataViewToHex = function(dataView, opt_offset, opt_length) {
    var offset = 0;
    var length = dataView.byteLength;
    if (opt_offset != undefined) {
      offset = opt_offset;
    }
    if (opt_length != undefined) {
      length = opt_length;
    }
    var msg = '';
    var i;
    for (i = 0; i < length; i++) {
      if (i % 8 == 0) {
        msg += '    ';
      }
      var number = dataView.getUint8(offset++);
      msg += tachyfont.utils.uint8ToHex(number) + ', ';
      if (i % 8 == 7) {
        msg += '\n';
      }
    }
    if (i % 8) {
      msg += '\n';
    }
    return msg;
  };


  /**
   * Convert a number to hex.
   * @param {number} number The number to convert to hex.
   * @param {number=} opt_length Optional number of hex chars.
   * @return {string}
   */
  tachyfont.utils.numberToHex = function(number, opt_length) {
    // TODO(bstell): if desired, add better length handling.
    if (opt_length == 2) {
      return '0x' + ('00' + number.toString(16)).substr(-2);
    } else {
      return '0x' + ('0000' + number.toString(16)).substr(-4);
    }
  };


  /**
   * Routine to convert an offset to hex.
   * @param {number} offset
   * @param {number} offSize The number of bytes in the offset.
   * @return {string}
   */
  tachyfont.utils.offsetToHexComma = function(offset, offSize) {
    var msg = '';
    for (var i = 0; i < offSize; i++) {
      msg = tachyfont.utils.uint8ToHex(offset & 0xff) + ', ' + msg;
      offset >>= 8;
    }
    return msg;
  };


  /**
   * Routine to convert an 8 bit value to hex.
   * @param {number} number The byte value.
   * @return {string}
   */
  tachyfont.utils.uint8ToHex = function(number) {
    return '0x' + ('0' + number.toString(16)).substr(-2);
  };


  /**
   * Routine to convert an 8 bit value to hex with a comma.
   * @param {number} number The byte value.
   * @return {string}
   */
  tachyfont.utils.uint8ToHexComma = function(number) {
    return '0x' + ('0' + number.toString(16)).substr(-2) + ', ';
  };


  /**
   * Routine to convert a 16 bit value to hex with commas.
   * @param {number} number The byte value.
   * @return {string}
   */
  tachyfont.utils.uint16ToHexComma = function(number) {
    var msg = '';
    msg += tachyfont.utils.uint8ToHex((number >> 8) & 0xff) + ', ';
    msg += tachyfont.utils.uint8ToHex((number >> 0) & 0xff) + ', ';
    return msg;
  };


  /**
   * Routine to convert a 32 bit value to hex with commas.
   * @param {number} number The byte value.
   * @return {string}
   */
  tachyfont.utils.uint32ToHexComma = function(number) {
    var msg = '';
    msg += tachyfont.utils.uint8ToHex((number >> 24) & 0xff) + ', ';
    msg += tachyfont.utils.uint8ToHex((number >> 16) & 0xff) + ', ';
    msg += tachyfont.utils.uint8ToHex((number >> 8) & 0xff) + ', ';
    msg += tachyfont.utils.uint8ToHex((number >> 0) & 0xff) + ', ';
    return msg;
  };


  /**
   * Routine to display a range of bytes in a sfnt.
   * @param {!tachyfont.BinaryFontEditor} binaryEditor The binary editor.
   * @param {number} offset The starting offset to display.
   * @param {number} length The length to display.
   * @return {string}
   */
  tachyfont.utils.binaryEditorBytesToHexComma =
      function(binaryEditor, offset, length) {
    binaryEditor.seek(offset);
    var msg = '';
    var i;
    for (i = 0; i < length; i++) {
      if (i % 8 == 0) {
        msg += '    ';
      }
      var number = binaryEditor.getUint8();
      msg += tachyfont.utils.uint8ToHex(number) + ', ';
      if (i % 8 == 7) {
        msg += '\n';
      }
    }
    if (i % 8) {
      msg += '\n';
    }
    return msg;
  };



}

