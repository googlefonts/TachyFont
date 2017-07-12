'use strict';

/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
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

goog.provide('tachyfont.DemoBackendService');

goog.require('tachyfont.BackendService');


goog.scope(function() {



/**
 * Handles interacting with the backend server.
 *
 * @param {string} baseUrl URL of the tachyfont server.
 * @constructor
 * @extends {tachyfont.BackendService}
 */
tachyfont.DemoBackendService = function(baseUrl) {
  tachyfont.DemoBackendService.base(this, 'constructor', baseUrl);
};
goog.inherits(tachyfont.DemoBackendService, tachyfont.BackendService);
var DemoBackendService = tachyfont.DemoBackendService;


/** @override */
DemoBackendService.prototype.requestCodepoints = function(fontInfo, codes) {
  var that = this;
  var params = 'fontName=' + fontInfo.getFontFamily() +
      '&weight=' + fontInfo.getWeight() + '&codepoints=' + codes.join(',');
  return this
      .requestUrl(
          this.baseUrl + '/characterdata', 'POST', params,
          {'Content-Type': 'application/x-www-form-urlencoded'})
      .then(function(glyphData) {
        return that.parseDataHeader(glyphData);
      });
};


/** @override */
DemoBackendService.prototype.requestFontBase = function(fontInfo) {
  var url = this.baseUrl + '/fontbase?fontname=' + fontInfo.getFontFamily() +
      '&' +
      'weight=' + fontInfo.getWeight();
  return this.requestUrl(url, 'GET', null, {});
};


/** @override */
DemoBackendService.prototype.log = function(message) {
  return this.requestUrl(
      this.baseUrl + '/incremental_fonts/logger',
      'POST',
      message,
      // Google App Engine servers do not support CORS so we cannot say
      // the 'Content-Type' is 'application/json'.
      //{'Content-Type': 'application/json'},
      {'Content-Type': 'text/plain'});
};


});  // goog.scope
