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
 *
 * For reference: How to read/parse the CFF table
 * ----------------------------------------------
 * The items in the CFF table are organized as:
 *     1) Items that are placed one after another.
 *        - Header
 *        - Name INDEX
 *        - Top DICT INDEX
 *        - etc.
 *     2) Items found by their offset in the Top DICT.
 *        - CharStrings INDEX
 *        - Font DICT INDEX
 *        - Private DICTs (which are found relative to the Font DICT INDEX)
 *
 * To read the CFF table the code:
 *     - Determines the sizes of the items before the Top DICT INDEX
 *     - Reads the Top DICT INDEX
 *     - Uses the first element in the Top DICT INDEX as the Top DICT
 *     - Reads the other items using the offsets in the Top DICT
 *
 * @param {number} cffTableOffset The offset in the OpenType font to the CFF
 *     table.
 * @param {!DataView} fontData The font data.
 * @constructor @struct @final
 */
tachyfont.Cff = function(cffTableOffset, fontData) {


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
  // First move past the CFF Header.
  var offset = tachyfont.Cff.getHeaderSize(this.binaryEditor_);
  // Next move past the CFF Name INDEX
  offset += tachyfont.CffIndex.computeLength(offset, this.binaryEditor_);

  // Read the Top DICT INDEX.
  var topDictIndex = tachyfont.Cff.readTopDictIndex(offset, this.binaryEditor_);
  var topDict = topDictIndex.getDictElement(0);
  if (!topDict) {
    // Library fatal error: without a Top DICT the font cannot be read nor
    // modified.
    throw new Error('missing Top DICT: font cannot be processed');
  }
  /**
   * The CFF Top DICT.
   * The Top DICT has the offsets to other items with the CFF table (as well as
   * other meta information about the font).
   * @private @const {!tachyfont.CffDict}
   */
  this.topDict_ = topDict;

  /**
   * The CFF CharStrings INDEX:
   *   - found by an offset in the Top DICT
   *   - holds the glyph data.
   * This item is poorly named:
   *   - 'Char': this holds data about glyphs not about chars.
   *   - 'Strings': this hold binary data not human readable strings.
   * @private @const {!tachyfont.CffIndex}
   */
  this.charStringsIndex_ =
      tachyfont.Cff.readCharStringsIndex(this.topDict_, this.binaryEditor_);

  /**
   * The CFF Font DICT INDEX:
   *   - found by an offset in the Top DICT
   *   - holds per-font information such as 'nominal width' of the glyphs.
   * @private @const {!tachyfont.CffIndex}
   */
  this.fontDictIndex_ =
      tachyfont.Cff.readFontDictIndex(this.topDict_, this.binaryEditor_);
};


/**
 * Gets the font data bytes.
 * @return {!DataView}
 */
tachyfont.Cff.prototype.getFontData = function() {
  return this.fontData_;
};


/**
 * Gets the binaryEditor.
 * @return {!tachyfont.BinaryFontEditor}
 */
tachyfont.Cff.prototype.getBinaryEditor = function() {
  return this.binaryEditor_;
};


/**
 * Gets the Top DICT.
 * @return {!tachyfont.CffDict}
 */
tachyfont.Cff.prototype.getTopDict = function() {
  return this.topDict_;
};


/**
 * Gets the Font DICT INDEX.
 * This has the relative offsets to the Private Font DICTs.
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.prototype.getFontDictIndex = function() {
  return this.fontDictIndex_;
};


/**
 * Gets the CFF header size.
 * The CFF Header holds it own length to provide upward compatibility if more
 * header space is needed.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 *     binary data.
 * @return {number} The size of the CFF header.
 */
tachyfont.Cff.getHeaderSize = function(binaryEditor) {
  binaryEditor.seek(2);  // Skip the major and minor number.
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
      tachyfont.CffIndex.type.DICT, binaryEditor);
  topDictIndex.loadDicts(binaryEditor);
  return topDictIndex;
};


