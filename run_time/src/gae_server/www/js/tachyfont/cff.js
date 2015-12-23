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
   * The font's table of contents entery for the CFF table.
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
   * This font's CFF major version number.
   * @private {number}
   */
  this.major_;

  /**
   * This font's CFF minor version number.
   * @private {number}
   */
  this.minor_;

  /**
   * Size of the CFF Header.
   * @private {number}
   */
  this.hdrSize_;

  /**
   * The offset size (number of bytes used in a offset) in the font.
   * @private {number}
   */
  this.offSize_;

  /**
   * The offset to the Name INDEX.
   * @private {number}
   */
  this.nameIndexOffset_;

  /**
   * The Name INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.nameIndex_;

  /**
   * The offset to the Top DICT INDEX.
   * @private {number}
   */
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

  /**
   * The offset to the String INDEX.
   * @private {number}
   */
  this.stringIndexOffset_;

  /**
   * The String INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.stringIndex_;

  /**
   * The offset to the Global Subr INDEX.
   * @private {number}
   */
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
   * The offset to the FS Select table.
   * @private {number}
   */
  this.fdSelectOffset_;

  /**
   * The offset to the CharStrings INDEX.
   * @private {number}
   */
  this.charStringsIndexOffset_;

  /**
   * The CharStrings INDEX.
   * @private {!tachyfont.CffIndex}
   */
  this.charStringsIndex_;

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
  this.major_ = this.binEd_.getUint8();
  this.minor_ = this.binEd_.getUint8();
  this.hdrSize_ = this.binEd_.getUint8();
  this.offSize_ = this.binEd_.getUint8();
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
    this.topDictIndex_.setDictOperators(tachyfont.CffDict.TOP_DICT_OPERATORS);
  }
  this.topDictIndex_.loadDicts(this.binEd_);
  if (goog.DEBUG) {
    this.topDictIndex_.display(true, this.cffTableOffset_);
  }
  this.topDict_ =
      /** @type {!tachyfont.CffDict} */ (this.topDictIndex_.getElement(0));
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
 * Get the CFF major number;
 * @return {number}
 */
tachyfont.Cff.prototype.getMajor = function() {
  return this.major_;
};


/**
 * Get the CFF minor number.
 * @return {number}
 */
tachyfont.Cff.prototype.getMinor = function() {
  return this.minor_;
};

