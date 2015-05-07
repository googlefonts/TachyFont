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

goog.provide('webfonttailor');

goog.require('tachyfont.FontInfo');
goog.require('tachyfont.FontsInfo');
goog.require('webfonttailor.alternate');


/**
 * The list of supported weights for Noto Sans JP normal (upright).
 *
 * @type {!Object.<string, !Object.<string, string>>}
 */
webfonttailor.JaNormalInfo = {
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
 * @type {!Object.<string, !Object>}
 */
webfonttailor.JaStyleInfo = {
  'normal': webfonttailor.JaNormalInfo
};


/**
 * This list of supported languages for the Noto Sans font family.
 *
 * @type {!Object.<string, !Object>}
 */
webfonttailor.NotoSansLanguageInfo = {
  'ja': webfonttailor.JaStyleInfo
};


/**
 * This list of supported font families.
 *
 * @type {!Object.<string, !Object>}
 */
webfonttailor.FontFamliesInfo = {
  'Noto Sans': webfonttailor.NotoSansLanguageInfo
};


/**
 * getTachyFontInfo: get the font information.
 *
 * @param {!Array.<string>} fontFamlies The suggested list of font families.
 * @param {!Array.<string>} languages The language codes list.
 * @param {!Array.<Object>} faces The faces (eg, slant, weight) list.
 * @param {!Object.<string, string>} options Additional info; eg, stretch.
 * @return {!tachyfont.FontsInfo} The information describing the fonts, include:
 *     fonts: A list of font.
 *     url: The url to the tachyfont server.
 */
webfonttailor.getTachyFontsInfo = function(fontFamlies, languages, faces,
    options) {
  if (options['useAlternate']) {
    return webfonttailor.alternate.getTachyFontsInfo(fontFamlies, languages,
        faces, options);
  }
  var fonts = [];
  for (var i = 0; i < fontFamlies.length; i++) {
    var fontFamily = fontFamlies[i];
    var languagesInfo = webfonttailor.FontFamliesInfo[fontFamily];
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
            var fontInfo = new tachyfont.FontInfo(font['name'], font['weight']);
            fonts.push(fontInfo);
          }
        }
      }
    }
  }
  return new tachyfont.FontsInfo(fonts, '', '');
};

goog.exportSymbol('webfonttailor', webfonttailor);
goog.exportProperty(webfonttailor, 'getTachyFontsInfo',
    webfonttailor.getTachyFontsInfo);

