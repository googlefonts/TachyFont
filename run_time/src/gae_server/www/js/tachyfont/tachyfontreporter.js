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

  /** @private {!Object.<string, string>} */
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
tachyfont.Reporter.object_;


/**
 * Get the reporter singleton.
 *
 * @param {string} url The base URL to send reports to.
 * @return {!tachyfont.Reporter} The reporter singleton.
 */
tachyfont.Reporter.getReporter = function(url) {
  if (goog.DEBUG) {
    if (tachyfont.Reporter.object_ && tachyfont.Reporter.object_.url_ != url) {
      debugger;
    }
  }
  if (!tachyfont.Reporter.object_) {
    tachyfont.Reporter.object_ = new tachyfont.Reporter(url);
  }
  return tachyfont.Reporter.object_;
};


/**
 * Add the time an item happened.
 *
 * @param {string} name The name of the item.
 * @param {boolean=} opt_recordDups If true record duplicates separately.
 */
tachyfont.Reporter.prototype.addItemTime = function(name, opt_recordDups) {
  var deltaTime = goog.now() - tachyfont.Reporter.startTime_;
  this.addItem(name, '' + deltaTime, opt_recordDups);
};


/**
 * Add an item to report.
 *
 * @param {string} name The name of the item.
 * @param {string} value The value of the item.
 * @param {boolean=} opt_recordDups If true record duplicates separately.
 */
tachyfont.Reporter.prototype.addItem = function(name, value, opt_recordDups) {
  if (opt_recordDups) {
    if (name in this.dupCnts_) {
      var dupCnt = this.dupCnts_[name] + 1;
      this.dupCnts_[name] = dupCnt;
      name += '.' + dupCnt;
    } else {
      this.dupCnts_[name] = 0;
    }
  }
  this.items_[name] = value;
};


/**
 * Send the report.
 *
 * @param {boolean=} opt_okIfNoItems Do not complain if not items.
 */
tachyfont.Reporter.prototype.sendReport = function(opt_okIfNoItems) {
  var names = Object.keys(this.items_);
  names.sort();
  if (names.length == 0) {
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

  var items = [];
  if (goog.DEBUG) {
    goog.log.info(tachyfont.logger, 'report items:');
  }
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var item = name + '=' + this.items_[name];
    items.push(item);
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, '    ' + item);
    }
  }
  var reportUrl = this.url_ + '/gen_204?id=tf&' + items.join('&');
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

