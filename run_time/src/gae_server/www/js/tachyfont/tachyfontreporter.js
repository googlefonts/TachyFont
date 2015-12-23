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
goog.require('tachyfont.Logger');



/**
 * Singleton reporter.
 *
 * @param {string} url The base URL to send reports to.
 * @constructor
 */
tachyfont.Reporter = function(url) {

  /** @private {string} */
  this.url_ = url;

  /** @private {!Object.<string, (number|string)>} */
  this.items_ = {};
};


/**
 * TachyFont start time.
 *
 * This is as close to the user start time as possible. This is useful for
 * reporting how long after start time activities happened.
 *
 * @private {number} The milliseconds since midnight, January 1, 1970
 */
tachyfont.Reporter.startTime_ = goog.now();


/**
 * TachyFont singleton object.
 *
 * @private {tachyfont.Reporter}
 */
tachyfont.Reporter.instance_ = null;


/**
 * Indicated is the reporter has been intialized.
 * @return {boolean} Whether the reporter has been initialized.
 */
tachyfont.Reporter.isReady = function() {
  return tachyfont.Reporter.instance_ != null;
};


/**
 * Initialize the reporter singleton.
 * @param {string} url The base URL to send reports to.
 */
tachyfont.Reporter.initReporter = function(url) {
  if (tachyfont.Reporter.instance_ == null) {
    tachyfont.Reporter.instance_ = new tachyfont.Reporter(url);
  }
};


/**
 * Reset the reporter singleton.
 */
tachyfont.Reporter.reset = function() {
  tachyfont.Reporter.instance_ = null;
};


/**
 * Add the time an item happened.
 *
 * @param {string} name The name of the item.
 */
tachyfont.Reporter.addItemTime = function(name) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  tachyfont.Reporter.addItem(name, deltaTime);
};


/**
 * Add an item to report.
 *
 * @param {string} name The name of the item.
 * @param {string|number} value The value of the item.
 */
tachyfont.Reporter.addItem = function(name, value) {
  if (typeof value == 'number') {
    value = Math.round(value);
  }
  tachyfont.Reporter.instance_.items_[name] = value;
};


/**
 * Send an error report.
 *
 * @param {string} errNum The error number.
 * @param {string} id Identifying information.
 * @param {*} errInfo The error information.
 */
tachyfont.Reporter.reportError = function(errNum, id, errInfo) {
  // Move any pre-existing items aside.
  var preexistingItems = tachyfont.Reporter.instance_.items_;
  tachyfont.Reporter.instance_.items_ = {};
  var name = errNum + '.' + id;
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
  }
  tachyfont.Reporter.addItem(name, msg);
  if (goog.DEBUG) {
    var keys = Object.keys(tachyfont.Reporter.instance_.items_);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      name = keys[i];
      goog.log.error(tachyfont.Logger.logger, '    ' + name + ': ' +
          tachyfont.Reporter.instance_.items_[name]);
    }
    // debugger; // Enable this when debugging the reporter.
  }
  tachyfont.Reporter.sendReport();

  // Restore any pre-existing items.
  tachyfont.Reporter.instance_.items_ = preexistingItems;


};


/**
 * Send the report.
 *
 * @param {boolean=} opt_okIfNoItems Do not complain if not items.
 */
tachyfont.Reporter.sendReport = function(opt_okIfNoItems) {
  var keys = Object.keys(tachyfont.Reporter.instance_.items_);
  keys.sort();
  if (keys.length == 0) {
    if (goog.DEBUG) {
      if (!opt_okIfNoItems) {
        goog.log.warning(tachyfont.Logger.logger, 'sendReport: no items');
      }
    }
    return;
  }

  var baseUrl = tachyfont.Reporter.instance_.url_ + '/gen_204?id=tf&';
  var length = baseUrl.length;
  var items = [];
  if (goog.DEBUG) {
    goog.log.info(tachyfont.Logger.logger, 'report items:');
  }
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var value = encodeURIComponent(
        (tachyfont.Reporter.instance_.items_[name]).toString());
    delete tachyfont.Reporter.instance_.items_[name];
    var item = encodeURIComponent(name) + '=' + value;
    if (length + item.length > 2000) {
      tachyfont.Reporter.sendGen204_(baseUrl, items);
      length = baseUrl.length;
      items = [];
    }
    length += item.length;
    items.push(item);
    if (goog.DEBUG) {
      goog.log.info(tachyfont.Logger.logger, '    ' + item);
    }
  }
  tachyfont.Reporter.sendGen204_(baseUrl, items);
};


/**
 * Send the gen_204.
 *
 * @param {string} baseUrl The url to send the GET to.
 * @param {Array.<string>} params The URL parameters.
 * @private
 */
tachyfont.Reporter.sendGen204_ = function(baseUrl, params) {
  var reportUrl = baseUrl + params.join('&');
  var image = new Image();
  image.onload = image.onerror = tachyfont.Reporter.cleanUpFunc_(image);
  image.src = reportUrl;
};


/**
 * Clear references off the Image so it can be garbage collected.
 * @private
 * @param {!Image} image The image to clean up.
 * @return {!function()} Function that cleans up the image.
 */
tachyfont.Reporter.cleanUpFunc_ = function(image) {
  return function() {
    image.onload = image.onerror = null;
  };
};

