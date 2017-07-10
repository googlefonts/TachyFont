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
 * @param {!tachyfont.WorkQueue.Task} task The task to add.
 */
tachyfont.WorkQueue.prototype.addTask = function(task) {
  this.queue_.push(task);
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
 * @param {function(*=)} taskFunction The function to call.
 * @param {*} data The data to pass to the function.
 * @constructor @struct @final
 */
tachyfont.WorkQueue.Task = function(taskFunction, data) {
  /** @private {function(*=)} */
  this.function_ = taskFunction;

  /** @private {*} */
  this.data_ = data;
};


/**
 * Gets the task function.
 * @return {function(*=)}
 */
tachyfont.WorkQueue.Task.prototype.getFunction = function() {
  return this.function_;
};


/**
 * Gets the task data.
 * @return {*}
 */
tachyfont.WorkQueue.Task.prototype.getData = function() {
  return this.data_;
};
