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
 * This class manages TachyFont work queues.
 * @param {string} name An identifier useful for error reports.
 * @constructor @struct @final
 */
tachyfont.WorkQueue = function(name) {
  /**
   * An identifier useful for error reports.
   * @private @const {string}
   */
  this.name_ = name;
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
