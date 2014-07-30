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

ForDebug.old_onload = window.onload;
/**
 * Display the results on window.onload.
 */
window.onload = function() {
  setTimeout(function() {
    var num_timings = timer.numberOfTimingRecords();
    if (num_timings) {
      var table = document.createElement('table');
      table.id = 'timingTablex';
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
    if (ForDebug.old_onload) {
      ForDebug.old_onload(window);
    }
  }, 500);
};

/**
 * Add a "drop DB" button.
 * @private
 */
ForDebug.addDropIdbButton = function(incrFontMgr, fontname) {
  var old_onload = window.onload;
  window.onload = function() {
    var span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.top = '10px';
    span.style.right = '10px';
    var button = document.createElement('button');
    button.onclick = dropIdb;
    var label = document.createTextNode('drop DB');
    button.appendChild(label);
    span.appendChild(button);
    var br = document.createElement('br');
    span.appendChild(br);
    var msg_span = document.createElement('span');
    msg_span.id = 'dropIdb_msg';
    span.appendChild(msg_span);
    document.body.appendChild(span);
    if (old_onload) {
      old_onload(window);
    }
  };
  function dropIdb() {
    var msg_span = document.getElementById('dropIdb_msg');
    ForDebug.dropIdb(incrFontMgr, fontname).
    then(function() {
      msg_span.innerHTML = 'dropped DB';
    }).
    catch (function(msg) {
      msg_span.innerHTML = msg;
    });
  }

};


/**
 * Drop the IndexedDB database.
 * @return {Promise} The Promise for when the DB is dropped.
 */
ForDebug.dropIdb = function(incrFontMgr, fontname) {
  var db_name = IncrementalFont.DB_NAME + '/' + fontname;
  return incrFontMgr.getIDB_
  .then(function(db) {
    db.close();
    return new Promise(function(resolve, reject) {
      console.log('drop ' + db_name);
      var request = indexedDB.deleteDatabase(db_name);
      request.onsuccess = function(e) {
        resolve();
      };
      request.onblocked = function() {
        console.log("deleteDatbase got blocked event");
      };
      request.onerror = function(e) {
        debugger;
        reject(e);
      };
    })
  }).
  then(function() {
    return 'dropped ' + db_name;
  }).
  catch (function(e) {
    console.log('dropIdb ' + db_name + ': ' + e.message);
    debugger;
    return 'dropIdb ' + db_name + ': ' + e.message;
  });
};

