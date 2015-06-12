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

goog.require('goog.log');
goog.require('tachyfont.BinaryFontEditor');



/**
 * @param {string} version
 * @param {string} signature
 * @param {number} count
 * @param {number} flags
 * @param {number} offsetToGlyphData
 * @param {ArrayBuffer} glyphData
 * @constructor
 */
tachyfont.GlyphBundleResponse = function(
    version, signature, count, flags, offsetToGlyphData, glyphData) {
  this.version = version;
  this.signature = signature;
  this.count = count;
  this.flags = flags;
  this.offsetToGlyphData = offsetToGlyphData;
  this.glyphData = glyphData;
};


/**
 * @return {number} the length of the glyph data in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getDataLength = function() {
  return this.glyphData.byteLength - this.offsetToGlyphData;
};


/**
 * @return {tachyfont.BinaryFontEditor} a font editor for the glyph data in this
 *         response.
 */
tachyfont.GlyphBundleResponse.prototype.getFontEditor = function() {
  return new tachyfont.BinaryFontEditor(new DataView(this.glyphData),
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
