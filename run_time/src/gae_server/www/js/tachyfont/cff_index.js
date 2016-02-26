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
 * This class reads a CFF (Adobe's Compact Font Format) INDEX. For a detailed
 * description of a CFF dict @see
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
  this.offset_ = offset;

  /**
   * The type of the elements in this INDEX.
   * @private @const {number}
   */
  this.type_ = type;

  /** @private {!Array<string|!DataView|!tachyfont.CffDict>} */
  this.elements_ = [];

  binaryEditor.seek(offset);

  /** @private {number} */
  this.count_ = binaryEditor.getUint16();

  // Note: not following the CFF spec here.
  // The spec says an empty INDEX is only 2 bytes long but all the fonts handled
  // by TachyFont have been processed by fontTools and it always adds a 0x01
  // byte for offsetSize and a single 0x01 byte for the offsets array.

  /**
   * The number of bytes per element in the offset array.
   * @private @const {number}
   */
  this.offsetSize_ = binaryEditor.getUint8();

  /** @private {!Array<number>} */
  this.offsets_ = [];

  for (var i = 0; i <= this.count_; i++) {
    var elementOffset = binaryEditor.getOffset(this.offsetSize_);
    this.offsets_.push(elementOffset);
  }

  /** @private @const {number} */
  this.tableLength_ =
      2 + // 2 count bytes.
      1 + // 1 offSize byte (indicate the bytes per offset).
      (this.count_ + 1) * this.offsetSize_ + // The offsets array size.
      this.offsets_[this.count_] - 1; // The elements size.
};


/**
 * Compute a CFF INDEX's length.
 * @param {number} offset The offset from start of the CFF table.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 * @return {number} The length of the INDEX.
 */
tachyfont.CffIndex.computeLength = function(offset, binaryEditor) {
  // Move the the start of the INDEX.
  binaryEditor.seek(offset);

  // Get the number of elements (2 bytes).
  var count = binaryEditor.getUint16();

  // Get the element size (1 byte).
  var offsetSize = binaryEditor.getUint8();

  // Move to the last offset.
  binaryEditor.skip(count * offsetSize); // The offsets array field size.

  // Get the elements field size
  // CFF INDEXs store the actual offset + 1. So the elements field size is the
  // last offset - 1
  var elementsSize = binaryEditor.getOffset(offsetSize) - 1;

  // Calculate the table size.
  var tableSize = 2 + // The count field size.
      1 + // The offsetSize field size.
      (count + 1) * offsetSize + // The offset array field size.
      elementsSize; // The elements field size.
  return tableSize;
};


/**
 * Indicates the CFF INDEX holds human readable strings.
 * @const {number}
 */
tachyfont.CffIndex.TYPE_STRING = 1;


/**
 * Indicates the CFF INDEX holds human binary strings.
 * @const {number}
 */
tachyfont.CffIndex.TYPE_BINARY_STRING = 2;


/**
 * Indicates the CFF INDEX holds DICTs.
 * DICTs always have binary data.
 * @const {number}
 */
tachyfont.CffIndex.TYPE_DICT = 3;


/**
 * Gets an INDEX element.
 * @param {number} index The index of the element.
 * @return {!tachyfont.CffDict|!DataView|string} A element from the INDEX.
 * @throws RangeError if index is not in the array.
 */
tachyfont.CffIndex.prototype.getElement = function(index) {
  if (index in this.elements_) {
    return this.elements_[index];
  }
  throw new RangeError('CFF ' + this.name_ + ' INDEX: invalid index: ' + index);
};


/**
 * Gets an INDEX DICT element.
 * @param {number} index The index of the element.
 * @return {!tachyfont.CffDict} The DICT element from the INDEX.
 * @throws Error if is not a DICT index.
 * @throws RangeError if index is not in the array.
 */
tachyfont.CffIndex.prototype.getDictElement = function(index) {
  if (this.type_ != tachyfont.CffIndex.TYPE_DICT) {
    throw new Error('not a DICT INDEX');
  }
  if (index in this.elements_) {
    return /** @type {!tachyfont.CffDict} */ (this.elements_[index]);
  }
  throw new RangeError('CFF ' + this.name_ + ' INDEX: invalid index: ' + index);
};


/**
 * Gets the offsetSize of elements.
 * @return {number} The offsetSize of elements.
 */
tachyfont.CffIndex.prototype.getOffsetSize = function() {
  return this.offsetSize_;
};


/**
 * Gets the count of elements.
 * @return {number} The count of elements.
 */
tachyfont.CffIndex.prototype.getCount = function() {
  return this.count_;
};


/**
 * Gets the elements.
 * @return {!Array<string|!DataView|!tachyfont.CffDict>} The elements.
 */
tachyfont.CffIndex.prototype.getElements = function() {
  return this.elements_;
};


/**
 * Gets the element's offset from the beginning of the index.
 * @param {number} index The index to get the offset for.
 * @return {number} The element's offset.
 */
tachyfont.CffIndex.prototype.getAdjustedElementOffset = function(index) {
  var offset = 2 + 1 + (this.offsetSize_ * (this.count_ + 1)) - 1;
  offset += this.offsets_[index];
  return offset;
};


/**
 * Gets the element offsets.
 * @return {!Array<number>} The element offsets.
 */
tachyfont.CffIndex.prototype.getOffsets = function() {
  return this.offsets_;
};


/**
 * Gets the table length.
 * @return {number} The length of the table.
 */
tachyfont.CffIndex.prototype.getLength = function() {
  return this.tableLength_;
};


/**
 * Gets the table type.
 * @return {number} The type of the table.
 */
tachyfont.CffIndex.prototype.getType = function() {
  return this.type_;
};


/**
 * Loads the INDEX strings.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 */
tachyfont.CffIndex.prototype.loadStrings = function(binaryEditor) {
  var dataStart = this.offset_ + 2 + 1 + (this.count_ + 1) * this.offsetSize_;
  binaryEditor.seek(dataStart);
  for (var i = 0; i < this.count_; i++) {
    var dataLength = this.offsets_[i + 1] - this.offsets_[i];
    if (this.type_ == tachyfont.CffIndex.TYPE_STRING) {
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
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary font editor.
 */
tachyfont.CffIndex.prototype.loadDicts = function(binaryEditor) {
  if (this.type_ != tachyfont.CffIndex.TYPE_DICT) {
    throw new Error(this.name_ + ' does not hold DICTS');
  }
  var arrayBuffer = binaryEditor.dataView.buffer;
  var dataStart = this.offset_ + 2 + 1 + (this.count_ + 1) * this.offsetSize_;
  for (var i = 0; i < this.count_; i++) {
    var name = this.name_ + i;
    var length = this.offsets_[i + 1] - this.offsets_[i];
    // TODO(bstell): make this reusable.
    var offset = binaryEditor.dataView.byteOffset + binaryEditor.baseOffset +
        dataStart + this.offsets_[i] - 1;
    var dict = tachyfont.CffDict.loadDict(name, arrayBuffer, offset, length);
    this.elements_.push(dict);
  }
};

