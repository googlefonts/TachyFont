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

goog.provide('tachyfont.IncrementalFontUtils');

goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.log');


/**
 * Enum for flags in the coming glyph bundle
 * @enum {number}
 */
tachyfont.IncrementalFontUtils.FLAGS = {
  HAS_HMTX: 1,
  HAS_VMTX: 2,
  HAS_CFF: 4
};


/**
 * Segment size in the loca table
 * @const {number}
 */
tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE = 64;


/**
 * The Style Sheet ID
 * @const {string}
 */
tachyfont.IncrementalFontUtils.STYLESHEET_ID =
    'Incremental\u00A0Font\u00A0Utils';


/**
 * Gets the map of glyphIds to codepoints.
 * @param {!Array<number>} neededCodes The codes to be injected.
 * @param {!tachyfont.typedef.CmapMapping} cmapMapping The cmap info.
 * @return {!Object<number,!Array<number>>}
 */
tachyfont.IncrementalFontUtils.getGlyphToCodeMap = function(
    neededCodes, cmapMapping) {
  var glyphToCodeMap = {};
  for (var i = 0; i < neededCodes.length; i++) {
    var code = neededCodes[i];
    var charCmapInfo = cmapMapping[code];
    if (charCmapInfo) {
      // Handle multiple codes sharing a glyphId.
      if (glyphToCodeMap[charCmapInfo.glyphId] == undefined) {
        glyphToCodeMap[charCmapInfo.glyphId] = [];
      }
      glyphToCodeMap[charCmapInfo.glyphId].push(code);
    }
    if (goog.DEBUG) {
      if (!charCmapInfo) {
        tachyfont.log.warning('no glyph for codepoint 0x' + code.toString(16));
      }
    }
  }
  return glyphToCodeMap;
};


/**
 * Set the Horizontal/Vertical metrics.
 * @param {number} flags Indicates what is in the glyphData.
 * @param {!tachyfont.GlyphBundleResponse.GlyphData} glyphData An object holding
 *     the glyph data.
 * @param {!tachyfont.BinaryFontEditor} baseBinaryEditor A font editor.
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font bytes.
 */
tachyfont.IncrementalFontUtils.setMtx = function(
    flags, glyphData, baseBinaryEditor, fileInfo) {
  var id = glyphData.getId();
  if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
    var hmtx = glyphData.getHmtx();
    baseBinaryEditor.setMtxSideBearing(
        fileInfo.hmtxOffset, fileInfo.hmetricCount, id, hmtx);
  }
  if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
    var vmtx = glyphData.getVmtx();
    baseBinaryEditor.setMtxSideBearing(
        fileInfo.vmtxOffset, fileInfo.vmetricCount, id, vmtx);
  }
};


/**
 * Parses base font header, set properties.
 * @param {!DataView} baseFont Base font with header.
 * @param {!Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCharsetFormat2 =
    function(baseFont, headerInfo) {
  if (!headerInfo.charset_fmt)
    return;
  var binaryEditor = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.charset_fmt.offset + 1);
  var nGroups = headerInfo.charset_fmt.gos.len;
  var segments = headerInfo.charset_fmt.gos.segments;
  var is_fmt_2 = (headerInfo.charset_fmt.gos.type == 6);
  for (var i = 0; i < nGroups; i++) {
    binaryEditor.setUint16(segments[i][0]);
    if (is_fmt_2)
      binaryEditor.setUint16(segments[i][1]);
    else
      binaryEditor.setUint8(segments[i][1]);
  }
};


/**
 * Fixes the glyph offset.
 * @param {!Object} headerInfo The font header information.
 * @param {!DataView} baseFont Base font as DataView
 * @param {boolean} compact Whether the glyph offsets should be compacted.
 * @return {!DataView} The base font with fixed glyph offsets.
 */
tachyfont.IncrementalFontUtils.fixGlyphOffsets = function(
    headerInfo, baseFont, compact) {
  if (headerInfo.isTtf) {
    var binaryEditor = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = headerInfo.glyphOffset;
    var glyphCount = headerInfo.numGlyphs;
    var glyphSize;
    var thisOne;
    var nextOne;
    for (var i = (tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE - 1);
        i < glyphCount;
        i += tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE) {
      thisOne = binaryEditor.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i);
      nextOne = binaryEditor.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i + 1);
      glyphSize = nextOne - thisOne;
      if (glyphSize) {
        binaryEditor.seek(glyphOffset + thisOne);
        binaryEditor.setInt16(-1);
      }
    }
  } else {
    var binaryEditor = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = headerInfo.glyphOffset;
    var glyphCount = headerInfo.numGlyphs;
    var lastRealOffset = binaryEditor.getGlyphDataOffset(
        headerInfo.glyphDataOffset, headerInfo.offsetSize, 0);
    var delta = 0;
    var thisOne;
    for (var i = 0; i < glyphCount + 1; i++) {
      thisOne = binaryEditor.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i);
      if (compact || (lastRealOffset == thisOne)) {
        thisOne = lastRealOffset + delta;
        binaryEditor.setGlyphDataOffset(headerInfo.glyphDataOffset,
            headerInfo.offsetSize, i, thisOne);
        delta++;
      } else {
        lastRealOffset = thisOne;
        delta = 1;
      }
      if (i < glyphCount) {
        binaryEditor.seek(glyphOffset + thisOne);
        binaryEditor.setUint8(14);
      }
    }
  }
  return baseFont;
};


/**
 * Add the '@font-face' rule
 * @param {!DataView} data The font data.
 * @param {string} mimeType The mime-type of the font.
  * @return {string} The blob URL.
  */
tachyfont.IncrementalFontUtils.getBlobUrl = function(data, mimeType) {
  var blob;
  try {
    blob = new Blob([data], { type: mimeType });
  } catch (e) {
    // IE 11 does not like using DataView here.
    if (e.name == 'InvalidStateError') {
      var buffer = data.buffer.slice(data.byteOffset);
      blob = new Blob([buffer], { type: mimeType});
    }
  }
  var blobUrl = window.URL.createObjectURL(blob);
  return blobUrl;
};


/**
 * Trim a CSSStyleSheet font-family string.
 *
 * @param {string} cssFontFamily The font-family name to trim.
 * @return {string} The trimed font-family name.
 */
tachyfont.IncrementalFontUtils.trimCssFontFamily = function(cssFontFamily) {
  var trimmedName = cssFontFamily.trim();
  // When there are spaces in the font-name, Chromium adds quotes
  // around the font name in the style object; eg, "Noto Sans Japanese"
  // becomes "'Noto Sans Japanese'".
  // https://code.google.com/p/chromium/issues/detail?id=368293
  var firstChar = trimmedName.charAt(0);
  var lastChar = trimmedName.charAt(trimmedName.length - 1);
  if (firstChar != lastChar) {
    // Not wrapped by the same character.
    return trimmedName;
  }
  if ((firstChar != '"') && (firstChar != "'")) {
    // Not wrapped by quotes.
    return trimmedName;
  }
  // Remove the wrapping quotes.
  return trimmedName.substring(1, trimmedName.length - 1);
};


/**
 * Get the TachyFont style sheet.
 *
 * @return {!CSSStyleSheet} The style sheet.
 */
tachyfont.IncrementalFontUtils.getStyleSheet = function() {
  // TODO(bstell): consider caching this.
  var style = document.getElementById(
      tachyfont.IncrementalFontUtils.STYLESHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = tachyfont.IncrementalFontUtils.STYLESHEET_ID;
    document.head.appendChild(style);
  }
  var sheet = style.sheet;
  return sheet;
};
