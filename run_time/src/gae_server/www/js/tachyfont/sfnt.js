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

goog.provide('tachyfont.Sfnt');

goog.require('goog.asserts');
goog.require('tachyfont.BinaryFontEditor');



/**
 * @fileoverview Reads and/or modifies the table in a sfnt font; eg, an
 * OpenType font.
 * @author bstell@google.com (Brian Stell)
 */



/**
 * The sfnt font.
 * To create a tachyfont.Sfnt.Font call tachyfont.Sfnt.getFont().
 * @constructor @struct @final
 */
tachyfont.Sfnt.Font = function() {
  /** @private {!DataView} */
  this.fontData_;

  /** @private {!tachyfont.BinaryFontEditor} */
  this.binEd_;

  /** @private {!tachyfont.Sfnt.TableOfContents} */
  this.tableOfContents_;
};


/**
 * Set the font data.
 * Because the init call is protected a useful tachyfont.Sfnt.Font can only be
 * created by tachyfont.Sfnt.getFont (not by new);
 * @param {!DataView} fontData
 * @protected
 */
tachyfont.Sfnt.Font.prototype.init = function(fontData) {
  this.fontData_ = fontData;
  this.binEd_ = new tachyfont.BinaryFontEditor(fontData, 0);
  // Get the table of contents.
  this.tableOfContents_ =
      tachyfont.Sfnt.getTableOfContents(fontData, this.binEd_);
};


/**
 * Create a tachyfont.Sfnt.Font.
 * @param {!DataView} fontData
 * @return {!tachyfont.Sfnt.Font}
 */
tachyfont.Sfnt.getFont = function(fontData) {
  var font = new tachyfont.Sfnt.Font();
  font.init(fontData);
  return font;
};


/**
 * Get a table.
 * @param {string} tableTag The name of the table.
 * @return {!Uint8Array} The table contents.
 */
tachyfont.Sfnt.Font.prototype.getTable = function(tableTag) {
  var tocEntry = this.tableOfContents_.getTocEntry(tableTag);
  var offset = tocEntry.offset_;
  var length = tocEntry.length_;
  var data = new Uint8Array(this.fontData_.buffer, offset, length);
  return data;
};


/**
 * Replace a table.
 * @param {string} tableTag The name of the table.
 * @param {!Array.<!Array.<!Uint8Array>>} data The new table contents.
 */
tachyfont.Sfnt.Font.prototype.replaceTable = function(tableTag, data) {
  var entry = this.tableOfContents_.getTocEntry(tableTag);
  var deltaSize = this.replaceData_(entry.offset_, entry.length_, data);
  this.tableOfContents_.updateOffsets_(this.binEd_, deltaSize, entry.offset_);
};


/**
 * Replace a block of data.
 * @param {number} offset Where to insert the new data.
 * @param {number} length How much old data to remove.
 * @param {!Array.<!Array.<!Uint8Array>>} data The new table contents.
 * @return {number} The delta size change.
 * @private
 */
tachyfont.Sfnt.Font.prototype.replaceData_ = function(offset, length, data) {
  // Get the new table size;
  var newTableLength = 0;
  for (var i = 0; i < data.length; i++) {
    var dataGroup = data[i];
    for (var j = 0; j < dataGroup.length; j++) {
      newTableLength += dataGroup[j].byteLength;
    }
  }

  var dataBefore = new Uint8Array(this.fontData_.buffer, 0, offset);
  var dataAfter = new Uint8Array(this.fontData_.buffer, offset + length);

  // Merge the data into a single buffer.
  // TODO(bstell): does the data really need to be in a single ArrayBuffer?
  // Sending it over to C++ code uses a Blob with can accept an array of items.
  // If the data can be handled as an array of ArrayBuffer then no copying would
  // be needed. Could have 2 getters: one that gets it as is and one that forces
  // it to a single ArrayBuffer if needed.
  var deltaSize = newTableLength - length;
  var newFontData = new Uint8Array(this.fontData_.byteLength + deltaSize);
  newFontData.set(dataBefore);
  var position = dataBefore.byteLength;
  for (var i = 0; i < data.length; i++) {
    var dataGroup = data[i];
    for (var j = 0; j < dataGroup.length; j++) {
      newFontData.set(dataGroup[j], position);
      position += dataGroup[j].byteLength;
    }
  }
  newFontData.set(dataAfter, position);

  // Install the new data into the font.
  this.fontData_ = new DataView(newFontData.buffer);
  this.binEd_ = new tachyfont.BinaryFontEditor(this.fontData_, 0);

  return deltaSize;
};



/**
 * The Font table of contents.
 * @constructor @struct @final @protected
 */
tachyfont.Sfnt.TableOfContents = function() {
  /** @private {boolean} */
  this.isCff_ = false;

  /** @private {Array.<!tachyfont.Sfnt.TableOfContentsEntry>} */
  this.items_ = [];

  /** @private {Object.<string, number>} */
  this.tagIndex_ = {};
};


