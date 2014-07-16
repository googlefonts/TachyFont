'use strict';

/*
 * Copyright 2014 Google Inc. All rights reserved.
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

/**
 * Init a timer
 * @constructor
 */
function Timer() {
    this.start_time = Date.now();  
    this.results = [];
}

/**
 * Save start of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.time_start = function(msg) {
  console.time('@@@ ' + msg);
  console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() -this.start_time;
  this.results.push('begin ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ begin ' + msg + ' at ' + cur_time);
};

/**
 * Save end of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.time_end = function(msg) {
  console.timeEnd('@@@ ' + msg);
  console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - this.start_time;
  this.results.push('end ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ end ' + msg + ' at ' + cur_time);
};

