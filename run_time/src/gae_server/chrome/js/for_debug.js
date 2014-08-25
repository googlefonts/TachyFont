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

/**
 * If timing data was collected display them on DOM ready.
 */
document.addEventListener("DOMContentLoaded", function(event) {
  setTimeout(function() {
    var num_timings = timer.numberOfTimingRecords();
    if (num_timings) {
      timer.display_timing();
    }
  }, 1);
});


ForDebug.getCookie = function(name) {
  name += '=';
  var cookies = document.cookie.split(';');
  for(var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i];
    while (cookie.charAt(0)==' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) != -1) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return "";

};


/**
 * Add a Bandwidth control.
 * @param {Object} incrFontMgr The incremental font manager.
 */
ForDebug.addBandwidthControl = function(incrFontMgr) {
  document.addEventListener("DOMContentLoaded", function(event) {
    var span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.top = '50px';
    span.style.right = '10px';
    span.style.backgroundColor = 'white';
    span.style.border = '1px solid gray';
    console.log('need to add a bandwidth control');
    var label = document.createElement('span');
    label.innerHTML = 'Bandwidth: ';
    span.appendChild(label);

    var cookie_value = ForDebug.getCookie('bandwidth');
    var select = document.createElement("select");
    var option_none = document.createElement("option");
    option_none.text = "full";
    select.add(option_none);
    var option_3g = document.createElement("option");
    option_3g.text = "3G";
    console.log('set the value to 1600')
    option_3g.value = "1600";
    select.add(option_3g);
    // This code to set the selectedIndex is crude.
    if (cookie_value == '3G') {
      select.selectedIndex = select.options.length - 1;
    } else {
      select.selectedIndex = 0;
    }
    function setBandwidthCookie(select) {
      console.log('select.selectedIndex = ' + select.selectedIndex);
      var selectedOption = select.options[select.selectedIndex];
      console.log('selectedOption.value = ' + selectedOption.value);
      document.cookie = 'bandwidth=' + selectedOption.value;

    }
    setBandwidthCookie(select);
    
    select.onchange = function(event) {
      var select = event.srcElement;
      setBandwidthCookie(select);
    };

    span.appendChild(select);
    document.body.appendChild(span);
  });
};

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
    span.style.backgroundColor = 'white';
    span.style.border = '1px solid gray';
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
    ForDebug.dropIdb_(incrFontMgr, fontname, function(msg) {
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
 * @private
 */
ForDebug.dropIdb_ = function(incrFontMgr, fontname, callback) {
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
      callback('blocked dropping ' + db_name);
    };
    request.onerror = function(e) {
      debugger;
      callback('failed to drop ' + db_name + ': ' + e.code + '/' + e.message);
    };
  });
};

