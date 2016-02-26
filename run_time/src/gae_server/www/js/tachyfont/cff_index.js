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


goog.provide('tachyfont.CffIndex');

goog.require('tachyfont.CffDict');



/**
 * This class reads a CFF (Adobe's Compact Font Format) INDEX.
 * See cff.js for an overview of how the CFF table is being modified.
 * For a detailed description of a CFF INDEX @see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format @see
 * http://www.microsoft.com/typography/otspec/
 * @param {string} name The table name.
 * @param {number} offset The offset from start of the CFF table.
 * @param {number} type Indicates the data type in the index.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 * @constructor @struct @final
 */
tachyfont.CffIndex = function(name, offset, type, binaryEditor) {
  /** @private @const {string} */
  this.name_ = name;

  /**
   * The offset in the CFF table to this INDEX.
   * @private @const {number} */
  this.offsetToIndex_ = offset;

  /**
   * The type of the elements in this INDEX.
   * Possible types are STRING, BINARY_STRING, and (CFF) DICT.
   * @private @const {number}
   */
  this.type_ = type;

  /** @private {!Array<string|!DataView|!tachyfont.CffDict>} */
  this.elements_ = [];

  binaryEditor.seek(offset);

  // Get the INDEX's count.
  var count = binaryEditor.getUint16();

  /**
   * The number offsets.
   * Note: not strictly following the CFF spec here. The spec says an empty
   * INDEX (count == 0) is only 2 bytes long (ie: does not have a offsetSize nor
   * any offsets). However, all the fonts handled by TachyFont have been
   * processed by fontTools and it always adds a 0x01 byte for offsetSize and a
   * single 0x01 byte for the offsets array.
   * @private {number}
   */
  this.numberOfOffsets_ = count + 1;

  /**
   * The number of bytes per element in the offset array.
   * @private @const {number}
   */
  this.offsetSize_ = binaryEditor.getUint8();

  /**
   * The offsets array.
   * Note: that offsets are 1-indexed; ie: the element[0] is at offset 1.
   * @private {!Array<number>}
   */
  this.offsets_ = [];

  // Read in the offsets.
  for (var i = 0; i < this.numberOfOffsets_; i++) {
    var elementOffset = binaryEditor.getElementOffset(this.offsetSize_);
    this.offsets_.push(elementOffset);
  }

  /**
   * Calculate the INDEX length.
   * @private @const {number}
   */
  this.indexByteLength_ =
      2 + // The count field size.
      1 + // The offsetSize field size (indicates the bytes per offset).
      this.numberOfOffsets_ * this.offsetSize_ + // The offsets array size.
      this.offsets_[this.numberOfOffsets_ - 1] - 1; // The elements size.
};


/**
 * Compute a CFF INDEX's length.
 * @param {number} offset The offset from start of the CFF table.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 * @return {number} The length of the INDEX.
 */
tachyfont.CffIndex.computeLength = function(offset, binaryEditor) {
  var tmpIndex = new tachyfont.CffIndex('tmpName', offset,
      tachyfont.CffIndex.type.STRING, binaryEditor);
  return tmpIndex.indexByteLength_;
};


/**
 * Get the INDEX's name.
 * @return {string}
 */
tachyfont.CffIndex.prototype.getName = function() {
  return this.name_;
};


/**
 * Gets the offset in the CFF table to this INDEX.
 * @return {number}
 */
tachyfont.CffIndex.prototype.getOffsetToIndex = function() {
  return this.offsetToIndex_;
};


/**
 * Defines the type of data held in a CFF INDEX.
 * @enum {number}
 */
tachyfont.CffIndex.type = {
  /** The INDEX hold human readable strings. */
  STRING: 1,
  /** The INDEX hold binary strings. */
  BINARY_STRING: 2,
  /** The INDEX hold CFF DICT(s). */
  DICT: 3
};


/**
 * Gets an INDEX element.
 * @param {number} index The index of the element.
 * @return {tachyfont.CffDict|DataView|string} A element from the INDEX.
 */
tachyfont.CffIndex.prototype.getElement = function(index) {
  if (index in this.elements_) {
    return this.elements_[index];
  }
  return null;
};


/**
 * Gets an INDEX DICT element.
 * @param {number} index The index of the element.
 * @return {tachyfont.CffDict} The DICT element from the INDEX.
 */