/** @type {number} */
tachyfont.Sfnt.TableOfContents.TTF_VERSION_NUMBER = 0x00010000;


/** @type {string} */
tachyfont.Sfnt.TableOfContents.CFF_VERSION_TAG = 'OTTO';


/**
 * Factory to get a font table of contents.
 * @param {!DataView} fontData The font data.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary editor for the font.
 * @return {!tachyfont.Sfnt.TableOfContents}
 */
tachyfont.Sfnt.getTableOfContents = function(fontData, binEd) {
  var tableOfContents = new tachyfont.Sfnt.TableOfContents();
  tableOfContents.init_(fontData, binEd);
  return tableOfContents;
};


/**
 * Initialize the Table Of Contents.
 * @param {!DataView} fontData The font data.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary editor for the font.
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.init_ = function(fontData, binEd) {
  var sfntVersion = binEd.getUint32();
  binEd.seek(0);
  var sfntVersionTag = binEd.readString(4);
  if (sfntVersion == tachyfont.Sfnt.TableOfContents.TTF_VERSION_NUMBER) {
    // TODO(bstell): handle a ttf font.
    this.isCff_ = false;
  } else if (sfntVersionTag == tachyfont.Sfnt.TableOfContents.CFF_VERSION_TAG) {
    // is CFF opentype font
    this.isCff_ = true;
  } else {
    throw new Error('invalid font');
  }
  var numTables = binEd.getUint16();
  binEd.skip(6); // searchRange, entrySelector, rangeShift
  for (var i = 0; i < numTables; i++) {
    var tag = binEd.readString(4);
    var checksum = binEd.getUint32();
    var offset = binEd.getUint32();
    var length = binEd.getUint32();
    var item =
        new tachyfont.Sfnt.TableOfContentsEntry(tag, checksum, offset, length);
    this.items_.push(item);
    this.tagIndex_[tag] = i;
  }
};


/**
 * Update the Table Of Contents.
 * @param {!tachyfont.BinaryFontEditor} binEd A binary editor for the font.
 * @param {number} deltaSize The amount to change the offset.
 * @param {number} afterOffset Only change offsets that were after this offset.
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.updateOffsets_ =
    function(binEd, deltaSize, afterOffset) {
  // Skip sfntVersion, numTables, searchRange, entrySelector, rangeShift.
  binEd.seek(12);

  // The sfnt table of contents:
  // * 32 bit tag (4 8-bit chars)
  // * 32 bit checksum
  // * 32 bit offset
  // * 32 bit length
  var numTables = this.items_.length;
  for (var i = 0; i < numTables; i++) {
    var entry = this.items_[i];
    var tag = binEd.readString(4);
    goog.asserts.assert(tag == entry.tag_);
    binEd.skip(4); // Skip the checksum.
    if (entry.offset_ == afterOffset) {
      // Skip the offset.
      binEd.skip(4);
      // Update the length
      entry.length_ += deltaSize;
      binEd.setUint32(entry.length_);
    } else if (entry.offset_ > afterOffset) {
      // Update the offset.
      entry.offset_ += deltaSize;
      binEd.setUint32(entry.offset_);
      // Skip the length.
      binEd.skip(4);
    } else {
      binEd.skip(8); // Skip the offset and length.
    }
  }
};


/**
 * Get a Table Of Contents table entry.
 * @param {string} tag The 4 character tag for the table.
 * @return {!tachyfont.Sfnt.TableOfContentsEntry} ;
 */
tachyfont.Sfnt.TableOfContents.prototype.getTocEntry = function(tag) {
  var index = this.tagIndex_[tag];
  return this.items_[index];
};


/**
 * Get isCff.
 * @return {boolean} Whether the font type is CFF (not Truetype).
 */
tachyfont.Sfnt.TableOfContents.prototype.isCff = function() {
  return this.isCff_;
};



/**
 * An item in the Font table of contents.
 * @param {string} tag The table name.
 * @param {number} checksum The checksum of the table.
 * @param {number} offset The offset to the table.
 * @param {number} length The length of the table.
 * @constructor @struct @final
 */
tachyfont.Sfnt.TableOfContentsEntry = function(tag, checksum, offset, length) {
  /** @private {string} */
  this.tag_ = tag;

  /** @private {number} */
  this.checksum_ = checksum;

  /** @private {number} */
  this.offset_ = offset;

  /** @private {number} */
  this.length_ = length;
};


/**
 * Get the tag for this entry.
 * @return {string} The tag (exactly 4 chars) for this entry.
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getTag = function() {
  return this.tag_;
};


/**
 * Get the checksum for this entry.
 *
 * @return {number} The checksum for this entry.
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getChecksum = function() {
  return this.checksum_;
};


/**
 * Get the length for this entry.
 * @return {number} The length for this entry.
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getLength = function() {
  return this.length_;
};


/**
 * Get the table offset from the beginning of the font to the table.
 * @return {number} The offset to the table.
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getOffset = function() {
  return this.offset_;
};


