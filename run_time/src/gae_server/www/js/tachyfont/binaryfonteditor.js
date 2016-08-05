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

goog.provide('tachyfont.BinaryFontEditor');


goog.require('goog.asserts');
goog.require('tachyfont.BinaryEditor');
goog.require('tachyfont.CharCmapInfo');
/** @suppress {extraRequire} */
goog.require('tachyfont.typedef.FileInfo');
/** @suppress {extraRequire} */
goog.require('tachyfont.typedef.uint8');



/**
 * Binary Font Editor.
 * This class also provides routines to read/write font and TachyFont specific
 * data structures (in addition to the functions in tachyfont.BinaryEditor).
 * @param {!DataView} dataView DataView which includes data
 * @param {number} baseOffset Set this offset as 0 offset for operations
 * @constructor @struct @final @extends {tachyfont.BinaryEditor}
 */
tachyfont.BinaryFontEditor = function(dataView, baseOffset) {
  tachyfont.BinaryFontEditor.base(this, 'constructor', dataView, baseOffset);
};
goog.inherits(tachyfont.BinaryFontEditor, tachyfont.BinaryEditor);


/**
 * @param {number} offSize Number of bytes in offset
 * @return {number} Offset
 */
tachyfont.BinaryFontEditor.prototype.getElementOffset = function(offSize) {
  var offset;
  switch (offSize) {
    case 1:
      offset = this.getUint8();
      break;
    case 2:
      offset = this.getUint16();
      break;
    case 3:
      offset = this.getUint16() << 8;
      offset |= this.getUint8();
      break;
    case 4:
      offset = this.getUint32();
      break;
    default:
      throw 'invalid offset size: ' + offSize;
  }
  return offset;
};


/**
 * @param {number} offSize Number of bytes in offset
 * @param {number} value Offset value
 */
tachyfont.BinaryFontEditor.prototype.setOffset = function(offSize, value) {
  switch (offSize) {
    case 1:
      this.setUint8(value);
      break;
    case 2:
      this.setUint16(value);
      break;
    case 3:
      this.setUint16(value >>> 8);
      this.setUint8(value & 0xFF);
      break;
    case 4:
      this.setUint32(value);
      break;
  }
};


/**
 * Creates nibble stream reader starting from current position
 * @return {function()} NibbleOfNumber decoder function
 */
tachyfont.BinaryFontEditor.prototype.nibbleReader = function() {
  var that = this;
  var value;
  var nibbleByte;
  var aligned = true;
  return function() {
    if (aligned) {
      nibbleByte = that.getUint8();
      value = (nibbleByte & 0xF0) >>> 4;
    } else {
      value = (nibbleByte & 0x0F);
    }
    aligned = !aligned;
    return value;
  };
};


/**
 * Starting from current positions read whole extra array table
 * @param {number} extraLen
 * @return {!Array<number>} array of extra numbers
 */
tachyfont.BinaryFontEditor.prototype.readExtraArray = function(extraLen) {
  var readNextNibble = this.nibbleReader();
  var extraArray = [];
  var extraData;
  var sign;
  var numNibbles;
  for (var i = 0; i < extraLen; i++) {
    extraData = 0;
    numNibbles = readNextNibble();
    if (numNibbles < 8) {
      sign = 1;
      numNibbles++;
    } else {
      sign = -1;
      numNibbles -= 7;
    }
    for (var j = 0; j < numNibbles; j++) {
      extraData <<= 4;
      extraData |= readNextNibble();
    }
    extraData *= sign;
    extraArray.push(extraData);
  }
  return extraArray;
};


/**
 * Read following group of segments
 * @return {!Object} Group of Segments returned
 */
