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

goog.provide('tachyfont.Cmap');

goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Logger');
goog.require('tachyfont.Reporter');


/**
 * Enum for error values.
 * @enum {string}
 * @private
 */
tachyfont.Cmap.Error_ = {
  FILE_ID: 'ECM',
  WRITE_CMAP4_SEGMENT_COUNT: '01',
  FORMAT4_SEGMENT_COUNT: '02',
  FORMAT4_END_CODE: '03',
  FORMAT4_SEGMENT_LENGTH: '04',
  FORMAT4_START_CODE: '05',
  FORMAT4_GLYPH_ID_ALREADY_SET: '06',
  FORMAT4_ID_RANGE_OFFSET: '07',
  FORMAT4_CHAR_CMAP_INFO: '08',
  FORMAT4_SEGMENT: '09',
  FORMAT12_CHAR_CMAP_INFO: '10',
  FORMAT12_START_CODE: '11',
  FORMAT12_END_CODE: '12',
  FORMAT12_SEGMENT_LENGTH: '13',
  FORMAT12_GLYPH_ID_ALREADY_SET: '14',
  FORMAT12_GLYPH_ID_MISMATCH: '15',
  FORMAT12_CMAP_ERROR: '16',
  FORMAT12_GLYPH_LENGTH_ERROR: '17',
  FORMAT12_GLYPH_DATA_ERROR: '18',
  FORMAT12_START_CODE2: '19',
  FORMAT12_END_CODE2: '20',
  FORMAT12_GLYPH_ID_NOT_SET: '21',
  FORMAT12_CHAR_INFO: '22',
  END: '00'
};


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.Cmap.reportError_ = function(errNum, errId, errInfo) {
  if (goog.DEBUG) {
    if (!tachyfont.Reporter.isReady()) {
      goog.log.error(tachyfont.Logger.logger, 'failed to report error');
    }
  }
  if (tachyfont.Reporter.isReady()) {
    tachyfont.Reporter.reportError(
        tachyfont.Cmap.Error_.FILE_ID + errNum, errId, errInfo);
  }
};


/**
 * Writes the format 12 cmap into the font.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @param {!DataView} baseFontView Base font with header.
 */
tachyfont.Cmap.writeCmap12 = function(fileInfo, baseFontView) {
  if (!fileInfo.compact_gos.cmap12) {
    return;
  }
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap12.offset + 16);
  var nGroups = fileInfo.cmap12.nGroups;
  var segments = fileInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < nGroups; i++) {
    binEd.setUint32(segments[i][0]);
    binEd.setUint32(segments[i][0] + segments[i][1] - 1);
    binEd.setUint32(0);
  }
};


/**
 * Writes the format 4 cmap into the font.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @param {!DataView} baseFontView Base font with header.
 * @param {string} weight The font weight for error reporting.
 */
tachyfont.Cmap.writeCmap4 = function(fileInfo, baseFontView, weight) {
  if (!fileInfo.compact_gos.cmap4) {
    return;
  }
  var segments = fileInfo.compact_gos.cmap4.segments;
  var glyphIdArray = fileInfo.compact_gos.cmap4.glyphIdArray;
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.WRITE_CMAP4_SEGMENT_COUNT,
        weight, 'segCount=' + segCount +
        ', segments.length=' + segments.length);
  }
  var glyphIdArrayLen = (fileInfo.cmap4.length - 16 - segCount * 8) / 2;
  fileInfo.cmap4.segCount = segCount;
  fileInfo.cmap4.glyphIdArrayLen = glyphIdArrayLen;
  binEd.skip(6); //skip searchRange,entrySelector,rangeShift
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
    // Make the single code point in this segment point to .notdef.
    var startCode = segments[i][0];
    binEd.setUint16(0x10000 - startCode);
  }
  // Write idRangeOffset vValues.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][3]);
  }
  // Write glyphIdArray values.
  if (glyphIdArrayLen > 0) {
    binEd.setArrayOf(binEd.setUint16, glyphIdArray);
  }
};


/**
 * Check the characters that are loaded in the font.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @param {!DataView} baseFontView Current base font
 * @param {!Object<string, number>} charList The list of characters.
 * @param {!Object.<number, !tachyfont.CharCmapInfo>} cmapMapping Information
 *     about the cmap segments for the codepoint.
 * @param {string} weight The font weight for error reporting.
 * @param {boolean} charsLoaded If set check that the chars are loaded.
 * @return {boolean} True if chars seem okay.
 */
