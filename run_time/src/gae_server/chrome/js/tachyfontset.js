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

goog.provide('tachyfont.TachyFontSet');

goog.require('goog.Promise');
goog.require('goog.log');
goog.require('goog.style');

goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.chainedPromises');


/**
 * Manage a group of TachyFonts.
 *
 * @param {string} familyName The font family name for this set.
 * @constructor
 */
tachyfont.TachyFontSet = function(familyName) {
  /**
   * The TachyFonts managed in this set.
   *
   * @private {Array.<tachyfont.TachyFont>}
   */
  this.fonts_ = [];

  this.fontIdToIndex = {};
  this.css_family_to_family = {};
  this.familyName = familyName;

  /**
   * Sigh, for really slow sites do not set the CSS until the page is loaded.
   *
   * @private {boolean}
   */
  this.domContentLoaded_ = false;

  /**
   * The number of chars that need to be loaded.
   *
   * TODO(bstell): this is not fully used yet.
   *
   * @private {number}
   */
  this.pendingChars_ = 0;

  /**
   * Do not need to scan the DOM if there have been mutation events before
   * DOMContentLoaded.
   *
   * @private {boolean}
   */
  this.hadMutationEvents_ = false;

  /**
   * The updateFont operation takes time so serialize them.
   *
   * @private {tachyfont.chainedPromises}
   */
  this.finishPrecedingUpdateFont_ = new tachyfont.chainedPromises();

  /**
   * The timerID from setTimeout.
   *
   * @private {?number} The timerID from setTimeout.
   */
  this.pendingUpdateRequest_ = null;
};


/**
 * Maximum time in milliseconds to wait before doing a character update.
 *
 * @type {number}
 */
tachyfont.TachyFontSet.TIMEOUT = 3000;


/**
 * Add a TachyFont.
 *
 * @param {tachyfont.TachyFont} font The TachyFont to add to the set.
 */
tachyfont.TachyFontSet.prototype.addFont = function(font) {
  this.fonts_.push(font);
};


/**
 * Record the needed text for each TachyFont.
 *
 * @param {Object} node The text node.
 * @return {boolean} True if text was added.
 */
tachyfont.TachyFontSet.prototype.addTextToFontGroups = function(node) {
  var text = node.nodeValue.trim();
  if (!text) {
    return false;
  }

  var parentNode = node.parentNode;
  // <title> text does not have a parentNode.
  if (!parentNode) {
    return false;
  }
  var parentName = node.parentNode.nodeName;
  if (parentName == 'SCRIPT' || parentName == 'STYLE') {
    return false;
  }
  var css_family = goog.style.getComputedStyle(parentNode,
      'font-family');
  var weight = goog.style.getComputedStyle(parentNode,
      'font-weight');
  // TODO(bstell): add support for slant, width, etc.
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger_, css_family + '/' + weight + ': "' +
      text + '"');
  }

  // Convert the css_family to a family (empty string if not supported)
  var family = this.css_family_to_family[css_family];
  if (family == undefined) {
    var families = css_family.split(',');
    for (var i = 0; i < families.length; i++) {
      var a_family = tachyfont.IncrementalFontUtils.trimFamilyName(families[i]);
      if (a_family == this.familyName) {
        this.css_family_to_family[css_family] = this.familyName;
        break;
      }
    }
    family = this.css_family_to_family[css_family];
  }
  if (!family) {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'css_family \'' + css_family + '\' not supported');
    }
    return false;
  }

  // Normalize the weight; eg, 'normal' -> '400'
  weight = tachyfont.cssWeightToNumber[weight] || weight;
  var fontId = tachyfont.fontId(family, weight);

  // Look for this in the font set.
  var index = this.fontIdToIndex[fontId];
  if (index == undefined) {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'did not find = ' + fontId);
    }
    return false;
  }

  var tachyFont = this.fonts_[index];
  // Handle UTF16.
  var charArray = tachyfont.stringToChars(text);
  var textAdded = false;
  // Tell the font it needs these characters.
  var charlist = tachyFont.incrfont.charsToLoad;
  for (var i = 0; i < charArray.length; i++) {
    var c = charArray[i];
    if (charlist[c] != 1) {
      textAdded = true;
      this.pendingChars_ += 1;
    }
    charlist[c] = 1;
  }
  return textAdded;
};


