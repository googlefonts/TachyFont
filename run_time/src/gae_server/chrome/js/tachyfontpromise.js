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

goog.provide('tachyfont.promise');
goog.provide('tachyfont.chainedPromises');

goog.require('goog.Promise');


/**
 * A class that holds a promise and the associated resolve and reject functions.
 *
 * @param {tachyfont.chainedPromises} opt_container If used to chain promises
 *     then this holds the object that implements the chaining.
 * @constructor
 */
tachyfont.promise = function(opt_container) {
  /**
   * The promise.
   *
   * @private {goog.Promise}
   */
  this.promise_ = new goog.Promise(function(resolve, reject) {
    this.resolver_ = resolve;
    this.rejecter_ = reject;
    this.container_ = opt_container;
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
 * @param {*} opt_value An optional value to pass to the resolve function.
 */
tachyfont.promise.prototype.resolve = function(opt_value) {
  this.resolver_(opt_value);
  if (this.container_) {
    if (this.container_.promises.length > 1) {
      this.container_.promises.shift();
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
  this.promises = [];
  var firstPromise = new tachyfont.promise(this);
  firstPromise.precedingPromise_ = firstPromise.promise_;
  firstPromise.resolve();
  this.promises.push(firstPromise);
};


/**
 * Get a chained promise.
 *
 * @return {tachyfont.promise}
 */
tachyfont.chainedPromises.prototype.getChainedPromise = function() {
  var precedingPromise = this.promises[this.promises.length - 1];
  var newPromise = new tachyfont.promise(this);
  newPromise.precedingPromise_ = precedingPromise.promise_;
  this.promises.push(newPromise);
  return newPromise;
};

