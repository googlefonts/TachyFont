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

  /**
   * The duplicate items count;
   *
   * Useful when keeping duplicates separately.
   *
   * @private {!Object.<string, number>}
   */
  this.dupCnts_ = {};
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
 * @private {!tachyfont.Reporter}
 */
tachyfont.Reporter.instance_;


/**
 * Get the reporter singleton.
 *
 * @param {string} url The base URL to send reports to.
 * @return {!tachyfont.Reporter} The reporter singleton.
 */
tachyfont.Reporter.getReporter = function(url) {
  if (!tachyfont.Reporter.instance_) {
    tachyfont.Reporter.instance_ = new tachyfont.Reporter(url);
  }
  return tachyfont.Reporter.instance_;
};


/**
 * Add the time an item happened.
 *
 * @param {string} name The name of the item.
 * @param {number=} opt_roundTo Optionally round to this number.
 */
tachyfont.Reporter.prototype.addItemTime = function(name, opt_roundTo) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  // Round to the time to groups to make the graph more useful.
  if (typeof opt_roundTo == 'number' && opt_roundTo > 1) {
    deltaTime = Math.round(deltaTime / opt_roundTo) * opt_roundTo;
  }
  this.addItem(name, deltaTime);
};


/**
 * Add an item to report.
 *
 * @param {string} name The name of the item.
 * @param {string|number} value The value of the item.
 */
tachyfont.Reporter.prototype.addItem = function(name, value) {
  if (name in this.dupCnts_) {
    var dupCnt = this.dupCnts_[name] + 1;
    this.dupCnts_[name] = dupCnt;
    name += '.' + dupCnt;
  } else {
    this.dupCnts_[name] = 0;
  }

  if (typeof value == 'number') {
    value = Math.round(value);
  }
  this.items_[name] = value;
};


/**
 * Send an error report.
 *
 * @param {string} errNum The error number.
 * @param {string} id Identifying information.
 * @param {*} errInfo The error information.
 */
tachyfont.Reporter.prototype.reportError = function(errNum, id, errInfo) {
  // Move any pre-existing items aside.
  var preexistingItems = this.items_;
  this.items_ = {};
  var name = 'e.' + errNum + '.' + id;
  var msg = '';

  // Get the error message out of the error object.
  var value = '';
  if (typeof errInfo == 'string') {
    msg += errInfo + ', ';
  } else if (typeof errInfo == 'object') {
    if (errInfo['message']) {
      msg += errInfo['message'] + ', ';
    }
    if (errInfo['name']) {
      msg += errInfo['name'] + ', ';
    }
    if (errInfo['url']) {
      msg += errInfo['url'] + ', ';
    }
    if (errInfo['lineNumber']) {
      msg += errInfo['lineNumber'] + ', ';
    }
  }
  this.addItem(name, msg);
  this.sendReport();
  if (goog.DEBUG) {
    var keys = Object.keys(this.items_);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      name = keys[i];
      goog.log.error(tachyfont.logger, '    ' + name + ': ' +
          this.items_[name]);
    }
    // debugger; // Enable this when debugging the reporter.
  }

  // Restore any pre-existing items.
  this.items_ = preexistingItems;


};


/**
 * Send the report.
 *
 * @param {boolean=} opt_okIfNoItems Do not complain if not items.
 */
tachyfont.Reporter.prototype.sendReport = function(opt_okIfNoItems) {
  var keys = Object.keys(this.items_);
  keys.sort();
  if (keys.length == 0) {
    if (goog.DEBUG) {
      if (!opt_okIfNoItems) {
        goog.log.warning(tachyfont.logger, 'sendReport: no items');
      }
    }
    return;
  }

  var baseUrl = this.url_ + '/gen_204?id=tf&';
  var length = baseUrl.length;
  var items = [];
  if (goog.DEBUG) {
    goog.log.info(tachyfont.logger, 'report items:');
  }
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var value = encodeURIComponent((this.items_[name]).toString());
    delete this.items_[name];
    var item = encodeURIComponent(name) + '=' + value;
    if (length + item.length > 2000) {
      this.sendGen204_(baseUrl, items);
      length = baseUrl.length;
      items = [];
    }
    length += item.length;
    items.push(item);
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, '    ' + item);
    }
  }
  this.sendGen204_(baseUrl, items);
};


/**
 * Send the gen_204.
 *
 * @param {string} baseUrl The url to send the GET to.
 * @param {Array.<string>} params The URL parameters.
 * @private
 */
tachyfont.Reporter.prototype.sendGen204_ = function(baseUrl, params) {
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

