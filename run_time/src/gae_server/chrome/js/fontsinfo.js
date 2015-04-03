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

goog.provide('tachyfont.FontsInfo');



/**
 * The information for the fonts.
 *
 * @param {!Object} fonts .
 * @param {string} url .
 * @constructor
 */
tachyfont.FontsInfo = function(fonts, url) {
  /** @type {!Object} */
  this.fonts = fonts;

  /** @type {string} */
  this.url = url;
};


goog.scope(function() {
goog.exportSymbol('tachyfont.FontsInfo', tachyfont.FontsInfo);
var FontsInfoPrototype = tachyfont.FontsInfo.prototype;
goog.exportProperty(FontsInfoPrototype, 'fonts',
    FontsInfoPrototype.fonts);
goog.exportProperty(FontsInfoPrototype, 'url',
    FontsInfoPrototype.url);
});  // goog.scope

