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

goog.provide('tachyfont.reporter');

goog.require('goog.log');


/**
 * TachyFont start time.
 *
 * This is as close to the user start time as possible. This is useful for
 * reporting how long after start time activities happened.
 *
 * @private {number} The milliseconds since midnight, January 1, 1970
 */
tachyfont.reporter.startTime_ = goog.now();


/**
 * The URL to send the report to.
 *
 * @type {string} The list of helper objects.
 */
tachyfont.reporter.url = '';


/**
 * The items to report.
 *
 * @private {!Object.<string, string>}
 */
tachyfont.reporter.items_ = {};


/**
 * The duplicate items count;
 *
 * Useful when keeping duplicates separately.
 *
 * @private {!Object.<string, number>}
 */
tachyfont.reporter.dupCnts_ = {};


/**
 * Add the time an item happened.
 *
 * @param {string} name The name of the item.
 * @param {boolean=} opt_recordDups If true record duplicates separately.
 */
tachyfont.reporter.addItemTime = function(name, opt_recordDups) {
  var deltaTime = goog.now() - tachyfont.reporter.startTime_;
  tachyfont.reporter.addItem(name, '' + deltaTime, opt_recordDups);
};


/**
 * Add an item to report.
 *
 * @param {string} name The name of the item.
 * @param {string} value The value of the item.
 * @param {boolean=} opt_recordDups If true record duplicates separately.
 */
tachyfont.reporter.addItem = function(name, value, opt_recordDups) {
  if (opt_recordDups) {
    if (name in tachyfont.reporter.dupCnts_) {
      var dupCnt = tachyfont.reporter.dupCnts_[name] + 1;
      tachyfont.reporter.dupCnts_[name] = dupCnt;
      name += '.' + dupCnt;
    } else {
      tachyfont.reporter.dupCnts_[name] = 0;
    }
  }
  tachyfont.reporter.items_[name] = value;
};


/**
 * Send the report.
 *
 * @param {boolean=} opt_okIfNoItems Do not complain if not items.
 */
tachyfont.reporter.sendReport = function(opt_okIfNoItems) {
  var names = Object.keys(tachyfont.reporter.items_);
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
    if (!tachyfont.reporter.url) {
      goog.log.error(tachyfont.logger, 'sendReport: URL not set');
      debugger;
      return;
    }
  }

  var items = [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var item = name + '=' + tachyfont.reporter.items_[name];
    items.push(item);
  }
  var reportUrl = tachyfont.reporter.url + '/gen_204?id=tf&' + items.join('&');
  var image = new Image();
  image.onload = image.onerror = tachyfont.reporter.cleanUp_(image);
  image.src = reportUrl;

  // Clean out the old items.
  tachyfont.reporter.items_ = {};
};


/**
 * Clear references off the Image so it can be garbage collected.
 * @private
 * @param {!Image} image The image to clean up.
 * @return {!function()} Function that cleans up the image.
 */
tachyfont.reporter.cleanUp_ = function(image) {
  return function() {
    image.onload = image.onerror = null;
  };
};

