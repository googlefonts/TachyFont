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


goog.provide('tachyfont.MetricReport');



/**
 * The MetricReport class contains a single metric report.
 * @param {string} metricId The metric identifier.
 * @param {string} fontId The font identifier.
 * @param {number} metricValue The metric value. This will be rounded.
 * @constructor @struct @final
 */
tachyfont.MetricReport = function(metricId, fontId, metricValue) {
  /**
   * The metric identifier.
   * @private {string}
   */
  this.metricId_ = metricId;

  /**
   * The font identifier.
   * @private {string}
   */
  this.fontId_ = fontId;

  /**
   * The metric value.
   * @private {number}
   */
  this.metricValue_ = Math.round(metricValue);

};


/**
 * Gets the metric id.
 * @return {string}
 */
tachyfont.MetricReport.prototype.getMetricId = function() {
  return this.metricId_;
};


/**
 * Gets the font id.
 * @return {string}
 */
tachyfont.MetricReport.prototype.getFontId = function() {
  return this.fontId_;
};


/**
 * Gets the metric value.
 * @return {number}
 */
tachyfont.MetricReport.prototype.getMetricValue = function() {
  return this.metricValue_;
};
