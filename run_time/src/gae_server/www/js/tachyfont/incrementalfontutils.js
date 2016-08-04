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
goog.require('goog.log.Level');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.CharCmapInfo');
goog.require('tachyfont.Logger');


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
 * Sanitize base font to pass OTS
 * @param {!Object} headerInfo The font header information.
 * @param {!DataView} baseFont Base font as DataView
 * @return {!DataView} Sanitized base font
 */
tachyfont.IncrementalFontUtils.sanitizeBaseFont =
    function(headerInfo, baseFont) {

  if (headerInfo.isTtf) {
    headerInfo.dirty = true;
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
    headerInfo.dirty = true;
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
      if (lastRealOffset == thisOne) {
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
 * Set a style's visibility.
 * @param {?Object} style The style object
 * @param {!tachyfont.FontInfo} fontInfo The font information object
 * @param {boolean} visible True is setting visibility to visible.
 * @return {!Object} New style object for given font and visibility
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


/**
 * Delete a CSS style rule.
 *
 * @param {number} ruleToDelete The rule to delete.
 * @param {!CSSStyleSheet} sheet The style sheet.
 */
tachyfont.IncrementalFontUtils.deleteCssRule = function(ruleToDelete, sheet) {
  if (ruleToDelete != -1) {
    if (sheet.deleteRule) {
      sheet.deleteRule(ruleToDelete);
    } else if (sheet.removeRule) {
      sheet.removeRule(ruleToDelete);
    } else {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.Logger.logger, 'no delete/drop rule');
      }
    }
  }
};


/**
 * Find the \@font-face rule for the given font spec.
 *
 * TODO(bstell): Add slant, width, etc.
 * @param {!CSSStyleSheet} sheet The style sheet.
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
          goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
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
 * @param {!CSSStyleSheet} sheet The style sheet.
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
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'rule = ' + rule_str);
  }
  var ruleToDelete = tachyfont.IncrementalFontUtils.findFontFaceRule(
      sheet, fontFamily, weight);
  tachyfont.IncrementalFontUtils.deleteCssRule(ruleToDelete, sheet);
  sheet.insertRule(rule_str, sheet.cssRules.length);
};


/**
 * Get the character to glyphId mapping.
 * @param {!Object} headerInfo Header information.
 * @return {!Object<number, !tachyfont.CharCmapInfo>} Map of chars to glyphId,
 *     format4Seg, format12Seg.
 */
tachyfont.IncrementalFontUtils.getCmapMapping = function(headerInfo) {
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
            debugger; // TODO(bstell): verify this code.
          }
          glyphId = glyphIdArray[glyphIdIndex++];
          if (glyphId == 0) {
            // This code is not mapped in the font.
            if (goog.DEBUG) {
              debugger; // TODO(bstell): verify this code.
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
      debugger; // TODO(bstell): need to handle this.
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


