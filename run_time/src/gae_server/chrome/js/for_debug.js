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
 * This module has "for debug" code.
 */

var ForDebug = {};

// This is here only for measuring the timings during development.
// This is not needed for regular use.
var timer = new Timer();

var columns = ['Item', 'Start', 'End', 'Length'];

/**
 * If timing data was collected display them on DOM ready.
 */
document.addEventListener("DOMContentLoaded", function(event) {
  setTimeout(function() {
    var num_timings = timer.numberOfTimingRecords();
    if (num_timings) {
      var table = document.createElement('table');
      table.id = 'timingTable';
      table.style.fontSize = '125%';
      table.style.fontFamily = 'sans-serif';
      var row = table.insertRow(0);
      for (var i = 0; i < columns.length; i++) {
        var cell = row.insertCell(i);
        cell.style.fontWeight = '900';
        cell.style.textAlign = 'center';
        cell.innerHTML = columns[i];
      }
      // Use body.childNodes rather than body.children to get before any text.
      var first_child = document.body.childNodes[0];
      document.body.insertBefore(table, first_child);
      var br = document.createElement('br');
      document.body.insertBefore(br, first_child);
      timer.display_timing(table);
    }
  }, 1);
});

/**
 * Add a "drop DB" button.
 * @param {Object} incrFontMgr The incremental font manager.
 * @param {String} fontname The fontname.
 */
ForDebug.addDropIdbButton = function(incrFontMgr, fontname) {
  document.addEventListener("DOMContentLoaded", function(event) {
    var span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.top = '10px';
    span.style.right = '10px';
    var msg_span = document.createElement('span');
    msg_span.id = 'dropIdb_msg';
    span.appendChild(msg_span);
    var button = document.createElement('button');
    button.onclick = dropIdb;
    var label = document.createTextNode('drop DB');
    button.appendChild(label);
    span.appendChild(button);

    document.body.appendChild(span);
  });
  function dropIdb() {
    var msg_span = document.getElementById('dropIdb_msg');
    ForDebug.dropIdb(incrFontMgr, fontname, function(msg) {
      msg_span.innerHTML = msg;
    });
  }
};


/**
 * Drop the IndexedDB database.
 * @param {Object} incrFontMgr The incremental font manager.
 * @param {String} fontname The fontname.
 * @param {function} call Call this function with the status.
 * @return {Promise} The Promise for when the DB is dropped.
 */
ForDebug.dropIdb = function(incrFontMgr, fontname, callback) {
  var db_name = IncrementalFont.DB_NAME + '/' + fontname;
  return incrFontMgr.getIDB_
  .then(function(db) {
    db.close();
    callback('dropping ' + db_name);
    var request = indexedDB.deleteDatabase(db_name);
    request.onsuccess = function(e) {
      callback('dropped ' + db_name);
    };
    request.onblocked = function() {
      callback('dropping ' + db_name + ' blocked');
      console.log('deleteDatbase got blocked event');
    };
    request.onerror = function(e) {
      debugger;
      callback('dropping ' + db_name + ' failed: ' + e.code + '/' + e.message);
    };
  });
};

