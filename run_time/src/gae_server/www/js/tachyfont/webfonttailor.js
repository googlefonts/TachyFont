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

goog.provide('tachyfont.webfonttailor');

goog.require('tachyfont');
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.FontsInfo');
goog.require('tachyfont.webfonttailor_alternate');


/**
 * The list of supported weights for Noto Sans JP normal (upright).
 *
 * @private {!Object<string, !Object<string, string>>}
 */
tachyfont.webfonttailor.JaNormalInfo_ = {
  'familyName': { 'name': 'Noto Sans JP' },
  '100': { 'name': 'NotoSansJP-Thin', 'weight': '100' },
  '300': { 'name': 'NotoSansJP-Light', 'weight': '300' },
  '350': { 'name': 'NotoSansJP-DemiLight', 'weight': '350' },
  '400': { 'name': 'NotoSansJP-Regular', 'weight': '400' },
  '500': { 'name': 'NotoSansJP-Medium', 'weight': '500' },
  '700': { 'name': 'NotoSansJP-Bold', 'weight': '700' },
  '900': { 'name': 'NotoSansJP-Black', 'weight': '900' }
};


/**
 * This list of supported styles (slants) for Noto Sans JP.
 *
 * @private {!Object<string, !Object>}
 */
tachyfont.webfonttailor.JaStyleInfo_ = {
  'normal': tachyfont.webfonttailor.JaNormalInfo_
};


/**
 * This list of supported languages for the Noto Sans font family.
 *
 * @private {!Object<string, !Object>}
 */
tachyfont.webfonttailor.NotoSansLanguageInfo_ = {
  'ja': tachyfont.webfonttailor.JaStyleInfo_
};


/**
 * This list of supported font families.
 *
 * @private {!Object<string, !Object>}
 */
tachyfont.webfonttailor.FontFamliesInfo_ = {
  'Noto Sans': tachyfont.webfonttailor.NotoSansLanguageInfo_
};


/**
 * getTachyFontInfo: get the font information.
 *
 * @param {!Array<string>} fontFamlies The suggested list of font families.
 * @param {!Array<string>} languages The language codes list.
 * @param {!Array<Object>} faces The faces (eg, slant, weight) list.
 * @param {!Object<string, string>} options Additional info; eg, stretch.
 * @param {!Array<string>=} opt_priorityWeights Weights to prioritize
 *     (optional).
 * @return {!tachyfont.FontsInfo} The information describing the fonts, include:
 *     fonts: A list of font.
 *     url: The url to the tachyfont server.
 */
tachyfont.webfonttailor.getTachyFontsInfo =
    function(fontFamlies, languages, faces, options, opt_priorityWeights) {
  if (options['useAlternate']) {
    return tachyfont.webfonttailor_alternate.getTachyFontsInfo(fontFamlies,
        languages, faces, options);
  }
  var priorityWeights = opt_priorityWeights || [];
  var priorityFonts = [];
  var nonPriorityFonts = [];
  for (var i = 0; i < fontFamlies.length; i++) {
    var fontFamily = fontFamlies[i];
    var languagesInfo = tachyfont.webfonttailor.FontFamliesInfo_[fontFamily];
    if (!languagesInfo) {
      continue;
    }
    for (var j = 0; j < languages.length; j++) {
      var language = languages[j];
      var styleInfo = languagesInfo[language];
      if (!styleInfo) {
        continue;
      }
      for (var k = 0; k < faces.length; k++) {
        var face = faces[k];
        var style = face['style'];
        var weights = face['weights'];
        var weightsInfo = styleInfo[style];
        for (var l = 0; l < weights.length; l++) {
          var weight = weights[l];
          var font = weightsInfo[weight];
          if (font) {
            var priority = priorityWeights.indexOf(weight) != -1;
            var fontInfo = new tachyfont.FontInfo(weightsInfo.familyName.name,
                font['weight'], priority);
            if (priority) {
              priorityFonts.push(fontInfo);
            } else {
              nonPriorityFonts.push(fontInfo);
            }
          }
        }
      }
    }
  }
  var fonts = priorityFonts.concat(nonPriorityFonts);
  return new tachyfont.FontsInfo(fonts, '', '');
};

goog.exportSymbol('tachyfont.webfonttailor', tachyfont.webfonttailor);
goog.exportProperty(tachyfont.webfonttailor, 'getTachyFontsInfo',
    tachyfont.webfonttailor.getTachyFontsInfo);

