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

goog.provide('tachyfont.GlyphBundleResponse');

goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.IncrementalFontUtils');



/**
 * @param {string} version
 * @param {string} signature
 * @param {number} offset Offset to the GlyphBundle Bytes
 * @param {!ArrayBuffer} buffer The glyph response buffer.
 * @constructor @final @struct
 */
tachyfont.GlyphBundleResponse = function(version, signature, offset, buffer) {
  var dataView = new DataView(buffer);
  var binaryEditor = new tachyfont.BinaryFontEditor(dataView, offset);
  var count = binaryEditor.getUint16();
  var flags = binaryEditor.getUint16();

  this.version = version;
  this.signature = signature;
  this.flags = flags;
  this.glyphBuffer = buffer;
  this.glyphDataArray_ = [];

  for (var i = 0; i < count; i += 1) {
    var id = binaryEditor.getUint16();
    var hmtx;
    var vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
      hmtx = binaryEditor.getUint16();
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
      vmtx = binaryEditor.getUint16();
    }

    var bytesOffset = binaryEditor.getUint32();
    var length = binaryEditor.getUint16();

    var bytes = binaryEditor.getArrayOf(binaryEditor.getUint8, length);

    var glyphData = new tachyfont.GlyphBundleResponse.GlyphData(id, hmtx, vmtx,
        bytesOffset, length, bytes);
    this.glyphDataArray_.push(glyphData);
  }
  // Sort the glyphData entries by glyph id.
  this.glyphDataArray_.sort(function(a, b) {
    return a.getId() - b.getId();
  });
};


/**
 * @return {number} Number of glyphs in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getGlyphCount = function() {
  return this.glyphDataArray_.length;
};


/**
 * @return {number} flags binary for this response.
 */
tachyfont.GlyphBundleResponse.prototype.getFlags = function() {
  return this.flags;
};


/**
 * @return {!Array<!tachyfont.GlyphBundleResponse.GlyphData>}
 */
tachyfont.GlyphBundleResponse.prototype.getGlyphDataArray = function() {
  return this.glyphDataArray_;
};



/**
 * @param {number} id
 * @param {number|undefined} hmtx
 * @param {number|undefined} vmtx
 * @param {number} offset
 * @param {number} length
 * @param {!Array<number>} bytes
 * @constructor @final @struct
 */
tachyfont.GlyphBundleResponse.GlyphData = function(id, hmtx, vmtx, offset,
    length, bytes) {
  /** @private @const {number} */
  this.id_ = id;

  /** @private @const {number|undefined} */
  this.hmtx_ = hmtx;

  /** @private @const {number|undefined} */
  this.vmtx_ = vmtx;

  /** @private @const {number} */
  this.offset_ = offset;

  /** @private @const {number} */
  this.length_ = length;

  /** @private @const {!Array<number>} */
  this.bytes_ = bytes;
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getId = function() {
  return this.id_;
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getHmtx = function() {
  if (typeof this.hmtx_ == 'undefined') {
    throw new Error('hmtx undefined');
  }
  return /** @type {number} */ (this.hmtx_);
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getVmtx = function() {
  if (typeof this.vmtx_ == 'undefined') {
    throw new Error('vmtx undefined');
  }
  return /** @type {number} */ (this.vmtx_);
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getOffset = function() {
  return this.offset_;
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getLength = function() {
  return this.length_;
};


/**
 * @return {!Array<number>}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getBytes = function() {
  return this.bytes_;
};


