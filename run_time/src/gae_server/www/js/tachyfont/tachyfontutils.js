'use strict';

/**
 * @license
 * Copyright 2014-2015 Google Inc. All rights reserved.
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

goog.require('goog.crypt.Md5');


/**
 * Convert a codepoint to a string.
 *
 * This duplicates the String.fromCodePoint function in ES6.
 *
 * Chrome supports this function but the Closure compiler does not recognize
 * this.
 *
 * @param {!number} codePoint The codepoint.
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
 * Report the chars in the charList.
 *
 * @param {!Object.<!string, !number>} charList The list of loaded chars.
 */
tachyfont.utils.reportCharList = function(title, charList) {
  if (goog.DEBUG) {
    if (charList.constructor != Object) {
      console.log('tachyfont.utils.reportCharList: expected Object but got ' +
        charList.constructor);
      debugger;
      return;
    }
    var charListArray = Object.keys(charList);

    var codes = [];
    for (var i = 0; i < charListArray.length; i++) {
      if (typeof charListArray[i] != 'string') {
        console.log(title + '[' + i + '] not a character: ' +
          typeof charListArray[i]);
        debugger;
      }
      var code = tachyfont.charToCode(charListArray[i]);
      codes.push(code);
    }
    tachyfont.utils.reportCodes(title, codes);
  }
};

/**
 * Report the list of codepoints.
 *
 * @param {string} title The title of the codepoint list.
 * @param {!Array.<!number>} codesIn The array of codepoints.
 */
tachyfont.utils.reportCodes = function(title, codesIn) {
  if (goog.DEBUG) {
    if (codesIn.constructor != Array) {
      console.log('tachyfont.utils.codesIn: expected Array but got ' +
        codesIn.constructor);
      debugger;
      return;
    }
    var codes = codesIn.slice();
    codes.sort(function(a, b){ return a - b });

    console.log('----------');
    console.log(title + ':');
    var formattedOutput = '  ';
    var str = '';
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      if (typeof codes[i] != 'number') {
        console.log(title + '[' + i + '] not a number: ' + typeof codes[0]);
        debugger;
        return;
      }
      formattedOutput += ' 0x' + ('00000' + code.toString(16)).substr(-5) + ',';
      str += String.fromCodePoint(code);
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
 * Check that the cmap matches the charList.
 *
 * @param {!Array.<number>} charList The list of loaded chars.
 * @param {!Object} fileInfo Information about the font data.
 * @param {!DataView} fontView The font data.
 * @return {boolean} True if the charlist and cmap agree.
 */
tachyfont.utils.checkCmap = function(charList, fileInfo, fontView) {
  if (goog.DEBUG) {
    console.log('need to code tachyfont.utils.checkCmap');
    // debugger;
    // TODO(bstell): need to code this.
    // Copy the charList array into a charList map.
    // Walk the cmap format 9 subtable.
    //   for each char
    //     if set in the font data
    //       remove from the charList map
    //     else
    //       record that it is set but not in the charList
    //     if char not in blank char list
    //       if the glyph does not have length
    //         record char in zero length chars list
    //       if the glyph does not have outline data
    //         record char in blank chars list
    //
    // Report any entries remaining in the charlist map
    // Report any chars in the cmap but not in the charList
    // Report any chars without length
    // Report any chars without outlines
  }
  return true;
};



/**
 * Report the MD5 for the font tables.
 *
 * @param {!Array.<number>} charList The list of loaded chars.
 * @param {!Object} fileInfo Information about the font data.
 * @param {!DataView} fontView The font data.
 * @return {boolean} True if the charlist and cmap agree.
 */
tachyfont.utils.reportChecksums = function(fileInfo, fontView) {
  if (goog.DEBUG) {
    console.log('need to code tachyfont.utils.reportChecksums');
    // debugger;
    // TODO(bstell): need to code this
    // Read the version
    // Read the number of tables
    // for each table
    //   calculate the MD5 hash
    //   report the table name and MD5 hash
  }
};


/**
 * Report the MD5 for a font table.
 *
 * @param {number} offset The start offset in data.
 * @param {number} length The length of the table.
 * @param {!DataView} dataView The data.
 * @return {string} The MD5 hash.
 */
tachyfont.utils.caclulateMd5 = function(offset, length, dataView) {
  // TODO(bstell): need to code this
  return '';
};


///**
// * Check the fileInfo against the font's table of contents.
// *
// * @param {!Object} fileInfo Information about the font data.
// * @param {!DataView} fontView The font data.
// * @return {boolean} True if the charlist and cmap agree.
// */
//tachyfont.utils.checkFileInfo = function(fileInfo, fontView) {
//  // Not sure if this would be really valuable
//};


