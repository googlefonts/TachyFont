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


goog.provide('tachyfont.Cff');

goog.require('tachyfont.BinaryFontEditor');
/** @suppress {extraRequire} */
goog.require('tachyfont.CffDict');
goog.require('tachyfont.CffIndex');



/**
 * The CFF classes (tachyfont.Cff, tachyfont.CffIndex, tachyfont.CffDict) read
 * the CFF (Adobe's Compact Font Format) table in an OpenType/CFF font.
 * To support TachyFont's lazy loading the CFF code can insert new data into the
 * CharStrings INDEX and fix up:
 *    - the OpenType (sfnt) table of contents offsets
 *    - the CFF Top DICT offsets
 *    - the CFF CharStrings INDEX offsets and length
 *    - the offsets in the CFF Private Font DICTs
 *
 * In a TachyFont there is a large 'empty' (zeroed) space behind the CharStrings
 * INDEX. As chars/glyphs are lazily added the CharStrings INDEX expands into
 * this empty space.
 *
 * In a Compact TachyFont the empty space is removed and as chars/glyphs are
 * lazily added the CharStrings INDEX is expanded. This expansion requires the
 * CFF table be expanded. The CFF table expansion requires the OpenType table of
 * contents be adjusted.
 *
 * For a detailed description of the CFF format @see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format @see
 * http://www.microsoft.com/typography/otspec/otff.htm
 * @param {!DataView} fontData The font data.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 *     binary data.
 * @param {!tachyfont.CffDict} topDict The CFF Top DICT info which holds offsets
 *     to other parts of the CFF table.
 * @param {!tachyfont.CffIndex} charStringsIndex The CFF CharStrings INDEX which
 *     holds the CFF glyph data.
 * @param {!tachyfont.CffIndex} fontDictIndex The CFF Font DICT INDEX which
 *     holds font private info.
 * @constructor @struct @final
 */
tachyfont.Cff = function(fontData, binaryEditor, topDict, charStringsIndex,
    fontDictIndex) {

  /**
   * Font data bytes.
   * @private {!DataView}
   */
  this.fontData_ = fontData;

  /**
   * Helper class to edit the binary data.
   * @private {!tachyfont.BinaryFontEditor}
   */
  this.binaryEditor_ = binaryEditor;

  /**
   * The CFF Top DICT.
   * @private {!tachyfont.CffDict}
   */
  this.topDict_ = topDict;

  // The offset to the Encodings table.
  // Note: CFF CID fonts do not have an Encodings table.

  /**
   * The CFF CharStrings INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.charStringsIndex_ = charStringsIndex;


  /**
   * The CFF Font DICT INDEX.
   * This holds font private information.
   * @private {!tachyfont.CffIndex}
   */
  this.fontDictIndex_ = fontDictIndex;
};


/**
 * A factory that reads the CFF table within a OpenType font.
 * For a list of the tables see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * @param {number} cffTableOffset The offset the the CFF table.
 * @param {!DataView} fontData The font data.
 * @return {!tachyfont.Cff} The class holding the CFF table information.
 */
tachyfont.Cff.getCffTable = function(cffTableOffset, fontData) {
  // Helper class to edit the binary data.
  var binaryEditor = new tachyfont.BinaryFontEditor(fontData, cffTableOffset);

  // The initial tables are in the CFF table one-after-another.

  // Move past the CFF Header.
  var offset = tachyfont.Cff.getHeaderSize(binaryEditor);
  // Move past the CFF Name INDEX
  offset += tachyfont.CffIndex.computeLength(offset, binaryEditor);

  // Read the Top DICT which gives the offsets to the other tables.
  var topDict = tachyfont.Cff.readTopDictIndex(offset, binaryEditor);

  // The following tables:
  //     - are found by offsets in the Top DICT.
  //     - are modified when inserting data into the CharStrings INDEX.

  // Read the CharStrings INDEX which holds the glyph data.
  var charStringsIndex =
      tachyfont.Cff.readCharStringsIndex(topDict, binaryEditor);

  // Read the Private Font DICTs which holds information about the fonts in the
  // CFF table.
  var fontDictIndex = tachyfont.Cff.readFontDictIndex(topDict, binaryEditor);

  // Bundle all this info together for later use.
  var cff = new tachyfont.Cff(fontData, binaryEditor, topDict, charStringsIndex,
      fontDictIndex);
  return cff;
};


/**
 * Get the font data.
 * @return {!DataView}
 */
tachyfont.Cff.prototype.getFontData = function() {
  return this.fontData_;
};


/**
 * Get the binaryEditor.
 * @return {!tachyfont.BinaryFontEditor}
 */
tachyfont.Cff.prototype.getBinaryEditor = function() {
  return this.binaryEditor_;
};


/**
 * Get the Top DICT.
 * @return {!tachyfont.CffDict}
 */
