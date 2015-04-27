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
 * TachyFont report time chunking.
 *
 * Cluster the report timing into fewer columns. The report timing is to the
 * millisecond. Using millisecons means a graph covering 3 seconds would have
 * 3000 columns. Instead, round the times to this unit.
 *
 * @private {number}
 */
tachyfont.Reporter.clusterUnit_ = 50;


/**
 * Get the reporter singleton.
 *
 * @param {string} url The base URL to send reports to.
 * @return {!tachyfont.Reporter} The reporter singleton.
 */
tachyfont.Reporter.getReporter = function(url) {
  if (goog.DEBUG) {
    if (tachyfont.Reporter.instance_ &&
        tachyfont.Reporter.instance_.url_ != url) {
      debugger;
    }
  }
  if (!tachyfont.Reporter.instance_) {
    tachyfont.Reporter.instance_ = new tachyfont.Reporter(url);
  }
  return tachyfont.Reporter.instance_;
};


/**
 * Add the time an item happened.
 *
 * @param {string} name The name of the item.
 */
tachyfont.Reporter.prototype.addItemTime = function(name) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  // Round to the time to groups to make the graph more useful.
  deltaTime = Math.round(deltaTime / tachyfont.Reporter.clusterUnit_) *
      tachyfont.Reporter.clusterUnit_;
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
  var name = 'e.' + errNum;
  this.addItem(name, '');
  this.addItem(name + '.id', id);

  // Get the error message out of the error object.
  var value = '';
  if (typeof errInfo == 'string') {
    this.addItem(name + '.' + 'msg', errInfo);
  } else if (typeof errInfo == 'object') {
    if (errInfo['stack']) {
      this.addItem(name + '.' + 'stack', errInfo['stack']);
    } else if (errInfo['message']) {
      this.addItem(name + '.' + 'message', errInfo['message']);
    } else if (errInfo['name']) {
      this.addItem(name + '.' + 'name', errInfo['name']);
    }
    if (errInfo['url']) {
      this.addItem(name + '.' + 'url', errInfo['url']);
    }
    if (errInfo['lineNumber']) {
      value = errInfo['lineNumber'];
      this.addItem(name + '.' + 'lineNumber', value);
    }
  }
  this.sendReport();
  if (goog.DEBUG) {
    var keys = Object.keys(this.items_);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      name = keys[i];
      goog.log.error(tachyfont.logger, '    ' + name + ': ' +
          this.items_[name]);
    }
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
        debugger;
      }
    }
    return;
  }
  if (goog.DEBUG) {
    if (!this.url_) {
      goog.log.error(tachyfont.logger, 'sendReport: URL not set');
      debugger;
      return;
    }
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
    var item = name + '=' + value;
    if (length + item.length > 2000) {
      items.push('truncated=true');
      break;
    }
    length += item.length;
    items.push(item);
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, '    ' + item);
    }
  }
  var reportUrl = baseUrl + items.join('&');
  var image = new Image();
  image.onload = image.onerror = tachyfont.Reporter.cleanUpFunc_(image);
  image.src = reportUrl;

  // Clean out the old items.
  this.items_ = {};
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

