'use strict';

/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
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

goog.provide('tachyfont.SparseBitArray');

goog.require('goog.asserts');


goog.scope(function() {



/**
 * This class provides a sparse bit array.
 *
 * The bit array is made up of 'pages'. The bit array is sparse because only
 * pages with set bits are allocated. Each page uses an array of bytes to cover
 * a continous range of bits.
 * @constructor @struct @final
 */
tachyfont.SparseBitArray = function() {
  /** @private {!Object<number, !Uint8Array>} */
  this.pages_ = {};

  /**
   * TODO(bstell): if no errors reporting then delete this after 2016-10-01.
   *
   * For testing make an alternate recording of the bits.
   * This is used to verify the correct operation of the sparse bit array.
   * Note: Storing info this way uses a large amount of memory; eg,20K entries
   * can take 1.5MB.
   * @private {!Object<number, boolean>}
   */
  this.alternateBitInfo_ = {};

  /**
   * For testing record the number of page allocations.
   * @private {number}
   */
  this.numberOfPageAllocations_ = 0;
};
var SparseBitArray = tachyfont.SparseBitArray;


/**
 * The amount to shift to get the page index.
 */
SparseBitArray.PAGE_SHIFT = 8;


/**
 * The amount to shift to get the page index.
 */
SparseBitArray.PAGE_MASK = 0xFF;


/**
 * The number of bytes in a page.
 */
SparseBitArray.BYTES_PER_PAGE = 32;


/**
 * The number of bytes in a page.
 */
SparseBitArray.BITS_PER_BYTE = 8;


/**
 * The amount to shift to get the byte index.
 */
SparseBitArray.BYTE_SHIFT = 3;


/**
 * The amount to shift to get the byte index.
 */
SparseBitArray.BYTE_MASK = 0x7;


/**
 * Sets the bit at index.
 * @param {number} index The bit's index.
 */
SparseBitArray.prototype.setBit = function(index) {
  var pageIndex = index >> SparseBitArray.PAGE_SHIFT;
  var pageBitArray = this.pages_[pageIndex];
  if (!pageBitArray) {
    pageBitArray = this.pages_[pageIndex] =
        new Uint8Array(SparseBitArray.BYTES_PER_PAGE);
    this.numberOfPageAllocations_++;
  }
  var pageBitIndex = index & SparseBitArray.PAGE_MASK;
  var pageByteIndex = pageBitIndex >> SparseBitArray.BYTE_SHIFT;
  var byteBitIndex = pageBitIndex & SparseBitArray.BYTE_MASK;
  var theBit = 1 << byteBitIndex;
  pageBitArray[pageByteIndex] |= theBit;
  goog.asserts.assert(this.alternateBitInfo_[index] = true);
};


/**
 * Gets whether the bit at index is set.
 * Returns false if the bit is missing; ie: is in a sparse area.
 * @param {number} index The bit's index.
 * @return {boolean}
 */
SparseBitArray.prototype.isSet = function(index) {
  var pageIndex = index >> SparseBitArray.PAGE_SHIFT;
  var pageBitArray = this.pages_[pageIndex];
  if (!pageBitArray) {
    return false;
  }
  var pageBitIndex = index & SparseBitArray.PAGE_MASK;
  var pageByteIndex = pageBitIndex >> SparseBitArray.BYTE_SHIFT;
  var theByte = pageBitArray[pageByteIndex];
  var byteBitIndex = pageBitIndex & SparseBitArray.BYTE_MASK;
  var theBit = 1 << byteBitIndex;
  var bitIsSet = !!(theByte & theBit);
  goog.asserts.assert(
      bitIsSet == !!this.alternateBitInfo_[index], 'bit %s should be %s', index,
      !!this.alternateBitInfo_[index]);
  return bitIsSet;
};


/**
 * Gets the number of page allocations.
 * This is useful for testing.
 * @return {number}
 */
SparseBitArray.prototype.getNumberOfPageAllocations = function() {
  return this.numberOfPageAllocations_;
};


/**
 * Compares the sparse bit array against the alternate bit info.
 * This is useful for testing.
 * @return {boolean}
 */
SparseBitArray.prototype.compareAlternateBitInfo = function() {
  var pageKeys = Object.keys(this.pages_);
  for (var i = 0; i < pageKeys.length; i++) {
    // Need parseInt because Object.keys() always returns strings.
    var pageKey = parseInt(pageKeys[i], 10);
    var page = this.pages_[pageKey];
    for (var j = 0; j < SparseBitArray.BYTES_PER_PAGE; j++) {
      var theByte = page[j];
      for (var k = 0; k < SparseBitArray.BITS_PER_BYTE; k++) {
        var theBit = 1 << k;
        var bitIsSet = !!(theByte & theBit);
        var index =  //
            (pageKey * SparseBitArray.BYTES_PER_PAGE *
             SparseBitArray.BITS_PER_BYTE) +
            (j * SparseBitArray.BITS_PER_BYTE) + k;
        goog.asserts.assert(
            bitIsSet == !!this.alternateBitInfo_[index], 'bit %s should be %s',
            index, !!this.alternateBitInfo_[index]);
        goog.asserts.assert(
            (!!this.alternateBitInfo_[index] ?
                 delete (this.alternateBitInfo_[index]) :
                 0) ||
            true);
      }
    }
  }
  goog.asserts.assert(
      Object.keys(this.alternateBitInfo_).length == 0,
      'number of alternateBitInfo bits set differs from the sparse array by ' +
          '%s bits',
      Object.keys(this.alternateBitInfo_).length);
  return true;
};

});  // goog.scope