/**
 * Reads the CFF Font DICT INDEX.
 * This has info on the per-font Private DICTs. Even though a CFF table in an
 * OpenType font can only one main font that font can be used as if it were
 * multiple fonts. For example, some of the glyph data could be 'changed'
 * making one version have square ends and the other have round ends.
 * @param {!tachyfont.CffDict} topDict The CFF Top DICT with the offset to the
 *     CharStrings INDEX.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor Helper class to edit the
 * @return {!tachyfont.CffIndex}
 */
tachyfont.Cff.readFontDictIndex = function(topDict, binaryEditor) {
  var fontDictIndexOffset =
      topDict.getOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0);
  if (fontDictIndexOffset == null) {
    // Library fatal error: without the (Private) Font DICT offset the CFF font
    // cannot be read nor modified.
    throw new Error('FD_ARRAY operator');
  }
  var fontDictIndex = new tachyfont.CffIndex('FontDICT',
      /** @type {number} */ (fontDictIndexOffset),
      tachyfont.CffIndex.type.DICT, binaryEditor);
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
  if (charStringsIndexOffset == null) {
    // Library fatal error: without the CharStrings INDEX offset the CFF font
    // cannot be read nor modified.
    throw new Error('CHAR_STRINGS operator');
  }
  var charStringsIndex = new tachyfont.CffIndex('CharStrings',
      /** @type {number} */ (charStringsIndexOffset),
      tachyfont.CffIndex.type.BINARY_STRING, binaryEditor);
  charStringsIndex.loadStrings(binaryEditor);
  return charStringsIndex;
};


/**
 * Gets the CharStrings INDEX object.
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
  return new Uint8Array(this.fontData_.buffer, offset, length);
};


/**
 * Gets the specified operand for an operator.
 * CFF DICTs store values as sets of (1 or more) operands followed by an
 * operator. For example the font bounding box is specified by four operands
 * (eg, -991 -1050 2930 1810) followed by the FontBBox (5) operator.
 * @param {string} operator The operator.
 * @param {number} index The index of the operand to get.
 * @return {?tachyfont.CffDict.Operand}
 */
tachyfont.Cff.prototype.getTopDictOperand = function(operator, index) {
  return this.topDict_.getOperand(operator, index);
};


/**
 * Lists the items in the CFF table whose offsets can change when the
 * CharStrings INDEX is resized.
 * @private @const {!Array<string>}
 */
tachyfont.Cff.repositionedItemsOperators_ = [
  tachyfont.CffDict.Operator.CHARSET,
  tachyfont.CffDict.Operator.FD_SELECT,
  tachyfont.CffDict.Operator.FD_ARRAY
];


/**
 * Updates the offsets in the CFF table when the CharStrings INDEX changes size.
 * Given a delta size update the offsets in the Top DICT and Private DICTs.
 * @param {number} deltaSize The size change.
 */
tachyfont.Cff.prototype.updateCharStringsSize = function(deltaSize) {
  var charStringsIndexOffset = this.charStringsIndex_.getOffsetToIndex();
  for (var i = 0; i < tachyfont.Cff.repositionedItemsOperators_.length; i++) {
    var operator = tachyfont.Cff.repositionedItemsOperators_[i];
    var offset = this.topDict_.getOperand(operator, 0);
    if (offset > charStringsIndexOffset) {
      this.topDict_.updateDictEntryOperand(operator, 0, deltaSize);
    }
  }

  // Update the offsets to the Private DICTs.
  var count = this.fontDictIndex_.getNumberOfElements();
  for (var i = 0; i < count; i++) {
    var dict = this.fontDictIndex_.getDictElement(i);
    if (dict == null) {
      // Library fatal error: something is deeply wrong and recovery is not
      // possible.
      throw new Error('Private DICT ' + i);
    }
    var offset = dict.getOperand(tachyfont.CffDict.Operator.PRIVATE, 1);
    if (offset > charStringsIndexOffset) {
      dict.updateDictEntryOperand(tachyfont.CffDict.Operator.PRIVATE, 1,
          deltaSize);
    }
  }
};

