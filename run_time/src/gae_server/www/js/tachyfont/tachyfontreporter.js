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

goog.require('goog.userAgent');
goog.require('tachyfont.log');



/**
 * Singleton reporter.
 *
 * @param {string} url The base URL to send reports to.
 * @constructor
 */
tachyfont.Reporter = function(url) {

  /** @private {string} */
  this.url_ = url;

  /** @private {!Object<string, (number|string)>} */
  this.items_ = {};
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
 * @param {string} url The base URL to send reports to.
 */
tachyfont.Reporter.initReporter = function(url) {
  if (tachyfont.Reporter.instance_ == null) {
    tachyfont.Reporter.instance_ = new tachyfont.Reporter(url);
  }
};


/**
 * Resets the reporter singleton.
 */
tachyfont.Reporter.reset = function() {
  tachyfont.Reporter.instance_ = null;
};


/**
 * Adds the time an item happened.
 * @param {string} name The name of the item.
 */
tachyfont.Reporter.addItemTime = function(name) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  tachyfont.Reporter.addItem(name, deltaTime);
};


/**
 * Adds an item to report.
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
 * Sends an error report.
 * @param {string} errNum The error number.
 * @param {string} id Identifying information.
 * @param {*} errInfo The error information.
 */
tachyfont.Reporter.reportError = function(errNum, id, errInfo) {
  if (tachyfont.Reporter.instance_ == null) {
    // Failed to report the error.
    if (goog.DEBUG) {
      tachyfont.log.severe(
          'failed to report error: errNum = ' + errNum + ', id = ' + id +
          ', errInfo = ' + errInfo);
    }
    return;
  }

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
    if (goog.DEBUG) {
      if (!msg) {
        debugger;
        tachyfont.log.severe('unsupported error object');
      }
    }
  }
  tachyfont.Reporter.addItem(name, msg);
  if (goog.DEBUG) {
    var keys = Object.keys(tachyfont.Reporter.instance_.items_);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      name = keys[i];
    }
  }
  tachyfont.Reporter.sendReport();

  // Restore any pre-existing items.
  tachyfont.Reporter.instance_.items_ = preexistingItems;


};


/**
 * Sends the report.
 */
tachyfont.Reporter.sendReport = function() {
  var keys = Object.keys(tachyfont.Reporter.instance_.items_);
  keys.sort();
  if (keys.length == 0) {
    return;
  }

  var baseUrl = tachyfont.Reporter.instance_.url_ + '/gen_204?id=tf&';
  var length = baseUrl.length;
  var items = [];
  var item = 'm=' + (goog.userAgent.MOBILE ? '1' : '0');
  length += item.length;
  items.push(item);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var value = encodeURIComponent(
        (tachyfont.Reporter.instance_.items_[name]).toString());
    delete tachyfont.Reporter.instance_.items_[name];
    item = encodeURIComponent(name) + '=' + value;
    if (length + item.length > 2000) {
      tachyfont.Reporter.sendGen204_(baseUrl, items);
      length = baseUrl.length;
      items = [];
    }
    length += item.length;
    items.push(item);
  }
  tachyfont.Reporter.sendGen204_(baseUrl, items);
};


/**
 * Sends the gen_204.
 * @param {string} baseUrl The url to send the GET to.
 * @param {!Array<string>} params The URL parameters.
 * @private
 */
tachyfont.Reporter.sendGen204_ = function(baseUrl, params) {
  var reportUrl = baseUrl + params.join('&');
  if (goog.DEBUG) {
    tachyfont.log.info('report: ' + params.join(', '));
  }
  var image = new Image();
  image.onload = image.onerror = tachyfont.Reporter.cleanUpFunc_(image);
  image.src = reportUrl;
};


/**
 * Clears references off the Image so it can be garbage collected.
 * @param {!Image} image The image to clean up.
 * @return {!function()} Function that cleans up the image.
 * @private
 */
tachyfont.Reporter.cleanUpFunc_ = function(image) {
  return function() {
    image.onload = image.onerror = null;
  };
};

