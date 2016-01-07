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
 * @param {ArrayBuffer} buffer The glyph response buffer.
 * @constructor @final @struct
 */
tachyfont.GlyphBundleResponse = function(version, signature, offset, buffer) {
  var dataView = new DataView(buffer);
  var binEd = new tachyfont.BinaryFontEditor(dataView, offset);
  var count = binEd.getUint16();
  var flags = binEd.getUint16();

  this.version = version;
  this.signature = signature;
  this.count = count;
  this.flags = flags;
  this.offsetToGlyphData = offset + 4;
  this.glyphBuffer = buffer;
  this.glyphDataArray_ = [];

  for (var i = 0; i < count; i += 1) {
    var id = binEd.getUint16();
    var hmtx, vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
      hmtx = binEd.getUint16();
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
      vmtx = binEd.getUint16();
    }

    var bytesOffset = binEd.getUint32();
    var length = binEd.getUint16();

    var bytes = binEd.getArrayOf(binEd.getUint8, length);

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
 * @return {number} the length of the glyph data in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getDataLength = function() {
  return this.glyphBuffer.byteLength - this.offsetToGlyphData;
};


/**
 * @return {tachyfont.BinaryFontEditor} a font editor for the glyph data in this
 *         response.
 */
tachyfont.GlyphBundleResponse.prototype.getFontEditor = function() {
  return new tachyfont.BinaryFontEditor(new DataView(this.glyphBuffer),
                                        this.offsetToGlyphData);
};


/**
 * @return {number} Number of glyphs in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getGlyphCount = function() {
  return this.count;
};


/**
 * @return {number} flags binary for this response.
 */
tachyfont.GlyphBundleResponse.prototype.getFlags = function() {
  return this.flags;
};


/**
 * @return {!Array.<!tachyfont.GlyphBundleResponse.GlyphData>}
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
 * @param {!Array.<number>} bytes
 * @constructor @final @struct
 */
tachyfont.GlyphBundleResponse.GlyphData = function(id, hmtx, vmtx, offset,
    length, bytes) {
  /** @private {number} */
  this.id_ = id;

  /** @private {number|undefined} */
  this.hmtx_ = hmtx;

  /** @private {number|undefined} */
  this.vmtx_ = vmtx;

  /** @private {number} */
  this.offset_ = offset;

  /** @private {number} */
  this.length_ = length;

  /** @private {!Array.<number>} */
  this.bytes_ = bytes;
};


/**
 * @return {number}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getId = function() {
  return this.id_;
};


/**
 * @return {number|undefined}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getHmtx = function() {
  return this.hmtx_;
};


/**
 * @return {number|undefined}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getVmtx = function() {
  return this.vmtx_;
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
 * @return {!Array.<number>}
 */
tachyfont.GlyphBundleResponse.GlyphData.prototype.getBytes = function() {
  return this.bytes_;
};