/**
 * Request an update of a group of TachyFonts
 */
tachyfont.TachyFontSet.prototype.requestUpdateFonts = function() {
  // Set a pending request.
  if (this.pendingUpdateRequest_ == null) {
    this.pendingUpdateRequest_ = setTimeout(function() {
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger_, 'requestUpdateFonts: updateFonts');
      }
      this.updateFonts(false);
    }.bind(this), tachyfont.TachyFontSet.TIMEOUT);
  }
};


/**
 * Update a group of TachyFonts
 *
 * @param {boolean} allowEarlyUse Allow the font to be used before the page has
 *     finished loading.
 * @return {goog.Promise}
 *
 */
tachyfont.TachyFontSet.prototype.updateFonts = function(allowEarlyUse) {
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger_, 'updateFonts');
  }
  // Clear any pending request.
  if (this.pendingUpdateRequest_ != null) {
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger_, 'clear pendingUpdateRequest_');
    }
    clearTimeout(this.pendingUpdateRequest_);
    this.pendingUpdateRequest_ = null;
  }
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'updateFonts: wait for preceding update');
  }
  var allUpdated = this.finishPrecedingUpdateFont_.getChainedPromise();
  allUpdated.getPrecedingPromise().
  then(function() {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'updateFonts: done waiting for preceding update');
    }
    var updatingFonts = [];
    for (var i = 0; i < this.fonts_.length; i++) {
      var fontObj = this.fonts_[i].incrfont;
      var load = fontObj.loadChars();
      updatingFonts.push(load);
    }
    return goog.Promise.all(updatingFonts);
  }.bind(this)).
  then(function(/*loadResults*/) {
    var fontsData = [];
    for (var i = 0; i < this.fonts_.length; i++) {
      var fontObj = this.fonts_[i].incrfont;
      var needToSetFont = fontObj.needToSetFont_;
      // It takes significant time to pass the font data from Javascript to the
      // browser. So unless specifically told to do so, do not update the font
      // before the page loads.
      if (!this.domContentLoaded_) {
        if (!allowEarlyUse) {
          needToSetFont = false;
        }
      }
      // TODO(bstell): check the font has loaded char data. If no char data was
      // ever loaded then don't waste CPU and time loading a useless font.
      var fontData;
      if (needToSetFont) {
        fontData = fontObj.getBase;
      } else {
        fontData = goog.Promise.resolve(null);
      }
      fontsData.push(fontData);
    }
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'updateFonts: wait for font bases');
    }
    return goog.Promise.all(fontsData);
  }.bind(this)).
  then(function(loadResults) {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'updateFonts: got font bases');
    }
    var allCssSet = [];
    for (var i = 0; i < loadResults.length; i++) {
      var loadResult = loadResults[i];
      if (loadResult == null) {
        allCssSet.push(goog.Promise.resolve(null));
        continue;
      }
      var fileInfo = loadResult[0];
      var fontData = loadResult[1];
      var fontObj = this.fonts_[i].incrfont;
      if (goog.DEBUG) {
        goog.log.fine(tachyfont.logger_, 'updateFonts: setFont: ');
      }
      var cssSetResult = fontObj.setFont(fontData, fileInfo).
        then(function(cssSetResult) {
          tachyfont.IncrementalFontUtils.setVisibility(fontObj.style,
            fontObj.fontInfo_, true);
        });
      allCssSet.push(cssSetResult);
    }
    return goog.Promise.all(allCssSet);
  }.bind(this)).
  then(function(setResults) {
    if (goog.DEBUG) {
      goog.log.fine(tachyfont.logger_, 'updateFonts: updated all fonts');
    }
    allUpdated.resolve();
  }.bind(this)).
  thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger_, 'failed to load all fonts' +
          e.stack);
      debugger;
    }
  });
  return allUpdated.getPromise();
};
