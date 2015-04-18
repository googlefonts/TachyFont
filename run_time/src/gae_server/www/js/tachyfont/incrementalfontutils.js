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

goog.require('goog.asserts');
goog.require('goog.log');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.CharCmapInfo');
goog.require('tachyfont.FontInfo');


/**
 * Incremental font loader utilities. A separate namespace is not longer needed.
 */
tachyfont.IncrementalFontUtils = {};


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
 * Inject glyphs in the glyphData to the baseFont
 * @param {Object} headerInfo The font header information.
 * @param {DataView} baseFont Current base font
 * @param {tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {Object.<string, !tachyfont.CharCmapInfo>} cmapMapping the code point
 *     to cmap info mapping.
 * @param {Object.<number, !number>} glyphToCodeMap  The glyph Id to code point
 *     mapping;
 * @return {DataView} Updated base font
 */
tachyfont.IncrementalFontUtils.injectCharacters = function(headerInfo, baseFont,
    bundleResponse, cmapMapping, glyphToCodeMap) {
  // time_start('inject')
  headerInfo.dirty = true;
  var bundleBinEd = bundleResponse.getFontEditor();
  var baseBinEd = new tachyfont.BinaryFontEditor(baseFont, 0);

  var count = bundleResponse.getGlyphCount();
  var flags = bundleResponse.getFlags();

  var isCFF = flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_CFF;
  var offsetDivisor = 1;
  if (!isCFF && headerInfo.offsetSize == 2) {
    // For the loca "short version":
    //   "The actual local offset divided by 2 is stored."
    offsetDivisor = 2;
  }
  var glyphIds = [];
  for (var i = 0; i < count; i += 1) {
    var id = bundleBinEd.getUint16();
    glyphIds.push(id);
    var nextId = id + 1;
    var hmtx, vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
      hmtx = bundleBinEd.getUint16();
      baseBinEd.setMtxSideBearing(headerInfo.hmtxOffset, headerInfo.hmetricCount,
          id, hmtx);
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
      vmtx = bundleBinEd.getUint16();
      baseBinEd.setMtxSideBearing(headerInfo.vmtxOffset, headerInfo.vmetricCount,
          id, vmtx);
    }
    var offset = bundleBinEd.getUint32();
    var length = bundleBinEd.getUint16();

    if (!isCFF) {
      // Set the loca for this glyph.
      baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize,
          id, offset / offsetDivisor);
      var oldNextOne = baseBinEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, nextId);
      var newNextOne = offset + length;
      // Set the length of the current glyph (at the loca of nextId).
      baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize,
          nextId, newNextOne / offsetDivisor);

      // Fix the sparse loca values before this new value.
      var prev_id = id - 1;
      while (prev_id >= 0 && baseBinEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, prev_id) > offset) {
        baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize,
            prev_id, offset / offsetDivisor);
        prev_id--;
      }
      /*
       * Fix up the sparse loca values after this glyph.
       *
       * If value is changed and length is nonzero we should make the next glyph
       * a dummy glyph(ie: write -1 to make it a composite glyph).
       */
      var isChanged = oldNextOne != newNextOne;
      isChanged = isChanged && nextId < headerInfo.numGlyphs;
      if (isChanged) {
        // Fix the loca value after this one.
        baseBinEd.seek(headerInfo.glyphOffset + newNextOne);
        if (length > 0) {
          baseBinEd.setInt16(-1);
        }else if (length == 0) {
          /*if it is still zero,then could write -1*/
          var currentUint1 = baseBinEd.getUint32(),
              currentUint2 = baseBinEd.getUint32();
          if (currentUint1 == 0 && currentUint2 == 0) {
            baseBinEd.seek(headerInfo.glyphOffset + newNextOne);
            baseBinEd.setInt16(-1);
          }
        }
      }
    } else {
      baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize,
          id, offset);
      var oldNextOne = baseBinEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, nextId);
      baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize, nextId,
          offset + length);
      nextId = id + 2;
      var offsetCount = headerInfo.numGlyphs + 1;
      var currentIdOffset = offset + length, nextIdOffset;
      if (oldNextOne < currentIdOffset && nextId - 1 < offsetCount - 1) {
        baseBinEd.seek(headerInfo.glyphOffset + currentIdOffset);
        baseBinEd.setUint8(14);
      }
      while (nextId < offsetCount) {
        nextIdOffset = baseBinEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
            headerInfo.offsetSize, nextId);
        if (nextIdOffset <= currentIdOffset) {
          currentIdOffset++;
          baseBinEd.setGlyphDataOffset(headerInfo.glyphDataOffset, headerInfo.offsetSize,
              nextId, currentIdOffset);
          if (nextId < offsetCount - 1) {
            baseBinEd.seek(headerInfo.glyphOffset + currentIdOffset);
            baseBinEd.setUint8(14);
          }
          nextId++;
        } else {
          break;
        }
      }
    }

    var bytes = bundleBinEd.getArrayOf(bundleBinEd.getUint8, length);
    baseBinEd.seek(headerInfo.glyphOffset + offset);
    baseBinEd.setArrayOf(baseBinEd.setUint8, bytes);
  }
  // Set the glyph Ids in the cmap format 12 subtable;
  tachyfont.IncrementalFontUtils.setFormat12GlyphIds_(headerInfo, baseFont, 
    glyphIds, glyphToCodeMap, cmapMapping);

  // Set the glyph Ids in the cmap format 4 subtable;
  tachyfont.IncrementalFontUtils.setFormat4GlyphIds_(headerInfo, baseFont, 
    glyphIds, glyphToCodeMap, cmapMapping);

  // time_end('inject')

  return baseFont;
};


