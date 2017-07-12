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

goog.provide('tachyfont.Promise');

goog.require('goog.Promise');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.log');



/**
 * A class that holds a promise and the associated resolve and reject functions.
 * @param {!tachyfont.Promise.Chained=} opt_container If used to chain promises
 *     then this holds the object that implements the chaining.
 * @param {string=} opt_msg An optional message useful for debugging.
 * @constructor @final @struct
 */
tachyfont.Promise.Encapsulated = function(opt_container, opt_msg) {
  var resolver;
  var rejecter;

  /**
   * @private {boolean}
   */
  this.isFulfilled_ = false;

  /**
   * The promise.
   * @private {!goog.Promise}
   */
  this.promise_ = new goog.Promise(function(resolve, reject) {
    resolver = resolve;
    rejecter = reject;
  }, this);

  /**
   * @private {!function (?=): ?}
   */
  this.resolver_ = resolver;

  /**
   * @private {!function (?=): ?}
   */
  this.rejecter_ = rejecter;

  /**
   * @private {?tachyfont.Promise.Chained}
   */
  this.container_ = opt_container || null;

  /**
   * @private {string}
   */
  this.msg_ = opt_msg || '';

  /**
   * If this is being used to serialize promises then this is the preceeding
   * promise that the current thread needs to wait for.
   * @private {?goog.Promise}
   */
  this.precedingPromise_ = null;
};


/**
 * The reportError constants.
 */
/**
 * Enum for logging values.
 * @enum {string}
 * @private
 */
tachyfont.Promise.Encapsulated.Error_ = {
  FILE_ID: 'ETP',
  PRECEDING_PROMISE: '01',
  RESOLVE_CHAINED_COUNT: '02',
  REJECT_CHAINED_COUNT: '03',
  LINGERING_PROMISE: '04'
};


/**
 * Reports errors for this file.
 * @param {string} errNum The error number;
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.Promise.Encapsulated.reportError_ = function(errNum, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.Promise.Encapsulated.Error_.FILE_ID + errNum, '000', errInfo);
};


/**
 * Gets the actual goog.Promise.
 * @return {!goog.Promise}
 */
tachyfont.Promise.Encapsulated.prototype.getPromise = function() {
  return this.promise_;
};


/**
 * Gets the preceding/chained goog.Promise.
 * @return {?goog.Promise}
 */
tachyfont.Promise.Encapsulated.prototype.getPrecedingPromise = function() {
  if (!this.precedingPromise_) {
    tachyfont.Promise.Encapsulated.reportError_(
        tachyfont.Promise.Encapsulated.Error_.PRECEDING_PROMISE, this.msg_);
  }
  return this.precedingPromise_;
};


/**
 * Rejects the promise.
 * @param {*=} opt_value An optional value to pass to the reject function.
 */
tachyfont.Promise.Encapsulated.prototype.reject = function(opt_value) {
  if (!this.isFulfilled_) {
    this.rejecter_(opt_value);
    this.isFulfilled_ = true;
  } else {
    this.promise_ = new goog.Promise(function(resolve, reject) {
      reject(opt_value);  //
    });
  }
  if (this.container_) {
    if (this.container_.promises_.length <= 1) {
      // We unshift all except the very first manually added promise.
      if (this.container_.chainedCount_ != 0) {
        tachyfont.Promise.Encapsulated.reportError_(
            tachyfont.Promise.Encapsulated.Error_.REJECT_CHAINED_COUNT,
            this.msg_);
      }
    }
    if (this.container_.promises_.length > 1) {
      this.container_.promises_.shift();
      this.container_.pendingCount_--;
    }
  }
};


/**
 * Resolves the promise.
 * @param {*=} opt_value An optional value to pass to the resolve function.
 */
tachyfont.Promise.Encapsulated.prototype.resolve = function(opt_value) {
  if (!this.isFulfilled_) {
    this.resolver_(opt_value);
    this.isFulfilled_ = true;
  } else {
    this.promise_ = new goog.Promise(function(resolve, reject) {
      resolve(opt_value);  //
    });
  }
  if (this.container_) {
    if (this.container_.promises_.length <= 1) {
      // We unshift all except the very first manually added promise.
      if (this.container_.chainedCount_ != 0) {
        tachyfont.Promise.Encapsulated.reportError_(
            tachyfont.Promise.Encapsulated.Error_.RESOLVE_CHAINED_COUNT,
            this.msg_);
      }
    }
    if (this.container_.promises_.length > 1) {
      this.container_.promises_.shift();
      this.container_.pendingCount_--;
    }
  }
};



/**
 * A class that manages chaining promises.
 * This class maintains a queue of promises. As a new request is made it is set
 * to wait for the preceding promise to resolve.
 * @param {string} msg Indicates the caller.
 * @constructor
 */
tachyfont.Promise.Chained = function(msg) {
  /**
     * For debug: count of total chained promises.
     * @private {number}
     */
  this.chainedCount_ = 0;

  /**
   * For debug: count of pending promises.
   * @private {number}
   */
  this.pendingCount_ = 0;

  /**
   * Info about the code using the chainedPromise.
   * @private {string}
   */
  this.msg_ = msg + ': ';

  /**
   * Start a chained timer to detect deadlock.
   */
  this.checkForLingeringPromise();

  /**
   * The number of times the timeout has happened.
   * @private {number}
   */
  this.timerReportCount_ = 0;

  /** @private {!Array<!tachyfont.Promise.Encapsulated>} */
  this.promises_ = [];

  var firstPromise = new tachyfont.Promise.Encapsulated(this);
  firstPromise.precedingPromise_ = firstPromise.promise_;
  this.promises_.push(firstPromise);
  firstPromise.resolve();
};


/**
 * Gets a chained promise.
 * @param {string} msg Information about the caller.
 * @return {!tachyfont.Promise.Encapsulated}
 */
tachyfont.Promise.Chained.prototype.getChainedPromise = function(msg) {
  this.chainedCount_++;
  this.pendingCount_++;
  var precedingPromise = this.promises_[this.promises_.length - 1];
  var newPromise = new tachyfont.Promise.Encapsulated(this, msg);
  newPromise.precedingPromise_ = precedingPromise.promise_;
  this.promises_.push(newPromise);
  return newPromise;
};


/**
 * Checks if a promise has not resolved in a reasonable time.
 * This may indicate slowness or a deadlock.
 */
tachyfont.Promise.Chained.prototype.checkForLingeringPromise = function() {
  setTimeout(function() {
    if (this.pendingCount_ != 0) {
      if (goog.DEBUG) {
        tachyfont.log.warning(
            this.msg_ + 'lingering pending count: ' + this.pendingCount_);
      }
      this.timerReportCount_++;
      if (this.timerReportCount_ < 10) {
        this.checkForLingeringPromise();
      } else {
        tachyfont.Promise.Encapsulated.reportError_(
            tachyfont.Promise.Encapsulated.Error_.LINGERING_PROMISE,
            this.msg_ + 'gave up checking for pending count');
      }
    } else {
      this.timerReportCount_ = 0;
    }
  }.bind(this), 10000);
};
