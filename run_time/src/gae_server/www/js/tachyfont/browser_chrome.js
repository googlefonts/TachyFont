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
goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Logger');


/**
 * Set the \@font-face rule.
 * @param {!DataView} fontData The font dataview.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {boolean} isTtf True if the font is a TrueType font.
 * @param {?string} oldBlobUrl The previous Blob URL.
 * @return {!goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.Browser.setFont = function(fontData, fontInfo, isTtf, oldBlobUrl) {
  return goog.Promise.resolve().
      then(function() {
        var mimeType;
        var format;
        if (isTtf) {
          mimeType = 'font/ttf'; // 'application/x-font-ttf';
          format = 'truetype';
        } else {
          mimeType = 'font/otf'; // 'application/font-sfnt';
          format = 'opentype';
        }
        if (oldBlobUrl) {
          window.URL.revokeObjectURL(oldBlobUrl);
        }
        var blobUrl =
           tachyfont.IncrementalFontUtils.getBlobUrl(fontData, mimeType);

        return tachyfont.Browser.setFontNoFlash(fontInfo, format, blobUrl).
           then(function() {
             if (goog.DEBUG) {
               goog.log.fine(tachyfont.Logger.logger, 'setFont: setFont done');
             }
             return goog.Promise.resolve(blobUrl);
           });
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
  // The desired @font-face font-family.
  var fontFamily = fontInfo.getFamilyName();
  // The temporary @font-face font-family.
  var weight = fontInfo.getWeight();
  var tmpFontFamily = 'tmp-' + weight + '-' + fontFamily;
  var sheet = tachyfont.IncrementalFontUtils.getStyleSheet();

  // Create a temporary @font-face rule to transfer the blobUrl data from
  // Javascript to the browser side.
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'setFont: ' + tmpFontFamily + '/' + weight);
  }
  tachyfont.IncrementalFontUtils.setCssFontRule(sheet, tmpFontFamily, weight,
      blobUrl, format);

  var setFontPromise = new goog.Promise(function(resolve, reject) {
    // The document.fonts.load call fails with a weight that is not a multiple
    // of 100. So use an artifical weight to work around this problem.
    var fontStr = '400 20px ' + tmpFontFamily;
    if (goog.DEBUG) {
      goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
          'setFont: fontStr = ' + fontStr);
    }
    // Transfer the data.
    // TODO(bstell): Make this cross platform.
    document.fonts.load(fontStr).
        then(function(value) {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.Logger.logger, 'loaded ' + tmpFontFamily +
                '/' + weight);
          }
          resolve();
        });
  }).
      then(function() {
        // Now that the font is ready switch the @font-face to the desired name.
        tachyfont.Browser.switchFont(sheet, tmpFontFamily, fontFamily, weight,
            blobUrl, format);
      });

  return setFontPromise;
};


/**
 * Switch from the temporary font to the target font.
 *
 * @param {!CSSStyleSheet} sheet The CSS style sheet.
 * @param {string} tmpFontFamily The temporary font-family that is loading the
 *     blob.
 * @param {string} fontFamily The target font-family.
 * @param {string} weight The The target weight
 * @param {string} blobUrl The blob URL for the font data.
 * @param {string} format The font type.
 */
tachyfont.Browser.switchFont = function(sheet, tmpFontFamily, fontFamily,
    weight, blobUrl, format) {
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'switch to fontFamily');
  }
  // Set the updated font rule.
  tachyfont.IncrementalFontUtils.setCssFontRule(sheet, fontFamily, weight,
      blobUrl, format);

  // Delete the temporary rule
  var ruleToDelete = tachyfont.IncrementalFontUtils.findFontFaceRule(
      sheet, tmpFontFamily, weight);
  if (goog.DEBUG) {
    goog.log.info(tachyfont.Logger.logger, '**** switched ' + weight +
        ' from ' + tmpFontFamily + ' to ' + fontFamily +
                ' ****');
  }
  tachyfont.IncrementalFontUtils.deleteCssRule(ruleToDelete, sheet);
};