/**
 * Set the format 12 glyph Ids.
 * 
 * @param {Object} headerInfo The object with the font header information.
 * @param {DataView} baseFont Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<!number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {Object.<string, !tachyfont.CharCmapInfo>} cmapMapping the code point
 *     to cmap info mapping.
 * @private
 */
tachyfont.IncrementalFontUtils.setFormat12GlyphIds_ =
  function(headerInfo, baseFont, glyphIds, glyphToCodeMap, cmapMapping) {
  if (!headerInfo.cmap12) {
    return;
  }
  var segEd = new tachyfont.BinaryFontEditor(baseFont,
    headerInfo.cmap12.offset + 16);
  var segments = headerInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < glyphIds.length; i += 1) {
    var id = glyphIds[i];
    var code = glyphToCodeMap[id];
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, 'format 12: code = ' + code);
    }
    var charCmapInfo = cmapMapping[code];
    if (!charCmapInfo) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'format 12, code ' + code +
          ': no CharCmapInfo');
        debugger;
      }
      continue;
    }

    // Set the glyphId for format 12
    var format12Seg = charCmapInfo.format12Seg;
    var segment = segments[format12Seg];
    var segStartCode = segment[0];
    var segEndCode = segStartCode + segment[1] - 1;
    var segStartGlyphId = segment[2];
    var segOffset = format12Seg * 12;
    segEd.seek(segOffset);
    var inMemoryStartCode = segEd.getUint32();
    var inMemoryEndCode = segEd.getUint32();
    var inMemoryGlyphId = segEd.getUint32();
    if (goog.DEBUG) {
      // Check the code point.
      if (inMemoryStartCode != segStartCode) {
        goog.log.error(tachyfont.logger, 'format 12, code ' + code + ', seg ' 
          + format12Seg + ': startCode mismatch');
        debugger;
      }
      if (inMemoryEndCode != segEndCode) {
        goog.log.error(tachyfont.logger, 'format 12 code ' + code + ', seg ' +
          format12Seg + ': endCode mismatch');
        debugger;
      }
      if (segStartCode != segEndCode) { // TODO(bstell): check length
        goog.log.error(tachyfont.logger, 'format 12 code ' + code + ', seg ' +
          format12Seg + ': length != 1');
        debugger;
      }
      if (inMemoryGlyphId != 0) {
        if (inMemoryGlyphId == segStartGlyphId) {
          goog.log.error(tachyfont.logger, 'format 12 code ' + code + ', seg ' +
            format12Seg + ' glyphId already set');
        } else {
          goog.log.error(tachyfont.logger, 'format 12 code ' + code + ', seg ' +
            format12Seg + ' glyphId mismatch');
          debugger;
        }
      }
    }
    // Seek to the glyphId.
    segEd.seek(segOffset + 8);
    // Set the glyphId.
    segEd.setUint32(segStartGlyphId);


  }
};

