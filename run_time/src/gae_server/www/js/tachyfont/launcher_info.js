'use strict';

/**
 * @license
 * Copyright 2017 Google Inc. All rights reserved.
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

goog.provide('tachyfont.LauncherInfo');
goog.provide('tachyfont.LauncherTypedef');


/** @typedef {{
 *     startTime: number,
 *     DOMContentLoaded: boolean,
 *     DomMutationObserved: boolean,
 *     urls: !Object<string, string>
 * }} */
tachyfont.LauncherTypedef.Launcher;



/**
 * Manages the initial setup data.
 * @constructor
 */
tachyfont.LauncherInfo = function() {
  /** @type {?tachyfont.LauncherTypedef.Launcher} */
  this.launcher =
      window['tachyfont_launcher'] || window['tachyfontprelude'] || {};

  /**
   * The TachyFont start time. This is useful for overall speed testing. It is
   * more accurate to get this from the launcher code if that is available.
   * @private {number}
   */
  this.startTime_ = this.launcher['startTime'] || Date.now();

  /**
   * The font Blob URLs.
   * @private {!Object<string, string>}
   */
  this.urls_ = this.launcher['urls'] || {};

  /**
   * The launcher/prelude reports.
   * @private {!Array<!Array<string>>}
   */
  this.reports_ = this.launcher['reports'] || [];
};


/**
 * Gets the actual launcher value.
 * This is useful for testing.
 * @return {!Object|undefined}
 */
tachyfont.LauncherInfo.prototype.getActualLauncher = function() {
  return window['tachyfont_launcher'];
};


/**
 * Gets the actual prelude value.
 * This is useful for testing.
 * @return {!Object|undefined}
 */
tachyfont.LauncherInfo.prototype.getActualPrelude = function() {
  return window['tachyfontprelude'];
};


/**
 * Gets whether the initial setup saw a DOMContentLoaded event.
 * @return {boolean}
 */
tachyfont.LauncherInfo.prototype.getDomContentLoaded = function() {
  return !!this.launcher['DOMContentLoaded'];
};


/**
 * Gets whether the initial setup observed a DOM mutation.
 * @return {boolean}
 */
tachyfont.LauncherInfo.prototype.getDomMutationObserved = function() {
  return !!this.launcher['DomMutationObserved'];
};


/**
 * Gets the initial setup start time in milliseconds.
 * @return {number}
 */
tachyfont.LauncherInfo.prototype.getStartTime = function() {
  return this.startTime_;
};


/**
 * Gets the merged fontbase data (promise) if available.
 * @return {!Promise<?Uint8Array>}
 */
tachyfont.LauncherInfo.prototype.getMergedFontbasesBytes = function() {
  return this.launcher['mergedFontBases'] ||
      new Promise(function(resolve) {
           resolve(null);
         });
};


/**
 * Gets the launcher/prelude reports.
 * @return {!Array<!Array<string>>}
 */
tachyfont.LauncherInfo.prototype.getReports = function() {
  return this.reports_;
};


/**
 * Gets the font Blob URLs.
 * @param {string} fontId The font identifier.
 * @return {?string}
 */
tachyfont.LauncherInfo.prototype.getUrl = function(fontId) {
  return this.urls_[fontId] || null;
};


/**
 * Removes the launcher's mutation observer.
 */
tachyfont.LauncherInfo.prototype.disconnectMutationObserver = function() {
  if (this.launcher['mutationObserver']) {
    this.launcher['mutationObserver'].disconnect();
    this.launcher['mutationObserver'] = null;
  }
};


/**
 * Gets the XDelta3 decoder class if available.
 * @return {?Object}
 */
tachyfont.LauncherInfo.prototype.getXDeltaDecoder = function() {
  return window.XDelta3Decoder || window['XDelta3Decoder'] || null;
};
