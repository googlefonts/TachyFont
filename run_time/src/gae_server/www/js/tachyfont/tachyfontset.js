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
goog.require('goog.array');
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
   * @type {!Array.<tachyfont.TachyFont>}
   */
  this.fonts = [];

  /** @type {!Object} */
  this.fontIdToIndex = {};

  /**
   * Map of CSS family spec to TachyFont family.
   *
   * @type {!Object.<string, string>}
   */
  this.cssFamilyToTachyFontFamily = {};

  /** @type {string} */
  this.familyName = familyName;

  /**
   * Sigh, for really slow sites do not set the CSS until the page is loaded.
   *
   * @type {boolean}
   */
  this.domContentLoaded = false;

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
   * @type {boolean}
   */
  this.hadMutationEvents = false;

  /**
   * The updateFont operation takes time so serialize them.
   *
   * @type {tachyfont.chainedPromises}
   */
  this.finishPrecedingUpdateFont = new tachyfont.chainedPromises();
  if (goog.DEBUG) {
    this.finishPrecedingUpdateFont.setDebugMessage('finishPrecedingUpdateFont');
  }

  /**
   * Timeout to report a lingering update request.
   *
   * @private {?number} The timerID from setTimeout.
   */
  this.pendingUpdateRequest_ = null;

  /**
   * Timeout to report lingering needed char data.
   *
   * @private {?number} The timerID from setTimeout.
   */
  // TODO (bstell): need to make this work.
  this.pendingCharDataRequest_ = null;
};


/*
 * There are multiple issues for the 'character detection', 'character data
 * fetching', and 'CSS update' logic to manage:
 *
 *   1. Character Detection
 *      * Use a Mutation Observer to record the characters as they are added to
 *        the DOM.
 *        * Behavior of simple web pages:
 *          * Load the DOM in a single operation and fire DOMContentLoaded
 *          * Note: the mutation event can happen before or after the
 *            DOMContentLoaded event.
 *        * Behavior of complex web pages:
 *          * Slowly load chunks of characters into the DOM both before and
 *            after DOMContentLoaded.
 *          * Mutation events happen multiple times before DOMContentLoaded and
 *            multiple times after DOMContentLoaded.
 *        * Mutation events can happen before or after DOMContentLoaded so at
 *          DOMContentLoaded:
 *          * If there have been mutation events then immediately update the
 *            fonts.
 *          * If there have not been mutation events then wait for mutation
 *            event which will follow soon.  We could scan the DOM to do the
 *            update immediately on DOMContentLoaded but scanning the DOM is
 *            expensive.
 *
 *   2. Character Data Fetching
 *      We want to have all the character data as close to DOMContentLoaded as
 *      possible. Because of round trip latency, we want to avoid lots of small
 *      fetches.
 *      * Before and after DOMContentLoaded: to reduce  the number of fetches
 *        only fetch every few seconds.
 *      * On DOMContentLoaded if there have been mutation events then fetch
 *        immediately. If there have not been any mutation events then wait to
 *        fetch the data on the soon to follow mutation event.
 *
 *   3. CSS Updating
 *      * It is _very_ CPU/time expensive to ship multiple multi-megabyte fonts
 *        from Javascript to the browser native code.
 *        * During the transfer the heavy CPU usage makes the page unresponsive.
 *        * Currently during the transfer the text becomes blank. The user sees
 *          an unpleasant 'flash' of blank text between the time when the
 *          fallback glyphs are cleared and the new glyphs are available for
 *          display.
 *        * The 'flash' can perhaps be solved by rendering to an off screen area
 *          and only switching the CSS once the transfer is complete. Note that
 *          this will not do anything about the CPU usage.
 *      * If on start up the font is already persisted then update the CSS
 *        immediately as it is very likely the font already has the UI text. The
 *        positive of this is that the UI shows the correct glyphs as soon as
 *        possible. The negative of this is there may be a ransom note effect
 *        and the CSS update makes the page unresponsived during the data
 *        transfer.
 *      * Before DOMContentLoaded do not display updates to the font as this
 *        would make the page unresponsive (even if the flashing is fixed).
 *      * At DOMContentLoaded display the font (this is the main goal)
 *      * After DOMContentLoaded only fetch characters and set the font every
 *        few seconds to balance keeping the display correct vs CPU loading.
 */


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
  this.fonts.push(font);
};


/**
 * For the node and sub-nodes remove TachyFont from input fields.
 *
 * @param {Node} node The starting point for walking the node/sub-nodes.
 */
tachyfont.TachyFontSet.prototype.recursivelyRemoveTachyFontFromInputFields =
    function(node) {
  this.removeTachyFontFromInputField(node);
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    this.recursivelyRemoveTachyFontFromInputFields(children[i]);
  }
};


/**
 * Remove TachyFont from an input field.
 *
 * @param {Node} node The node to work on.
 */
tachyfont.TachyFontSet.prototype.removeTachyFontFromInputField =
    function(node) {
  if (node.nodeName != 'INPUT') {
    return;
  }

  var cssFamily = goog.style.getComputedStyle(/** @type {Element} */ (node),
      'font-family');
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'INPUT css family: ' + cssFamily);
  }

  var families = cssFamily.split(',');
  // Remove the TachyFont if it is in the family list.
  goog.array.removeAllIf(families, function(val, index, array) {
    // Handle extra quotes.
    val = tachyfont.IncrementalFontUtils.trimFamilyName(val);
    return this.familyName == val;
  }, this);
  var newCssFamily = families.join(', ');
  node.style.fontFamily = newCssFamily;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER, 'newCssFamily: ' +
        goog.style.getComputedStyle(/** @type {Element} */ (node),
            'font-family'));
  }
};


