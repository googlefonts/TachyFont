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

/**
 * @fileoverview Code to parse the CFF table in an OpenType CFF font. This reads
 * the CFF Header and INDEXs. For a detailed description of the CFF format
 * @see http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format
 * @see http://www.microsoft.com/typography/otspec/otff.htm
 * @author bstell@google.com (Brian Stell)
 */

goog.provide('tachyfont.Cff');

goog.require('tachyfont.BinaryFontEditor');
/** @suppress {extraRequire} */
goog.require('tachyfont.CffDict');
goog.require('tachyfont.CffIndex');



/**
 * The class holding the CFF table information.
 * @param {!tachyfont.Sfnt.TableOfContentsEntry} tocEntry The Sfnt table of
 *     contents entry.
 * @param {!DataView} fontData The font data.
 * @constructor @struct @final
 */
tachyfont.Cff = function(tocEntry, fontData) {
  /**
   * The font's table of contents entry for the CFF table.
   * @private {!tachyfont.Sfnt.TableOfContentsEntry}
   */
  this.tocEntry_ = tocEntry;

  /**
   * Font data bytes.
   * @private {!DataView}
   */
  this.fontData_ = fontData;

  /**
   * The offset in the font data to the CFF table.
   * @private {number}
   */
  this.cffTableOffset_ = this.tocEntry_.getOffset();


  /**
   * Helper class to edit the binary data.
   * @private {!tachyfont.BinaryFontEditor}
   */
  this.binEd_;

  /**
   * The Header size.
   * @private {number}
   */
  this.hdrSize_;

  /**
   * The offset size (number of bytes used in a offset) in the font.
   * @private {number}
   */
  this.offSize_;

  /** @private {number} */
  this.nameIndexOffset_;

  /**
   * The Name INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.nameIndex_;

  /** @private {number} */
  this.topDictIndexOffset_;

  /**
   * The Top DICT INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.topDictIndex_;

  /**
   * The Top DICT (a associative map).
   * @private {!tachyfont.CffDict}
   */
  this.topDict_;

  /** @private {number} */
  this.stringIndexOffset_;

  /**
   * The String INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.stringIndex_;

  /** @private {number} */
  this.globalSubrIndexOffset_;

  /**
   * The Global Subr INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.globalSubrIndex_;

  /**
   * The offset to the Encodings table.
   * Note: CFF CID fonts do not have an Encodings table.
   */

  /**
   * The offset to the FD Select table.
   * @private {number}
   */
  this.fdSelectOffset_;

  /** @private {number} */
  this.charStringsIndexOffset_;

  /**
   * The CharStrings INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.charStringsIndex_;

  /**
   * The number of glyphs in the CharString INDEX.
   * @private {number}
   */
  this.nGlyphs_;

  /**
   * The offset to the Font DICT INDEX.
   * @private {number}
   */
  this.fontDictIndexOffset_;

  /**
   * The Font DICT INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.fontDictIndex_;

  /**
   * The per-font Private DICTs.
   * @private {!Array.<!tachyfont.CffDict>}
   */
  this.fontPrivateDicts_ = [];
};


/**
 * A factory to get the CFF table object.
 * @param {!tachyfont.Sfnt.TableOfContentsEntry} tocEntry The Sfnt table of
 *     contents entry.
 * @param {!DataView} fontData The font data.
 * @return {!tachyfont.Cff} The class holding the CFF table information.
 */
tachyfont.Cff.getCffTable = function(tocEntry, fontData) {
  var cff = new tachyfont.Cff(tocEntry, fontData);
  cff.init_();
  return cff;
};


/**
 * Initialize the CFF font object.
 * @private
 */
tachyfont.Cff.prototype.init_ = function() {
  this.initBinaryEditor_();

  this.readHeader_();

  this.readNameIndex_();

  this.readTopDictIndex_();

  this.readStringIndex_();

  this.readGlobalSubrIndex_();

  /* CFF CID fonts do not have an Encodings table */

  this.readCharStringsIndex_();

  this.readFontDictIndex_();

  this.readPrivateDicts_();

};


/**
 * Process the header of an INDEX.
 * @private
 */
tachyfont.Cff.prototype.initBinaryEditor_ = function() {
  this.binEd_ =
      new tachyfont.BinaryFontEditor(this.fontData_, this.cffTableOffset_);
};


/**
 * Process the CFF header.
 * @private
 */
tachyfont.Cff.prototype.readHeader_ = function() {
  // Skip the major and minor number.
  this.binEd_.skip(2);
  this.hdrSize_ = this.binEd_.getUint8();
  // Skip offSize.
  this.binEd_.skip(1);
  this.binEd_.seek(this.hdrSize);
};


/**
 * Process the Name INDEX.
 * @private
 */