/**
 * Get the character to glyphId mapping.
 * @param {DataView} baseFont Base font.
 * @param {Object} headerInfo Header information.
 * @return {Object.<string, tachyfont.CharCmapInfo>} Map of chars to glyphId, 
 *     format4Seg, format12Seg.
 */
tachyfont.IncrementalFontUtils.getCmapMapping = function(headerInfo) {
  var cmapMapping = {};
  var charCmapInfo;
  // Parse format 4.
  if (headerInfo.cmap4) {
    var segments = headerInfo.compact_gos.cmap4.segments;
    var glyphIdArray = headerInfo.compact_gos.cmap4.glyphIdArray;
    var glyphIdIndex = 0;
    for (var i = 0; i < segments.length; i++) {
      var startCode = segments[i][0];
      var endCode = segments[i][1];
      var idDelta = segments[i][2];
      var idRangeOffset = segments[i][3];
      var length = endCode - startCode + 1;
      for (var j = 0; j < length; j++) {
        var code = startCode + j;
        var glyphId = null;
        if (idRangeOffset == 0) {
          glyphId = (code + idDelta) % 65536;
        } else {
          if (goog.DEBUG) {
            // TODO(bstell): verify this code.
            debugger;
          }
          glyphId = glyphIdArray[glyphIdIndex++];
          if (glyphId == 0) {
            // This code is not mapped in the font.
            if (goog.DEBUG) {
              // TODO(bstell): verify this code.
              debugger;
            }
            continue;
          }
        }
        charCmapInfo = new tachyfont.CharCmapInfo(glyphId, i, null);
        cmapMapping[code] = charCmapInfo;
      }
    }
  }


  if (!headerInfo.cmap12) {
    debugger; // TODO(bstell): need to handle this.
    return cmapMapping;
  }
  var n12Groups = headerInfo.cmap12.nGroups;
  var segments = headerInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < n12Groups; i++) {
    var startCode = segments[i][0];
    var length = segments[i][1];
    var startGlyphId = segments[i][2];
    for (var j = 0; j < length; j++) {
      var code = startCode + j;
      charCmapInfo = cmapMapping[code];
      var glyphId = startGlyphId + j;
      if (goog.DEBUG) {
        if (charCmapInfo) {
          goog.asserts.assert(charCmapInfo.glyphId == glyphId,
            'format 4/12 glyphId mismatch');
        }
      }
      if (!charCmapInfo) {
        charCmapInfo = new tachyfont.CharCmapInfo(glyphId, null, null);
        cmapMapping[code] = charCmapInfo;
      }
      charCmapInfo.format12Seg = i;
    }
  }
  return cmapMapping;
};


/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCmap12 = function(baseFont, headerInfo) {
  if (!headerInfo.cmap12)
    return;
  var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.cmap12.offset + 16);
  var nGroups = headerInfo.cmap12.nGroups;
  var segments = headerInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < nGroups; i++) {
    if (goog.DEBUG) {
      var startCode = segments[i][0];
      var length = segments[i][1];
      var glyphId = segments[i][2];
      if (length != 1) {
        goog.log.error(tachyfont.logger, 'format 4, seg ' + i + 'length = ' +
          length);
        debugger;
      }
    }
    binEd.setUint32(segments[i][0]);
    binEd.setUint32(segments[i][0] + segments[i][1] - 1);
    binEd.setUint32(0);
  }
};