tachyfont.Cff.prototype.getTopDict = function() {
  return this.topDict_;
};


/**
 * Get the Font DICT INDEX.
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.prototype.getFontDictIndex = function() {
  return this.fontDictIndex_;
};


/**
 * Get the CFF header size.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 *     binary data.
 * @return {number} The size of the CFF header.
 */
tachyfont.Cff.getHeaderSize = function(binaryEditor) {
  binaryEditor.seek(2); // Skip the major and minor number.
  return binaryEditor.getUint8();
};


/**
 * Reads the CFF Top DICT.
 * The Top DICT has the offsets to the CharStrings INDEX and Font DICT INDEX.
 * @param {number} offset The offset in the CFF table to the Top DICT INDEX.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 *     binary data.
 * @return {!tachyfont.CffDict}
 */
tachyfont.Cff.readTopDictIndex = function(offset, binaryEditor) {
  var topDictIndex = new tachyfont.CffIndex('TopDICT', offset,
      tachyfont.CffIndex.TYPE_DICT, binaryEditor);
  topDictIndex.loadDicts(binaryEditor);
  // The Top DICT INDEX is designed to support a CFF font having multiple
  // fonts in it. A CFF table in an OpenType only has one font. So no need to
  // return an array of Top DICTs. Just return the Top DICT for the single font.
  return topDictIndex.getDictElement(0);
};


/**
 * Reads the CFF Font DICT INDEX.
 * This has info on the per-font Private DICTs. Even though a CFF table has
 * only one font that font can have multiple Private DICTs.
 * @param {!tachyfont.CffDict} topDict The CFF Top DICT with the offset to the
 *     CharStrings INDEX.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.readFontDictIndex = function(topDict, binaryEditor) {
  var fontDictIndexOffset =
      topDict.getOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0);
  var fontDictIndex = new tachyfont.CffIndex('FontDICT', fontDictIndexOffset,
      tachyfont.CffIndex.TYPE_DICT, binaryEditor);
  fontDictIndex.loadDicts(binaryEditor);
  return fontDictIndex;
};


/**
 * Reads the CFF CharStrings INDEX.
 * This holds the glyph data. This INDEX is expanded as chars/glyphs are lazily
 * loaded.
 * @param {!tachyfont.CffDict} topDict The CFF Top DICT with the offset to the
 *     CharStrings INDEX.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.readCharStringsIndex = function(topDict, binaryEditor) {
  var charStringsIndexOffset =
      topDict.getOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0);
  var charStringsIndex = new tachyfont.CffIndex('CharStrings',
      charStringsIndexOffset, tachyfont.CffIndex.TYPE_BINARY_STRING,
      binaryEditor);
  charStringsIndex.loadStrings(binaryEditor);
  return charStringsIndex;
};


/**
 * Gets the CharStrings INDEX.
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.prototype.getCharStringsIndex = function() {
  return this.charStringsIndex_;
};


/**
 * Gets a block of the font data.
 * @param {number} offset The starting offset.
 * @param {number} length One greater than the last byte.
 * @return {!Uint8Array}
 */
tachyfont.Cff.prototype.getData = function(offset, length) {
  offset += this.binaryEditor_.getBaseOffset();
  var data = new Uint8Array(this.fontData_.buffer, offset, length);
  return data;
};


/**
 * Gets an operand for an operator.
 * @param {string} operator The operator.
 * @param {number} index The index of the operand to get.
 * @return {number}
 */
tachyfont.Cff.prototype.getTopDictOperand = function(operator, index) {
  var value = this.topDict_.getOperand(operator, index);
  return value;
};


/**
 * Updates the CharStrings element size.
 * @param {number} deltaSize The size change.
 */
tachyfont.Cff.prototype.updateCharStringsSize = function(deltaSize) {
  // The list of table whose offsets that could change because of a CharStrings
  // size change.
  var operators = [
    tachyfont.CffDict.Operator.CHARSET,
    tachyfont.CffDict.Operator.FD_SELECT,
    tachyfont.CffDict.Operator.FD_ARRAY
  ];
  var charStringsIndexOffset = this.charStringsIndex_.getOffset();
  for (var i = 0; i < operators.length; i++) {
    var operator = operators[i];
    var offset = this.topDict_.getOperand(operator, 0);
    if (offset > charStringsIndexOffset) {
      this.topDict_.updateDictEntryOperand(operator, 0, deltaSize);
    }
  }

  // Update the offsets to the Private DICTs.
  var count = this.fontDictIndex_.getCount();
  for (var i = 0; i < count; i++) {
    var dict = this.fontDictIndex_.getDictElement(i);
    var offset = dict.getOperand(tachyfont.CffDict.Operator.PRIVATE, 1);
    if (offset > charStringsIndexOffset) {
      dict.updateDictEntryOperand(tachyfont.CffDict.Operator.PRIVATE, 1,
          deltaSize);
    }
  }
};