tachyfont.CffIndex.prototype.getDictElement = function(index) {
  // TODO(bstell): make subclasses instead of testing for type.
  if (this.type_ != tachyfont.CffIndex.type.DICT) {
    return null;
  }
  if (index in this.elements_) {
    return /** @type {!tachyfont.CffDict} */ (this.elements_[index]);
  }
  return null;
};


/**
 * Gets the offsetSize of elements.
 * This is the number of bytes used by each element offset.
 * @return {number} The offsetSize of elements.
 */
tachyfont.CffIndex.prototype.getOffsetSize = function() {
  return this.offsetSize_;
};


/**
 * Gets the number of offsets.
 * @return {number}
 */
tachyfont.CffIndex.prototype.getNumberOfOffsets = function() {
  return this.numberOfOffsets_;
};


/**
 * Gets the elements lenght.
 * @return {number}
 */
tachyfont.CffIndex.prototype.getNumberOfElements = function() {
  return this.elements_.length;
};


/**
 * Gets the elements.
 * @return {!Array<string|!DataView|!tachyfont.CffDict>} The elements.
 */
tachyfont.CffIndex.prototype.getElements = function() {
  return this.elements_;
};


/**
 * Pushes an element.
 * @param {string|!DataView|!tachyfont.CffDict} element An element to push.
 */
tachyfont.CffIndex.prototype.pushElement = function(element) {
  this.elements_.push(element);
};


/**
 * Gets the element's offset from the beginning of the INDEX.
 * When lazily loading glyph data this is needed to update the CharStrings data
 * and the DICT data.
 * @param {number} index The index to get the offset for.
 * @return {number} The element's offset.
 */
tachyfont.CffIndex.prototype.getAdjustedElementOffset = function(index) {
  var offset = 2 + 1 + (this.offsetSize_ * this.numberOfOffsets_) - 1;
  return offset + this.offsets_[index];
};


/**
 * Gets the element offsets.
 * @return {!Array<number>} The element offsets.
 */
tachyfont.CffIndex.prototype.getOffsets = function() {
  return this.offsets_;
};


/**
 * Gets the number of bytes used by this INDEX.
 * @return {number} The length of the table.
 */
tachyfont.CffIndex.prototype.getIndexByteLength = function() {
  return this.indexByteLength_;
};


/**
 * Gets the table type.
 * TODO(bstell): make subclasses for binary string and DICT.
 * @return {number} The type of the table.
 */
tachyfont.CffIndex.prototype.getType = function() {
  return this.type_;
};


/**
 * Loads the INDEX strings.
 * TODO(bstell): put this in a binary string subclass.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 */
tachyfont.CffIndex.prototype.loadStrings = function(binaryEditor) {
  var dataStart = this.offsetToIndex_ + 2 + 1 +
      this.numberOfOffsets_ * this.offsetSize_;
  binaryEditor.seek(dataStart);
  var count = this.numberOfOffsets_ - 1;
  for (var i = 0; i < count; i++) {
    var dataLength = this.offsets_[i + 1] - this.offsets_[i];
    if (this.type_ == tachyfont.CffIndex.type.STRING) {
      var str = binaryEditor.readString(dataLength);
      this.elements_.push(str);
    } else {
      var dataView = binaryEditor.readDataView(dataLength);
      this.elements_.push(dataView);
    }
  }
};


/**
 * Loads the INDEX DICTs.
 * TODO(bstell): put this in a DICT subclass.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 */
tachyfont.CffIndex.prototype.loadDicts = function(binaryEditor) {
  if (this.type_ != tachyfont.CffIndex.type.DICT) {
    throw new Error(this.name_ + ' does not hold DICTS');
  }
  var dataView = binaryEditor.getDataView();
  var arrayBuffer = dataView.buffer;
  var dataStart = this.offsetToIndex_ + 2 + 1 +
      this.numberOfOffsets_ * this.offsetSize_;
  var count = this.numberOfOffsets_ - 1;
  for (var i = 0; i < count; i++) {
    var name = this.name_ + i;
    var length = this.offsets_[i + 1] - this.offsets_[i];
    var offset = dataView.byteOffset + binaryEditor.getBaseOffset() +
        dataStart + this.offsets_[i] - 1;
    var dictDataView = new DataView(arrayBuffer, offset, length);
    var dict = new tachyfont.CffDict(name, dictDataView);
    this.elements_.push(dict);
  }
};

