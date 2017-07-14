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

goog.require('goog.userAgent');
goog.require('tachyfont.BackendService');
/** @suppress {extraRequire} */
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


/**
 * The metric/error reporting path.
 * @type {string}
 */
GoogleBackendService.REPORTER_PATH = '/gen_204?id=tf&';


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
  return this
      .requestUrl(
          this.getDataUrl(
              fontInfo, GoogleBackendService.GLYPHS_REQUEST_PREFIX,
              GoogleBackendService.GLYPHS_REQUEST_SUFFIX),
          'arraybuffer', 'POST',
          'glyphs=' + encodeURIComponent(this.compressedGlyphsList_(codes)),
          {'Content-Type': 'application/x-www-form-urlencoded'})
      .then(function(glyphData) {
        return self.parseDataHeader(glyphData);
      });
};


/** @override */
GoogleBackendService.prototype.requestFontBase = function(fontInfo) {
  return this.requestUrl(
      this.getDataUrl(
          fontInfo, GoogleBackendService.FRAMEWORK_REQUEST_PREFIX,
          GoogleBackendService.FRAMEWORK_REQUEST_SUFFIX),
      'arraybuffer', 'GET', null, {});
};


/**
 * Reports an error.
 * @override
 * @param {!tachyfont.ErrorReport} errorReport The error report.
 */
GoogleBackendService.prototype.reportError = function(errorReport) {
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
  this.sendBeacon(params);
};


/**
 * Reports a metric.
 * @override
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 */
GoogleBackendService.prototype.reportMetric = function(metricReport) {
  this.metricReports.push(metricReport);
};


/**
 * Sends a set of log reports.
 * @override
 */
GoogleBackendService.prototype.flushLogs = function() {
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

  var reportUrl = this.baseUrl + GoogleBackendService.REPORTER_PATH;
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
      this.sendBeacon(items);
      this.flushLogs();
      return;
    }
    length += item.length;
    items.push(item);
  }
  this.sendBeacon(items);
};


/**
 * @param {!tachyfont.FontInfo} fontInfo containing info on the font; ie:
 *     fontkit, familyPath = the font's directory; ie. "notosansjapanese", and
 *     name = Unique name for this particular instance of the font
 *     (style/weight) ie. "notosans100".
 * @param {string} prefix Action prefix in the URL.
 * @param {string} suffix Action suffset in the URL.
 * @return {string} URL for the specified font action.
 */
GoogleBackendService.prototype.getDataUrl =
    function(fontInfo, prefix, suffix) {
  var familyPath = fontInfo.getFamilyPath();
  if (!familyPath) {
    // Using familyPath is preferred over cssFontFamily.
    familyPath = fontInfo.getCssFontFamily().replace(/ /g, '').toLowerCase();
  }
  return this.baseUrl + '/' + prefix + '/' +
      'p' + tachyfont.BackendService.PROTOCOL_MAJOR_VERSION +
      '/' + familyPath + '/' + fontInfo.getVersion() + '/' +
      fontInfo.getFontKit() + '.' + suffix;
};


/**
 * @private
 * @param {!Array<number>} codes list of code points to compress.
 * @return {string} compressed code point list.
 */
GoogleBackendService.prototype.compressedGlyphsList_ = function(codes) {
  var result = '';
  for (var i = 0; i < codes.length; i++) {
    var cp = codes[i];
    if (cp != 45) {  // Dash
      result = result + tachyfont.utils.stringFromCodePoint(cp);
    } else {
      // Dash is a special character in the compressed glyph list and must
      // be at the start of the string.
      result = '-' + result;
    }
  }
  return result;
};


/**
 * Sends the metrics/error report to a url that returns 204.
 * @param {!Array<string>} params The URL parameters.
 * @override
 */
GoogleBackendService.prototype.sendBeacon = function(params) {
  var reportUrl =
      this.baseUrl + GoogleBackendService.REPORTER_PATH + params.join('&');
  var image = new Image();
  image.onload = image.onerror = GoogleBackendService.cleanUpFunc_(image);
  image.src = reportUrl;
};


/**
 * Clears references off the Image so it can be garbage collected.
 * @param {!Image} image The image to clean up.
 * @return {!function()} Function that cleans up the image.
 * @private
 */
GoogleBackendService.cleanUpFunc_ = function(image) {
  return function() {
    image.onload = image.onerror = null;
  };
};

});  // goog.scope
