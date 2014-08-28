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
 * TachyFonEnv - A namespace.
 */
function TachyFonEnv() {
}

TachyFonEnv.js_list_ = [];
TachyFonEnv.js_list_loaded_cnt = 0;
TachyFonEnv.ready_list_ = [];
TachyFonEnv.css_list_ = [];
TachyFonEnv.css_list_loaded_cnt = 0;

TachyFonEnv.init_ = function() {
  //debugger;
  TachyFonEnv.add_css('css/table_styles.css');
  TachyFonEnv.add_js('js/binary-font-editor.js');
  TachyFonEnv.add_js('js/incrfont-indexeddb.js');
  TachyFonEnv.add_js('js/incr-font-utils.js');
  TachyFonEnv.add_js('js/rle-decoder.js');
  TachyFonEnv.add_js('js/time-utils.js');
  TachyFonEnv.add_js('js/for_debug.js');
  TachyFonEnv.add_js('js/promise-1.0.0.js');
  TachyFonEnv.ready(27, function(closure) {
    console.log('ready: ' + closure);
  });
};

/**
 * Load a CSS file.
 * @param {string} url The URL of the CSS.
 */
TachyFonEnv.add_css = function(url) {
//  console.log('add css \"' + url + '\'');
  TachyFonEnv.css_list_.push(url);
  var link = document.createElement('link');
  link.setAttribute('href', url);
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.onload = function() {
//    console.log('loaded ' + url);
    TachyFonEnv.css_list_loaded_cnt += 1;
    TachyFonEnv.handle_ready_();
  }
  document.head.appendChild(link);
};


/**
 * Load a Javascript file.
 * @param {string} url The URL of the Javascript.
 */
TachyFonEnv.add_js = function(url) {
//  console.log('add script \"' + url + '\'');
  TachyFonEnv.js_list_.push(url);
  var script = document.createElement('script');
  script.src = url;
  script.onload = function() {
//    console.log('loaded ' + url);
    TachyFonEnv.js_list_loaded_cnt += 1;
    TachyFonEnv.handle_ready_();
  };
  document.head.appendChild(script);
};


/**
 * Call the JS callbacks if all the Javascript has been loaded.
 * @param {function} call The function to call when all of the Javascript has
 * been loaded.
 * @param {Object} closure Data to pass to the callback.
 * @private
 */
TachyFonEnv.handle_ready_ = function() {
  // Check if all the JS files are loaded.
  if (TachyFonEnv.js_list_.length != TachyFonEnv.js_list_loaded_cnt) {
    return;
  }
  if (TachyFonEnv.css_list_.length != TachyFonEnv.css_list_loaded_cnt) {
    return;
  }
//  console.log('ready');
  for (var i = 0; i < TachyFonEnv.ready_list_.length; i++) {
    var callback_obj = TachyFonEnv.ready_list_[i];
    callback_obj.callback(callback_obj.closure);
  }
};


/**
 * Register a Javascript is ready callback.
 * This is called when all the requested Javascript URLs are loaded.
 * @param {Object} closure Data to pass to the callback.
 * @param {function} call Call this function when the env is ready.
 */
TachyFonEnv.ready = function(closure, callback) {
//  console.log('add callback');
  var callback_obj = {}; // Make this minifiable.
  callback_obj.callback = callback;
  callback_obj.closure = closure;
  TachyFonEnv.ready_list_.push(callback_obj);
  TachyFonEnv.handle_ready_();
};

TachyFonEnv.init_();
