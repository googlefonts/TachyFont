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

goog.provide('tachyfont.PreludeInfo');



/**
 * Manages the initial setup data.
 * @constructor
 */
tachyfont.PreludeInfo = function() {
  /** {!Object} */
  this.tachyfontprelude = window['tachyfontprelude'] || {};

  /**
   * The TachyFont start time. This is useful for overall speed testing. It is
   * more accurate to get this from the prelude code if that is available.
   * @private {number}
   */
  this.startTime_ = this.tachyfontprelude['startTime'] || Date.now();

};


/**
 * Gets the actual tachyfontprelude value.
 * This is useful for testing.
 * @return {!Object|undefined}
 */
tachyfont.PreludeInfo.prototype.getActualPrelude = function() {
  return window['tachyfontprelude'];
};


/**
 * Gets whether the initial setup saw a DOMContentLoaded event.
 * @return {boolean}
 */
tachyfont.PreludeInfo.prototype.getDomContentLoaded = function() {
  return !!this.tachyfontprelude['DOMContentLoaded'];
};


/**
 * Gets whether the initial setup observed a DOM mutation.
 * @return {boolean}
 */
tachyfont.PreludeInfo.prototype.getDomMutationObserved = function() {
  return !!this.tachyfontprelude['DomMutationObserved'];
};


/**
 * Gets the initial setup start time in milliseconds.
 * @return {number}
 */
tachyfont.PreludeInfo.prototype.getStartTime = function() {
  return this.startTime_;
};


/**
 * Gets the merged fontbase data (promise) if available.
 * @return {?Promise<Uint8Array>}
 */
tachyfont.PreludeInfo.prototype.getMergedFontbasesBytes = function() {
  var tachyfont_loader = window['tachyfont_loader'] || {};
  return tachyfont_loader['mergedFontBases'] || null;
};


/**
 * Gets the XDelta3 decoder class if available.
 * @return {?Object}
 */
tachyfont.PreludeInfo.prototype.getXDeltaDecoder = function() {
  return window.XDelta3Decoder || window['XDelta3Decoder'] || null;
};
