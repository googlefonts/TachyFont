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


goog.provide('tachyfont.ErrorReport');



/**
 * The ErrorReport class contains a single error report.
 * @param {string} errorId The error identifier.
 * @param {string} fontId The font identifier.
 * @param {string} errorDetail The error details.
 * @constructor @struct @final
 */
tachyfont.ErrorReport = function(errorId, fontId, errorDetail) {
  // LINT.IfChange
  /**
   * The error identifier.
   * Note: this field name needs to match the proto's field name.
   * @type {string}
   */
  this.error_id = errorId;

  /**
   * The font identifier.
   * Note: this field name needs to match the proto's field name.
   * @type {string}
   */
  this.font_id = fontId;

  /**
   * Details about the error.
   * Note: this field name needs to match the proto's field name.
   * @type {string}
   */
  this.error_info = errorDetail;
  // LINT.ThenChange(//depot/google3/\
  //     google/internal/incrementalwebfonts/v1/tachyfont.proto)
};


/**
 * Gets the error id.
 * @return {string}
 */
tachyfont.ErrorReport.prototype.getErrorId = function() {
  return this.error_id;
};


/**
 * Gets the font id.
 * @return {string}
 */
tachyfont.ErrorReport.prototype.getFontId = function() {
  return this.font_id;
};


/**
 * Gets the error detail.
 * @return {string}
 */
tachyfont.ErrorReport.prototype.getErrorDetail = function() {
  return this.error_info;
};
