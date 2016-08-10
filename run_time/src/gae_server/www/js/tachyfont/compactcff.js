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
 * @param {!tachyfont.typedef.FileInfo} fileInfo Information about the font
 *     bytes.
 * @param {!tachyfont.FontInfo} fontInfo Information about the font (eg,
 *     weight).
 * @constructor @struct @final
 */
tachyfont.CompactCff = function(fontData, fileInfo, fontInfo) {
  /** @private {!tachyfont.Sfnt.Font} */
  this.sfnt_ = tachyfont.Sfnt.getFont(fontData);

  /**
   * Information about the font bytes.
   * @private {!tachyfont.typedef.FileInfo}
   */
  this.fileInfo_ = fileInfo;

  /**
   * Information about the font.
   * @private {!tachyfont.FontInfo}
   */
  this.fontInfo_ = fontInfo;
};


/**
 * Gets the Sfnt member.
 * @return {!tachyfont.Sfnt.Font}
 */
tachyfont.CompactCff.prototype.getSfnt = function() {
  return this.sfnt_;
};


/**
 * Gets the FileInfo member.
 * @return {!tachyfont.typedef.FileInfo}
 */
tachyfont.CompactCff.prototype.getFileInfo = function() {
  return this.fileInfo_;
};


/**
 * Gets an identifier for the font.
 * This is useful for error messages.
 * @return {string}
 */
tachyfont.CompactCff.prototype.getFontId = function() {
  // This should include other info such as slant, etc.
  return this.fontInfo_.getWeight();
};


/**
 * Compacts a TachyFont.
 */
tachyfont.CompactCff.prototype.compact = function() {
  var origOffsets = this.sfnt_.getCompactOffsets();
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
  this.updateFileInfo(origOffsets);
  return;
};


/**
 * Updates the fileInfo offsets.
 * @param {!tachyfont.Sfnt.CompactOffsets} origOffsets The array to add the
 * Uint8Array to.
 */
tachyfont.CompactCff.prototype.updateFileInfo = function(origOffsets) {
  var newOffsets = this.sfnt_.getCompactOffsets();

  // Adjust the cmap offsets.
  var deltaCmapOffset =
      newOffsets.getCmapOffset() - origOffsets.getCmapOffset();
  this.fileInfo_.cmap4.offset += deltaCmapOffset;
  this.fileInfo_.cmap12.offset += deltaCmapOffset;

  // Adjust the Cff glyph data offsets.
  var deltaCffOffset = newOffsets.getCffOffset() - origOffsets.getCffOffset();
  this.fileInfo_.glyphOffset += deltaCffOffset;
  this.fileInfo_.glyphDataOffset += deltaCffOffset;

  // Adjust the Horizontal/Vertical Metrics offsets.
  this.fileInfo_.hmtxOffset = newOffsets.getHmtxOffset();
  this.fileInfo_.vmtxOffset = newOffsets.getVmtxOffset();
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
