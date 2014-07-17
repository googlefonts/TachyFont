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
    this.timing_info = {};
}

/**
 * Save start of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.start = function(msg) {
  console.time('@@@ ' + msg);
  console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() - this.start_time;
  this.results.push('begin ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ begin ' + msg + ' at ' + cur_time);
  var info = {};
  if (this.timing_info[msg]) {
    console.log('**** duplicate: "' + msg + '"');
  }
  info['name'] = msg;
  info['start'] = cur_time;
  this.timing_info[msg] = info;
};

/**
 * Save end of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.end = function(msg) {
  console.timeEnd('@@@ ' + msg);
  console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - this.start_time;
  this.results.push('end ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ end ' + msg + ' at ' + cur_time);
  var info = this.timing_info[msg];
  info['end'] = cur_time;
};

/**
 * Display the timing info on the page.
 * @param {Object} table DOM table element.
 */
Timer.prototype.display_timing = function(table) {
  var arr = [];
  for (var key in this.timing_info) {
    arr.push(this.timing_info[key]);
  }
  arr.sort(function(a, b) {
    return a['start'] - b['start'];
  });

  for (var i = 0; i < arr.length; i++) {
    var info = arr[i];
    var name = info['name'];
    var start = info['start'];
    var end = info['end'];
    var delta;
    if (end) {
      delta = end - start;
    } else {
      end = '?';
      delta = '?';
    }
    var row = table.insertRow(table.rows.length);
    var cell = 0;
    this._appendTimingCell(row, cell++, name, 'left');
    this._appendTimingCell(row, cell++, start, 'right');
    this._appendTimingCell(row, cell++, end, 'right');
    this._appendTimingCell(row, cell++, delta, 'right');
  }
};

/**
 * Add a timing cell.
 * @param {!Object} row DOM row element.
 * @param {Number} pos The position in the row element.
 * @param {String|Number} value The value to display.
 * @param {String} align The alignment value.
 */
Timer.prototype._appendTimingCell = function(row, pos, value, align) {
  var cell = row.insertCell(pos);
  var mytype = typeof value;
  if (typeof value === 'number')
    cell.innerHTML = '' + Math.round(value);
  else
    cell.innerHTML = value;
  if (align)
    cell.style.textAlign = align;
};
