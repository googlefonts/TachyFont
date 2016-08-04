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
  this.binaryEditor_;

  /** @private {!tachyfont.Sfnt.TableOfContents} */
  this.tableOfContents_;

  /** @private {!tachyfont.Sfnt.TableOfContents} */
  this.sortedTableOfContents_;

  /** @private {!Array<number>} */
  this.allocatedLengths_ = [];
};


/** @type {string} */
tachyfont.Sfnt.CFF_TAG = 'CFF ';


/** @type {string} */
tachyfont.Sfnt.CMAP_TAG = 'cmap';


/** @type {string} */
tachyfont.Sfnt.HMTX_TAG = 'hmtx';


/** @type {string} */
tachyfont.Sfnt.VMTX_TAG = 'vmtx';


/**
 * @return {!DataView}
 */
tachyfont.Sfnt.Font.prototype.getFontData = function() {
  return this.fontData_;
};


/**
 * @return {!tachyfont.BinaryFontEditor}
 */
tachyfont.Sfnt.Font.prototype.getBinaryEditor = function() {
  return this.binaryEditor_;
};


/**
 * @return {!tachyfont.Sfnt.TableOfContents}
 */
tachyfont.Sfnt.Font.prototype.getTableOfContents = function() {
  return this.tableOfContents_;
};


/**
 * Get a Table Of Contents table entry.
 * @param {string} tag The 4 character tag for the table.
 * @return {!tachyfont.Sfnt.TableOfContentsEntry} ;
 */
tachyfont.Sfnt.Font.prototype.getTableEntry = function(tag) {
  var tagsIndex = this.tableOfContents_.getTagsIndex();
  if (tag in tagsIndex) {
    var index = tagsIndex[tag];
    return this.tableOfContents_.getItems()[index];
  }
  throw new Error('no such table: ' + tag);
};


/**
 * Get a Table Of Contents table offset.
 * @param {string} tag The 4 character tag for the table.
 * @return {number} ;
 */
tachyfont.Sfnt.Font.prototype.getTableOffset = function(tag) {
  var tableEntry = this.getTableEntry(tag);
  return tableEntry.getOffset();
};


/**
 * Get a Table Of Contents table length. This does not include any padding
 * length.
 * @param {string} tag The 4 character tag for the table.
 * @return {number} ;
 */
tachyfont.Sfnt.Font.prototype.getTableLength = function(tag) {
  var tableEntry = this.getTableEntry(tag);
  return tableEntry.getLength();
};


/**
 * @return {!tachyfont.Sfnt.TableOfContents}
 */
tachyfont.Sfnt.Font.prototype.getSortedTableOfContents = function() {
  return this.sortedTableOfContents_;
};


/**
 * Get the allocated space. This is the tableEntry size plus any padding.
 * @param {string} tag The tag name;
 * @return {number}
 */
