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

goog.provide('tachyfont.FontInfo');



/**
 * The information for a font.
 * @param {?string} name The font name.
 * @param {?string} weight The font weight.
 * @param {?string=} opt_familyPath The font family path.
 * @param {?string=} opt_version The font version.
 * @param {?string=} opt_fontKit The font kit.
 * @constructor
 */
tachyfont.FontInfo =
    function(name, weight, opt_familyPath, opt_version, opt_fontKit) {

  /** @private {string} */
  this.name_ = name || '';

  /** @private {string} */
  this.weight_ = weight || '';

  /** @private {string} */
  this.familyPath_ = opt_familyPath || '';

  /** @private {string} */
  this.version_ = opt_version || '';

  /** @private {string} */
  this.fontKit_ = opt_fontKit || '';

  /** @private {string} */
  this.familyName_ = '';

  /** @private {string} */
  this.dataUrl_ = '';

  /**
   * Indicates if this font should be serviced ahead of other fonts.
   * @private {boolean}
   */
  this.priority_ = false;
};


/**
 * Gets the name of the TachyFont.
 * @return {string} The name of the TachyFont.
 */
tachyfont.FontInfo.prototype.getName = function() {
  return this.name_;
};


/**
 * Gets the weight of the TachyFont.
 * @return {string} The weight of the TachyFont.
 */
tachyfont.FontInfo.prototype.getWeight = function() {
  return this.weight_;
};


/**
 * Gets the font directory of the TachyFont.
 * @return {string|undefined} The font directory of the TachyFont.
 */
tachyfont.FontInfo.prototype.getFamilyPath = function() {
  return this.familyPath_;
};


/**
 * Gets the version of the TachyFont.
 * @return {string|undefined} The version of the TachyFont.
 */
tachyfont.FontInfo.prototype.getVersion = function() {
  return this.version_;
};


/**
 * Gets the font kit of the TachyFont.
 * @return {string|undefined} The font kit of the TachyFont server.
 */
tachyfont.FontInfo.prototype.getFontKit = function() {
  return this.fontKit_;
};


/**
 * Gets the family name of the TachyFont.
 * @return {string} The family name of the TachyFont.
 */
tachyfont.FontInfo.prototype.getFamilyName = function() {
  return this.familyName_;
};


/**
 * Sets the family name of the TachyFont.
 * @param {string} familyName The family name of the TachyFont.
 */
tachyfont.FontInfo.prototype.setFamilyName = function(familyName) {
  this.familyName_ = familyName;
};


/**
 * Gets the URL to the TachyFont.
 * @return {string} The URL to the TachyFont server.
 */
tachyfont.FontInfo.prototype.getDataUrl = function() {
  return this.dataUrl_;
};


/**
 * Sets the URL to the TachyFont.
 * @param {string} dataUrl The URL to the TachyFont server.
 */
tachyfont.FontInfo.prototype.setDataUrl = function(dataUrl) {
  this.dataUrl_ = dataUrl;
};


/**
 * Gets the priority of this font.
 * @return {boolean} Whether this is a priority font.
 */
tachyfont.FontInfo.prototype.getPriority = function() {
  return this.priority_;
};


/**
 * Sets the priority of this font.
 * @param {?boolean} priority True if is a priority font.
 */
tachyfont.FontInfo.prototype.setPriority = function(priority) {
  this.priority_ = priority ? true : false;
};


goog.scope(function() {
goog.exportSymbol('tachyfont.FontInfo', tachyfont.FontInfo);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getName',
                    tachyfont.FontInfo.prototype.getName);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getWeight',
                    tachyfont.FontInfo.prototype.getWeight);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getFamilyPath',
                    tachyfont.FontInfo.prototype.getFamilyPath);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getVersion',
                    tachyfont.FontInfo.prototype.getVersion);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getFontKit',
                    tachyfont.FontInfo.prototype.getFontKit);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getFamilyName',
                    tachyfont.FontInfo.prototype.getFamilyName);
goog.exportProperty(tachyfont.FontInfo.prototype, 'setFamilyName',
                    tachyfont.FontInfo.prototype.setFamilyName);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getDataUrl',
                    tachyfont.FontInfo.prototype.getDataUrl);
goog.exportProperty(tachyfont.FontInfo.prototype, 'setDataUrl',
                    tachyfont.FontInfo.prototype.setDataUrl);
goog.exportProperty(tachyfont.FontInfo.prototype, 'getPriority',
                    tachyfont.FontInfo.prototype.getPriority);
goog.exportProperty(tachyfont.FontInfo.prototype, 'setPriority',
                    tachyfont.FontInfo.prototype.setPriority);
});  // goog.scope