tachyfont.Cmap.checkCharacters = function(fileInfo, baseFontView, 
    charList, cmapMapping, weight, charsLoaded) {

  var charsOkay = true;
  var baseBinEd = new tachyfont.BinaryFontEditor(baseFontView, 0);
  var segEd = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap12.offset + 16);
  var chars = Object.keys(charList);
  chars.sort();
  var count = chars.length;
  var isCFF = !fileInfo.isTtf;
  var charInfoErrors = [];
  var startCodeErrors = [];
  var endCodeErrors = [];
  var glyphIdErrors = [];
  var cmapErrors = [];
  var glyphLengthErrors = [];
  var glyphDataErrors = [];
  var segments = fileInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < count; i += 1) {
    var aChar = chars[i];
    var code = tachyfont.charToCode(aChar);
    var codeIsBlank = tachyfont.BLANK_CHARS[code] ? true : false;
    var charInfo = cmapMapping[code];
    if (!charInfo) {
      if (charInfoErrors.length < 5) {
        charInfoErrors.push(code);
      }
      charsOkay = false;
      continue;
    }

    // Check the Format 12 cmap.
    var glyphId = charInfo.glyphId;
    var format12Segment = charInfo.format12Seg;
    var segment = segments[format12Segment];
    var segmentStartCode = segment[0];
    var segmentLength = segment[1];
    var segmentGlyphId = segment[2];
    if (code != segmentStartCode || segmentLength != 1 ||
        glyphId != segmentGlyphId) {
      if (cmapErrors.length < 5) {
        cmapErrors.push(code);
      }
      continue;
    }

    // Get the format 12 cmap info for this char.
    var segmentEndCode = segmentStartCode + segmentLength - 1;
    var segOffset = format12Segment * 12;
    segEd.seek(segOffset);
    var inMemoryStartCode = segEd.getUint32();
    var inMemoryEndCode = segEd.getUint32();
    var inMemoryGlyphId = segEd.getUint32();

    // Check the start code.
    if (inMemoryStartCode != segmentStartCode) {
      if (startCodeErrors.length < 5) {
        startCodeErrors.push(code);
      }
      charsOkay = false;
    }
    // Check the end code.
    if (inMemoryEndCode != segmentEndCode) {
      if (endCodeErrors.length < 5) {
        endCodeErrors.push(code);
      }
      charsOkay = false;
    }
    if (charsLoaded) {
      // Check the glyph Id.
      if (inMemoryGlyphId != segmentGlyphId) {
        if (glyphIdErrors.length < 5) {
          glyphIdErrors.push(code);
        }
        charsOkay = false;
      }
    }

    // Check the loca/charstring-index.
    if (!isCFF) {
      // TODO(bstell): Develop this code for TTF fonts.
      // See the (!isCFF) section in injectCharacters() for code that adds a
      // char to the font.
    } else {
      var glyphOffset = baseBinEd.getGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, glyphId);
      var nextGlyphOffset = baseBinEd.getGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize,
          glyphId + 1);
      var glyphLength = nextGlyphOffset - glyphOffset;

      if (charsLoaded) {
        // Check the glyph length.
        if (glyphLength < 0 || (!codeIsBlank && glyphLength == 1)) {
          // Blank chars sometimes are longer than necessary.
          if (code <= 32 || (code >= 0x80 && code <= 0xA0)) {
            continue;
          }
          charsOkay = false;
          if (glyphLengthErrors.length < 5) {
            glyphLengthErrors.push(code);
          }
          continue;
        }
        baseBinEd.seek(fileInfo.glyphOffset + glyphOffset);
        var glyphByte = baseBinEd.getUint8();
        if (!codeIsBlank && glyphByte == 14) {
          charsOkay = false;
          if (glyphDataErrors.length < 5) {
            glyphDataErrors.push(code);
          }
          continue;
        }
      }
    }
  }
  //  Report errors.
  if (charInfoErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_CHAR_INFO, weight,
        charInfoErrors.toString());
  }
  if (startCodeErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_START_CODE2, weight,
        startCodeErrors.toString());
  }
  if (endCodeErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_END_CODE2, weight,
        endCodeErrors.toString());
  }
  if (glyphIdErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_GLYPH_ID_NOT_SET, weight,
        glyphIdErrors.toString());
  }
  if (cmapErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_CMAP_ERROR, weight,
        cmapErrors.toString());
  }
  if (glyphLengthErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_GLYPH_LENGTH_ERROR, weight,
        glyphLengthErrors.toString());
  }
  if (glyphDataErrors.length != 0) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT12_GLYPH_DATA_ERROR, weight,
        glyphDataErrors.toString());
  }
  return charsOkay;
};