/**
 * For the node and sub-nodes record the needed text for each TachyFont.
 *
 * @param {Node} node The starting point for walking the node/sub-nodes.
 */
tachyfont.TachyFontSet.prototype.recursivelyAddTextToFontGroups =
    function(node) {
  this.addTextToFontGroups(node);
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    this.recursivelyAddTextToFontGroups(children[i]);
  }
};


/**
 * Record the needed text for each TachyFont.
 *
 * @param {Node} node The text node.
 * @return {boolean} True if text was added.
 */
tachyfont.TachyFontSet.prototype.addTextToFontGroups = function(node) {
  if (node.nodeName != '#text') {
    return false;
  }

  var text = node.nodeValue.trim();
  if (!text) {
    return false;
  }

  var parentNode = /** @type {Element} */ (node.parentNode);
  // <title> text does not have a parentNode.
  if (!parentNode) {
    return false;
  }
  var parentName = node.parentNode.nodeName;
  if (parentName == 'SCRIPT' || parentName == 'STYLE') {
    return false;
  }
  var cssFamily = goog.style.getComputedStyle(parentNode, 'font-family');
  var weight = goog.style.getComputedStyle(parentNode, 'font-weight');
  // TODO(bstell): add support for slant, width, etc.
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger, cssFamily + '/' + weight + ': "' +
        text + '"');
  }

  // Convert the cssFamily to a family (empty string if not supported)
  var family = this.cssFamilyToTachyFontFamily[cssFamily];
  if (family == undefined) {
    var families = cssFamily.split(',');
    for (var i = 0; i < families.length; i++) {
      var aFamily = tachyfont.IncrementalFontUtils.trimFamilyName(families[i]);
      if (aFamily == this.familyName) {
        this.cssFamilyToTachyFontFamily[cssFamily] = this.familyName;
        break;
      }
    }
    family = this.cssFamilyToTachyFontFamily[cssFamily];
  }
  if (!family) {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger, goog.log.Level.FINER,
          'cssFamily \'' + cssFamily + '\' not supported');
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
      goog.log.log(tachyfont.logger, goog.log.Level.FINER,
          'did not find = ' + fontId);
    }
    return false;
  }

  var tachyFont = this.fonts[index];
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
        goog.log.info(tachyfont.logger, 'requestUpdateFonts: updateFonts');
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
    goog.log.fine(tachyfont.logger, 'updateFonts');
  }
  // Clear any pending request.
  if (this.pendingUpdateRequest_ != null) {
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, 'clear pendingUpdateRequest_');
    }
    clearTimeout(this.pendingUpdateRequest_);
    this.pendingUpdateRequest_ = null;
  }
  var msg;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'updateFonts: wait for preceding update');
    msg = 'updateFonts';
  }
  var allUpdated = this.finishPrecedingUpdateFont.getChainedPromise(msg);
  allUpdated.getPrecedingPromise().
      then(function() {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'updateFonts: done waiting for preceding update');
        }
        var updatingFonts = [];
        for (var i = 0; i < this.fonts.length; i++) {
          var fontObj = this.fonts[i].incrfont;
          var load = fontObj.loadChars();
          updatingFonts.push(load);
        }
        return goog.Promise.all(updatingFonts);
      }.bind(this)).
      thenCatch(function(err) {
        if (goog.DEBUG) {
          debugger;
        }
      }).
      then(function(/*loadResults*/) {
        var fontsData = [];
        for (var i = 0; i < this.fonts.length; i++) {
          var fontObj = this.fonts[i].incrfont;
          var needToSetFont = fontObj.needToSetFont;
          // It takes significant time to pass the font data from Javascript to
          // the browser. So unless specifically told to do so, do not update
          // the font before the page finishes loading.
          if (!this.domContentLoaded) {
            if (!allowEarlyUse) {
              needToSetFont = false;
            }
          }
          // TODO(bstell): check the font has loaded char data. If no char data
          // was ever loaded then don't waste CPU and time loading a useless
          // font.
          var fontData;
          if (needToSetFont) {
            fontData = fontObj.getBase;
          } else {
            fontData = goog.Promise.resolve(null);
          }
          fontsData.push(fontData);
        }
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'updateFonts: wait for font bases');
        }
        return goog.Promise.all(fontsData);
      }.bind(this)).
      then(function(loadResults) {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
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
          var fontObj = this.fonts[i].incrfont;
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger, 'updateFonts: setFont: ');
          }
          var cssSetResult = fontObj.setFont(fontData, fileInfo).
              then(function() {
                var name = 'sf' + this.fontInfo.getWeight();
                tachyfont.reporter.addItemTime(name, true);
                tachyfont.IncrementalFontUtils.setVisibility(this.style,
                this.fontInfo, true);
              }.bind(fontObj));
          allCssSet.push(cssSetResult);
        }
        return goog.Promise.all(allCssSet);
      }.bind(this)).
      then(function(setResults) {
        var okIfNoItems;
        if (goog.DEBUG) {
          okIfNoItems = true;
          goog.log.fine(tachyfont.logger, 'updateFonts: updated all fonts');
        }
        tachyfont.reporter.sendReport(okIfNoItems);
        allUpdated.resolve();
      }.bind(this)).
      thenCatch(function(e) {
        if (goog.DEBUG) {
          goog.log.error(tachyfont.logger, 'failed to load all fonts' +
              e.stack);
          debugger;
        }
        allUpdated.reject();
      });
  return allUpdated.getPromise();
};