tachyfont.BinaryFontEditor.prototype.readNextGOS = function() {
  var gos = {};
  var type = this.getUint8();
  var nGroups = this.getUint16();
  var segments = [];

  if (type == 5) {
    var startCode;
    var length;
    var gid;
    for (var i = 0; i < nGroups; i++) {
      startCode = this.getUint32();
      length = this.getUint32();
      gid = this.getUint32();
      segments.push([startCode, length, gid]);
    }
  } else if (type == 4) {
    var extraOffset = [];
    var i = 0;
    var nextByte;
    var value;
    while (i < nGroups) {
      nextByte = this.getUint8();
      for (var j = 0; j < 4; j++) {
        if (i < nGroups) {
          value = nextByte & (0xC0 >>> (2 * j));
          value >>>= (6 - 2 * j);
          segments.push(value);
          if (value == 3) {
            extraOffset.push(i);
          }
          i++;
        } else {
          break;
        }
      }
    }
    var extraLen = extraOffset.length;
    var extraArray = this.readExtraArray(extraLen);
    for (i = 0; i < extraLen; i++) {
      segments[extraOffset[i]] = extraArray[i];
    }
  } else if (type == 3) {
    var extraOffset = [];
    var startCode;
    var length;
    var gid;
    var segment;
    for (var i = 0; i < nGroups; i++) {
      segment = this.getElementOffset(3);  //lower 24 bits
      startCode = (segment & 0xF80000) >> 19;
      length = (segment & 0x70000) >> 16;
      gid = segment & 0xFFFF;
      segments.push([startCode, length, gid]);
      if (startCode == 0x1F) {
        extraOffset.push([i, 0]);
      }
      if (length == 0x7) {
        extraOffset.push([i, 1]);
      }
    }
    var extraLen = extraOffset.length;
    var extraArray = this.readExtraArray(extraLen);
    for (var i = 0; i < extraLen; i++) {
      segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
    }
    for (var i = 1; i < nGroups; i++) {
      segments[i][0] += segments[i - 1][0];
    }
  } else if (type == 2) {
    var extraOffset = [];
    var deltaStartCode;
    var length;
    var deltaGid;
    var segment;
    for (var i = 0; i < nGroups; i++) {
      segment = this.getUint8();
      deltaStartCode = (segment & 0xE0) >> 5;
      length = (segment & 0x18) >> 3;
      deltaGid = segment & 0x07;
      segments.push([deltaStartCode, length, deltaGid]);
      if (deltaStartCode == 0x07) {
        extraOffset.push([i, 0]);
      }
      if (length == 0x03) {
        extraOffset.push([i, 1]);
      }
      if (deltaGid == 0x07) {
        extraOffset.push([i, 2]);
      }
    }
    var extraLen = extraOffset.length;
    var extraArray = this.readExtraArray(extraLen);
    for (var i = 0; i < extraLen; i++) {
      segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
    }
    for (var i = 1; i < nGroups; i++) {
      segments[i][0] += segments[i - 1][0];
      segments[i][2] += segments[i - 1][2];
    }
  } else if (type == 6 || type == 7) {
    var extraOffset = [];
    var deltaFirst;
    var deltaNleft;
    var segment;
    for (var i = 0; i < nGroups; i++) {
      segment = this.getUint8();
      deltaFirst = (segment & 0xF8) >> 3;
      deltaNleft = (segment & 0x07);
      segments.push([deltaFirst, deltaNleft]);
      if (deltaFirst == 0x1F) {
        extraOffset.push([i, 0]);
      }
      if (deltaNleft == 0x7) {
        extraOffset.push([i, 1]);
      }
    }
    var extraLen = extraOffset.length;
    var extraArray = this.readExtraArray(extraLen);
    for (var i = 0; i < extraLen; i++) {
      segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
    }
    for (var i = 1; i < nGroups; i++) {
      segments[i][0] += segments[i - 1][0];
      segments[i][1] += segments[i - 1][1];
    }
  }
  gos.segments = segments;
  gos.type = type;
  gos.len = nGroups;
  return gos;
};


/**
 * Magic used in header of the base font.
 * BS:Brian Stell AC:Ahmet Celik :)
 * @type {string}
 */
tachyfont.BinaryFontEditor.magicHead = 'BSAC';


/**
 * Version of the supported base font
 * @type {number}
 */
tachyfont.BinaryFontEditor.BASE_VERSION = 1;


/**
 * Reading operations for the header
 * @type {!Object}
 */
