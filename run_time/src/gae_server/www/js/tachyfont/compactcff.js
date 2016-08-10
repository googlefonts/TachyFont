'use strict';

/**
 * @license
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

goog.provide('tachyfont.CompactCff');

goog.require('tachyfont.Cff');
goog.require('tachyfont.CffDict');
goog.require('tachyfont.Sfnt');



/**
 * This class manages compacting a CFF font.
 * @param {!DataView} fontData The font data bytes.
 * @constructor @struct @final
 */
tachyfont.CompactCff = function(fontData) {
  /** @private {!tachyfont.Sfnt.Font} */
  this.sfnt_ = tachyfont.Sfnt.getFont(fontData);
};


/**
 * Gets the Sfnt member.
 * @return {!tachyfont.Sfnt.Font}
 */
tachyfont.CompactCff.prototype.getSfnt = function() {
  return this.sfnt_;
};


/**
 * Compacts a TachyFont.
 */
tachyfont.CompactCff.prototype.compact = function() {
  var fontData = this.sfnt_.getFontData();
  var cffTableOffset = this.sfnt_.getTableOffset(tachyfont.Sfnt.CFF_TAG);
  var cffTableLength = this.sfnt_.getTableLength(tachyfont.Sfnt.CFF_TAG);
  var cff = new tachyfont.Cff(cffTableOffset, fontData);

  var charStringsIndex = cff.getCharStringsIndex();
  var charStringsOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0));
  var charStringsLength = charStringsIndex.getIndexByteLength();
  var fdArrayOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0));

  // Calculate the offsets and length.
  var cffStart = cffTableOffset;
  var charStringsStart = cffStart + charStringsOffset;
  var gapAfterCharStrings =
      fdArrayOffset - (charStringsOffset + charStringsLength);
  var fdArrayStart = cffTableOffset + fdArrayOffset;
  var remainingLength = cffTableLength - fdArrayOffset;

  // Build up the CFF table but do not include the gap after the CharStrings
  // INDEX.
  var cffDataSegments = [];
  this.addDataSegment(cffDataSegments, fontData, cffStart, charStringsOffset);
  this.addDataSegment(
      cffDataSegments, fontData, charStringsStart, charStringsLength);
  // Adjust the CFF offsets for no gap after the CharStrings INDEX.
  cff.updateCharStringsSize(-gapAfterCharStrings);
  this.addDataSegment(cffDataSegments, fontData, fdArrayStart, remainingLength);

  this.sfnt_.replaceTable(tachyfont.Sfnt.CFF_TAG, [cffDataSegments]);
  return;
};


/**
 * Adds a data segment to an array of data segments.
 * @param {!Array.<!Uint8Array>} dataArray The array to add the Uint8Array to.
 * @param {!DataView} dataView The source data.
 * @param {number} offset
 * @param {number} length
 */
tachyfont.CompactCff.prototype.addDataSegment = function(
    dataArray, dataView, offset, length) {
  var dataViewOffset = dataView.byteOffset;
  var dataOffset = dataViewOffset + offset;
  var buffer = dataView.buffer;
  var newUint8Array = new Uint8Array(buffer, dataOffset, length);
  dataArray.push(newUint8Array);
};
