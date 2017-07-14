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

goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Define');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.utils');


/**
 * Enum for error values.
 * @enum {string}
 */
// LINT.IfChange
tachyfont.Cmap.Error = {
  FILE_ID: 'ECM',
  // The code reporting errors 01-09 commented out.
  //WRITE_CMAP4_SEGMENT_COUNT: '01',
  //FORMAT4_SEGMENT_COUNT: '02',
  //FORMAT4_END_CODE: '03',
  //FORMAT4_SEGMENT_LENGTH: '04',
  //FORMAT4_START_CODE: '05',
  //FORMAT4_ID_RANGE_OFFSET: '07',
  //FORMAT4_CHAR_CMAP_INFO: '08',
  //FORMAT4_SEGMENT: '09',
  FORMAT12_CHAR_CMAP_INFO: '10',
  FORMAT12_START_CODE: '11',
  FORMAT12_END_CODE: '12',
  FORMAT12_SEGMENT_LENGTH: '13',
  FORMAT12_GLYPH_ID_MISMATCH: '15',
  FORMAT12_CMAP_ERROR: '16',
  FORMAT12_GLYPH_LENGTH_ERROR: '17',
  FORMAT12_GLYPH_DATA_ERROR: '18',
  FORMAT12_START_CODE2: '19',
  FORMAT12_END_CODE2: '20',
  FORMAT12_GLYPH_ID_NOT_SET: '21',
  FORMAT12_CHAR_INFO: '22',
  WRITE_CMAP4_UNSUPPORTED: '23',
  SET_FORMAT4_GLYPHIDS_UNSUPPORTED: '24',
  END: '00'
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/boq/gen204/error-reports.properties)


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.Cmap.reportError = function(errNum, errId, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.Cmap.Error.FILE_ID + errNum, errId, errInfo);
};


/**
 * Writes the format 12 cmap into the font.
 *
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font file.
 * @param {!DataView} baseFontView Base font with header.
 */
tachyfont.Cmap.writeCmap12 = function(fileInfo, baseFontView) {
  if (!fileInfo.compact_gos.cmap12) {
    return;
  }
  var binaryEditor = new tachyfont.BinaryFontEditor(baseFontView,
      fileInfo.cmap12.offset + 16);
  var nGroups = fileInfo.cmap12.nGroups;
  var segments = fileInfo.compact_gos.cmap12.segments;
  for (var i = 0; i < nGroups; i++) {
    binaryEditor.setUint32(segments[i][0]);
    binaryEditor.setUint32(segments[i][0] + segments[i][1] - 1);
    binaryEditor.setUint32(0);
  }
};


/**
 * Writes the format 4 cmap into the font.
 *
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font file.
 * @param {!DataView} baseFontView Base font with header.
 * @param {string} fontId The fontId for error reporting.
 */
tachyfont.Cmap.writeCmap4 = function(fileInfo, baseFontView, fontId) {
  if (!fileInfo.compact_gos.cmap4) {
    return;
  }
  tachyfont.Cmap.reportError(
      tachyfont.Cmap.Error.WRITE_CMAP4_UNSUPPORTED, fontId, '');
  throw new Error('write cmap4 unsupported');
  //var segments = fileInfo.compact_gos.cmap4.segments;
  //var glyphIdArray = fileInfo.compact_gos.cmap4.glyphIdArray;
  //var binaryEditor = new tachyfont.BinaryFontEditor(baseFontView,
  //    fileInfo.cmap4.offset + 6);
  //var segCount = binaryEditor.getUint16() / 2;
  //if (segCount != segments.length) {
  //  tachyfont.Cmap.reportError(
  //      tachyfont.Cmap.Error.WRITE_CMAP4_SEGMENT_COUNT, fontId,
  //      'segCount=' + segCount + ', segments.length=' + segments.length);
  //}
  //var glyphIdArrayLen = (fileInfo.cmap4.length - 16 - segCount * 8) / 2;
  //fileInfo.cmap4.segCount = segCount;
  //fileInfo.cmap4.glyphIdArrayLen = glyphIdArrayLen;
  //binaryEditor.skip(6);  //skip searchRange, entrySelector, rangeShift
  //// Write endCode values.
  //for (var i = 0; i < segCount; i++) {
  //  binaryEditor.setUint16(segments[i][1]);
  //}
  //binaryEditor.skip(2);//skip reservePad
  //// Write startCode values.
  //for (var i = 0; i < segCount; i++) {
  //  binaryEditor.setUint16(segments[i][0]);
  //}
  //// Write idDelta values.
  //for (var i = 0; i < segCount; i++) {
  //  // Make the single code point in this segment point to .notdef.
  //  var startCode = segments[i][0];
  //  binaryEditor.setUint16(0x10000 - startCode);
  //}
  //// Write idRangeOffset vValues.
  //for (var i = 0; i < segCount; i++) {
  //  binaryEditor.setUint16(segments[i][3]);
  //}
  //// Write glyphIdArray values.
  //if (glyphIdArrayLen > 0) {
  //  binaryEditor.setArrayOf(binaryEditor.setUint16, glyphIdArray);
  //}
};


