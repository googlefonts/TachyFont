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
 * @constructor @final
 */
tachyfont.MetricReport = function(metricId, fontId, metricValue) {
  // LINT.IfChange
  /**
   * The metric identifier.
   * Note: this field name needs to match the proto's field name.
   * @type {string}
   */
  this['metric_id'] = metricId;

  /**
   * The font identifier.
   * Note: this field name needs to match the proto's field name.
   * @type {string}
   */
  this['font_id'] = fontId;

  /**
   * The metric value.
   * Note: this field name needs to match the proto's field name.
   * @type {number}
   */
  this['value'] = Math.round(metricValue);
  // LINT.ThenChange(//depot/google3/\
  //     google/internal/incrementalwebfonts/v1/tachyfont.proto)
};


/**
 * Gets the metric id.
 * @return {string}
 */
tachyfont.MetricReport.prototype.getMetricId = function() {
  return this['metric_id'];
};


/**
 * Gets the font id.
 * @return {string}
 */
tachyfont.MetricReport.prototype.getFontId = function() {
  return this['font_id'];
};


/**
 * Gets the metric value.
 * @return {number}
 */
tachyfont.MetricReport.prototype.getMetricValue = function() {
  return this['value'];
};
