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
var timer1 = new Timer('lightGreen', '10px', '');
var timer2 = new Timer('lightPink', '', '10px');

/**
 * If timing data was collected display them on DOM ready.
 */
document.addEventListener("DOMContentLoaded", function(event) {
  setTimeout(function() {
    if (timer1.numberOfTimingRecords()) {
      timer1.display_timing();
    }
    if (timer2.numberOfTimingRecords()) {
      timer2.display_timing();
    }
  }, 1);
});


ForDebug.getCookie = function(name, fallback) {
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
  return fallback;

};

ForDebug.Bandwidths = [
  { name: 'Full', value: '0' },
  { name: 'Argentina - 1.0 Mbps', value: '1000' },
  { name: 'India - 1.3 Mbps', value: '1300' },
  { name: '3G - 1.6 Mbps', value: '1600' },
  { name: 'China - 4.8 Mbps', value: '4800' },
  { name: 'Japan - 5.7 Mbps', value: '5700' },
  { name: 'South Korea - 14.7 Mbps', value: '14700' },
  { name: 'Taiwan - 3.4 Mbps', value: '3400' },
];

/**
 * Add a Bandwidth control.
 * @param {Object} incrFontMgr The incremental font manager.
 */
ForDebug.addBandwidthControl = function(incrFontMgr) {
  document.addEventListener("DOMContentLoaded", function(event) {
    var span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.top = '100px';
    span.style.right = '10px';
    span.style.backgroundColor = 'lightYellow';
    span.style.border = '1px solid gray';
    var label = document.createElement('span');
    label.innerHTML = "<a href='http://www.akamai.com/stateoftheinternet/'" +
    		"target='_blank'>Akami mobile bandwidth</a> " +
    		"(<a href='http://www.akamai.com/dl/akamai/akamai-soti-q114.pdf'" +
    		"target='_blank'>2014 report pg 31</a>): ";
    span.appendChild(label);

    var cookie_value = ForDebug.getCookie('bandwidth', '0');
    var select = document.createElement("select");
    select.selectedIndex = 0;
    for (var i = 0; i < ForDebug.Bandwidths.length; i++) {
      var option_info = ForDebug.Bandwidths[i];
      var option = document.createElement("option");
      option.text = option_info.name;
      option.value = option_info.value;
      select.add(option);
      if (cookie_value == option_info.value) {
        select.selectedIndex = i;
      }
    }

    function setBandwidthCookie(select) {
      var selectedOption = select.options[select.selectedIndex];
      document.cookie = 'bandwidth=' + selectedOption.value;
    }
    setBandwidthCookie(select);
    
    select.onchange = function(event) {
      var select = event.currentTarget;
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

