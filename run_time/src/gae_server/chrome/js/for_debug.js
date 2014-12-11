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

ForDebug.updateDisplay_ = function() {
  setTimeout(function() {
    if (timer1.numberOfTimingRecords()) {
      timer1.display_timing();
    }
    if (timer2.numberOfTimingRecords()) {
      timer2.display_timing();
    }
  }, 1);
};


/**
 * If timing data was collected display them on DOM ready.
 */
if (document.readyState == 'loading') {
  document.addEventListener("DOMContentLoaded", function(event) {
    ForDebug.updateDisplay_();
  });
} else {
  ForDebug.updateDisplay_();
}

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
  { name: '10 Kbps', value: '10' },
  { name: '100 Kbps', value: '100' },
  { name: '250 Kbps', value: '250' },
  { name: 'Argentina - 1.0 Mbps', value: '1000' },
  { name: 'India - 1.3 Mbps', value: '1300' },
  { name: '3G moving - 384 Kbps', value: '384' },
  { name: '3G stationary - 1.6 Mbps', value: '1600' },
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
  var label_innerHTML = "<a href='http://www.akamai.com/stateoftheinternet/'" +
  "target='_blank'>Akami mobile bandwidth</a> " +
  "(<a href='http://www.akamai.com/dl/akamai/akamai-soti-q114.pdf'" +
  "target='_blank'>2014 report pg 31</a>): ";

  ForDebug.addDropDownCookieControl(ForDebug.Bandwidths, 120, 10, 
    'lightYellow', label_innerHTML, 'bandwidth');
};

ForDebug.TimingTextSizes = [
  { name: 'Extra Large', value: '200%' },
  { name: 'Large', value: '150%' },
  { name: 'Regular', value: '100%' },
];

/**
 * Add a control to set the timing text size.
 * For the text to be readable on WebPageTest.org it needs to be quite large.
 * For other uses it can be a normal size
 * @param {Object} incrFontMgr The incremental font manager.
 */
ForDebug.addTimingTextSizeControl = function() {
  ForDebug.addDropDownCookieControl(ForDebug.TimingTextSizes, 160, 10, 
    'lightYellow', "Timing Text Size", 'timing-text-size');
};

/**
 * Add a control to set the timing text size.
 * For the text to be readable on WebPageTest.org it needs to be quite large.
 * For other uses it can be a normal size
 * @param {Object} incrFontMgr The incremental font manager.
 */
ForDebug.addDropDownCookieControl = function(options, top, right, background_color, label_innerHTML, cookie_name) {
  if (document.readyState == 'loading') {
    document.addEventListener("DOMContentLoaded", function(event) {
      ForDebug.addDropDownCookieControl_(options, top, right, background_color, label_innerHTML, cookie_name);
    });
  } else {
    ForDebug.addDropDownCookieControl_(options, top, right, background_color, label_innerHTML, cookie_name);
  }
};

ForDebug.addDropDownCookieControl_ = function(options, top, right, background_color, label_innerHTML, cookie_name) {
  var span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.top = top + 'px';
  span.style.right = right + 'px';
  span.style.backgroundColor = background_color;
  span.style.border = '1px solid gray';
  var label = document.createElement('span');
  label.innerHTML = label_innerHTML + ": ";
  span.appendChild(label);

  var cookie_value = ForDebug.getCookie(cookie_name, '0');
  var select = document.createElement("select");
  select.selectedIndex = 0;
  for (var i = 0; i < options.length; i++) {
    var option_info = options[i];
    var option = document.createElement("option");
    option.text = option_info.name;
    option.value = option_info.value;
    select.add(option);
    if (cookie_value == option_info.value) {
      select.selectedIndex = i;
    }
  }

  function setOptionChange(select) {
    var selectedOption = select.options[select.selectedIndex];
    document.cookie = cookie_name + '=' + selectedOption.value;
  }
  setOptionChange(select);
  
  select.onchange = function(event) {
    var select = event.currentTarget;
    setOptionChange(select);
  };

  span.appendChild(select);
  document.body.appendChild(span);
};

/**
 * Add a "drop DB" button.
 * @param {Object} incrFontMgr The incremental font manager.
 * @param {String} fontname The fontname.
 */
ForDebug.addDropIdbButton = function(incrFontMgr, fontname) {
  if (document.readyState == 'loading') {
    document.addEventListener("DOMContentLoaded", function(event) {
      ForDebug.addDropIdbButton_(incrFontMgr, fontname);
    });
  } else {
    ForDebug.addDropIdbButton_(incrFontMgr, fontname);
  }
};


/**
 * Add a "drop DB" button.
 * @param {Object} incrFontMgr The incremental font manager.
 * @param {String} fontname The fontname.
 */
ForDebug.addDropIdbButton_ = function(incrFontMgr, fontname) {
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
  var label = document.createTextNode('drop IndexedDB data');
  button.appendChild(label);
  span.appendChild(button);

  document.body.appendChild(span);

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
  var db_name = tachyfont.IncrementalFont.DB_NAME + '/' + fontname;
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

