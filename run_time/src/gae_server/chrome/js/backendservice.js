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

goog.provide('tachyfont.BackendService');
goog.provide('tachyfont.GoogleBackendService');

goog.require('goog.net.XhrIo');
goog.require('goog.events');
goog.require('goog.net.EventType');
goog.require('goog.Promise');

/**
 * Handles interacting with the backend server.
 * @constructor
 * @param {string} baseUrl URL of the tachyfont server.
 */
tachyfont.BackendService = function(baseUrl) {
  this.baseUrl = baseUrl;
};

/**
 * Request codepoints from the backend server.
 * @param {Object.<string, string>} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @param {Array.<number>} codes Codepoints to be requested
 * @return {goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
tachyfont.BackendService.prototype.requestCodepoints = function(
    fontInfo, codes) {
  var that = this;
  var bandwidth = tachyfont.ForDebug.getCookie('bandwidth', '0');
  return tachyfont.BackendService.requestUrl_(
      this.baseUrl + '/incremental_fonts/request',
      'POST',
      JSON.stringify({'font': fontInfo.name, 'arr': codes}),
      // Google App Engine servers do not support CORS so we cannot say
      // the 'Content-Type' is 'application/json'.
      //{'Content-Type': 'application/json'},
      {'Content-Type': 'text/plain', 'X-TachyFont-bandwidth': bandwidth})
  .then(function(glyphData) {
    return that.parseCodepointHeader_(glyphData);
  });
};

/**
 * Parses the header of a codepoint response and returns info on it:
 * @param {ArrayBuffer} glyphData modified to point to the start
 *        of the glyph data.
 * @return Header info, {count: ..., flags: ..., version: ...,
 *         fontSignature: ...}
 * @private
 */
tachyfont.BackendService.prototype.parseCodepointHeader_ = function(glyphData) {
  var dataView = new DataView(glyphData);
  var offset = 0;
  var count = dataView.getUint16(offset);
  offset += 2;
  var flags = dataView.getUint8(offset++);
  return new tachyfont.GlyphBundleResponse(
      '1.0', '', count, flags, offset, glyphData);
};

/**
 * Request a font's base data from the backend server.
 * @param {Object.<string, string>} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @return {goog.Promise} Promise to return ArrayBuffer for the base.
 */
tachyfont.BackendService.prototype.requestFontBase = function(fontInfo) {
  var bandwidth = tachyfont.ForDebug.getCookie('bandwidth', '0');
  return tachyfont.BackendService.requestUrl_(this.baseUrl +
      '/incremental_fonts/incrfonts/' + fontInfo.name + '/base', 'GET',
      null, { 'X-TachyFont-bandwidth': bandwidth });
};

/**
 * Send a log message to the server
 * @param {string} message The message to log.
 * @return {goog.Promise} Promise to return ArrayBuffer for the response.
 */
tachyfont.BackendService.prototype.log = function(message) {
  return tachyfont.BackendService.requestUrl_(
      this.baseUrl + '/incremental_fonts/logger',
      'POST',
      message,
      // Google App Engine servers do not support CORS so we cannot say
      // the 'Content-Type' is 'application/json'.
      //{'Content-Type': 'application/json'},
      {'Content-Type': 'text/plain'});
};

/**
 * Async XMLHttpRequest to given url using given method, data and header
 * @param {string} url Destination url
 * @param {string} method Request method
 * @param {?string} postData Request data
 * @param {Object} headers Request headers
 * @return {goog.Promise} Promise to return response
 * @private
 */
tachyfont.BackendService.requestUrl_ =
    function(url, method, postData, headers) {
  return new goog.Promise(function(resolve, reject) {
    var xhr = new goog.net.XhrIo();
    xhr.setResponseType(goog.net.XhrIo.ResponseType.ARRAY_BUFFER);
    goog.events.listen(xhr, goog.net.EventType.COMPLETE, function(e) {
      if (this.isSuccess()) {
        resolve(this.getResponse());
      } else {
        reject(this.getStatus() + ' ' + this.getStatusText());
      }
    });
    xhr.send(url, method, postData, headers);
  });
};

/**
 * Handles interacting with the backend server.
 * @param {string} baseUrl of the backend server.
 * @constructor
 */
tachyfont.GoogleBackendService = function(baseUrl) {
  this.baseUrl = baseUrl;
};

