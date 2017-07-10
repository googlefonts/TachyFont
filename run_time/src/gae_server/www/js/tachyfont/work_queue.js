'use strict';

/**
 * @license
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

goog.provide('tachyfont.WorkQueue');

goog.require('goog.Promise');
goog.require('tachyfont.Reporter');



/**
 * This class manages work queues.
 * @param {string} name An identifier useful for error reports.
 * @constructor @struct @final
 */
tachyfont.WorkQueue = function(name) {
  /** @private @const {string} */
  this.name_ = name;

  /** @private {!Array<!tachyfont.WorkQueue.Task>} */
  this.queue_ = [];
};


/**
 * Adds a task.
 * @param {function(?)} taskFunction The function to call.
 * @param {*} data The data to pass to the function.
 * @param {string} fontId An identifier useful for error messages.
 * @param {number=} opt_watchDogTime Option watch dog time.
 * @return {!tachyfont.WorkQueue.Task} A task object.
 */
tachyfont.WorkQueue.prototype.addTask = function(
    taskFunction, data, fontId, opt_watchDogTime) {
  var task = new tachyfont.WorkQueue.Task(
      taskFunction, data, fontId, opt_watchDogTime);
  this.queue_.push(task);
  if (this.queue_.length == 1) {
    this.runNextTask();
  }
  return task;
};


/**
 * Runs a task.
 */
tachyfont.WorkQueue.prototype.runNextTask = function() {
  if (this.queue_.length < 1) {
    return;
  }
  var task = this.queue_[0];
  task.run().thenAlways(function() {
    this.queue_.shift();
    this.runNextTask();
  }, this);
};


/**
 * Gets the queue length.
 * @return {number}
 */
tachyfont.WorkQueue.prototype.getLength = function() {
  return this.queue_.length;
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.WorkQueue.Error = {
  FILE_ID: 'EWQ',
  WATCH_DOG_TIMER: '01',
  END: '00'
};


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.WorkQueue.reportError = function(errNum, errId, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.WorkQueue.Error.FILE_ID + errNum, errId, errInfo);
};


/**
 * Gets the work queue name
 * @return {string}
 */
tachyfont.WorkQueue.prototype.getName = function() {
  return this.name_;
};



/**
 * A class that holds a task.
 * @param {function(?)} taskFunction The function to call.
 * @param {*} data The data to pass to the function.
 * @param {string} fontId An indentifer for error reporting.
 * @param {number=} opt_watchDogTime Option watch dog time.
 * @constructor @struct @final
 */
tachyfont.WorkQueue.Task = function(
    taskFunction, data, fontId, opt_watchDogTime) {
  var resolver;

  /** @private {function(?)} */
  this.function_ = taskFunction;

  /** @private {*} */
  this.data_ = data;

  /** @private {string} */
  this.fontId_ = fontId;

  /** @private {!goog.Promise<?,?>} */
  this.result_ = new goog.Promise(function(resolve, reject) {  //
    resolver = resolve;
  });

  /** @private {function(*=)} */
  this.resolver_ = resolver;

  /** @private {?number} */
  this.timeoutId_ = null;

  /** @private {number} */
  this.watchDogTime_ =
      opt_watchDogTime || tachyfont.WorkQueue.Task.WATCH_DOG_TIME;
};


/**
 * The time in milliseconds to wait before reporting that a running task did not
 * complete.
 * @type {number}
 */
tachyfont.WorkQueue.Task.WATCH_DOG_TIME = 10 * 60 * 1000;


/**
 * Gets the task result promise (may be unresolved).
 * @return {!goog.Promise<?,?>}
 */
tachyfont.WorkQueue.Task.prototype.getResult = function() {
  return this.result_;
};


/**
 * Resolves the task result promise.
 * @param {*} result The result of the function. May be any value including a
 *     resolved/rejected promise.
 * @return {!goog.Promise<?,?>}
 * @private
 */
tachyfont.WorkQueue.Task.prototype.resolve_ = function(result) {
  this.resolver_(result);
  return this.result_;
};


/**
 * Runs the task.
 * @return {*}
 */
tachyfont.WorkQueue.Task.prototype.run = function() {
  this.startWatchDogTimer_();
  var result;
  try {
    result = this.function_(this.data_);
  } catch (e) {
    result = goog.Promise.reject(e);
  }
  this.result_.thenAlways(function() {  //
    this.stopWatchDogTimer_();
  }.bind(this));
  return this.resolve_(result);
};


/**
 * Starts the watch dog timer.
 * @return {*}
 * @private
 */
tachyfont.WorkQueue.Task.prototype.startWatchDogTimer_ = function() {
  this.timeoutId_ = setTimeout(function() {
    this.timeoutId_ = null;
    tachyfont.WorkQueue.reportError(
        tachyfont.WorkQueue.Error.WATCH_DOG_TIMER, this.fontId_, '');
  }.bind(this), this.watchDogTime_);
};


/**
 * Stops the watch dog timer.
 * @private
 */
tachyfont.WorkQueue.Task.prototype.stopWatchDogTimer_ = function() {
  if (this.timeoutId_) {
    clearTimeout(this.timeoutId_);
  }
  this.timeoutId_ = null;
};
