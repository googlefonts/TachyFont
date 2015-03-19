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
goog.provide('webfonttailor.FontsInfo');

/**
 * webfonttailor.jaNormalInfo
 *
 * This list of supported weights for Noto Sans JP normal (upright).
 */
webfonttailor.jaNormalInfo = {
  '100': { 'name': 'NotoSansJP-Thin', 'weight': '100',
           'class': 'NotoSansJP-Thin' },
  '200': { 'name': 'NotoSansJP-Light', 'weight': '200',
           'class': 'NotoSansJP-light' },
  '300': { 'name': 'NotoSansJP-DemiLight', 'weight': '300',
           'class': 'NotoSansJP-DemiLight' },
  '400': { 'name': 'NotoSansJP-Regular', 'weight': '400',
           'class': 'NotoSansJP-Regular' },
  '500': { 'name': 'NotoSansJP-Medium', 'weight': '500',
           'class': 'NotoSansJP-Medium' },
  '700': { 'name': 'NotoSansJP-Bold', 'weight': '700',
           'class': 'NotoSansJP-Bold' },
  '900': { 'name': 'NotoSansJP-Black', 'weight': '900',
           'class': 'NotoSansJP-Black' }
};

/**
 * webfonttailor.jaStyleInfo
 *
 * This list of supported styles (slants) for Noto Sans JP.
 */
webfonttailor.jaStyleInfo = {
  'normal': webfonttailor.jaNormalInfo
};

/**
 * webfonttailor.notoSansLanguageInfo
 *
 * This list of supported languages for the Noto Sans font family.
 */
webfonttailor.notoSansLanguageInfo = {
  'ja': webfonttailor.jaStyleInfo
};

/**
 * webfonttailor.fontFamliesInfo
 *
 * This list of supported font families.
 */
webfonttailor.fontFamliesInfo = {
  'Noto Sans': webfonttailor.notoSansLanguageInfo
};


/**
 * Object holding information about the requested fonts.
 *
 * @constructor
 */
webfonttailor.FontsInfo = function() {
  // TODO(bstell): Define the fields.
  // TODO(bstell): Fix the constructor parameters.
};


/**
 * getTachyFontInfo: get the font information.
 *
 * @param {Array.<string>} fontFamlies The suggested list of font families.
 * @param {Array.<string>} languages The language codes list.
 * @param {Array.<Object>} faces The faces (eg, slant, weight) list.
 * @param {Object.<string, string>} options Additional info; eg, stretch.
 * @return {webfonttailor.FontsInfo} The information describing the fonts.
 */
webfonttailor.getTachyFontsInfo = function(fontFamlies, languages, faces,
  options) {
  var fontsInfo = new webfonttailor.FontsInfo();
  var fonts = [];
  for (var i = 0; i < fontFamlies.length; i++) {
    var fontFamily = fontFamlies[i];
    var languagesInfo = webfonttailor.fontFamliesInfo[fontFamily];
    if (languagesInfo == undefined) {
      continue;
    }
    for (var j = 0; j < languages.length; j++) {
      var language = languages[j];
      var styleInfo = languagesInfo[language];
      if (styleInfo == undefined) {
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
            fonts.push(font);
          }
        }
      }
    }
  }
  fontsInfo['fonts'] = fonts;
  fontsInfo['url'] = '';
  return fontsInfo;
};
