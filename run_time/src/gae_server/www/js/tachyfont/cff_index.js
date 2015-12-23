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
 * @fileoverview Code to parse a CFF INDEX. For a detailed description of a CFF
 * dict
 * @see http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format
 * @see http://www.microsoft.com/typography/otspec/otff.htm
 * @author bstell@google.com (Brian Stell)
 */

goog.provide('tachyfont.CffIndex');

goog.require('goog.log');
goog.require('tachyfont.CffDict');
goog.require('tachyfont.Logger');
goog.require('tachyfont.utils');



/**
 * A class holding CFF INDEX table information.
 * @param {string} name The table name.
 * @param {number} offset The offset from start of the CFF table.
 * @param {number} type Indicates the data type in the index.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary font editor.
 * @constructor @struct @final
 */
tachyfont.CffIndex = function(name, offset, type, binEd) {
  /** @private {string} */
  this.name_ = name;

  /** @private {number} */
  this.offset_ = offset;

  /** @private {number} */
  this.type_ = type;

  /** @dict @private {!Object.<string,string>} */
  this.dictOperators_;

  /** @private {!Array.<string|!DataView|!tachyfont.CffDict>} */
  this.elements_ = [];

  binEd.seek(offset);

  /** @private {number} */
  this.count_ = binEd.getUint16();

  /** @private {number} */
  this.offSize_;

  /** @private {!Array.<number>} */
  this.offsets_ = [];

  // The spec says an empty INDEX is only 2 bytes long but all the fonts handled
  // by TachyFont have been processed by fontTools and it always adds a 0x01
  // byte for offSize and a single 0x01 byte for the offsets array.

  // Non-empty INDEX so collect the basic info.
  this.offSize_ = binEd.getUint8();
  this.offsets_ = [];

  for (var i = 0; i <= this.count_; i++) {
    var elementOffset = binEd.getOffset(this.offSize_);
    this.offsets_.push(elementOffset);
  }

  /** @private {number} */
  this.tableLength_ = 2 + 1 + (this.count_ + 1) * this.offSize_ +
      this.offsets_[this.count_] - 1;
};


/**
 * Indicates the CFF INDEX holds human readable strings.
 * @const {number}
 */
tachyfont.CffIndex.TYPE_STRING = 1;


/**
 * Indicates the CFF INDEX holds human readable strings.
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
 * Get an INDEX element.
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
 * Get an INDEX DICT element.
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


if (goog.DEBUG) {
  /**
   * Set the DICT operators map. The DICT operators map is used to covert the
   * operations to a human readable form.
   * @param {!Object.<string,string>} dictOperators The DICT operators map.
   */
  tachyfont.CffIndex.prototype.setDictOperators = function(dictOperators) {
    this.dictOperators_ = dictOperators;
  };
}


/**
 * Get the count of elements.
 * @return {number} The count of elements.
 */
tachyfont.CffIndex.prototype.getCount = function() {
  return this.count_;
};


/**
 * Get the table length.
 * @return {number} The length of the table.
 */
tachyfont.CffIndex.prototype.getLength = function() {
  return this.tableLength_;
};


/**
 * Load the INDEX strings.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary font editor.
 */
tachyfont.CffIndex.prototype.loadStrings = function(binEd) {
  goog.log.info(tachyfont.Logger.logger, this.name_);
  var dataStart = this.offset_ + 2 + 1 + (this.count_ + 1) * this.offSize_;
  binEd.seek(dataStart);
  for (var i = 0; i < this.count_; i++) {
    var dataLength = this.offsets_[i + 1] - this.offsets_[i];
    if (this.type_ == tachyfont.CffIndex.TYPE_STRING) {
      var str = binEd.readString(dataLength);
      this.elements_.push(str);
    } else {
      var dataView = binEd.readDataView(dataLength);
      this.elements_.push(dataView);
    }
  }
};

/*
 * Routines and data useful when debugging.
 */
if (goog.DEBUG) {
  /**
   * @param {boolean} showData If true then include the data in the display.
   * @param {number} cffTableOffset The offset of the CFF table in the font.
   */
  tachyfont.CffIndex.prototype.display = function(showData, cffTableOffset) {
    goog.log.info(tachyfont.Logger.logger, this.name_ + ':');
    goog.log.info(tachyfont.Logger.logger,
        '  elements: ' + this.elements_.length);
    goog.log.info(tachyfont.Logger.logger, '  offset: ' + this.offset_ + ' / ' +
        tachyfont.utils.numberToHex(this.offset_) + ' (' +
        tachyfont.utils.numberToHex(this.offset_ + cffTableOffset) + ')');

    if (this.count_ != this.elements_.length) {
      goog.log.info(tachyfont.Logger.logger,
          'this.count_(' + this.count_ + ') != ' +
          'this.elements_.length(' + this.elements_.length + ')');
      return;
    }
    for (var i = 0; i < this.count_; i++) {
      var offset = this.offsets_[i];
      var hexOffset = tachyfont.utils.numberToHex(offset);
      var displayStr = '  ' + ('   ' + i.toString()).substr(-3) + ': ' +
          ('  ' + offset).substr(-3) + ' (' + hexOffset + ')';
      if (showData) {
        if (this.type_ == tachyfont.CffIndex.TYPE_DICT) {
          var dict = this.elements_[i];
          var operators = dict.getOperators();
          // display the dict operands/operators.
          for (var j = 0; j < operators.length; j++) {
            var operator = operators[j];
            if (dict.dictOperators_) {
              goog.log.info(tachyfont.Logger.logger,
                  dict.getOperands(operator) + ' ' +
                  this.dictOperators_[operator]);
            } else {
              goog.log.info(tachyfont.Logger.logger,
                  dict.getOperands(operator) + ' ' + operator);
            }
          }
        } else {
          displayStr += ' ';
          if (this.type_ == tachyfont.CffIndex.TYPE_STRING) {
            displayStr += '"' + this.elements_[i] + '"';
          } else {
            displayStr += tachyfont.utils.dataViewToHex(
                /** @type {!DataView} */ (this.elements_[i]));
          }
          goog.log.info(tachyfont.Logger.logger, displayStr);
        }
      }
    }
  };
}


/**
 * Load the INDEX DICTs.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary font editor.
 */
tachyfont.CffIndex.prototype.loadDicts = function(binEd) {
  if (this.type_ != tachyfont.CffIndex.TYPE_DICT) {
    throw new Error(this.name_ + ' does not hold DICTS');
  }
  // TODO(bstell): in debug check this is a DICT INDEX.
  goog.log.info(tachyfont.Logger.logger, this.name_);
  var arrayBuffer = binEd.dataView.buffer;
  var dataStart = this.offset_ + 2 + 1 + (this.count_ + 1) * this.offSize_;
  for (var i = 0; i < this.count_; i++) {
    goog.log.info(tachyfont.Logger.logger, 'dict[' + i + ']');
    var name = this.name_ + i;
    var length = this.offsets_[i + 1] - this.offsets_[i];
    // TODO(bstell): make this reusable.
    var offset = binEd.dataView.byteOffset + binEd.baseOffset + dataStart +
        this.offsets_[i] - 1;
    var dict = tachyfont.CffDict.loadDict(name, arrayBuffer, offset, length,
        this.dictOperators_);
    this.elements_.push(dict);
  }
};

