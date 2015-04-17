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

goog.provide('tachyfont.CharCmapInfo');



/**
 * The cmap information for a character.
 *
 * @param {number} glyphId The glyph Id.
 * @param {number|null} format4Seg The format 4 segment index.
 * @param {number|null} format12Seg The format 12 segment index.
 * @constructor
 */
tachyfont.CharCmapInfo = function(glyphId, format4Seg, format12Seg) {

  /** @type {number} */
  this.glyphId = glyphId;

  /** @type {number|null} */
  this.format4Seg = format4Seg;

  /** @type {number|null} */
  this.format12Seg = format12Seg;
};