/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCmap4 = function(baseFont, headerInfo) {
  if (!headerInfo.cmap4)
    return;
  var segments = headerInfo.compact_gos.cmap4.segments;
  var glyphIdArray = headerInfo.compact_gos.cmap4.glyphIdArray;
  var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    if (goog.DEBUG) {
      alert('segCount=' + segCount + ', segments.length=' + segments.length);
      debugger;
    }
  }
  var glyphIdArrayLen = (headerInfo.cmap4.length - 16 - segCount * 8) / 2;
  headerInfo.cmap4.segCount = segCount;
  headerInfo.cmap4.glyphIdArrayLen = glyphIdArrayLen;
  binEd.skip(6); //skip searchRange,entrySelector,rangeShift
  if (goog.DEBUG) {
    for (var i = 0; i < segCount; i++) {
      var startCode = segments[i][0];
      var endCode = segments[i][1];
      var idDelta = segments[i][2];
      var idRangeOffset = segments[i][3];
      var length = endCode - startCode + 1;
      if (length != 1) {
        goog.log.error(tachyfont.logger, 'format 4, seg ' + i + 'length = ' +
          length);
        debugger;
      }
      var idRangeOffset = segments[i][3];
      if (idRangeOffset != 0) {
        goog.log.error(tachyfont.logger, 'format 4, seg ' + i +
          'idRangeOffset = ' + idRangeOffset);
        debugger;
      }
    }
  }
  // Write endCode values.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][1]);
  }
  binEd.skip(2);//skip reservePad
  // Write startCode values.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][0]);
  }
  // Write idDelta values.
  for (var i = 0; i < segCount; i++) {
    var startCode = segments[i][0];
    var idDelta = segments[i][2];
    var newIdDelta = 0x10000 - startCode;
    if (goog.DEBUG) {
      if (startCode != 0xffff && idDelta != newIdDelta + i + 1) {
        goog.log.error(tachyfont.logger, 'format 4, seg ' + i + 'idDelta = ' +
          idDelta);
        debugger;
      }
    }
    binEd.setUint16(newIdDelta);
//    binEd.setUint16(segments[i][2]);
  }
  // Write idRangeOffset vValues.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][3]);
  }
  // Write glyphIdArray values.
  if (glyphIdArrayLen > 0)
    binEd.setArrayOf(binEd.setUint16, glyphIdArray);
};


/**
 * Set the format 4 glyph Ids.
 * 
 * Note: this is not well tested.
 * 
 * @param {Object} headerInfo The object with the font header information.
 * @param {DataView} baseFont Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<!number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {Object.<string, !tachyfont.CharCmapInfo>} cmapMapping the code point
 *     to cmap info mapping.
 * @private
 */
tachyfont.IncrementalFontUtils.setFormat4GlyphIds_ =
  function(headerInfo, baseFont, glyphIds, glyphToCodeMap, cmapMapping) {
  if (!headerInfo.cmap4) {
    return;
  }
  var segments = headerInfo.compact_gos.cmap4.segments;
  var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger, 'segCount=' + segCount +
        ', segments.length=' + segments.length);
      debugger;
    }
    return;
  }
  binEd.seek(8);
  for (var i = 0; i < segCount; i++) {
    // Check the end code.
    var segEndCode = binEd.getUint16();
    if (segEndCode != segments[i][1]) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'segment ' + i + ': segEndCode (' +
          segEndCode + ') != segments[' + i + '][1] (' + segments[i][1] + ')');
        debugger;
      }
      return;
    }
    // Check the segment is one char long
    if (segEndCode != segments[i][0]) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'segment ' + i + ' is ' +
          (segments[i][1] - segments[i][0] + 1) + ' chars long');
        debugger;
      }
      return;
    }
  }
  binEd.skip(2);//skip reservePad
  for (var i = 0; i < segCount; i++) {
    var segStartCode = binEd.getUint16();
    if (segStartCode != segments[i][0]) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'segment ' + i + ': segStartCode (' +
          segStartCode + ') != segments[' + i + '][1] (' + segments[i][0] +
          ')');
        debugger;
      }
      return;
    }
  }
  var idDeltaOffset = binEd.tell();
  for (var i = 0; i < segCount; i++) {
    var segIdDelta = binEd.getUint16();
    var segGlyphId = (segIdDelta + segments[i][0]) & 0xFFFF;
    if (segGlyphId != 0) {
      if (goog.DEBUG) {
        if (segIdDelta == segments[i][2]) {
          goog.log.info(tachyfont.logger, 'segment ' + i + 
            ': segIdDelta already set');
        } else {
          goog.log.error(tachyfont.logger, 'segment ' + i + ': segIdDelta (' +
            segIdDelta + ') != segments[' + i + '][1] (' + segments[i][2] +
            ')');
          debugger;
          return;
        }
      }
    }
  }
  for (var i = 0; i < segCount; i++) {
    var segIdRangeOffset = binEd.getUint16();
    if (segIdRangeOffset != 0) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'segment ' + i +
          ': segIdRangeOffset (' + segIdRangeOffset + ') != 0');
        debugger;
      }
      return;
    }
  }
  for (var i = 0; i < glyphIds.length; i++) {
    // Set the glyph Id
    var glyphId = glyphIds[i];
    var code = glyphToCodeMap[glyphId];
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, 'format 4: code = ' + code);
    }
    var charCmapInfo = cmapMapping[code];
    if (!charCmapInfo) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'format 4, code ' + code +
          ': no CharCmapInfo');
        debugger;
      }
      continue;
    }
    var format4Seg = charCmapInfo.format4Seg;
    if (format4Seg == null) {
      if (goog.DEBUG) {
        if (code <= 0xFFFF) {
          goog.log.error(tachyfont.logger,
            'format 4, missine segment for code ' + code);
          debugger;
        }
      }
      // Character is not in the format 4 segment.
      continue;
    }
    binEd.seek(idDeltaOffset + format4Seg * 2);
    binEd.setUint16(segments[format4Seg][2]);
  }

};



