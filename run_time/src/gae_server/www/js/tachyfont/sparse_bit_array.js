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
  return !!(theByte & theBit);
};


/**
 * Gets the number of page allocations.
 * This is useful for testing.
 * @return {number}
 */
SparseBitArray.prototype.getNumberOfPageAllocations = function() {
  return this.numberOfPageAllocations_;
};

});  // goog.scope
