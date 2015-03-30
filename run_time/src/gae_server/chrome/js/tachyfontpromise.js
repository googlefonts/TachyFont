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

goog.provide('tachyfont.chainedPromises');
goog.provide('tachyfont.promise');

goog.require('goog.Promise');



/**
 * A class that holds a promise and the associated resolve and reject functions.
 *
 * @param {tachyfont.chainedPromises=} opt_container If used to chain promises
 *     then this holds the object that implements the chaining.
 * @param {string=} opt_msg An optional message useful for debugging.
 * @constructor
 */
tachyfont.promise = function(opt_container, opt_msg) {
  /**
   * The promise.
   *
   * @private {goog.Promise}
   */
  this.promise_ = new goog.Promise(function(resolve, reject) {
    this.resolver_ = resolve;
    this.rejecter_ = reject;
    this.container_ = opt_container;
    if (goog.DEBUG) {
      if (opt_container) {
        this.chainCount_ = opt_container.chainedCount_;
      }
      this.msg_ = opt_msg;
    }
  }, this);

  /**
   * If this is being used to serialize promises then this is the preceeding
   * promise that the current thread needs to wait for.
   *
   * @private {goog.Promise|undefined}
   */
  this.precedingPromise_;
};


/**
 * Get the actual goog.Promise.
 *
 * @return {goog.Promise}
 */
tachyfont.promise.prototype.getPromise = function() {
  return this.promise_;
};


/**
 * Get the preceding/chained goog.Promise.
 *
 * @return {goog.Promise|undefined}
 */
tachyfont.promise.prototype.getPrecedingPromise = function() {
  if (goog.DEBUG) {
    if (!this.precedingPromise_) {
      debugger;
    }
  }
  return this.precedingPromise_;
};


/**
 * Resolve the promise.
 *
 * @param {*=} opt_value An optional value to pass to the resolve function.
 */
tachyfont.promise.prototype.resolve = function(opt_value) {
  this.resolver_(opt_value);
  if (this.container_) {
    if (goog.DEBUG) {
      if (this.container_.promises.length <= 1) {
        // We unshift all except the very first manually added promise.
        if (this.container_.chainedCount_ != 0) {
          debugger;
        }
      }
    }
    if (this.container_.promises.length > 1) {
      this.container_.promises.shift();
      if (goog.DEBUG) {
        this.container_.pendingCount_--;
        goog.log.log(tachyfont.logger, goog.log.Level.FINER,
            this.msg_ + 'dropped count to ' + this.container_.pendingCount_);
      }
    }
  }
};



/**
 * A class that manages chaining promises.
 *
 * This class maintains a queue of promises. As a new request is made it is set
 * to wait for the preceding promise to resolve.
 *
 * @constructor
 */
tachyfont.chainedPromises = function() {
  if (goog.DEBUG) {
    /**
     * For debug: count of total chained promises.
     *
     * @private {number}
     */
    this.chainedCount_ = 0;

    /**
     * For debug: count of pending promises.
     *
     * @private {number}
     */
    this.pendingCount_ = 0;

    /**
     * For debug: the debug message.
     *
     * @private {string}
     */
    this.debugMsg_ = '';

    /**
     * For debug: an interval timer used to detect deadlock.
     *
     * @private {number}
     */
    this.intervalId_ = setInterval(function() {
      if (this.pendingCount_ != 0) {
        goog.log.log(tachyfont.logger, goog.log.Level.WARNING, this.debugMsg_ +
            'lingering pending count: ' + this.pendingCount_);
        this.timerReportCount_++;
        if (this.timerReportCount_ >= 10) {
          goog.log.log(tachyfont.logger, goog.log.Level.SEVERE, this.debugMsg_ +
              'gave up checking for pending count');
          clearInterval(this.intervalId_);
        }
      } else {
        this.timerReportCount_ = 0;
      }
    }.bind(this), 10000);

    /**
     * For debug: an interval timer used to detect deadlock.
     *
     * @private {number}
     */
    this.timerReportCount_ = 0;
  }
  this.promises = [];
  var firstPromise = new tachyfont.promise(this);
  firstPromise.precedingPromise_ = firstPromise.promise_;
  this.promises.push(firstPromise);
  firstPromise.resolve();
};


/**
 * Get a chained promise.
 *
 * @param {string=} opt_msg A debug message;
 * @return {tachyfont.promise}
 */
tachyfont.chainedPromises.prototype.getChainedPromise = function(opt_msg) {
  if (goog.DEBUG) {
    this.chainedCount_++;
    this.pendingCount_++;
    var msg = this.debugMsg_ + (opt_msg || '') + ': ';
    goog.log.log(tachyfont.logger, goog.log.Level.FINER, msg +
        ': increase pending count to ' + this.pendingCount_);
  }
  var precedingPromise = this.promises[this.promises.length - 1];
  var newPromise = new tachyfont.promise(this, msg);
  newPromise.precedingPromise_ = precedingPromise.promise_;
  this.promises.push(newPromise);
  return newPromise;
};


/**
 * Get a chained promise.
 *
 * @param {string} msg The debug message.
 */
tachyfont.chainedPromises.prototype.setDebugMessage = function(msg) {
  if (goog.DEBUG) {
    this.debugMsg_ = msg + ': ';
  }
};