/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCharsetFormat2 =
    function(baseFont, headerInfo) {
  if (!headerInfo.charset_fmt)
    return;
  var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.charset_fmt.offset + 1);
  var nGroups = headerInfo.charset_fmt.gos.len;
  var segments = headerInfo.charset_fmt.gos.segments;
  var is_fmt_2 = (headerInfo.charset_fmt.gos.type == 6);
  for (var i = 0; i < nGroups; i++) {
    binEd.setUint16(segments[i][0]);
    if (is_fmt_2)
      binEd.setUint16(segments[i][1]);
    else
      binEd.setUint8(segments[i][1]);
  }
};


/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @return {Object} The header information.
 */
tachyfont.IncrementalFontUtils.parseBaseHeader = function(baseFont) {

  var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
  var results = binEd.parseBaseHeader();
  if (!results.headSize) {
    throw 'missing header info';
  }
  return results;
};


/**
 * Sanitize base font to pass OTS
 * @param {Object} headerInfo The font header information.
 * @param {DataView} baseFont Base font as DataView
 * @return {DataView} Sanitized base font
 */
tachyfont.IncrementalFontUtils.sanitizeBaseFont = function(headerInfo, baseFont) {

  if (headerInfo.isTtf) {
    headerInfo.dirty = true;
    var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = headerInfo.glyphOffset;
    var glyphCount = headerInfo.numGlyphs;
    var glyphSize, thisOne, nextOne;
    for (var i = (tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE - 1);
        i < glyphCount;
        i += tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE) {
      thisOne = binEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i);
      nextOne = binEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i + 1);
      glyphSize = nextOne - thisOne;
      if (glyphSize) {
        binEd.seek(glyphOffset + thisOne);
        binEd.setInt16(-1);
      }
    }
  } else {
    headerInfo.dirty = true;
    var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = headerInfo.glyphOffset;
    var glyphCount = headerInfo.numGlyphs;
    var lastRealOffset = binEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
        headerInfo.offsetSize, 0);
    var delta = 0, thisOne;
    for (var i = 0; i < glyphCount + 1; i++) {
      thisOne = binEd.getGlyphDataOffset(headerInfo.glyphDataOffset,
          headerInfo.offsetSize, i);
      if (lastRealOffset == thisOne) {
        thisOne = lastRealOffset + delta;
        binEd.setGlyphDataOffset(headerInfo.glyphDataOffset,
            headerInfo.offsetSize, i, thisOne);
        delta++;
      } else {
        lastRealOffset = thisOne;
        delta = 1;
      }
      if (i < glyphCount) {
        binEd.seek(glyphOffset + thisOne);
        binEd.setUint8(14);
      }
    }
  }
  return baseFont;
};


/**
 * Set a style's visibility.
 * @param {Object} style The style object
 * @param {tachyfont.FontInfo} fontInfo The font information object
 * @param {boolean} visible True is setting visibility to visible.
 * @return {Object} New style object for given font and visibility
 */
tachyfont.IncrementalFontUtils.setVisibility = function(style, fontInfo,
    visible) {
  if (!style) {
    style = document.createElement('style');
    document.head.appendChild(style);
  }
  if (style.sheet.cssRules.length) {
    style.sheet.deleteRule(0);
  }
  var visibility;
  if (visible) {
    visibility = 'visible';
  } else {
    visibility = 'hidden';
  }
  var rule = '.' + fontInfo.getName() + ' { ' +
      'font-family: ' + fontInfo.getFamilyName() + '; ' +
      'font-weight: ' + fontInfo.getWeight() + '; ' +
      'visibility: ' + visibility + '; }';

  style.sheet.insertRule(rule, style.sheet.cssRules.length);

  return style;
};