/**
 * Set the format 4 glyph Ids.
 *
 * Note: this is not well tested.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @param {DataView} baseFontView Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {!Object.<number, !tachyfont.CharCmapInfo>} cmapMapping Information
 *     about the cmap segments for the codepoint.
 * @param {string} weight The font weight for error reporting.
 */
tachyfont.Cmap.setFormat4GlyphIds = function(fileInfo, baseFontView, glyphIds,
    glyphToCodeMap, cmapMapping, weight) {
  if (!fileInfo.compact_gos.cmap4) {
    return;
  }
  var segments = fileInfo.compact_gos.cmap4.segments;
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    tachyfont.Cmap.reportError_(
        tachyfont.Cmap.Error_.FORMAT4_SEGMENT_COUNT,
        weight, 'segCount=' + segCount + ', segments.length=' +
        segments.length);
    return;
  }
  binEd.seek(8);
  for (var i = 0; i < segCount; i++) {
    // Check the end code.
    var segmentEndCode = binEd.getUint16();
    if (segmentEndCode != segments[i][1]) {
      tachyfont.Cmap.reportError_(
          tachyfont.Cmap.Error_.FORMAT4_END_CODE,
          weight, 'segment ' + i + ': segmentEndCode (' + segmentEndCode +
          ') != segments[' + i + '][1] (' + segments[i][1] + ')');
      return;
    }
    // Check the segment is one char long
    if (segmentEndCode != segments[i][0]) {
      tachyfont.Cmap.reportError_(
          tachyfont.Cmap.Error_.FORMAT4_SEGMENT_LENGTH,
          weight, 'segment ' + i +
          ' is ' + (segments[i][1] - segments[i][0] + 1) + ' chars long');
      return;
    }
  }
  binEd.skip(2);//skip reservePad
  for (var i = 0; i < segCount; i++) {
    var segStartCode = binEd.getUint16();
    if (segStartCode != segments[i][0]) {
      tachyfont.Cmap.reportError_(
          tachyfont.Cmap.Error_.FORMAT4_START_CODE,
          weight, 'segment ' + i +
          ': segStartCode (' + segStartCode + ') != segments[' + i + '][1] (' +
          segments[i][0] + ')');
      return;
    }
  }
  var idDeltaOffset = binEd.tell();
  for (var i = 0; i < segCount; i++) {
    var segIdDelta = binEd.getUint16();
    var segGlyphId = (segIdDelta + segments[i][0]) & 0xFFFF;
    if (segGlyphId != 0) {
      tachyfont.Cmap.reportError_(
          tachyfont.Cmap.Error_.FORMAT4_GLYPH_ID_ALREADY_SET,
          weight, 'format 4 segment ' + i + ': segIdDelta (' + segIdDelta +
          ') != segments[' + i + '][1] (' + segments[i][2] + ')');
      if (goog.DEBUG) {
        if (segIdDelta == segments[i][2]) {
          goog.log.info(tachyfont.Logger.logger, 'format 4 segment ' + i +
              ': segIdDelta already set');
        }
        return;
      }
    }
  }
  for (var i = 0; i < segCount; i++) {
    var segIdRangeOffset = binEd.getUint16();
    if (segIdRangeOffset != 0) {
      tachyfont.Cmap.reportError_(
          tachyfont.Cmap.Error_.FORMAT4_ID_RANGE_OFFSET,
          weight, 'format 4 segment ' + i + ': segIdRangeOffset (' +
          segIdRangeOffset + ') != 0');
      return;
    }
  }
  for (var i = 0; i < glyphIds.length; i++) {
    // Set the glyph Id
    var glyphId = glyphIds[i];
    var codes = glyphToCodeMap[glyphId];
    if (codes == undefined) {
      continue;
    }
    for (var j = 0; j < codes.length; j++) {
      var code = codes[j];
      if (goog.DEBUG) {
        goog.log.info(tachyfont.Logger.logger, 'format 4: code = ' + code);
      }
      var charCmapInfo = cmapMapping[code];
      if (!charCmapInfo) {
        tachyfont.Cmap.reportError_(
            tachyfont.Cmap.Error_.FORMAT4_CHAR_CMAP_INFO,
            weight, 'format 4, code ' + code + ': no CharCmapInfo');
        continue;
      }
      var format4Seg = charCmapInfo.format4Seg;
      if (format4Seg == null) {
        if (code <= 0xFFFF) {
          tachyfont.Cmap.reportError_(
              tachyfont.Cmap.Error_.FORMAT4_SEGMENT,
              weight, 'format 4, missing segment for code ' + code);
        }
        // Character is not in the format 4 segment.
        continue;
      }
      binEd.seek(idDeltaOffset + format4Seg * 2);
      binEd.setUint16(segments[format4Seg][2]);
    }
  }
};


