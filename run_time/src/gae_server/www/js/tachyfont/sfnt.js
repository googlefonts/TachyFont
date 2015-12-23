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

goog.require('tachyfont.BinaryFontEditor');



/**
 * The Font table of contents.
 * @constructor
 * @protected
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
 * @param {DataView} fontData The font data.
 * @return {!tachyfont.Sfnt.TableOfContents}
 */
tachyfont.Sfnt.getTableOfContents = function(fontData) {
  var tableOfContents = new tachyfont.Sfnt.TableOfContents();
  tableOfContents.init_(fontData);
  return tableOfContents;
};


/**
 * Initialize the Table Of Contents.
 * @param {DataView} fontData The font data.
 * @private
 */
tachyfont.Sfnt.TableOfContents.prototype.init_ = function(fontData) {
  var binEd = new tachyfont.BinaryFontEditor(fontData, 0);
  var sfntVersion = binEd.getUint32();
  binEd.seek(0);
  var sfntVersionTag = binEd.readString(4);
  if (sfntVersion == tachyfont.Sfnt.TableOfContents.TTF_VERSION_NUMBER) {
    // TODO(bstell): handle a ttf font.
    this.isCff_ = false;
    debugger;
  } else if (sfntVersionTag == tachyfont.Sfnt.TableOfContents.CFF_VERSION_TAG) {
    // is CFF opentype font
    this.isCff_ = true;
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
 * Get a Table Of Contents table entry.
 * @param {string} tag The 4 character tag for the table.
 * @return {tachyfont.Sfnt.TableOfContentsEntry} ;
 */
tachyfont.Sfnt.TableOfContents.prototype.getTocEntry = function(tag) {
  var index = this.tagIndex_[tag];
  return this.items_[index];
};


/**
 * Get isCff.
 * @return {boolean}
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
 * @constructor
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


