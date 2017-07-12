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

goog.require('tachyfont.Define');



/**
 * The information for a font.
 * @param {?string} fontFamily The font family name.
 * @param {?string} weight The font weight.
 * @param {boolean} priority Indicates whether this font should be
 *     prioritized over other fonts.
 * @param {?string=} opt_familyPath The font family path.
 * @param {?string=} opt_version The font version.
 * @param {?string=} opt_fontKit The font kit.
 * @param {?number=} opt_size The size of the font in bytes.
 * @constructor
 */
tachyfont.FontInfo = function(
    fontFamily, weight, priority, opt_familyPath, opt_version, opt_fontKit,
    opt_size) {

  /** @private @const {string} */
  this.fontFamily_ = fontFamily || '';

  /** @private @const {string} */
  this.weight_ = weight || '';

  /**
   * Indicates if this font should be prioritized over other fonts.
   * @private {boolean}
   */
  this.priority_ = priority;

  /**
   * Indicates if this font should be loaded.
   * If systems resources are limited then some fonts may be chosen not to load.
   * @private {boolean}
   */
  this.shouldLoad_ = true;

  /** @private @const {string} */
  this.familyPath_ = opt_familyPath || '';

  /** @private @const {string} */
  this.version_ = opt_version || '';

  /** @private @const {string} */
  this.fontKit_ = opt_fontKit || '';

  /**
   * The size of the fully filled out font.
   * @private @const {number}
   */
  this.size_ = opt_size || 5 * 1000 * 1000;

  /** @private {string} */
  this.cssFontFamily_ = '';

  /** @private {string} */
  this.dataUrl_ = '';
};


/**
 * Gets the font family name of the TachyFont.
 * @return {string}
 */
tachyfont.FontInfo.prototype.getFontFamily = function() {
  return this.fontFamily_;
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
 * @return {string} The font directory of the TachyFont.
 */
tachyfont.FontInfo.prototype.getFamilyPath = function() {
  return this.familyPath_;
};


/**
 * Gets the version of the TachyFont.
 * @return {string} The version of the TachyFont.
 */
tachyfont.FontInfo.prototype.getVersion = function() {
  return this.version_;
};


/**
 * Gets the font kit of the TachyFont.
 * @return {string} The font kit of the TachyFont server.
 */
tachyfont.FontInfo.prototype.getFontKit = function() {
  return this.fontKit_;
};


/**
 * Gets the fully filled out size of the font.
 * @return {number} The font kit of the TachyFont server.
 */
tachyfont.FontInfo.prototype.getSize = function() {
  return this.size_;
};


/**
 * Gets the css font family name of the TachyFont.
 * @return {string}
 */
tachyfont.FontInfo.prototype.getCssFontFamily = function() {
  return this.cssFontFamily_;
};


/**
 * Sets the css font family name of the TachyFont.
 * @param {string} cssFontFamily The css font family name of the TachyFont.
 */
tachyfont.FontInfo.prototype.setCssFontFamily = function(cssFontFamily) {
  this.cssFontFamily_ = cssFontFamily;
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
 * Gets the "should load" setting for this font.
 * @return {boolean}
 */
tachyfont.FontInfo.prototype.getShouldLoad = function() {
  return this.shouldLoad_;
};


/**
 * Sets the "should load" setting for this font.
 * @param {boolean} setting Whether to load this font.
 */
tachyfont.FontInfo.prototype.setShouldLoad = function(setting) {
  this.shouldLoad_ = setting;
};


/**
 * Gets the database name for this font.
 * @return {string} The database name.
 */
tachyfont.FontInfo.prototype.getDbName = function() {
  return tachyfont.Define.DB_NAME + '/' + this.fontFamily_ + '/' +
      this.getFontId();
};


/**
 * Gets an identifier for the font.
 * @return {string}
 */
tachyfont.FontInfo.prototype.getFontId = function() {
  // TODO(bstell): add slant/width/etc.
  return this.weight_;
};

goog.exportSymbol('tachyfont.FontInfo', tachyfont.FontInfo);
