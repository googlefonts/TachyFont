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


goog.require('goog.Promise');
goog.require('goog.events');
goog.require('goog.functions');
goog.require('goog.net.EventType');
goog.require('goog.net.XhrIo');
/** @suppress {extraRequire} */
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.GlyphBundleResponse');


goog.scope(function() {



/**
 * Handles interacting with the backend server.
 *
 * @param {string} baseUrl URL of the tachyfont server.
 * @constructor
 */
tachyfont.BackendService = function(baseUrl) {
  /** @type {string} */
  this.baseUrl = baseUrl;
};
var BackendService = tachyfont.BackendService;


/**
 * Complete version for the tachyfont client/server protocol.
 */
tachyfont.BackendService.PROTOCOL_VERSION = '1.0';


/**
 * Major version for the tachyfont client/server protocol.
 */
tachyfont.BackendService.PROTOCOL_MAJOR_VERSION = '1';


/**
 * Request codepoints from the backend server.
 *
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @param {Array<number>} codes Codepoints to be requested
 * @return {goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
BackendService.prototype.requestCodepoints = goog.functions.NULL;


/**
 * Request a font's base data from the backend server.
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @return {goog.Promise} Promise to return ArrayBuffer for the base.
 */
BackendService.prototype.requestFontBase = goog.functions.NULL;


/**
 * Parses the header of a codepoint response and returns info on it:
 *
 * @param {ArrayBuffer} glyphData from a code point request.
 * @return {!tachyfont.GlyphBundleResponse}
 */
BackendService.prototype.parseDataHeader = function(glyphData) {
  var dataView = new DataView(glyphData);
  var offset = 0;
  var magicNumber = '';
  for (var i = 0; i < 4; i++) {
    magicNumber += String.fromCharCode(dataView.getUint8(offset++));
  }

  if (magicNumber != 'BSAC') {
    throw new Error('Invalid code point bundle header magic number: ' +
        magicNumber);
  }
  var majorVersion = dataView.getUint8(offset++);
  var version = majorVersion + '.' + dataView.getUint8(offset++);
  if (majorVersion != tachyfont.BackendService.PROTOCOL_MAJOR_VERSION) {
    throw new Error('Server response\'s major protocol version (' +
        majorVersion + ') does not match expected: ' +
        tachyfont.BackendService.PROTOCOL_MAJOR_VERSION);
  }
  offset += 2; // Skip reserved section.
  var signature = '';
  for (var i = 0; i < 20; i++) {
    var thisByteStr = dataView.getUint8(offset++).toString(16);
    if (thisByteStr.length == 1) {
      thisByteStr = '0' + thisByteStr;
    }
    signature += thisByteStr;
  }
  return new tachyfont.GlyphBundleResponse(version, signature, offset,
      glyphData);
};


/**
 * Send a log message to the server
 *
 * @param {string} message The message to log.
 * @return {goog.Promise} Promise to return ArrayBuffer for the response.
 */
BackendService.prototype.log = goog.functions.NULL;


/**
 * Async XMLHttpRequest to given url using given method, data and header
 *
 * @param {string} url Destination url
 * @param {string} method Request method
 * @param {?string} postData Request data
 * @param {Object} headers Request headers
 * @return {goog.Promise} Promise to return response
 * @protected
 */
BackendService.prototype.requestUrl = function(url, method, postData,
    headers) {
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


});  // goog.scope