tachyfont.BinaryFontEditor.readOps = {};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.GLOF = function(editor, fileInfo) {
  fileInfo.glyphOffset = editor.getUint32();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.GLCN = function(editor, fileInfo) {
  fileInfo.numGlyphs = editor.getUint16();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.LCOF = function(editor, fileInfo) {
  fileInfo.glyphDataOffset = editor.getUint32();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.LCFM = function(editor, fileInfo) {
  fileInfo.offsetSize = editor.getUint8();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.HMOF = function(editor, fileInfo) {
  fileInfo.hmtxOffset = editor.getUint32();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.VMOF = function(editor, fileInfo) {
  fileInfo.vmtxOffset = editor.getUint32();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.HMMC = function(editor, fileInfo) {
  fileInfo.hmetricCount = editor.getUint16();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.VMMC = function(editor, fileInfo) {
  fileInfo.vmetricCount = editor.getUint16();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.TYPE = function(editor, fileInfo) {
  fileInfo.isTtf = editor.getUint8();
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.CM12 = function(editor, fileInfo) {
  var cmap12 = {};
  cmap12.offset = editor.getUint32();
  cmap12.nGroups = editor.getUint32();
  fileInfo.cmap12 = cmap12;
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.CM04 = function(editor, fileInfo) {
  var cmap4 = {};
  cmap4.offset = editor.getUint32();
  cmap4.length = editor.getUint32();
  fileInfo.cmap4 = cmap4;
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.CCMP = function(editor, fileInfo) {
  var compact_gos = {};
  var GOSCount = editor.getUint8();
  var GOSArray = [];
  for (var i = 0; i < GOSCount; i++) {
    GOSArray.push(editor.readNextGOS());
  }
  //If there is both cmap format 4 and format 12 arrays
  //Now generating cmap format 4 arrays
  if (fileInfo.cmap4 && fileInfo.cmap12 && GOSArray.length == 2 &&
      GOSArray[1].type == 4) {
    var gos_type_4_lens = GOSArray[1];
    var gos_type_12 = GOSArray[0];
    var format_4_arrays = [];
    var glyphIdArray = [];
    var glyphIdIdx = 0;
    var fmt12SegNum = 0;
    var fmt12SegNumBegin;
    var fmt12SegNumEnd;
    var fmt4SegCount = gos_type_4_lens.len;
    var startCode;
    var endCode;
    var idDelta;
    var idRangeOffset;
    var startGid;
    var codeRange;
    for (var i = 0; i < fmt4SegCount; i++) {  // fix this
      if (gos_type_4_lens.segments[i] == 0) {
        // The only time there is a format 4 segment with no format 12
        // segment is the format 4 end segment 0xFFFF.
        if (i != fmt4SegCount - 1)
          throw 'invalid segment';
        // Add the format 4 last segment.
        format_4_arrays.push([0xFFFF, 0xFFFF, 1, 0]);
        continue;
      }
      fmt12SegNumBegin = fmt12SegNum;
      fmt12SegNumEnd = fmt12SegNum + gos_type_4_lens.segments[i] - 1;
      startGid = gos_type_12.segments[fmt12SegNumBegin][2];
      startCode = gos_type_12.segments[fmt12SegNumBegin][0];
      endCode = gos_type_12.segments[fmt12SegNumEnd][0] +
                    gos_type_12.segments[fmt12SegNumEnd][1] - 1;
      fmt12SegNum = fmt12SegNumEnd + 1;
      if (gos_type_4_lens.segments[i] == 1) {
        idRangeOffset = 0;
        idDelta = (startGid - startCode + 0x10000) & 0xFFFF;
      } else {
        idDelta = 0;
        idRangeOffset = 2 * (glyphIdIdx - i + fmt4SegCount);
        codeRange = endCode - startCode + 1;
        glyphIdIdx += codeRange;
        var currentSeg = fmt12SegNumBegin;
        var currentSegArr = gos_type_12.segments[currentSeg];
        var gid;
        for (var codePoint = startCode; codePoint <= endCode; ) {
          if (codePoint >= currentSegArr[0] &&
              codePoint <= (currentSegArr[0] + currentSegArr[1] - 1)) {
            gid = currentSegArr[2] + codePoint - currentSegArr[0];
            glyphIdArray.push(gid);
            codePoint++;
          }else if (codePoint >
              (currentSegArr[0] + currentSegArr[1] - 1)) {
            currentSeg++;
            if (currentSeg <= fmt12SegNumEnd)
              currentSegArr = gos_type_12.segments[currentSeg];
          }else if (codePoint < currentSegArr[0]) {
            glyphIdArray.push(0);  //missing codepoint
            codePoint++;
          }
        }
        if (glyphIdIdx != glyphIdArray.length)
          throw 'glyphIdArray update failure';
      }
      format_4_arrays.push([startCode, endCode, idDelta, idRangeOffset]);
    }
    compact_gos.cmap4 = {};
    compact_gos.cmap4.segments = format_4_arrays;
    compact_gos.cmap4.glyphIdArray = glyphIdArray;
  }
  compact_gos.cmap12 = GOSArray[0];
  fileInfo.compact_gos = compact_gos;
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.CS02 = function(editor, fileInfo) {
  var charset = {};
  charset.offset = editor.getUint32();
  charset.gos = editor.readNextGOS();
  fileInfo.charset_fmt = charset;
};


/**
 * @param {!tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {!tachyfont.typedef.FileInfo} fileInfo The FileInfo object.
 */
tachyfont.BinaryFontEditor.readOps.SHA1 = function(editor, fileInfo) {
  var sha1_fingerprint = editor.readString(40);
  fileInfo.sha1_fingerprint = sha1_fingerprint;
};


/**
 * Tags defined in the header of the basefont
 * @enum {!Object}
 */
tachyfont.BinaryFontEditor.TAGS = {
  'GLOF':
      {'desc': 'Start of the glyphs data relative to font file start',
        'fn': tachyfont.BinaryFontEditor.readOps.GLOF
      },
  'GLCN':
      {'desc': 'Number of glyphs in the font',
        'fn': tachyfont.BinaryFontEditor.readOps.GLCN
      },
  'LCOF':
      {'desc': 'Start of glyph data location offsets',
        'fn': tachyfont.BinaryFontEditor.readOps.LCOF
      },
  'LCFM':
      {'desc': 'Offset size of the offsets in loca table',
        'fn': tachyfont.BinaryFontEditor.readOps.LCFM
      },
  'HMOF':
      {'desc': 'Start of the HMTX table relative to font file start',
        'fn': tachyfont.BinaryFontEditor.readOps.HMOF
      },
  'VMOF':
      {'desc': 'Start of the VMTX table relative to font file start',
        'fn': tachyfont.BinaryFontEditor.readOps.VMOF
      },
  'HMMC':
      {'desc': 'Number of hmetrics in hmtx table',
        'fn': tachyfont.BinaryFontEditor.readOps.HMMC
      },
  'VMMC':
      {'desc': 'Number of vmetrics in vmtx table',
        'fn': tachyfont.BinaryFontEditor.readOps.VMMC
      },
  'TYPE':
      {'desc': 'Type of the font. 1 for TTF and 0 for CFF',
        'fn': tachyfont.BinaryFontEditor.readOps.TYPE
      },
  'CM12':
      {'desc': 'Start offset and number of groups in cmap fmt 12 table',
        'fn': tachyfont.BinaryFontEditor.readOps.CM12
      },
  'CM04':
      {'desc': 'Start offset of cmap fmt 4 table',
        'fn': tachyfont.BinaryFontEditor.readOps.CM04
      },
  'CCMP':
      {'desc': 'Compact cmap, groups of segments',
        'fn': tachyfont.BinaryFontEditor.readOps.CCMP
      },
  'CS02':
      {'desc': 'CFF Charset format 2 in compacted format',
        'fn': tachyfont.BinaryFontEditor.readOps.CS02
      },
  'SHA1':
      {'desc': 'Font file fingerprint',
        'fn': tachyfont.BinaryFontEditor.readOps.SHA1
      }
};


/**
 * A static routine that parses the header of the base font.
 * @param {!ArrayBuffer} headerBytes
 * @return {!tachyfont.typedef.FileInfo}
 */
tachyfont.BinaryFontEditor.parseBaseHeader = function(headerBytes) {
  var binaryEditor =
      new tachyfont.BinaryFontEditor(new DataView(headerBytes), 0);
  return binaryEditor.parseBaseHeader();
};


/**
 * Parses the header of the base font.
 * Set information as attributes in given loader object
 * @return {!tachyfont.typedef.FileInfo} Results of parsing the header.
 */
tachyfont.BinaryFontEditor.prototype.parseBaseHeader = function() {
  var magic = this.readString(4);
  if (magic != tachyfont.BinaryFontEditor.magicHead) {
    throw 'magic number mismatch: expected ' +
        tachyfont.BinaryFontEditor.magicHead + ' but got ' + magic;
  }
  var fileInfo = {};
  fileInfo.headSize = this.getInt32();
  if (!fileInfo.headSize) {
    throw 'Invalid head size!';
  }
  fileInfo.version = this.getInt32();
  if (fileInfo.version != tachyfont.BinaryFontEditor.BASE_VERSION) {
    throw 'Incompatible Base Font Version!';
  }
  var count = this.getUint16();
  var tag;
  var tagOffset;
  var saveOffset;
  var dataStart = count * 8 + 4 + 4 + 4 + 2;//magic, headSize, ver, count
  for (var i = 0; i < count; i++) {
    tag = this.readString(4);
    tagOffset = this.getUint32();
    if (!tachyfont.BinaryFontEditor.TAGS.hasOwnProperty(tag)) {//unknown tag
      throw 'Unknown Base Font Header TAG';
    }
    saveOffset = this.tell();
    this.seek(dataStart + tagOffset);
    tachyfont.BinaryFontEditor.TAGS[tag]['fn'](this, fileInfo);
    this.seek(saveOffset);
  }
  fileInfo.cmapMapping = tachyfont.BinaryFontEditor.getCmapMapping(
      /** @type {!tachyfont.typedef.FileInfo} */ (fileInfo));

  // The compiler does not know what got set by the tags calls.
  return /** @type {!tachyfont.typedef.FileInfo} */ (fileInfo);
};


/**
 * Sets side bearing in MTX tables
 * @param {number} start Beginning of MTX table
 * @param {number} metricCount Count of the metrics
 * @param {number} gid Glyph id
 * @param {number} value Side bearing value
 */
tachyfont.BinaryFontEditor.prototype.setMtxSideBearing =
    function(start, metricCount,
    gid, value) {
  if (gid < metricCount) {
    this.seek(start + gid * 4 + 2);
    this.setInt16(value);
  }else {
    this.seek(start + 2 * gid + 2 * metricCount);
    this.setInt16(value);
  }
};


/**
 * Gets the glyph location for the given gid
 * @param {number} start Beginning of the glyph offsets(loca) table
 * @param {number} offSize Number of bytes in the offset
 * @param {number} gid Glyph id
 * @return {number} Offset
 */
tachyfont.BinaryFontEditor.prototype.getGlyphDataOffset =
    function(start, offSize, gid) {
  this.seek(start + gid * offSize);
  return this.getElementOffset(offSize);
};


/**
 * Sets the glyph location for the given gid
 * TODO(bstell): This function should be setLocaOffset
 * @param {number} start Beginning of the glyph offsets(loca) table
 * @param {number} offSize Number of bytes in the offset
 * @param {number} gid Glyph id
 * @param {number} value New offset
 */
tachyfont.BinaryFontEditor.prototype.setGlyphDataOffset =
    function(start, offSize, gid,
    value) {
  this.seek(start + gid * offSize);
  this.setOffset(offSize, value);
};


/**
 * Get the character to glyphId mapping.
 * @param {!tachyfont.typedef.FileInfo} headerInfo Header information.
 * @return {!tachyfont.typedef.CmapMapping} Map of chars to glyphId,
 *     format4Seg, format12Seg.
 */
tachyfont.BinaryFontEditor.getCmapMapping = function(headerInfo) {
  var cmapMapping = {};
  var charCmapInfo;
  // Parse format 4.
  if (headerInfo.compact_gos.cmap4) {
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
            debugger;  // TODO(bstell): verify this code.
          }
          glyphId = glyphIdArray[glyphIdIndex++];
          if (glyphId == 0) {
            // This code is not mapped in the font.
            if (goog.DEBUG) {
              debugger;  // TODO(bstell): verify this code.
            }
            continue;
          }
        }
        charCmapInfo = new tachyfont.CharCmapInfo(glyphId, i, null);
        cmapMapping[code] = charCmapInfo;
      }
    }
  }


  if (!headerInfo.compact_gos.cmap12) {
    if (goog.DEBUG) {
      debugger;  // TODO(bstell): need to handle this.
    }
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
          goog.asserts.assert(
              charCmapInfo.glyphId == glyphId, 'format 4/12 glyphId mismatch');
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
