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
 * @param {string} baseUrl URL of the tachyfont server.
 * @constructor
 */
tachyfont.BackendService = function(baseUrl) {
  /** @type {string} */
  this.baseUrl = baseUrl;

  /**
   * Request backoff time.
   * When requests fail add a fuzzy backoff delay so when the request begin
   * working the servers are not overwhelmed with requests.
   * @private {number}
   */
  this.backOffTime_ = 0;
};
var BackendService = tachyfont.BackendService;


/**
 * Complete version for the tachyfont client/server protocol.
 * @type {string}
 */
tachyfont.BackendService.PROTOCOL_VERSION = '1.0';


/**
 * Major version for the tachyfont client/server protocol.
 * @type {string}
 */
tachyfont.BackendService.PROTOCOL_MAJOR_VERSION = '1';


/**
 * The base gain for the exponential backoff. Math.random() is added to this to
 * get a fuzzy gain; eg, a base gain of 1.5 + Math.random would give a gain
 * between 1.5 to 2.5.
 * @type {number}
 */
tachyfont.BackendService.BACKOFF_TIME_BASE_GAIN = 1.5;


/**
 * The initial backoff time in milliseconds.
 * @type {number}
 */
tachyfont.BackendService.BACKOFF_TIME_INITIAL = 100;


/**
 * The maximum backoff time in milliseconds.
 * @type {number}
 */
tachyfont.BackendService.BACKOFF_TIME_MAX = 10000;


/**
 * Enum for report params.
 * @enum {string}
 */
tachyfont.BackendService.Param = {
  ERROR_ID: 'ei',
  ERROR_TYPE: 'er',
  FONT_ID: 'fi',
  LOG_TYPE: 'lg',
  MOBILE: 'm',
  REPORT_TYPE: 'rt',
  END: ''
};


/**
 * Request codepoints from the backend server.
 *
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @param {!Array<number>} codes Codepoints to be requested
 * @return {?goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
BackendService.prototype.requestCodepoints = goog.functions.NULL;


/**
 * Request a font's base data from the backend server.
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     name, version, ...
 * @return {?goog.Promise} Promise to return ArrayBuffer for the base.
 */
BackendService.prototype.requestFontBase = goog.functions.NULL;


/**
 * Parses the header of a codepoint response and returns info on it:
 *
 * @param {!ArrayBuffer} glyphData from a code point request.
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
  offset += 2;  // Skip reserved section.
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
 * @return {?goog.Promise} Promise to return ArrayBuffer for the response.
 */
BackendService.prototype.log = goog.functions.NULL;


/**
 * Provides expontential fuzzy backoff for requestUrl failures. The expontential
 * backoff reduces traffic when the servers are down. The fuzziness evens out
 * the backed up requests when the servers recover.
 * @param {string} url Destination url
 * @param {string} responseTypeStr The response type.
 * @param {string} method Request method
 * @param {?string} postData Request data
 * @param {?Object} headers Request headers
 * @return {!goog.Promise<?,?>} Promise to return response
 */
BackendService.prototype.requestUrl = function(
    url, responseTypeStr, method, postData, headers) {
  var responseType;
  switch (responseTypeStr) {
    case 'arraybuffer':
      responseType = goog.net.XhrIo.ResponseType.ARRAY_BUFFER;
      break;
    case 'text':
      responseType = goog.net.XhrIo.ResponseType.TEXT;
      break;
    default:
      responseType = goog.net.XhrIo.ResponseType.DEFAULT;
  }
  if (this.backOffTime_ == 0) {
    return this.requestUrl_(url, responseType, method, postData, headers);
  } else {
    return new goog
        .Promise(
            function(resolve, reject) {
              setTimeout(function() {
                resolve();
              }.bind(this), this.backOffTime_);
            },
            this)
        .then(function() {
          return this.requestUrl_(url, responseType, method, postData, headers);
        }.bind(this));
  }
};


/**
 * Expontentially increases the backoff time with some fuzziness.
 * @private
 */
BackendService.prototype.increaseBackoffTime_ = function() {
  if (this.backOffTime_ == 0) {
    this.backOffTime_ = tachyfont.BackendService.BACKOFF_TIME_INITIAL;
    return;
  }
  // Increase the backoff time by 2 with a fuzzyness of + or - 0.5.
  this.backOffTime_ *=
      tachyfont.BackendService.BACKOFF_TIME_BASE_GAIN + Math.random();
  if (this.backOffTime_ > tachyfont.BackendService.BACKOFF_TIME_MAX) {
    this.backOffTime_ = tachyfont.BackendService.BACKOFF_TIME_MAX;
  }
};


/**
 * Expontentially decreases the backoff time.
 * @private
 */
BackendService.prototype.decreaseBackoffTime_ = function() {
  this.backOffTime_ /= 2;
  if (this.backOffTime_ < tachyfont.BackendService.BACKOFF_TIME_INITIAL) {
    this.backOffTime_ = 0;
  }
};


/**
 * Async XMLHttpRequest to given url using given method, data and header
 *
 * @param {string} url Destination url
 * @param {!goog.net.XhrIo.ResponseType} responseType The response type.
 * @param {string} method Request method
 * @param {?string} postData Request data
 * @param {?Object} headers Request headers
 * @return {!goog.Promise<?,?>} Promise to return response
 * @private
 */
BackendService.prototype.requestUrl_ = function(
    url, responseType, method, postData, headers) {
  return new goog.Promise(function(resolve, reject) {
    var xhr = new goog.net.XhrIo();
    xhr.setResponseType(responseType);
    goog.events.listen(xhr, goog.net.EventType.COMPLETE, function(e) {
      if (xhr.isSuccess()) {
        this.decreaseBackoffTime_();
        resolve(xhr.getResponse());
      } else {
        this.increaseBackoffTime_();
        reject(xhr.getStatus() + ' ' + xhr.getStatusText());
      }
    }.bind(this));

    xhr.send(url, method, postData, headers);
  }, this);
};


/**
 * Gets the backoff time.
 * @return {number}
 */
BackendService.prototype.getBackoffTime = function() {
  return this.backOffTime_;
};


/**
 * Sets the backoff time.
 * @param {number} backoffTime The backoff time.
 */
BackendService.prototype.setBackoffTime = function(backoffTime) {
  this.backOffTime_ = backoffTime;
};


/**
 * Reports an error.
 * @param {!tachyfont.ErrorReport} errorReport The error report.
 */
BackendService.prototype.reportError = goog.functions.NULL;


/**
 * Reports an metric.
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 */
BackendService.prototype.reportMetric = goog.functions.NULL;


/**
 * Sends a log report.
 */
BackendService.prototype.sendReport = goog.functions.NULL;


/**
 * Sends the gen_204.
 * @param {!Array<string>} params The URL parameters.
 */
BackendService.prototype.sendGen204 = goog.functions.NULL;

});  // goog.scope