/**
 * Check the characters that are loaded in the font.
 *
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font file.
 * @param {!DataView} baseFontView Current base font
 * @param {!Object<string, number>} charList The list of characters.
 * @param {string} fontId The fontId for error reporting.
 * @param {boolean} charsLoaded If set check that the chars are loaded.
 * @return {boolean} Whether the chars seem okay.
 */
tachyfont.Cmap.checkCharacters = function(
    fileInfo, baseFontView, charList, fontId, charsLoaded) {

  var charsOkay = true;
  var baseBinaryEditor = new tachyfont.BinaryFontEditor(baseFontView, 0);
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
    var code = tachyfont.utils.charToCode(aChar);
    var codeIsBlank = tachyfont.Define.BLANK_CHARS[code] ? true : false;
    var charInfo = fileInfo.cmapMapping[code];
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
      var glyphOffset = baseBinaryEditor.getGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, glyphId);
      var nextGlyphOffset = baseBinaryEditor.getGlyphDataOffset(
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
        baseBinaryEditor.seek(fileInfo.glyphOffset + glyphOffset);
        var glyphByte = baseBinaryEditor.getUint8();
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
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_CHAR_INFO, fontId,
        charInfoErrors.toString());
  }
  if (startCodeErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_START_CODE2, fontId,
        startCodeErrors.toString());
  }
  if (endCodeErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_END_CODE2, fontId,
        endCodeErrors.toString());
  }
  if (glyphIdErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_GLYPH_ID_NOT_SET, fontId,
        glyphIdErrors.toString());
  }
  if (cmapErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_CMAP_ERROR, fontId,
        cmapErrors.toString());
  }
  if (glyphLengthErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_GLYPH_LENGTH_ERROR, fontId,
        glyphLengthErrors.toString());
  }
  if (glyphDataErrors.length != 0) {
    tachyfont.Cmap.reportError(
        tachyfont.Cmap.Error.FORMAT12_GLYPH_DATA_ERROR, fontId,
        glyphDataErrors.toString());
  }
  return charsOkay;
};


/**
 * Set the format 4 glyph Ids.
 *
 * Note: this is not well tested.
 *
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font file.
 * @param {!DataView} baseFontView Current base font
 * @param {!Array<number>} glyphIds The glyph Ids to set.
 * @param {!Object<number, !Array<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {string} fontId The fontId for error reporting.
 */
