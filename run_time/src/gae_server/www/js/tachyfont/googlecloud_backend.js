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
};
goog.inherits(tachyfont.GoogleCloudBackend, tachyfont.BackendService);
var GoogleCloudBackend = tachyfont.GoogleCloudBackend;


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
          this.baseUrl + '/characterdata', 'text', 'POST', paramsJson,
          {'Content-Type': 'application/json'})
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
 * Reports an error.
 * @override
 * @param {!tachyfont.ErrorReport} errorReport The error report.
 */
GoogleCloudBackend.prototype.reportError = function(errorReport) {
  this.errorReports.push(errorReport);
};


/**
 * Reports an metric.
 * @override
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 */
GoogleCloudBackend.prototype.reportMetric = function(metricReport) {
  this.metricReports.push(metricReport);
};


/**
 * Sends the queued metric/error reports.
 */
GoogleCloudBackend.prototype.sendReports = function() {
  if (!this.errorReports.length && !this.metricReports.length) {
    return;
  }
  var url = this.baseUrl + '/v1/status:put';
  var putStatusRequestJson = this.buildPutStatusRequest();
  window.navigator.sendBeacon(url, putStatusRequestJson);
};


/**
 * Builds the TachyFont PutStatusRequest.
 * @return {string} The Json string.
 */
GoogleCloudBackend.prototype.buildPutStatusRequest = function() {
  var putStatusRequest = {};
  putStatusRequest['app_name'] = this.appName;
  putStatusRequest['is_mobile'] = goog.userAgent.MOBILE ? true : false;
  if (this.errorReports.length) {
    putStatusRequest['error_reports'] = this.errorReports;
    this.errorReports = [];
  }
  if (this.metricReports.length) {
    putStatusRequest['metric_reports'] = this.metricReports;
    this.metricReports = [];
  }
  return JSON.stringify(putStatusRequest);
};

});  // goog.scope
