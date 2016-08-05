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

goog.provide('tachyfont.FontsInfo');

/** @suppress {extraRequire} */
goog.require('tachyfont.FontInfo');



/**
 * Holds the information for a set of fonts.
 * @param {!Array<!tachyfont.FontInfo>} fonts .
 * @param {?string} dataUrl The URL of the Tachyfont server.
 * @param {?string} reportUrl The URL to send logging/error reports to.
 * @constructor
 */
tachyfont.FontsInfo = function(fonts, dataUrl, reportUrl) {
  var priorityFonts = [];
  var nonPriorityFonts = [];
  // Sort the priority fonts to the front of the list.
  for (var i = 0; i < fonts.length; i++) {
    var font = fonts[i];
    if (font.getPriority()) {
      priorityFonts.push(font);
    } else {
      nonPriorityFonts.push(font);
    }
  }
  /** @private {!Array<!tachyfont.FontInfo>} */
  this.prioritySortedFonts_ = priorityFonts.concat(nonPriorityFonts);

  /** @private {string} */
  this.dataUrl_ = dataUrl || '';

  /** @private {string} */
  this.reportUrl_ = reportUrl || '';
};


/**
 * Gets the list of information on the TachyFonts.
 * @return {!Array<!tachyfont.FontInfo>} The URL to the TachyFont server.
 */
tachyfont.FontsInfo.prototype.getPrioritySortedFonts = function() {
  return this.prioritySortedFonts_;
};


/**
 * Gets the URL to the TachyFont.
 * @return {string} The URL to the TachyFont server.
 */
tachyfont.FontsInfo.prototype.getDataUrl = function() {
  return this.dataUrl_;
};


/**
 * Sets the URL to the TachyFont.
 * @param {string} url The URL to the TachyFont server.
 */
tachyfont.FontsInfo.prototype.setDataUrl = function(url) {
  this.dataUrl_ = url;
};


/**
 * Gets the URL to the TachyFont.
 * @return {string} The URL to send logging/error reports to.
 */
tachyfont.FontsInfo.prototype.getReportUrl = function() {
  return this.reportUrl_;
};


/**
 * Sets the URL to the TachyFont.
 * @param {string} url The URL to send logging/error reports to.
 */
tachyfont.FontsInfo.prototype.setReportUrl = function(url) {
  this.reportUrl_ = url;
};


goog.scope(function() {
goog.exportSymbol('tachyfont.FontsInfo', tachyfont.FontsInfo);
goog.exportProperty(tachyfont.FontsInfo.prototype, 'getDataUrl',
                    tachyfont.FontsInfo.prototype.getDataUrl);
goog.exportProperty(tachyfont.FontsInfo.prototype, 'getReportUrl',
                    tachyfont.FontsInfo.prototype.getReportUrl);
});  // goog.scope