tachyfont.Cff.prototype.readNameIndex_ = function() {
  this.nameIndexOffset_ = this.hdrSize_;
  this.nameIndex_ = new tachyfont.CffIndex('Name', this.nameIndexOffset_,
      tachyfont.CffIndex.TYPE_STRING, this.binEd_);
  this.nameIndex_.loadStrings(this.binEd_);
  if (goog.DEBUG) {
    this.nameIndex_.display(true, this.cffTableOffset_);
  }
};


/**
 * Process the Top DICT INDEX.
 * @private
 */
tachyfont.Cff.prototype.readTopDictIndex_ = function() {
  this.topDictIndexOffset_ =
      this.nameIndexOffset_ + this.nameIndex_.getLength();
  this.topDictIndex_ = new tachyfont.CffIndex('TopDICT',
      this.topDictIndexOffset_, tachyfont.CffIndex.TYPE_DICT, this.binEd_);
  if (goog.DEBUG) {
    this.topDictIndex_.setDictOperators(tachyfont.CffDict.OperatorDescriptions);
  }
  this.topDictIndex_.loadDicts(this.binEd_);
  if (goog.DEBUG) {
    this.topDictIndex_.display(true, this.cffTableOffset_);
  }
  this.topDict_ = this.topDictIndex_.getDictElement(0);
};


/**
 * Process the String INDEX.
 * @private
 */
tachyfont.Cff.prototype.readStringIndex_ = function() {
  this.stringIndexOffset_ =
      this.topDictIndexOffset_ + this.topDictIndex_.getLength();
  this.stringIndex_ = new tachyfont.CffIndex('String', this.stringIndexOffset_,
      tachyfont.CffIndex.TYPE_STRING, this.binEd_);
  this.stringIndex_.loadStrings(this.binEd_);
  if (goog.DEBUG) {
    this.stringIndex_.display(true, this.cffTableOffset_);
  }
};


/**
 * Process the Global Subr INDEX.
 * @private
 */
tachyfont.Cff.prototype.readGlobalSubrIndex_ = function() {
  this.globalSubrIndexOffset_ = this.stringIndexOffset_ +
      this.stringIndex_.getLength();
  this.globalSubrIndex_ = new tachyfont.CffIndex('GlobalSubr',
      this.globalSubrIndexOffset_, tachyfont.CffIndex.TYPE_BINARY_STRING,
      this.binEd_);
  // To conserver memory do not process the data.
  // this.globalSubrIndex_.loadStrings(this.binEd_);
  //if (goog.DEBUG) {
  //  this.globalSubrIndex_.display(true, this.cffTableOffset_);
  //}
};


/**
 * Process the Font DICT INDEX.
 * This has info on the per-font Private DICTs.
 * @private
 */
tachyfont.Cff.prototype.readFontDictIndex_ = function() {
  this.fontDictIndexOffset_ =
      this.topDict_.getOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0);
  this.fontDictIndex_ = new tachyfont.CffIndex('FontDICT',
      this.fontDictIndexOffset_, tachyfont.CffIndex.TYPE_DICT, this.binEd_);
  if (goog.DEBUG) {
    this.fontDictIndex_.setDictOperators(
        tachyfont.CffDict.OperatorDescriptions);
  }
  this.fontDictIndex_.loadDicts(this.binEd_);
  if (goog.DEBUG) {
    this.fontDictIndex_.display(true, this.cffTableOffset_);
  }
};


/**
 * Process the Font DICT INDEX.
 * This has info on the per-font Private DICTs.
 * @private
 */
tachyfont.Cff.prototype.readPrivateDicts_ = function() {
  var count = this.fontDictIndex_.getCount();
  for (var i = 0; i < count; i++) {
    var dict = this.fontDictIndex_.getElement(i);
    var name = dict.getName();
    var buffer = this.binEd_.dataView.buffer;
    var length = dict.getOperand(tachyfont.CffDict.Operator.PRIVATE, 0);
    var offset = this.cffTableOffset_ +
        dict.getOperand(tachyfont.CffDict.Operator.PRIVATE, 1);
    var dictOperators;
    if (goog.DEBUG) {
      dictOperators = tachyfont.CffDict.OperatorDescriptions;
    }
    var privateDict = tachyfont.CffDict.loadDict(name, buffer, offset, length,
        dictOperators);
    this.fontPrivateDicts_.push(privateDict);
  }
};


/**
 * Process the CharStrings INDEX.
 * @private
 */
tachyfont.Cff.prototype.readCharStringsIndex_ = function() {
  this.charStringsIndexOffset_ =
      this.topDict_.getOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0);
  this.charStringsIndex_ = new tachyfont.CffIndex('CharStrings',
      this.charStringsIndexOffset_, tachyfont.CffIndex.TYPE_BINARY_STRING,
      this.binEd_);
  this.nGlyphs_ = this.charStringsIndex_.getCount();
  this.charStringsIndex_.loadStrings(this.binEd_);
  if (goog.DEBUG) {
    this.charStringsIndex_.display(true, this.cffTableOffset_);
  }
};

