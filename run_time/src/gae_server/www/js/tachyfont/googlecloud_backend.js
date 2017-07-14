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

goog.provide('tachyfont.GoogleCloudBackend');

goog.require('goog.Promise');
goog.require('goog.crypt.base64');
goog.require('goog.json');
goog.require('goog.userAgent');
goog.require('tachyfont.BackendService');


goog.scope(function() {



/**
 * Handles interacting with the backend server.
 * @param {string} appName The application's name.
 * @param {string} baseUrl URL of the tachyfont server.
 * @constructor
 * @extends {tachyfont.BackendService}
 */
tachyfont.GoogleCloudBackend = function(appName, baseUrl) {
  tachyfont.GoogleCloudBackend.base(this, 'constructor', appName, baseUrl);

  /**
   * Send reports it they have been queued for a while. The reports are sent
   * even if the queued size is small.
   * @type {number}
   */
  this.timeoutId = 0;

  /**
   * The approximate status length.
   * @type {number}
   */
  this.statusLength = 0;

  /*
   * Setup an page beforeunload listener to send any queued status.
   */
  window.addEventListener('beforeunload', function() {
    this.handleSendingStatus(true);
  }.bind(this), false);
};
goog.inherits(tachyfont.GoogleCloudBackend, tachyfont.BackendService);
var GoogleCloudBackend = tachyfont.GoogleCloudBackend;


/**
 * The path to the character data API.
 * @type {string}
 */
GoogleCloudBackend.API_CHARACTER_DATA = '/v1/characterdata';


/**
 * The path to the put status API.
 * @type {string}
 */
GoogleCloudBackend.API_PUT_STATUS = '/v1/status:put';


/**
 * Send reports it they have been queued for this long.
 * @type {number}
 */
GoogleCloudBackend.REPORT_TIMEOUT_MILLISEC = 60000;


/**
 * Send reports whenever the size of the queued status is greater than this. The
 * reports are send even if they have not been queued very long.
 * @type {number}
 */
GoogleCloudBackend.MAX_STATUS_LENGTH = 5000;


/** @override */
GoogleCloudBackend.prototype.requestCodepoints = function(fontInfo, codes) {
  var that = this;
  var paramsObj = {};
  paramsObj['font_name'] = fontInfo.getFontFamily();
  paramsObj['weight'] = parseInt(fontInfo.getWeight(), 10);
  paramsObj['code_points'] = codes;
  var paramsJson = JSON.stringify(paramsObj);
  return this
      .requestUrl(
          this.baseUrl + GoogleCloudBackend.API_CHARACTER_DATA, 'text', 'POST',
          paramsJson, {'Content-Type': 'application/json'})
      .then(function(response) {
        var responseObject = goog.json.parse(response);
        var glyphDataUint8Array = goog.crypt.base64.decodeStringToUint8Array(
            responseObject['glyphData']);
        return that.parseDataHeader(glyphDataUint8Array.buffer);
      });
};


/** @override */
GoogleCloudBackend.prototype.requestFontBase = function(fontInfo) {
  // The Google Cloud backend does not support requestFontBase. Get it from
  // gstatic instead.
  return goog.Promise.reject(
      'requestFontBase not supported (use gstatic instead');
};


/**
 * Handles the sending status reports. The reports will be sent if the amount
 * queued is large or they have been queued for a long time.
 * @param {boolean} sendNow Whether to send the report immediately.
 */
GoogleCloudBackend.prototype.handleSendingStatus = function(sendNow) {
  if (this.statusLength >= GoogleCloudBackend.MAX_STATUS_LENGTH) {
    sendNow = true;
  }
  if (sendNow) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
    this.sendReports();
  } else if (!this.timeoutId) {
    this.timeoutId = setTimeout(function() {
      this.timeoutId = 0;
      this.sendReports();
    }.bind(this), GoogleCloudBackend.REPORT_TIMEOUT_MILLISEC);
  }
};


/**
 * Reports an error.
 * @override
 * @param {!tachyfont.ErrorReport} errorReport The error report.
 */
GoogleCloudBackend.prototype.reportError = function(errorReport) {
  this.errorReports.push(errorReport);
  this.statusLength += JSON.stringify(errorReport).length;
  this.handleSendingStatus(false);
};


/**
 * Reports an metric.
 * @override
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 */
GoogleCloudBackend.prototype.reportMetric = function(metricReport) {
  this.metricReports.push(metricReport);
  this.statusLength += JSON.stringify(metricReport).length;
  this.handleSendingStatus(false);
};


/**
 * Sends the queued metric/error reports.
 */
GoogleCloudBackend.prototype.sendReports = function() {
  if (!this.errorReports.length && !this.metricReports.length) {
    return;
  }
  var url = this.baseUrl + GoogleCloudBackend.API_PUT_STATUS;
  var putStatusRequestJson = this.buildPutStatusRequest();
  window.navigator.sendBeacon(url, putStatusRequestJson);
};


/**
 * Builds the TachyFont PutStatusRequest.
 * @return {string} The Json string.
 */
GoogleCloudBackend.prototype.buildPutStatusRequest = function() {
  var putStatusRequest = {};
  // LINT.IfChange
  putStatusRequest['app_name'] = this.appName;
  putStatusRequest['is_mobile'] = goog.userAgent.MOBILE ? true : false;
  if (this.errorReports.length) {
    putStatusRequest['error_report'] = this.errorReports;
    this.errorReports = [];
  }
  if (this.metricReports.length) {
    putStatusRequest['metric_report'] = this.metricReports;
    this.metricReports = [];
  }
  // LINT.ThenChange(//depot/google3/\
  //     google/internal/incrementalwebfonts/v1/tachyfont.proto)
  this.statusLength = 0;
  return JSON.stringify(putStatusRequest);
};

});  // goog.scope
