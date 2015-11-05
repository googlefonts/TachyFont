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

goog.require('tachyfont.FontInfo');



/**
 * The information for a set of fonts.
 *
 * @param {!Array.<tachyfont.FontInfo>} fonts .
 * @param {?string} dataUrl The URL of the Tachyfont server.
 * @param {?string} reportUrl The URL to send logging/error reports to.
 * @constructor
 */
tachyfont.FontsInfo = function(fonts, dataUrl, reportUrl) {
  /** @private {!Array.<tachyfont.FontInfo>} */
  this.fonts_ = fonts;

  /** @private {string} */
  this.dataUrl_ = dataUrl || '';

  /** @private {string} */
  this.reportUrl_ = reportUrl || '';
};


/**
 * Get the list of information on the TachyFonts.
 *
 * @return {Array.<tachyfont.FontInfo>} The URL to the TachyFont server.
 */
tachyfont.FontsInfo.prototype.getFonts = function() {
  return this.fonts_;
};


/**
 * Get the URL to the TachyFont.
 *
 * @return {string} The URL to the TachyFont server.
 */
tachyfont.FontsInfo.prototype.getDataUrl = function() {
  return this.dataUrl_;
};


/**
 * Get the URL to the TachyFont.
 *
 * @return {string} The URL to send logging/error reports to.
 */
tachyfont.FontsInfo.prototype.getReportUrl = function() {
  return this.reportUrl_;
};


goog.scope(function() {
goog.exportSymbol('tachyfont.FontsInfo', tachyfont.FontsInfo);
goog.exportProperty(tachyfont.FontsInfo.prototype, 'getFonts',
                    tachyfont.FontsInfo.prototype.getFonts);
goog.exportProperty(tachyfont.FontsInfo.prototype, 'getDataUrl',
                    tachyfont.FontsInfo.prototype.getDataUrl);
goog.exportProperty(tachyfont.FontsInfo.prototype, 'getReportUrl',
                    tachyfont.FontsInfo.prototype.getReportUrl);
});  // goog.scope