tachyfont.Cmap.setFormat4GlyphIds = function(
    fileInfo, baseFontView, glyphIds, glyphToCodeMap, fontId) {
  if (!fileInfo.compact_gos.cmap4) {
    return;
  }
  tachyfont.Cmap.reportError(
      tachyfont.Cmap.Error.SET_FORMAT4_GLYPHIDS_UNSUPPORTED, fontId, '');
  throw new Error('set format4 glyphids unsupported');
  //var segments = fileInfo.compact_gos.cmap4.segments;
  //var binaryEditor = new tachyfont.BinaryFontEditor(baseFontView,
  //    fileInfo.cmap4.offset + 6);
  //var segCount = binaryEditor.getUint16() / 2;
  //if (segCount != segments.length) {
  //  tachyfont.Cmap.reportError(
  //      tachyfont.Cmap.Error.FORMAT4_SEGMENT_COUNT, fontId,
  //      'segCount=' + segCount + ', segments.length=' + segments.length);
  //  return;
  //}
  //binaryEditor.seek(8);
  //for (var i = 0; i < segCount; i++) {
  //  // Check the end code.
  //  var segmentEndCode = binaryEditor.getUint16();
  //  if (segmentEndCode != segments[i][1]) {
  //    tachyfont.Cmap.reportError(
  //        tachyfont.Cmap.Error.FORMAT4_END_CODE, fontId, 'segment ' + i +
  //            ': segmentEndCode (' + segmentEndCode + ') != segments[' + i +
  //            '][1] (' + segments[i][1] + ')');
  //    return;
  //  }
  //  // Check the segment is one char long
  //  if (segmentEndCode != segments[i][0]) {
  //    tachyfont.Cmap.reportError(
  //        tachyfont.Cmap.Error.FORMAT4_SEGMENT_LENGTH, fontId, 'segment ' +
  //            i + ' is ' + (segments[i][1] - segments[i][0] + 1) +
  //            ' chars long');
  //    return;
  //  }
  //}
  //binaryEditor.skip(2);//skip reservePad
  //for (var i = 0; i < segCount; i++) {
  //  var segStartCode = binaryEditor.getUint16();
  //  if (segStartCode != segments[i][0]) {
  //    tachyfont.Cmap.reportError(
  //        tachyfont.Cmap.Error.FORMAT4_START_CODE, fontId, 'segment ' + i +
  //            ': segStartCode (' + segStartCode + ') != segments[' + i +
  //            '][1] (' + segments[i][0] + ')');
  //    return;
  //  }
  //}
  //var idDeltaOffset = binaryEditor.tell();
  //// No longer reporting "already set" glyphs. This was never really an error
  //// as multiple composed characters could load the same sub-glyphs; eg, the
  //// acute used by a-acute, i-acute, o-acute, etc. Clients that had automatic
  //// site data clearing made this report very noisy.
  //for (var i = 0; i < segCount; i++) {
  //  var segIdRangeOffset = binaryEditor.getUint16();
  //  if (segIdRangeOffset != 0) {
  //    tachyfont.Cmap.reportError(
  //        tachyfont.Cmap.Error.FORMAT4_ID_RANGE_OFFSET, fontId,
  //        'format 4 segment ' + i + ': segIdRangeOffset (' +
  //        segIdRangeOffset + ') != 0');
  //    return;
  //  }
  //}
  //for (var i = 0; i < glyphIds.length; i++) {
  //  // Set the glyph Id
  //  var glyphId = glyphIds[i];
  //  var codes = glyphToCodeMap[glyphId];
  //  if (codes == undefined) {
  //    continue;
  //  }
  //  for (var j = 0; j < codes.length; j++) {
  //    var code = codes[j];
  //    var charCmapInfo = fileInfo.cmapMapping[code];
  //    if (!charCmapInfo) {
  //      tachyfont.Cmap.reportError(
  //          tachyfont.Cmap.Error.FORMAT4_CHAR_CMAP_INFO, fontId,
  //          'format 4, code ' + code + ': no CharCmapInfo');
  //      continue;
  //    }
  //    var format4Seg = charCmapInfo.format4Seg;
  //    if (format4Seg == null) {
  //      if (code <= 0xFFFF) {
  //        tachyfont.Cmap.reportError(
  //            tachyfont.Cmap.Error.FORMAT4_SEGMENT, fontId,
  //            'format 4, missing segment for code ' + code);
  //      }
  //      // Character is not in the format 4 segment.
  //      continue;
  //    }
  //    binaryEditor.seek(idDeltaOffset + format4Seg * 2);
  //    binaryEditor.setUint16(segments[format4Seg][2]);
  //  }
  //}
};


/**
 * Set the format 12 glyph Ids.
 *
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font file.
 * @param {!DataView} baseFontView Current base font
 * @param {!Array<number>} glyphIds The glyph Ids to set.
 * @param {!Object<number, !Array<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @param {string} fontId The fontId of the font.
 */
tachyfont.Cmap.setFormat12GlyphIds = function(
    fileInfo, baseFontView, glyphIds, glyphToCodeMap, fontId) {
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
      var charCmapInfo = fileInfo.cmapMapping[code];
      if (!charCmapInfo) {
        tachyfont.Cmap.reportError(
            tachyfont.Cmap.Error.FORMAT12_CHAR_CMAP_INFO, fontId,
            'format 12, code ' + code + ': no CharCmapInfo');
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
        tachyfont.Cmap.reportError(
            tachyfont.Cmap.Error.FORMAT12_START_CODE, fontId,
            'format 12, code ' + code + ', seg ' + format12Seg +
                ': startCode mismatch');
      }
      if (inMemoryEndCode != segmentEndCode) {
        tachyfont.Cmap.reportError(
            tachyfont.Cmap.Error.FORMAT12_END_CODE, fontId, 'format 12 code ' +
                code + ', seg ' + format12Seg + ': endCode mismatch');
      }
      if (segStartCode != segmentEndCode) {  // TODO(bstell): check length
        tachyfont.Cmap.reportError(
            tachyfont.Cmap.Error.FORMAT12_SEGMENT_LENGTH, fontId,
            'format 12 code ' + code + ', seg ' + format12Seg +
                ': length != 1');
      }
      // No longer reporting "already set" glyphs. This was never really an
      // error as multiple composed characters could load the same sub-glyphs;
      // eg, the acute used by a-acute, i-acute, o-acute, etc. Clients that have
      // automatic site data clearing made that report very noisy.
      if (inMemoryGlyphId != 0) {
        if (inMemoryGlyphId != segStartGlyphId) {
          tachyfont.Cmap.reportError(
              tachyfont.Cmap.Error.FORMAT12_GLYPH_ID_MISMATCH, fontId,
              'format 12 code ' + code + ', seg ' + format12Seg +
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
