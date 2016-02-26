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
 * @param {number} cffTableOffset The offset in the OpenType font to the CFF
 *     table.
 * @param {!DataView} fontData The font data.
 * @constructor @struct @final
 */
tachyfont.Cff = function(cffTableOffset, fontData) {

  // As detailed in
  // http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
  //
  // the items in the CFF table are organized as:
  //     1) Items that are placed one after another.
  //        - Header
  //        - Name INDEX
  //        - Top DICT INDEX
  //        - etc.
  //     2) Items found by their offset in the Top DICT.
  //        - CharStrings INDEX
  //        - Font DICT INDEX
  //        - Private DICTs (which are found relative to the Font DICT INDEX)
  //
  // To read the CFF table the code:
  //     - Determines the sizes of the items before the Top DICT INDEX
  //     - Reads the Top DICT INDEX
  //     - Uses the first element in the Top DICT INDEX as the Top DICT
  //     - Reads the other items using the offsets in the Top DICT

  /**
   * Font data bytes.
   * @private {!DataView}
   */
  this.fontData_ = fontData;

  /**
   * Helper class to edit the binary data.
   * @private {!tachyfont.BinaryFontEditor}
   */
  this.binaryEditor_ = new tachyfont.BinaryFontEditor(fontData, cffTableOffset);

  // Find the offset to the Top DICT INDEX.
  // Move past the CFF Header.
  var offset = tachyfont.Cff.getHeaderSize(this.binaryEditor_);
  // Move past the CFF Name INDEX
  offset += tachyfont.CffIndex.computeLength(offset, this.binaryEditor_);
  // Read the Top DICT INDEX.
  var topDictIndex = tachyfont.Cff.readTopDictIndex(offset, this.binaryEditor_);

  /**
   * The CFF Top DICT.
   * The Top DICT gives the offsets to the other tables.
   * @private {!tachyfont.CffDict}
   */
  this.topDict_ = topDictIndex.getDictElement(0);

  /**
   * The CFF CharStrings INDEX:
   *     - found by an offset in the Top DICT
   *     - holds the glyph data.
   * @private {!tachyfont.CffIndex}
   */
  this.charStringsIndex_ =
      tachyfont.Cff.readCharStringsIndex(this.topDict_, this.binaryEditor_);


  /**
   * The CFF Font DICT INDEX:
   *     - found by an offset in the Top DICT
   *     - holds per-font information
   * @private {!tachyfont.CffIndex}
   */
  this.fontDictIndex_ =
      tachyfont.Cff.readFontDictIndex(this.topDict_, this.binaryEditor_);
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
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.readTopDictIndex = function(offset, binaryEditor) {
  var topDictIndex = new tachyfont.CffIndex('TopDICT', offset,
      tachyfont.CffIndex.TYPE_DICT, binaryEditor);
  topDictIndex.loadDicts(binaryEditor);
  return topDictIndex;
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

