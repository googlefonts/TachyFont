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

var global_start_time = Date.now();


var TEMPORARY_FS_REQUEST_SIZE = 8 * 1024 * 1024;
var EMPTY_FS = false;
var RESULTS = [];

function time_start(msg) {
  console.time('@@@ ' + msg);
  console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('begin ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ begin ' + msg + ' at ' + cur_time);
}

function time_end(msg) {
  console.timeEnd('@@@ ' + msg);
  console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('end ' + msg + ' at ' + cur_time + '\n');
  console.log('@@@ end ' + msg + ' at ' + cur_time);
}

function updateResults() {
  var resultsElem = document.getElementById('results');
  var aResult;
  while (resultsElem && (aResult = RESULTS.shift())) {
    resultsElem.appendChild(document.createTextNode(aResult));
    resultsElem.appendChild(document.createElement('br'));
  }
}

function requestURL(url, method, data, headerParams, responseType) {
  // time_start('fetch ' + url)
  return new Promise(function(resolve, reject) {
    var oReq = new XMLHttpRequest();
    oReq.open(method, url, true);
    for (var param in headerParams)
      oReq.setRequestHeader(param, headerParams[param]);
    oReq.responseType = responseType;
    oReq.onload = function(oEvent) {
      if (oReq.status == 200) {
        // time_end('fetch ' + url)
        resolve(oReq.response);
      } else
        reject(oReq.status + ' ' + oReq.statusText);
    };
    oReq.onerror = function() {
      reject(Error('Network Error'));
    };
    oReq.send(data);
  });
}

function requestTemporaryFileSystem(grantedSize) {
  window.requestFileSystem = window.requestFileSystem ||
  window.webkitRequestFileSystem;
  return new Promise(function(resolve, reject) {
    window.requestFileSystem(window.TEMPORARY, grantedSize, resolve, reject);
  });
}