tachyfont.Sfnt.Font.prototype.getAllocatedLength = function(tag) {
  var sortedTagsIndex = this.sortedTableOfContents_.getTagsIndex();
  if (!(tag in sortedTagsIndex)) {
    throw new Error('tag ' + tag + ' not in font');
  }
  var index = sortedTagsIndex[tag];
  return this.allocatedLengths_[index];
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
  this.binaryEditor_ = new tachyfont.BinaryFontEditor(fontData, 0);
  // Get the table of contents.
  this.tableOfContents_ =
      tachyfont.Sfnt.parseTableOfContents(fontData, this.binaryEditor_);
  // Get the table of contents sorted by offset.
  this.sortedTableOfContents_ = this.tableOfContents_.getSorted_();
  var items = this.sortedTableOfContents_.getItems();
  // Get the allocated lengths. This includes any padding which the tableEntry
  // length does not.
  var i;
  var countLessOne = items.length - 1;
  for (i = 0; i < countLessOne; i++) {
    var thisEntry = items[i];
    var nextEntry = items[i + 1];
    this.allocatedLengths_[i] = nextEntry.getOffset() - thisEntry.getOffset();
  }
  var lastEntry = items[countLessOne];
  this.allocatedLengths_[countLessOne] = fontData.byteLength -
      lastEntry.getOffset();
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
 * Get a table's bytes.
 * @param {string} tableTag The name of the table.
 * @return {!Uint8Array} The table contents.
 */
tachyfont.Sfnt.Font.prototype.getTableBytes = function(tableTag) {
  var tableOfContentsEntry = this.tableOfContents_.getEntry(tableTag);
  var offset = tableOfContentsEntry.offset_;
  var length = tableOfContentsEntry.length_;
  var data = new Uint8Array(this.fontData_.buffer, offset, length);
  return data;
};


/**
 * Replace a table.
 * @param {string} tableTag The name of the table.
 * @param {!Array<!Array<!Uint8Array>>} data The new table contents.
 */
tachyfont.Sfnt.Font.prototype.replaceTable = function(tableTag, data) {
  // Add padding if necessary.
  var length = 0;
  for (var i = 0; i < data.length; i++) {
    var elements = data[i];
    for (var j = 0; j < elements.length; j++) {
      var element = elements[j];
      length += element.byteLength;
    }
  }
  var countBeyondLongAlignment = length % 4;
  if (countBeyondLongAlignment) {
    var neededLength = 4 - countBeyondLongAlignment;
    var padding = new Uint8Array(neededLength);
    var lastElementArray = data[data.length - 1];
    lastElementArray.push(padding);
  }

  var entry = this.tableOfContents_.getEntry(tableTag);
  var deltaTableLength = length - entry.getLength();
  var allocatedLength = this.getAllocatedLength(tableTag);
  var deltaAllocatedLength = this.replaceData_(entry.offset_, allocatedLength,
      data);
  this.tableOfContents_.updateOffsets_(this.binaryEditor_, deltaTableLength,
      deltaAllocatedLength, entry.offset_);
  this.init(this.fontData_);
};


/**
 * Replace a block of data.
 * @param {number} offset Where to insert the new data.
 * @param {number} length How much old data to remove.
 * @param {!Array<!Array<!Uint8Array>>} data The new table contents.
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

  var headerSize = this.fontData_.byteOffset;
  var fontBytesBuffer = this.fontData_.buffer;
  var beforeLength = offset + headerSize;
  var dataBefore = new Uint8Array(fontBytesBuffer, 0, beforeLength);
  var afterStart = beforeLength + length;
  var dataAfter = new Uint8Array(fontBytesBuffer, afterStart);

  // Merge the data into a single buffer (the Uint8Array set() method is very
  // fast).
  var deltaSize = newTableLength - length;
  var newFontBytes = new Uint8Array(fontBytesBuffer.byteLength + deltaSize);
  newFontBytes.set(dataBefore);
  var position = dataBefore.byteLength;
  for (var i = 0; i < data.length; i++) {
    var dataGroup = data[i];
    for (var j = 0; j < dataGroup.length; j++) {
      newFontBytes.set(dataGroup[j], position);
      position += dataGroup[j].byteLength;
    }
  }
  newFontBytes.set(dataAfter, position);

  // Install the new data into the font.
  this.fontData_ = new DataView(newFontBytes.buffer, headerSize);
  this.binaryEditor_ = new tachyfont.BinaryFontEditor(this.fontData_, 0);

  return deltaSize;
};


/**
 * The offsets affected by Compact TachyFont.
 * @return {!tachyfont.Sfnt.CompactOffsets}
 */
tachyfont.Sfnt.Font.prototype.getCompactOffsets = function() {
  return new tachyfont.Sfnt.CompactOffsets(
      this.getTableOffset(tachyfont.Sfnt.CFF_TAG),
      this.getTableOffset(tachyfont.Sfnt.CMAP_TAG),
      this.getTableOffset(tachyfont.Sfnt.HMTX_TAG),
      this.getTableOffset(tachyfont.Sfnt.VMTX_TAG));
};



/**
 * The offsets affected by Compact TachyFont.
 * @param {number} cffOffset
 * @param {number} cmapOffset
 * @param {number} hmtxOffset
 * @param {number} vmtxOffset
 * @constructor @struct @final
 */
tachyfont.Sfnt.CompactOffsets =
    function(cffOffset, cmapOffset, hmtxOffset, vmtxOffset) {
  /** @private @const {number} */
  this.cffOffset_ = cffOffset;

  /** @private @const {number} */
  this.cmapOffset_ = cmapOffset;

  /** @private @const {number} */
  this.hmtxOffset_ = hmtxOffset;

  /** @private @const {number} */
  this.vmtxOffset_ = vmtxOffset;
};


/** @return {number} */
tachyfont.Sfnt.CompactOffsets.prototype.getCffOffset = function() {
  return this.cffOffset_;
};


/** @return {number} */
tachyfont.Sfnt.CompactOffsets.prototype.getCmapOffset = function() {
  return this.cmapOffset_;
};


/** @return {number} */
tachyfont.Sfnt.CompactOffsets.prototype.getHmtxOffset = function() {
  return this.hmtxOffset_;
};


/** @return {number} */
tachyfont.Sfnt.CompactOffsets.prototype.getVmtxOffset = function() {
  return this.vmtxOffset_;
};



/**
 * The Font table of contents.
 * @constructor @struct @final @protected
 */
tachyfont.Sfnt.TableOfContents = function() {
  /**
   * Indicates if this is a CFF font or a TrueType font.
   * TODO(bstell): make this const when changing the init call to be called
   * before the constructor.
   * @private {boolean}
   */
  this.isCff_ = false;

  /** @private {!Array<!tachyfont.Sfnt.TableOfContentsEntry>} */
  this.items_ = [];

  /** @private {!Object<string, number>} */
  this.tagIndex_ = {};
};


/**
 * Routine to make a sorted copy of the tables in a sfnt font.
 * @return {!tachyfont.Sfnt.TableOfContents}
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.getSorted_ = function() {
  var sortedTable = new tachyfont.Sfnt.TableOfContents();
  sortedTable.isCff_ = this.isCff_;
  sortedTable.items_ = this.items_.slice();

  sortedTable.items_.sort(function(a, b) {
    return a.getOffset() - b.getOffset();
  });
  sortedTable.tagIndex_ = {};
  for (var i = 0; i < sortedTable.items_.length; i++) {
    var entry = sortedTable.items_[i];
    var tag = entry.getTag();
    sortedTable.tagIndex_[tag] = i;
  }

  return sortedTable;
};


/**
 * @return {boolean}
 */
tachyfont.Sfnt.TableOfContents.prototype.getIsCff = function() {
  return this.isCff_;
};


/**
 * @return {!Array<!tachyfont.Sfnt.TableOfContentsEntry>}
 */
tachyfont.Sfnt.TableOfContents.prototype.getItems = function() {
  return this.items_;
};


/**
 * @return {!Object<string, number>}
 */
tachyfont.Sfnt.TableOfContents.prototype.getTagsIndex = function() {
  return this.tagIndex_;
};


/** @type {number} */
tachyfont.Sfnt.TableOfContents.TTF_VERSION_NUMBER = 0x00010000;


/** @type {string} */
tachyfont.Sfnt.TableOfContents.CFF_VERSION_TAG = 'OTTO';


/**
 * Factory to get a font table of contents.
 * @param {!DataView} fontData The font data.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary editor for the
 *     font.
 * @return {!tachyfont.Sfnt.TableOfContents}
 */
tachyfont.Sfnt.parseTableOfContents = function(fontData, binaryEditor) {
  var tableOfContents = new tachyfont.Sfnt.TableOfContents();
  tableOfContents.init_(fontData, binaryEditor);
  return tableOfContents;
};


/**
 * Initialize the Table Of Contents.
 * @param {!DataView} fontData The font data.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary editor for the
 *     font.
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.init_ = function(fontData,
    binaryEditor) {
  var sfntVersion = binaryEditor.getUint32();
  binaryEditor.seek(0);
  var sfntVersionTag = binaryEditor.readString(4);
  if (sfntVersion == tachyfont.Sfnt.TableOfContents.TTF_VERSION_NUMBER) {
    // TODO(bstell): handle a ttf font.
    this.isCff_ = false;
  } else if (sfntVersionTag == tachyfont.Sfnt.TableOfContents.CFF_VERSION_TAG) {
    // is CFF opentype font
    this.isCff_ = true;
  } else {
    throw new Error('invalid font');
  }
  var numTables = binaryEditor.getUint16();
  binaryEditor.skip(6);  // searchRange, entrySelector, rangeShift
  for (var i = 0; i < numTables; i++) {
    var entryOffset = binaryEditor.tell();
    var tag = binaryEditor.readString(4);
    binaryEditor.seek(entryOffset);
    var tagNumber = binaryEditor.getUint32();
    var checksum = binaryEditor.getUint32();
    var offset = binaryEditor.getUint32();
    var length = binaryEditor.getUint32();
    var item = new tachyfont.Sfnt.TableOfContentsEntry(tag, tagNumber, checksum,
        offset, length);
    this.items_.push(item);
    this.tagIndex_[tag] = i;
  }
};


/**
 * Update the Table Of Contents.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor A binary editor for the
 *     font.
 * @param {number} deltaTableLength The amount to change the table size.
 * @param {number} deltaAllocatedLength The amount to change the offset.
 * @param {number} afterOffset Only change offsets that were after this offset.
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.updateOffsets_ = function(
    binaryEditor, deltaTableLength, deltaAllocatedLength, afterOffset) {
  // Skip sfntVersion, numTables, searchRange, entrySelector, rangeShift.
  binaryEditor.seek(12);

  // The sfnt table of contents:
  // * 32 bit tag (4 8-bit chars)
  // * 32 bit checksum
  // * 32 bit offset
  // * 32 bit length
  var numTables = this.items_.length;
  for (var i = 0; i < numTables; i++) {
    var entry = this.items_[i];
    var tag = binaryEditor.readString(4);
    goog.asserts.assert(tag == entry.tag_);
    binaryEditor.skip(4);  // Skip the checksum.
    if (entry.offset_ == afterOffset) {
      // Skip the offset.
      binaryEditor.skip(4);
      // Update the length
      entry.length_ += deltaTableLength;
      binaryEditor.setUint32(entry.length_);
    } else if (entry.offset_ > afterOffset) {
      // Update the offset.
      entry.offset_ += deltaAllocatedLength;
      binaryEditor.setUint32(entry.offset_);
      // Skip the length.
      binaryEditor.skip(4);
    } else {
      binaryEditor.skip(8);  // Skip the offset and length.
    }
  }
};


/**
 * Get a Table Of Contents table entry.
 * @param {string} tag The 4 character tag for the table.
 * @return {!tachyfont.Sfnt.TableOfContentsEntry} ;
 */
tachyfont.Sfnt.TableOfContents.prototype.getEntry = function(tag) {
  var index = this.tagIndex_[tag];
  return this.items_[index];
};



/**
 * An item in the Font table of contents.
 * @param {string} tag The table name.
 * @param {number} tagNumber The table name number.
 * @param {number} checksum The checksum of the table.
 * @param {number} offset The offset to the table.
 * @param {number} length The length of the table.
 * @constructor @struct @final
 */
tachyfont.Sfnt.TableOfContentsEntry = function(tag, tagNumber, checksum, offset,
    length) {
  /** @private @const {string} */
  this.tag_ = tag;

  /** @private @const {number} */
  this.tagNumber_ = tagNumber;

  /** @private @const {number} */
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
 * Get the tag (as a number) for this entry.
 * @return {number}
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getTagNumber = function() {
  return this.tagNumber_;
};


/**
 * Get the checksum for this entry.
 * @return {number}
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getChecksum = function() {
  return this.checksum_;
};


/**
 * Get the offset for this entry.
 * @return {number}
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getOffset = function() {
  return this.offset_;
};


/**
 * Get the length for this entry.
 * @return {number} The length for this entry.
 */
tachyfont.Sfnt.TableOfContentsEntry.prototype.getLength = function() {
  return this.length_;
};




