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

// This is here only for measuring the timings during development.
// This is not needed for regular use.
var timer = new Timer();
//timer.start('first timer event');
//timer.end('first timer event');
function displayTimings() {
  setTimeout(function() {
//    timer.display_timing(document.getElementById('timingTable'));
  }, 1000);
}

var old_onload = window.onload;
window.onload = function() {
  setTimeout(function() {
    timer.display_timing(document.getElementById('timingTable'));
    if (old_onload) {
      old_onload(window);
    }
  }, 1000);
  
};