var GLYPHS_REQUEST_PREFIX = 'g';
var GLYPHS_REQUEST_SUFFIX = 'glyphs';
var FRAMEWORK_REQUEST_PREFIX = 't';
var FRAMEWORK_REQUEST_SUFFIX = 'framework';

/**
 * Request codepoints from the backend server.
 * @param {Object.<string, string>} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @param {Array.<number>} codes Codepoints to be requested
 * @return {goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
tachyfont.GoogleBackendService.prototype.requestCodepoints = function(
    fontInfo, codes) {
  var self = this;
  return tachyfont.BackendService.requestUrl_(this.getUrl_(fontInfo,
      GLYPHS_REQUEST_PREFIX,
      GLYPHS_REQUEST_SUFFIX),
      'POST',
      'glyphs=' + encodeURIComponent(this.compressedGlyphsList_(codes)),
      {'Content-Type': 'application/x-www-form-urlencoded'})
  .then(function(glyphData) {
    return self.parseHeader_(glyphData);
  });
};

/**
 * Parses the header of a codepoint response and returns info on it:
 * @param {ArrayBuffer} glyphData from a code point request.
 * @return Header info, {count: ..., flags: ..., version: ...,
 *         fontSignature: ...}
 * @private
 */
tachyfont.GoogleBackendService.prototype.parseHeader_ = function(glyphData) {
  var dataView = new DataView(glyphData);
  var offset = 0;
  var magicNumber = '';
  for (var i = 0; i < 4; i++) {
    magicNumber += String.fromCharCode(dataView.getUint8(offset++));
  }

  if (magicNumber == 'BSAC') {
    var version = dataView.getUint8(offset++) + '.' +
        dataView.getUint8(offset++);
    offset += 2; // Skip reserved section.
    var signature = '';
    for (var i = 0; i < 20; i++) {
      signature += dataView.getUint8(offset++).toString(16);
    }
    var count = dataView.getUint16(offset);
    offset += 2;
    var flags = dataView.getUint16(offset);
    offset += 2;
    return new tachyfont.GlyphBundleResponse(
        version, signature, count, flags, offset, glyphData);
  } else {
    throw new Error('Invalid code point bundle header magic number: ' +
        magicNumber);
  }
};

/**
 * Request a font's base data from the backend server.
 * @param {Object.<string, string>} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @return {goog.Promise} Promise to return ArrayBuffer for the base.
 */
tachyfont.GoogleBackendService.prototype.requestFontBase = function(fontInfo) {
  return tachyfont.BackendService.requestUrl_(this.getUrl_(fontInfo,
      FRAMEWORK_REQUEST_PREFIX,
      FRAMEWORK_REQUEST_SUFFIX),
      'GET', null, {});
};

/**
 * Send a log message to the server
 * @param {string} message The message to log.
 * @return {goog.Promise} Promise to return ArrayBuffer for the response.
 */
tachyfont.GoogleBackendService.prototype.log = function(message) {
  // Not implemented yet.
  return new goog.Promise(function(resolve, reject) {
    resolve(new ArrayBuffer(0));
  });
};

/**
 * @private
 * @param {Object.<string, string>} fontInfo containing info on the font; ie:
 *                 fontkit, familyName = Full font family name, not compressed
 *                 ie. "Noto Sans", and name = Unique name for this particular
 *                 instance of the font (style/weight) ie. "notosans100".
 * @param {string} prefix Action prefix in the URL.
 * @param {string} suffix Action suffset in the URL.
 * @return {string} URL for the specified font action.
 */
tachyfont.GoogleBackendService.prototype.getUrl_ = function(
    fontInfo, prefix, suffix) {
  var family = fontInfo['familyName'].replace(/ /g, '').toLowerCase();
  return this.baseUrl + '/' + prefix + '/' + family + '/' +
      fontInfo['version'] + '/' + fontInfo['fontkit'] + '.' + suffix;
};

/**
 * @private
 * @param {Array.<number>} codes list of code points to compress.
 * @return {string} compressed code point list.
 */
tachyfont.GoogleBackendService.prototype.compressedGlyphsList_ = function(
    codes) {
  var result = '';
  for (var i = 0; i < codes.length; i++) {
    var cp = codes[i];
    if (cp != 45) { // Dash
      result = result + String.fromCharCode(cp);
    } else {
      // Dash is a special character in the compressed glyph list and must
      // be at the start of the string.
      result = '-' + result;
    }
  }
  return result;
};
