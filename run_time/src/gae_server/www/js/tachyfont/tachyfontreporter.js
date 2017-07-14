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

goog.provide('tachyfont.Reporter');

goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('tachyfont.ErrorReport');
goog.require('tachyfont.MetricReport');



/**
 * Singleton reporter.
 *
 * @param {!tachyfont.BackendService} backend The backend to use.
 * @param {string} url The base URL to send reports to.
 * @param {number} apiVersion The API version.
 * @constructor
 */
tachyfont.Reporter = function(backend, url, apiVersion) {

  /** @private {!tachyfont.BackendService} */
  this.backend_ = backend;
};


/**
 * The TachyFont start time.
 * This is as close to the user start time as possible. This is useful for
 * reporting how long after start time activities happened.
 *
 * @private {number} The milliseconds since midnight, January 1, 1970
 */
tachyfont.Reporter.startTime_ = goog.now();


/**
 * The TachyFont Reporter singleton object.
 * @private {?tachyfont.Reporter}
 */
tachyfont.Reporter.instance_ = null;


/**
 * Gets the reporter instance.
 * @return {?tachyfont.Reporter}
 */
tachyfont.Reporter.getInstance = function() {
  return tachyfont.Reporter.instance_;
};


/**
 * Sets the reporter instance.
 * @param {?tachyfont.Reporter} instance The reporter instance
 */
tachyfont.Reporter.setInstance = function(instance) {
  tachyfont.Reporter.instance_ = instance;
};


/**
 * Initializes the reporter singleton.
 * @param {!tachyfont.BackendService} backend The backend to use.
 * @param {string} url The base URL to send reports to.
 * @param {number} apiVersion The API version.
 */
tachyfont.Reporter.initReporter = function(backend, url, apiVersion) {
  if (tachyfont.Reporter.instance_ == null) {
    tachyfont.Reporter.instance_ =
        new tachyfont.Reporter(backend, url, apiVersion);
  }
};


/**
 * Resets the reporter singleton.
 */
tachyfont.Reporter.reset = function() {
  tachyfont.Reporter.instance_ = null;
};


/**
 * Gets the logger.
 * @return {?goog.debug.Logger}
 */
tachyfont.Reporter.getErrorLogger = function() {
  if (!tachyfont.Reporter.errorLogger) {
    tachyfont.Reporter.errorLogger =
        goog.log.getLogger('tachyfont-error', goog.log.Level.INFO);
  }
  return tachyfont.Reporter.errorLogger;
};


/**
 * Adds the time an item happened.
 * @param {string} errorId The name of the item.
 * @param {string} fontId The font identifier.
 */
tachyfont.Reporter.addItemTime = function(errorId, fontId) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  tachyfont.Reporter.addItem(errorId, fontId, deltaTime);
};


/**
 * Adds an item to report.
 * @param {string} errorId The name of the item.
 * @param {string} fontId The font identifier.
 * @param {number} value The value of the item.
 */
tachyfont.Reporter.addItem = function(errorId, fontId, value) {
  var metricReport = new tachyfont.MetricReport(errorId, fontId, value);
  tachyfont.Reporter.addItem_(metricReport);
};


/**
 * Adds an item to report.
 * @param {!tachyfont.MetricReport} metricReport The metric report.
 * @private
 */
// TODO(bstell): move this into the backend code so it can be backend specific.
tachyfont.Reporter.addItem_ = function(metricReport) {
  tachyfont.Reporter.instance_.backend_.reportMetric(metricReport);
};


/**
 * Sends an error report.
 * @param {string} errorId The error id.
 * @param {string} fontId Font identifying information.
 * @param {*} errInfo The error information.
 */
tachyfont.Reporter.reportError = function(errorId, fontId, errInfo) {
  goog.log.error(tachyfont.Reporter.getErrorLogger(), errorId + '.' + fontId);

  if (tachyfont.Reporter.instance_ == null) {
    return;
  }

  var msg = '';
  // Get the error message out of the error object.
  if (typeof errInfo == 'string') {
    msg += errInfo;
  } else if (typeof errInfo == 'object') {
    if (errInfo['message']) {
      msg += errInfo['message'];
    }
    if (errInfo['name']) {
      if (msg) {
        msg += ', ';
      }
      msg += errInfo['name'] + ', ';
    }
    if (errInfo['url']) {
      if (msg) {
        msg += ', ';
      }
      msg += errInfo['url'] + ', ';
    }
    if (errInfo['lineNumber']) {
      if (msg) {
        msg += ', ';
      }
      msg += errInfo['lineNumber'] + ', ';
    }
    // e.target.error.name
    if (errInfo['target']) {
      var target = errInfo['target'];
      if (target['error']) {
        var error = target['error'];
        if (error['name']) {
          if (msg) {
            msg += ', ';
          }
          msg += error['name'] + ', ';
        }
      }
      if (target['source']) {
        var source = target['source'];
        if (source['name']) {
          if (msg) {
            msg += ', ';
          }
          msg += source['name'] + ', ';
        }
      }
    }
  }
  var errorReport = new tachyfont.ErrorReport(errorId, fontId, msg);
  tachyfont.Reporter.instance_.backend_.reportError(errorReport);
};


/**
 * Sends a log report.
 */
tachyfont.Reporter.sendReport = function() {
  tachyfont.Reporter.instance_.backend_.sendReport();
};
