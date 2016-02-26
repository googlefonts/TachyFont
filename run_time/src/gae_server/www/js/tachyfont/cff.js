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
 * This class reads and can resize the CharStrings INDEX in a CFF (Adobe's
 * Compact Font Format) table in an OpenType/CFF font. For a detailed
 * description of the CFF format @see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format @see
 * http://www.microsoft.com/typography/otspec/otff.htm
 * @param {number} offset The offset to the CFF table.
 * @param {!DataView} fontData The font data.
 * @constructor @struct @final
 */
tachyfont.Cff = function(offset, fontData) {
  /**
   * Font data bytes.
   * @private {!DataView}
   */
  this.fontData_ = fontData;

  /**
   * The offset in the font data to the CFF table.
   * @private {number}
   */
  this.cffTableOffset_ = offset;


  /**
   * Helper class to edit the binary data.
   * @private {!tachyfont.BinaryFontEditor}
   */
  this.binaryEditor_ =
      new tachyfont.BinaryFontEditor(this.fontData_, this.cffTableOffset_);

  /**
   * The CFF Header size.
   * @private {number}
   */
  this.headerSize_;

  /** Offset to the CFF Name INDEX.
   * @private {number}
   */
  this.nameIndexOffset_;

  /**
   * The CFF Name INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.nameIndex_;

  /**
   * Offset to the CFF Top DICT.
   * @private {number}
   */
  this.topDictIndexOffset_;

  /**
   * The CFF Top DICT INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.topDictIndex_;

  /**
   * The CFF Top DICT.
   * @private {!tachyfont.CffDict}
   */
  this.topDict_;


  // The offset to the Encodings table.
  // Note: CFF CID fonts do not have an Encodings table.

  /**
   * Offset to the CFF CharStrings INDEX.
   * @private {number}
   */
  this.charStringsIndexOffset_;

  /**
   * The CFF CharStrings INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.charStringsIndex_;


  /**
   * The CFF Font DICT INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.fontDictIndex_;
};


/**
 * A factory that reads the CFF table, creates and returns the information in an
 * object.
 * @param {number} offset The offset the the CFF table.
 * @param {!DataView} fontData The font data.
 * @return {!tachyfont.Cff} The class holding the CFF table information.
 */
tachyfont.Cff.getCffTable = function(offset, fontData) {
  var cff = new tachyfont.Cff(offset, fontData);
  cff.init_();
  return cff;
};


/**
 * Initializes the CFF font object.
 * @private
 */
tachyfont.Cff.prototype.init_ = function() {
  this.readHeader_();

  this.readNameIndex_();

  this.readTopDictIndex_();

  this.readCharStringsIndex_();

  this.readFontDictIndex_();
};


/**
 * Reads the CFF header.
 * @private
 */
tachyfont.Cff.prototype.readHeader_ = function() {
  // Skip the major and minor number.
  this.binaryEditor_.skip(2);
  this.headerSize_ = this.binaryEditor_.getUint8();
  // Skip offSize.
  this.binaryEditor_.skip(1);
  this.binaryEditor_.seek(this.headerSize_);
};


/**
 * Reads the CFF Name INDEX.
 * @private
 */
tachyfont.Cff.prototype.readNameIndex_ = function() {
  this.nameIndexOffset_ = this.headerSize_;
  this.nameIndex_ = new tachyfont.CffIndex('Name', this.nameIndexOffset_,
      tachyfont.CffIndex.TYPE_STRING, this.binaryEditor_);
  this.nameIndex_.loadStrings(this.binaryEditor_);
};


/**
 * Reads the CFF Top DICT INDEX.
 * @private
 */
tachyfont.Cff.prototype.readTopDictIndex_ = function() {
  this.topDictIndexOffset_ =
      this.nameIndexOffset_ + this.nameIndex_.getLength();
  this.topDictIndex_ = new tachyfont.CffIndex('TopDICT',
      this.topDictIndexOffset_, tachyfont.CffIndex.TYPE_DICT,
      this.binaryEditor_);
  this.topDictIndex_.loadDicts(this.binaryEditor_);
  this.topDict_ = this.topDictIndex_.getDictElement(0);
};


/**
 * Reads the CFF Font DICT INDEX.
 * This has info on the per-font Private DICTs.
 * @private
 */
tachyfont.Cff.prototype.readFontDictIndex_ = function() {
  var fontDictIndexOffset =
      this.topDict_.getOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0);
  this.fontDictIndex_ = new tachyfont.CffIndex('FontDICT',
      fontDictIndexOffset, tachyfont.CffIndex.TYPE_DICT, this.binaryEditor_);
  this.fontDictIndex_.loadDicts(this.binaryEditor_);
};


/**
 * Reads the CFF CharStrings INDEX.
 * @private
 */
tachyfont.Cff.prototype.readCharStringsIndex_ = function() {
  this.charStringsIndexOffset_ =
      this.topDict_.getOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0);
  this.charStringsIndex_ = new tachyfont.CffIndex('CharStrings',
      this.charStringsIndexOffset_, tachyfont.CffIndex.TYPE_BINARY_STRING,
      this.binaryEditor_);
  this.charStringsIndex_.loadStrings(this.binaryEditor_);
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
  offset += this.binaryEditor_.baseOffset;
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
  for (var i = 0; i < operators.length; i++) {
    var operator = operators[i];
    var offset = this.topDict_.getOperand(operator, 0);
    if (offset > this.charStringsIndexOffset_) {
      this.topDict_.updateDictEntryOperand(operator, 0, deltaSize);
    }
  }

  // Update the offsets to the Private DICTs.
  var count = this.fontDictIndex_.getCount();
  for (var i = 0; i < count; i++) {
    var dict = this.fontDictIndex_.getDictElement(i);
    var offset = dict.getOperand(tachyfont.CffDict.Operator.PRIVATE, 1);
    if (offset > this.charStringsIndexOffset_) {
      dict.updateDictEntryOperand(tachyfont.CffDict.Operator.PRIVATE, 1,
          deltaSize);
    }
  }
};

