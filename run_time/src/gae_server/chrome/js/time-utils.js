'use strict';
//
//THIS FILE IS DEPRECATED! DO NOT USE!
//

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
function Timer(top, leftMargin, rightMargin, display_level) {
    this.start_time = Date.now();
    this.results = [];
    this.timing_info = {};
    this.table = null;
    this.backgroundColor = 'lightPink';
    this.top = top;
    this.leftMargin = leftMargin;
    this.rightMargin = rightMargin;
    if (display_level == null)
        display_level = 0;
    this.display_level = display_level;
}

Timer.columns = [
  {'label': 'Item', 'display_level': 0},
  {'label': 'Start', 'display_level': 1},
  {'label': 'End', 'display_level': 1},
  {'label': 'mS', 'display_level': 0},
];
Timer.showDetails = false;

/**
 * Save start of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.start = function(msg) {
  if (Timer.showDetails) console.time('@@@ ' + msg);
  if (Timer.showDetails) console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() - this.start_time;
  this.results.push('begin ' + msg + ' at ' + cur_time + '\n');
  if (Timer.showDetails) console.log('@@@ begin ' + msg + ' at ' + cur_time);
  var info = {};
  if (this.timing_info[msg]) {
    console.log('**** duplicate: "' + msg + '"');
  }
  info['name'] = msg;
  info['start'] = cur_time;
  this.timing_info[msg] = info;
  this.display_timing();
};

/**
 * Save end of the an event and display msg on the console
 * @param {string} msg
 */
Timer.prototype.end = function(msg) {
  if (Timer.showDetails) console.timeEnd('@@@ ' + msg);
  if (Timer.showDetails) console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - this.start_time;
  this.results.push('end ' + msg + ' at ' + cur_time + '\n');
  if (Timer.showDetails) console.log('@@@ end ' + msg + ' at ' + cur_time);
  var info = this.timing_info[msg];
  if (info)
    info['end'] = cur_time;
  else
    console.log('**** missing start for "' + msg + '"');
  this.display_timing();
};


/**
 * Get the number of the timing records on the page.
 * @return {Number} The number of timing records.
 */
Timer.prototype.numberOfTimingRecords = function() {
  return Object.keys(this.timing_info).length;
};


/**
 * Display the timing info on the page.
 * @param {Object} table DOM table element.
 */
Timer.prototype.getTable = function() {
  if (this.table) {
    return this.table;
  }
  if (!document.body) {
    return null;
  }
  var table = document.createElement('table');
  var text_size = ForDebug.getCookie('timing-text-size', '200%')
  table.style.fontSize = text_size;
  table.style.fontFamily = 'sans-serif';
  table.style.marginLeft = this.leftMargin;
  table.style.marginRight = this.rightMargin;
  table.style.backgroundColor = this.backgroundColor;
  table.style.border = '3px solid gray';
  var row = table.insertRow(0);
  for (var i = 0; i < Timer.columns.length; i++) {
    var column = Timer.columns[i];
    if (column.display_level > this.display_level) {
      continue;
    }
    var cell = row.insertCell(-1);
    cell.style.fontWeight = '900';
    cell.style.textAlign = 'center';
    cell.innerHTML = column.label;
  }
  var div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = this.top;
  div.style.left = this.leftMargin;
  div.style.right = this.rightMargin;

  div.appendChild(table);
  document.body.appendChild(div);
  this.table = table;

  return this.table;
};


/**
 * Note that the timing is done: change the background color.
 */
Timer.prototype.done = function() {
  this.backgroundColor = 'lightGreen';
 var table = this.getTable();
  if (!table) {
    return;
  }
  table.style.backgroundColor = this.backgroundColor;
};

/**
 * Display the timing info on the page.
 */
Timer.prototype.display_timing = function() {
  var table = this.getTable();
  if (!table) {
    return;
  }
  var arr = [];
  for (var key in this.timing_info) {
    arr.push(this.timing_info[key]);
  }
  arr.sort(function(a, b) {
    return a['start'] - b['start'];
  });

  // Remove all but the header row.
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  for (var i = 0; i < arr.length; i++) {
    var info = arr[i];
    var name = info['name'];
    var start = info['start'];
    var end = info['end'];
    var delta;
    if (end) {
      delta = end - start;
    } else {
      end = '-';
      delta = '-';
    }
    var row = table.insertRow(table.rows.length);
    var cell = 0;
    if (this.display_level >= Timer.columns[0].display_level) {
      this._appendTimingCell(row, cell++, name, 'left');
    }
    if (this.display_level >= Timer.columns[1].display_level) {
      this._appendTimingCell(row, cell++, start, 'right');
    }
    if (this.display_level >= Timer.columns[2].display_level) {
      this._appendTimingCell(row, cell++, end, 'right');
    }
    if (this.display_level >= Timer.columns[3].display_level) {
      this._appendTimingCell(row, cell++, delta, 'right');
    }
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

//This is here only for measuring the timings during development.
//This is not needed for regular use.
var timer1 = new Timer('200px', '10px', '');
var timer2 = new Timer('200px', '', '10px');

