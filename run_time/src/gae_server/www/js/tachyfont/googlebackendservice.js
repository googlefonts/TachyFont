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

goog.provide('tachyfont.GoogleBackendService');

goog.require('goog.Promise');
goog.require('tachyfont.BackendService');
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.utils');


goog.scope(function() {



/**
 * Handles interacting with the backend server.
 *
 * @param {string} baseUrl of the backend server.
 * @constructor
 * @extends {tachyfont.BackendService}
 */
tachyfont.GoogleBackendService = function(baseUrl) {
  tachyfont.GoogleBackendService.base(this, 'constructor', baseUrl);
};
goog.inherits(tachyfont.GoogleBackendService, tachyfont.BackendService);
var GoogleBackendService = tachyfont.GoogleBackendService;


/** @type {string} */
GoogleBackendService.GLYPHS_REQUEST_PREFIX = 'g';


/** @type {string} */
GoogleBackendService.GLYPHS_REQUEST_SUFFIX = 'glyphs';


/** @type {string} */
GoogleBackendService.FRAMEWORK_REQUEST_PREFIX = 't';


/** @type {string} */
GoogleBackendService.FRAMEWORK_REQUEST_SUFFIX = 'framework';


/** @override */
GoogleBackendService.prototype.requestCodepoints = function(
    fontInfo, codes) {
  var self = this;
  return this.requestUrl(this.getDataUrl_(fontInfo,
      GoogleBackendService.GLYPHS_REQUEST_PREFIX,
      GoogleBackendService.GLYPHS_REQUEST_SUFFIX),
      'POST',
      'glyphs=' + encodeURIComponent(this.compressedGlyphsList_(codes)),
      {'Content-Type': 'application/x-www-form-urlencoded'})
      .then(function(glyphData) {
        return self.parseDataHeader(glyphData);
      });
};


/** @override */
GoogleBackendService.prototype.requestFontBase = function(fontInfo) {
  return this.requestUrl(this.getDataUrl_(fontInfo,
      GoogleBackendService.FRAMEWORK_REQUEST_PREFIX,
      GoogleBackendService.FRAMEWORK_REQUEST_SUFFIX),
      'GET', null, {});
};


/** @override */
GoogleBackendService.prototype.log = function(message) {
  // Not implemented yet.
  return new goog.Promise(function(resolve, reject) {
    resolve(new ArrayBuffer(0));
  });
};


/**
 * @private
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     fontkit, familyPath = the font's directory; ie. "notosansjapanese", and
 *     name = Unique name for this particular instance of the font
 *     (style/weight) ie. "notosans100".
 * @param {string} prefix Action prefix in the URL.
 * @param {string} suffix Action suffset in the URL.
 * @return {string} URL for the specified font action.
 */
GoogleBackendService.prototype.getDataUrl_ =
    function(fontInfo, prefix, suffix) {
  var familyPath = fontInfo.getfamilyPath();
  if (!familyPath) {
    // Using familyPath is preferred over familyName.
    familyPath = fontInfo.getFamilyName().replace(/ /g, '').toLowerCase();
  }
  return this.baseUrl + '/' + prefix + '/'
      + 'p' + tachyfont.BackendService.PROTOCOL_MAJOR_VERSION
      + '/' + familyPath + '/' + fontInfo.getVersion() + '/'
      + fontInfo.getFontKit() + '.' + suffix;
};


/**
 * @private
 * @param {Array.<number>} codes list of code points to compress.
 * @return {string} compressed code point list.
 */
GoogleBackendService.prototype.compressedGlyphsList_ = function(codes) {
  var result = '';
  for (var i = 0; i < codes.length; i++) {
    var cp = codes[i];
    if (cp != 45) { // Dash
      result = result + tachyfont.utils.stringFromCodePoint(cp);
    } else {
      // Dash is a special character in the compressed glyph list and must
      // be at the start of the string.
      result = '-' + result;
    }
  }
  return result;
};


});  // goog.scope