/**
 * Add the '@font-face' rule
 * @param {tachyfont.FontInfo} fontInfo Info about this font.
 * @param {DataView} data The font data.
 * @param {string} mimeType The mime-type of the font.
  * @return {string} The blob URL.
  */
tachyfont.IncrementalFontUtils.getBlobUrl = function(fontInfo, data, mimeType) {
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
 * @param {string} familyName The font-family name to trim.
 * @return {string} The trimed font-family name.
 */
tachyfont.IncrementalFontUtils.trimFamilyName = function(familyName) {
  var trimmedName = familyName.trim();
  // When there are spaces in the font-name, Chromium adds single quotes
  // around the font name in the style object; eg, "Noto Sans Japanese"
  // becomes "'Noto Sans Japanese'".
  // https://code.google.com/p/chromium/issues/detail?id=368293
  if (trimmedName.charAt(0) == "'" &&
      trimmedName.charAt(trimmedName.length - 1) == "'") {
    trimmedName = trimmedName.substring(1, trimmedName.length - 1);
  }
  return trimmedName;
};


/**
 * Get the TachyFont style sheet.
 *
 * @return {CSSStyleSheet} The style sheet.
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


/**
 * Delete a CSS style rule.
 *
 * @param {number} ruleToDelete The rule to delete.
 * @param {CSSStyleSheet} sheet The style sheet.
 */
tachyfont.IncrementalFontUtils.deleteCssRule = function(ruleToDelete, sheet) {
  if (ruleToDelete != -1) {
    if (sheet.deleteRule) {
      sheet.deleteRule(ruleToDelete);
    } else if (sheet.removeRule) {
      sheet.removeRule(ruleToDelete);
    } else {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger, 'no delete/drop rule');
      }
    }
  }
};


/**
 * Find the \@font-face rule for the given font spec.
 *
 * TODO(bstell): Add slant, width, etc.
 * @param {CSSStyleSheet} sheet The style sheet.
 * @param {string} fontFamily The fontFamily.
 * @param {string} weight The weight.
 * @return {number} The rule index; -1 if not found.
 */
tachyfont.IncrementalFontUtils.findFontFaceRule =
    function(sheet, fontFamily, weight) {
  var rule = -1;
  var rules = sheet.cssRules || sheet.rules;
  if (rules) {
    for (var i = 0; i < rules.length; i++) {
      var this_rule = rules[i];
      if (this_rule.type == CSSRule.FONT_FACE_RULE) {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'found an @font-face rule');
        }
        var this_style = this_rule.style;
        var thisFamily = this_style.getPropertyValue('font-family');
        thisFamily = tachyfont.IncrementalFontUtils.trimFamilyName(thisFamily);
        var thisWeight = this_style.getPropertyValue('font-weight');
        // TODO(bstell): consider using slant/width.
        if (thisFamily == fontFamily && thisWeight == weight) {
          rule = i;
          break;
        }
      }
    }
  }
  return rule;
};


/**
 * Set the CSS \@font-face rule.
 *
 * @param {CSSStyleSheet} sheet The style sheet.
 * @param {string} fontFamily The fontFamily.
 * @param {string} weight The weight.
 * @param {string} blobUrl The blob URL of the font data.
 * @param {string} format The format (truetype vs opentype) of the font.
 */
tachyfont.IncrementalFontUtils.setCssFontRule =
    function(sheet, fontFamily, weight, blobUrl, format) {
  var rule_str = '@font-face {\n' +
      '    font-family: ' + fontFamily + ';\n' +
      '    font-weight: ' + weight + ';\n' +
      '    src: url("' + blobUrl + '")' +
      ' format("' + format + '");\n' +
      '}\n';
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER, 'rule = ' + rule_str);
  }
  var ruleToDelete = tachyfont.IncrementalFontUtils.findFontFaceRule(
      sheet, fontFamily, weight);
  tachyfont.IncrementalFontUtils.deleteCssRule(ruleToDelete, sheet);
  sheet.insertRule(rule_str, sheet.cssRules.length);
};
