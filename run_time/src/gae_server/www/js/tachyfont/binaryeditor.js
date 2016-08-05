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

goog.provide('tachyfont.BinaryEditor');


/** @suppress {extraRequire} */
goog.require('tachyfont.typedef.FileInfo');
/** @suppress {extraRequire} */
goog.require('tachyfont.typedef.uint8');



/**
 * Binary Font Editor.
 * This class provides a Unix file like interface to read and write to a
 * DataView; eg, a 16 bit read reads 2 bytes and 'advances' to the data after
 * those 2 bytes. This class also provides routines to read/write font and
 * TachyFont specific data structures.
 * Always big endian byte order.
 * @param {!DataView} dataView DataView which includes data
 * @param {number} baseOffset Set this offset as 0 offset for operations
 * @constructor @struct
 */
tachyfont.BinaryEditor = function(dataView, baseOffset) {
  /**
   * The font data to edit.
   * @private @const {!DataView}
   */
  this.dataView_ = dataView;

  /**
   * The base offset into the beginning of the data of interest.
   * By having a base offset the calling code can easily seek within that data
   * without having to know if the data is in a DataView by itself of embedded
   * in a larger block of data.
   * @private @const {number}
   */
  this.baseOffset_ = baseOffset;

  /**
   * The offset to the current byte within the data of interest.
   * This value is the current position within the data of interest and is used
   * to manage the current position; eg, after reading/writing a 32 bit value
   * this value in increased by 4. This also provides support for seek and skip
   * operations.
   * @private {number}
   */
  this.offset_ = 0;
};


/**
 * Get the DataView.
 * @return {!DataView}
 */
tachyfont.BinaryEditor.prototype.getDataView = function() {
  return this.dataView_;
};


/**
 * Get the baseOffset.
 * @return {number}
 */
tachyfont.BinaryEditor.prototype.getBaseOffset = function() {
  return this.baseOffset_;
};


/**
 * Get the offset.
 * @return {number}
 */
tachyfont.BinaryEditor.prototype.getOffset = function() {
  return this.offset_;
};


/**
 * @return {!tachyfont.typedef.uint8} Unsigned byte
 */
tachyfont.BinaryEditor.prototype.getUint8 = function() {
  var data = this.dataView_.getUint8(this.baseOffset_ + this.offset_);
  this.offset_++;
  return data;
};


/**
 * @param {number} data Unsigned byte
 */
tachyfont.BinaryEditor.prototype.setUint8 = function(data) {
  this.dataView_.setUint8(this.baseOffset_ + this.offset_, data);
  this.offset_++;
};


/**
 * @return {number} Unsigned short
 */
tachyfont.BinaryEditor.prototype.getUint16 = function() {
  var data = this.dataView_.getUint16(this.baseOffset_ + this.offset_);
  this.offset_ += 2;
  return data;
};


/**
 * @param {number} data Unsigned short
 */
tachyfont.BinaryEditor.prototype.setUint16 = function(data) {
  this.dataView_.setUint16(this.baseOffset_ + this.offset_, data);
  this.offset_ += 2;
};


/**
 * @param {number} data Signed short
 */
tachyfont.BinaryEditor.prototype.setInt16 = function(data) {
  this.dataView_.setInt16(this.baseOffset_ + this.offset_, data);
  this.offset_ += 2;
};


/**
 * @return {number} Unsigned integer
 */
tachyfont.BinaryEditor.prototype.getUint32 = function() {
  var data = this.dataView_.getUint32(this.baseOffset_ + this.offset_);
  this.offset_ += 4;
  return data;
};


/**
 * @param {number} data Unsigned integer
 */
tachyfont.BinaryEditor.prototype.setUint32 = function(data) {
  this.dataView_.setUint32(this.baseOffset_ + this.offset_, data);
  this.offset_ += 4;
};


/**
 * @return {number} Signed integer
 */
tachyfont.BinaryEditor.prototype.getInt32 = function() {
  var data = this.dataView_.getInt32(this.baseOffset_ + this.offset_);
  this.offset_ += 4;
  return data;
};


/**
 * @param {function()} getter One of getUint or getInt functions
 * @param {number} count Size of array
 * @return {!Array<number>}
 */
tachyfont.BinaryEditor.prototype.getArrayOf = function(getter, count) {
  var arr = [];
  for (var i = 0; i < count; i++) {
    arr.push(getter.call(this));
  }
  return arr;
};


/**
 * @param {function(number)} setter One of setUint or setInt functions
 * @param {!Array<number>} arr
 */
tachyfont.BinaryEditor.prototype.setArrayOf = function(setter, arr) {
  var count = arr.length;
  for (var i = 0; i < count; i++) {
    setter.call(this, arr[i]);
  }
};


/**
 * Read as a DataView.
 *
 * @param {number} length Length of the bytes to read.
 * @return {!DataView}
 */
tachyfont.BinaryEditor.prototype.readDataView = function(length) {
  var offset = this.dataView_.byteOffset + this.baseOffset_ + this.offset_;
  var dataView = new DataView(this.dataView_.buffer, offset, length);
  this.offset_ += length;
  return dataView;
};


/**
 * Read as a string.
 *
 * @param {number} length Length of the string to read.
 * @return {string}
 */
tachyfont.BinaryEditor.prototype.readString = function(length) {
  var str = '';
  for (var i = 0; i < length; i++) {
    str += String.fromCharCode(this.getUint8());
  }
  return str;
};


/**
 * @param {number} newOffset The new offset to move to.
 */
tachyfont.BinaryEditor.prototype.seek = function(newOffset) {
  this.offset_ = newOffset;
};


/**
 * @param {number} len
 */
tachyfont.BinaryEditor.prototype.skip = function(len) {
  if (len < 0)
    throw 'Only nonnegative numbers are accepted';
  this.offset_ += len;
};


/**
 * @return {number} current offset
 */
tachyfont.BinaryEditor.prototype.tell = function() {
  return this.offset_;
};
