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



/**
 * Singleton reporter.
 *
 * @param {string} url The base URL to send reports to.
 * @constructor
 */
tachyfont.Reporter = function(url) {

  /** @private {string} */
  this.url_ = url + tachyfont.Reporter.URL_PATH;

  /** @private {!Object<string, (number|string)>} */
  this.items_ = {};
};


/**
 * The gen_204 path.
 * @type {string}
 */
tachyfont.Reporter.URL_PATH = '/gen_204?id=tf&';


/**
 * Enum for report params.
 * @enum {string}
 */
tachyfont.Reporter.Param = {
  ERROR_ID: 'ei',
  ERROR_TYPE: 'er',
  FONT_ID: 'fi',
  LOG_TYPE: 'lg',
  MOBILE: 'm',
  REPORT_TYPE: 'rt',
  END: ''
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
 * @param {string} errorId The error id.
 * @param {string} fontId Font identifying information.
 * @param {*} errInfo The error information.
 */
tachyfont.Reporter.reportError = function(errorId, fontId, errInfo) {
  if (tachyfont.Reporter.instance_ == null) {
    return;
  }
  var params = [];
  params.push(
      tachyfont.Reporter.Param.REPORT_TYPE + '=' +
      tachyfont.Reporter.Param.ERROR_TYPE);
  params.push(tachyfont.Reporter.Param.ERROR_ID + '=' + errorId);
  params.push(tachyfont.Reporter.Param.FONT_ID + '=' + fontId);
  params.push(
      tachyfont.Reporter.Param.MOBILE + '=' +
      (goog.userAgent.MOBILE ? '1' : '0'));
  var name = errorId + '.' + fontId;
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
  params.push(name + '=' + msg);
  tachyfont.Reporter.sendGen204_(params);
};


/**
 * Sends a log report.
 */
tachyfont.Reporter.sendReport = function() {
  var keys = Object.keys(tachyfont.Reporter.instance_.items_);
  keys.sort();
  if (keys.length == 0) {
    return;
  }

  var length = tachyfont.Reporter.instance_.url_.length;
  var items = [];
  var item = tachyfont.Reporter.Param.REPORT_TYPE + '=' +
      tachyfont.Reporter.Param.LOG_TYPE;
  length += item.length;
  items.push(item);

  item = tachyfont.Reporter.Param.MOBILE + '=' +
      (goog.userAgent.MOBILE ? '1' : '0');
  length += item.length;
  items.push(item);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var value = encodeURIComponent(
        (tachyfont.Reporter.instance_.items_[name]).toString());
    delete tachyfont.Reporter.instance_.items_[name];
    item = encodeURIComponent(name) + '=' + value;
    if (length + item.length > 2000) {
      tachyfont.Reporter.sendGen204_(items);
      length = tachyfont.Reporter.instance_.url_.length;
      items = [];
    }
    length += item.length;
    items.push(item);
  }
  tachyfont.Reporter.sendGen204_(items);
};


/**
 * Sends the gen_204.
 * @param {!Array<string>} params The URL parameters.
 * @private
 */
tachyfont.Reporter.sendGen204_ = function(params) {
  var reportUrl =
      tachyfont.Reporter.instance_.url_ + params.join('&');
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
