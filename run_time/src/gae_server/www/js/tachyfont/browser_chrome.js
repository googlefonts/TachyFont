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

goog.provide('tachyfont.Browser');

goog.require('goog.Promise');
goog.require('tachyfont.IncrementalFontUtils');


/**
 * Set the \@font-face rule.
 * @param {!DataView} fontData The font dataview.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {boolean} isTtf True if the font is a TrueType font.
 * @param {?string} oldBlobUrl The previous Blob URL.
 * @return {!goog.Promise<string,?>} The promise for the blobUrl when the glyphs
 *     are displaying.
 */
tachyfont.Browser.setFont = function(fontData, fontInfo, isTtf, oldBlobUrl) {
  var mimeType;
  var format;
  if (isTtf) {
    mimeType = 'font/ttf';  // 'application/x-font-ttf';
    format = 'truetype';
  } else {
    mimeType = 'font/otf';  // 'application/font-sfnt';
    format = 'opentype';
  }
  if (oldBlobUrl) {
    window.URL.revokeObjectURL(oldBlobUrl);
  }
  var blobUrl = tachyfont.IncrementalFontUtils.getBlobUrl(fontData, mimeType);

  return tachyfont.Browser.setFontNoFlash(fontInfo, format, blobUrl)
      .then(function() {
        return goog.Promise.resolve(blobUrl);
      });
};


/**
 * Add the '@font-face' rule.
 *
 * Simply setting the \@font-face causes a Flash Of Invisible Text (FOIT). The
 * FOIT is the time it takes to:
 *   1. Pass the blobUrl data from Javascript memory to browser (C++) memory.
 *   2. Check the font with the OpenType Sanitizer (OTS).
 *   3. Rasterize the outlines into pixels.
 *
 * To avoid the FOIT this function first passes the blobUrl data to a temporary
 * \@font-face rule that is not being used to display text. Once the temporary
 * \@font-face is ready (ie: the data has been transferred, and OTS has run) any
 * existing \@font-face is deleted and the temporary \@font-face switched to be
 * the desired \@font-face.
 *
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {string} format The \@font-face format.
 * @param {string} blobUrl The blobUrl to the font data.
 * @return {!goog.Promise} The promise resolves when the glyphs are displaying.
 */
// TODO(bstell): This is really Chrome specific. Make it more work for other
// browsers.
tachyfont.Browser.setFontNoFlash = function(fontInfo, format, blobUrl) {
  var cssFontFamily = fontInfo.getCssFontFamily();
  var weight = fontInfo.getWeight();

  // Load the font data under a font-face that is not getting used.
  var srcStr = 'url("' + blobUrl + '") ' +
      'format("' + format + '");';
  return goog.Promise.resolve()
      .then(function() {
        var fontFaceTmp =
            new FontFace('tmp-' + weight + '-' + cssFontFamily, srcStr);
        document.fonts.add(fontFaceTmp);
        return fontFaceTmp.load();
      })
      .then(function(value) {
        // Show the font now that the data has been transfered to the C++ side.
        var fontFace = new FontFace(cssFontFamily, srcStr);
        fontFace.weight = weight;
        document.fonts.add(fontFace);
        return fontFace.load();
      });
};
