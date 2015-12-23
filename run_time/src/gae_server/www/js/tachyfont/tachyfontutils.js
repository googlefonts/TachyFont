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
goog.provide('tachyfont.utils.IncrementalFontLoader');
goog.provide('tachyfont.utils.uint8');


/**
 * Enable/disable using/saving persisted data.
 *
 * @type {boolean}
 */
tachyfont.utils.persistData = true;


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
 * A mapping from css weight names to weights.
 *
 * @type {!Object.<string, string>}
 */
tachyfont.utils.cssWeightToNumber = {
  'lighter': '300',
  'normal': '400',
  'bold': '700',
  'bolder': '800'
};


/**
 * A map of the codepoints that should be blank.
 *
 * @type {!Object.<number, number>}
 */
tachyfont.utils.BLANK_CHARS = {
  // White space characters.
  0x0009: 1, 0x000A: 1, 0x000B: 1, 0x000C: 1, 0x000D: 1, 0x0020: 1, 0x0085: 1,
  0x00A0: 1, 0x1680: 1, 0x2000: 1, 0x2001: 1, 0x2002: 1, 0x2003: 1, 0x2004: 1,
  0x2005: 1, 0x2006: 1, 0x2007: 1, 0x2008: 1, 0x2009: 1, 0x200A: 1, 0x2028: 1,
  0x2029: 1, 0x202F: 1, 0x205F: 1, 0x3000: 1,

  // Default ignorable character set Source:
  // http://www.unicode.org/L2/L2002/02368-default-ignorable.pdf
  // "Default-ignorable code points ... have no visible glyph"
  0x00AD: 1, 0x034F: 1, 0x061C: 1, 0x115F: 1, 0x1160: 1, 0x17B4: 1, 0x17B5: 1,
  0x3164: 1, 0x180B: 1, 0x180C: 1, 0x180D: 1, 0x180E: 1, 0x200B: 1, 0x200C: 1,
  0x200D: 1, 0x200E: 1, 0x200F: 1, 0x202A: 1, 0x202B: 1, 0x202C: 1, 0x202D: 1,
  0x202E: 1, 0x2060: 1, 0x2061: 1, 0x2062: 1, 0x2063: 1, 0x2064: 1, 0x2065: 1,
  0x2066: 1, 0x2067: 1, 0x2068: 1, 0x2069: 1, 0x206A: 1, 0x206B: 1, 0x206C: 1,
  0x206D: 1, 0x206E: 1, 0x206F: 1, 0xFE00: 1, 0xFE01: 1, 0xFE02: 1, 0xFE03: 1,
  0xFE04: 1, 0xFE05: 1, 0xFE06: 1, 0xFE07: 1, 0xFE08: 1, 0xFE09: 1, 0xFE0A: 1,
  0xFE0B: 1, 0xFE0C: 1, 0xFE0D: 1, 0xFE0E: 1, 0xFE0F: 1, 0xFEFF: 1, 0xFFA0: 1,
  0x1D173: 1, 0x1D174: 1, 0x1D175: 1, 0x1D176: 1, 0x1D177: 1, 0x1D178: 1,
  0x1D179: 1, 0x1D17A: 1
};


/**
 * If the number of characters in the request is less than this count then add
 * additional characters to obfuscate the actual request.
 *
 * @type {number}
 */
tachyfont.utils.MINIMUM_NON_OBFUSCATION_LENGTH = 20;


/**
 * The range of characters to pick from.
 *
 * @type {number}
 */
tachyfont.utils.OBFUSCATION_RANGE = 256;


/**
 * @typedef {number}
 */
tachyfont.utils.uint8;


/**
 * @typedef {Object}
 */
tachyfont.utils.IncrementalFontLoader;


/**
 * Convert a codepoint to a string.
 *
 * This duplicates the String.fromCodePoint function in ES6.
 *
 * Chrome supports this function but the Closure compiler does not recognize
 * this.
 *
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
 *
 * @param {string} str The input string.
 * @return {Array.<string>} The array of characters.
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
 *
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
   *
   * @param {DataView} dataView The DataView.
   * @param {number=} opt_length An optional length;
   * @return {string}
   */
  tachyfont.utils.dataViewToHex = function(dataView, opt_length) {
    // TODO(bstell): code this.
    var str = '';
    return str;
  };



  /**
   * Report the list of codepoints.
   *
   * @param {string} title The title of the codepoint list.
   * @param {!Array.<number>} codesIn The array of codepoints.
   */
  tachyfont.utils.reportCodes = function(title, codesIn) {
    if (goog.DEBUG) {
      if (codesIn.constructor != Array) {
        console.log('tachyfont.utils.codesIn: expected Array but got ' +
            codesIn.constructor);
        debugger; // For debugging a utility function.
        return;
      }
      var codes = codesIn.slice();
      codes.sort(function(a, b) { return a - b });

      console.log('----------');
      console.log(title + ':');
      var formattedOutput = '  ';
      var str = '';
      for (var i = 0; i < codes.length; i++) {
        var code = codes[i];
        if (typeof codes[i] != 'number') {
          console.log(title + '[' + i + '] not a number: ' + typeof codes[0]);
          debugger; // For debugging a utility function.
          return;
        }
        formattedOutput +=
            ' 0x' + ('00000' + code.toString(16)).substr(-5) + ',';
        str += tachyfont.utils.stringFromCodePoint(code);
        if (i % 8 == 7) {
          formattedOutput += '   "' + str + '"';
          console.log(formattedOutput);
          formattedOutput = '  ';
          str = '';
        }
      }
      if (i && i % 8 != 0) {
        formattedOutput += '   "' + str + '"';
        console.log(formattedOutput);
      }
      if (codes.length == 0) {
        console.log('  <no codes>');
      }
      console.log('----------');
    }
  };
  /**
   * Convert a number to hex.
   * @param {number} number The number to convert to
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

}