/**
 * Set the format 12 glyph Ids.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @param {DataView} baseFontView Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {!Object.<number, !tachyfont.CharCmapInfo>} cmapMapping Information
 *     about the cmap segments for the codepoint.
 * @param {string} weight The weight of the font.
 */
tachyfont.Cmap.setFormat12GlyphIds = function(fileInfo, baseFontView, glyphIds,
    glyphToCodeMap, cmapMapping, weight) {
  if (!fileInfo.cmap12) {
    return;
  }
  var segEd = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap12.offset + 16);
  var segments = fileInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < glyphIds.length; i += 1) {
    var id = glyphIds[i];
    var codes = glyphToCodeMap[id];
    if (codes == undefined) {
      continue;
    }
    for (var j = 0; j < codes.length; j++) {
      var code = codes[j];
      if (goog.DEBUG) {
        goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
            'format 12: code = ' + code);
      }
      var charCmapInfo = cmapMapping[code];
      if (!charCmapInfo) {
        tachyfont.Cmap.reportError_(
            tachyfont.Cmap.Error_.FORMAT12_CHAR_CMAP_INFO,
            weight, 'format 12, code ' + code + ': no CharCmapInfo');
        continue;
      }

      // Set the glyphId for format 12
      var format12Seg = charCmapInfo.format12Seg;
      var segment = segments[format12Seg];
      var segStartCode = segment[0];
      var segmentEndCode = segStartCode + segment[1] - 1;
      var segStartGlyphId = segment[2];
      var segOffset = format12Seg * 12;
      segEd.seek(segOffset);
      var inMemoryStartCode = segEd.getUint32();
      var inMemoryEndCode = segEd.getUint32();
      var inMemoryGlyphId = segEd.getUint32();
      // Check the code point.
      if (inMemoryStartCode != segStartCode) {
        tachyfont.Cmap.reportError_(
            tachyfont.Cmap.Error_.FORMAT12_START_CODE,
            weight, 'format 12, code ' + code + ', seg ' + format12Seg +
            ': startCode mismatch');
      }
      if (inMemoryEndCode != segmentEndCode) {
        tachyfont.Cmap.reportError_(
            tachyfont.Cmap.Error_.FORMAT12_END_CODE,
            weight, 'format 12 code ' + code + ', seg ' + format12Seg +
            ': endCode mismatch');
      }
      if (segStartCode != segmentEndCode) { // TODO(bstell): check length
        tachyfont.Cmap.reportError_(
            tachyfont.Cmap.Error_.FORMAT12_SEGMENT_LENGTH,
            weight, 'format 12 code ' + code + ', seg ' + format12Seg +
            ': length != 1');
      }
      if (inMemoryGlyphId != 0) {
        if (inMemoryGlyphId == segStartGlyphId) {
          tachyfont.Cmap.reportError_(
              tachyfont.Cmap.Error_.FORMAT12_GLYPH_ID_ALREADY_SET,
              weight, 'format 12 code ' + code + ', seg ' + format12Seg +
              ' glyphId already set');
        } else {
          tachyfont.Cmap.reportError_(
              tachyfont.Cmap.Error_.FORMAT12_GLYPH_ID_MISMATCH,
              weight, 'format 12 code ' + code + ', seg ' + format12Seg +
              ' glyphId mismatch');
        }
      }
      // Seek to the glyphId.
      segEd.seek(segOffset + 8);
      // Set the glyphId.
      segEd.setUint32(segStartGlyphId);
    }
  }
};


/**
 * Determine if the font was preprocessed to have only one character per
 * segment. Fonts with this arrangement easily support keeping the cmap
 * accurate as character data is added.
 *
 * @param {!Object} fileInfo Information about the font file.
 * @return {boolean} true if only one char per segment.
 */
tachyfont.Cmap.isOneCharPerSeg = function(fileInfo) {
  if (fileInfo.compact_gos.cmap4) {
    var segments = fileInfo.compact_gos.cmap4.segments;
    for (var i = 0; i < segments.length; i++) {
      var segStartCode = segments[i][0];
      var segmentEndCode = segments[i][1];
      var idRangeOffset = segments[i][3];
      if (segStartCode != segmentEndCode || idRangeOffset != 0) {
        return false;
      }
    }
  }

  if (fileInfo.compact_gos.cmap12) {
    var segments = fileInfo.compact_gos.cmap12.segments;
    for (var i = 0; i < segments.length; i++) {
      var length = segments[i][1];
      if (length != 1) {
        return false;
      }
    }
  }

  return true;
};
