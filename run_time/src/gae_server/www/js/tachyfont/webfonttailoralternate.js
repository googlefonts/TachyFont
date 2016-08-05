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

goog.provide('tachyfont.webfonttailor_alternate');

goog.require('tachyfont');
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.FontsInfo');


/**
 * Get the font information for the Play Store experiment.

 * @param {!Array<string>} fontFamlies The suggested list of font families.
 * @param {!Array<string>} languages The language codes list.
 * @param {!Array<!Object>} faces The faces (eg, slant, weight) list.
 * @param {!Object<string, string>} options Additional info; eg, stretch.
 * @return {!tachyfont.FontsInfo} The information describing the fonts, include:
 *     fonts: A list of font.
 *     url: The url to the tachyfont server.
 */
tachyfont.webfonttailor_alternate.getTachyFontsInfo =
    function(fontFamlies, languages, faces, options) {
  var fonts = [];
  var dataUrl = '';
  var reportUrl = '';

  return new tachyfont.FontsInfo(fonts, dataUrl, reportUrl);
};

goog.exportSymbol('tachyfont.webfonttailor_alternate',
                  tachyfont.webfonttailor_alternate);
goog.exportProperty(tachyfont.webfonttailor_alternate, 'getTachyFontsInfo',
                    tachyfont.webfonttailor_alternate.getTachyFontsInfo);

