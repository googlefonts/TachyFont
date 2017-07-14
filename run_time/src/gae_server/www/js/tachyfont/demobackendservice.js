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

goog.provide('tachyfont.DemoBackendService');

goog.require('goog.userAgent');
goog.require('tachyfont.BackendService');


goog.scope(function() {



/**
 * Handles interacting with the backend server.
 *
 * @param {string} baseUrl of the backend server.
 * @constructor
 * @extends {tachyfont.BackendService}
 */
tachyfont.DemoBackendService = function(baseUrl) {
  tachyfont.DemoBackendService.base(this, 'constructor', baseUrl);
};
goog.inherits(tachyfont.DemoBackendService, tachyfont.BackendService);
var DemoBackendService = tachyfont.DemoBackendService;


/**
 * The gen204 path.
 * @type {string}
 */
DemoBackendService.REPORTER_PATH = '/gen_204?id=tf&';


/** @override */
DemoBackendService.prototype.requestCodepoints = function(fontInfo, codes) {
  var that = this;
  var params = 'fontName=' + fontInfo.getFontFamily() +
      '&weight=' + fontInfo.getWeight() + '&codepoints=' + codes.join(',');
  return this
      .requestUrl(
          this.baseUrl + '/characterdata', 'arraybuffer', 'POST', params,
          {'Content-Type': 'application/x-www-form-urlencoded'})
      .then(function(glyphData) {
        return that.parseDataHeader(glyphData);
      });
};


/** @override */
DemoBackendService.prototype.requestFontBase = function(fontInfo) {
  var url = this.baseUrl + '/fontbase?fontname=' + fontInfo.getFontFamily() +
      '&' +
      'weight=' + fontInfo.getWeight();
  return this.requestUrl(url, 'arraybuffer', 'GET', null, {});
};


/** @override */
DemoBackendService.prototype.log = function(message) {
};


/**
 * Reports an error.
 * @override
 * @param {!tachyfont.ErrorReport} errorReport The error report.
 */
DemoBackendService.prototype.reportError = function(errorReport) {
  var name = errorReport.getErrorId() + '.' + errorReport.getFontId();
  var params = [];
  params.push(
      tachyfont.BackendService.Param.REPORT_TYPE + '=' +
      tachyfont.BackendService.Param.ERROR_TYPE);
  params.push(
      tachyfont.BackendService.Param.ERROR_ID + '=' + errorReport.getErrorId());
  params.push(
      tachyfont.BackendService.Param.FONT_ID + '=' + errorReport.getFontId());
  params.push(
      tachyfont.BackendService.Param.MOBILE + '=' +
      (goog.userAgent.MOBILE ? '1' : '0'));
  params.push(name + '=' + errorReport.getErrorDetail());
  this.sendGen204(params);
};


/**
 * Reports a metric.
 * @override
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 */
DemoBackendService.prototype.reportMetric = function(metricReport) {
  this.metricReports.push(metricReport);
};


/**
 * Sends a set of log reports.
 * @override
 */
DemoBackendService.prototype.sendReport = function() {
  if (this.metricReports.length == 0) {
    return;
  }
  this.metricReports.sort(function(a, b) {
    if (a.getMetricId() > b.getMetricId()) {
      return 1;
    } else if (a.getFontId() > b.getFontId()) {
      return 1;
    }
    return -1;
  });

  var reportUrl = this.baseUrl + DemoBackendService.REPORTER_PATH;
  var length = reportUrl.length;
  var items = [];
  var item = tachyfont.BackendService.Param.REPORT_TYPE + '=' +
      tachyfont.BackendService.Param.LOG_TYPE;
  length += item.length;
  items.push(item);

  item = tachyfont.BackendService.Param.MOBILE + '=' +
      (goog.userAgent.MOBILE ? '1' : '0');
  length += item.length;
  items.push(item);
  while (this.metricReports.length > 0) {
    var report = this.metricReports.shift();
    var name = report.getMetricId() + '.' + report.getFontId();
    var value = report.getMetricValue().toString(10);
    item = encodeURIComponent(name) + '=' + value;
    if (length + item.length > 2000) {
      this.metricReports.unshift(report);
      this.sendGen204(items);
      this.sendReport();
      return;
    }
    length += item.length;
    items.push(item);
  }
  this.sendGen204(items);
};


/**
 * Sends the gen_204.
 * @param {!Array<string>} params The URL parameters.
 * @override
 */
DemoBackendService.prototype.sendGen204 = function(params) {
  var reportUrl =
      this.baseUrl + DemoBackendService.REPORTER_PATH + params.join('&');
  var image = new Image();
  image.onload = image.onerror = DemoBackendService.cleanUpFunc_(image);
  image.src = reportUrl;
};


/**
 * Clears references off the Image so it can be garbage collected.
 * @param {!Image} image The image to clean up.
 * @return {!function()} Function that cleans up the image.
 * @private
 */
DemoBackendService.cleanUpFunc_ = function(image) {
  return function() {
    image.onload = image.onerror = null;
  };
};

});  // goog.scope
