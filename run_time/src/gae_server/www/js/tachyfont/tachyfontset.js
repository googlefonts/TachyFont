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
goog.require('goog.style');
goog.require('tachyfont.Define');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Promise');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.utils');



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
   * @type {!Array<!tachyfont.TachyFont>}
   */
  this.fonts = [];

  /** @type {!Object} */
  this.fontIdToIndex = {};

  /**
   * Map of CSS family spec to TachyFont family.
   *
   * @type {!Object<string, string>}
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
   * Do not need to scan the DOM if there have been mutation events before
   * DOMContentLoaded.
   *
   * @type {boolean}
   */
  this.hadMutationEvents = false;

  /**
   * The updateFont operation takes time so serialize them.
   *
   * @type {!tachyfont.Promise.Chained}
   */
  this.finishPrecedingUpdateFont =
      new tachyfont.Promise.Chained('finishPrecedingUpdateFont');

  /**
   * Timeout indicating there is a pending update fonts request.
   *
   * @private {?number} The timerID from setTimeout.
   */
  this.pendingUpdateRequest_ = null;

  /**
   * Time of the last request update fonts.
   *
   * @private {number} The timerID from setTimeout.
   */
  this.lastRequestUpdateTime_ = 0;

};


/**
 * Enum for logging values.
 * @enum {string}
 */
tachyfont.TachyFontSet.Log = {
  SET_FONT: 'LTSSF.',
  SET_FONT_PRIORITY: 'LTSSP.',
  SET_FONT_DELAYED: 'LTSSD.',
  SET_FONT_DOM_LOADED: 'LTSSL.'
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.TachyFontSet.Error = {
  FILE_ID: 'ETS',
  UPDATE_FONT_LOAD_CHARS: '01',
  UPDATE_FONT_SET_FONT: '02',
  SET_FONT: '03'
};


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number;
 * @param {*} errObj The error object;
 * @private
 */
tachyfont.TachyFontSet.reportError_ = function(errNum, errObj) {
  tachyfont.Reporter.reportError(
      tachyfont.TachyFontSet.Error.FILE_ID + errNum, '000', errObj);
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
 * @param {!tachyfont.TachyFont} font The TachyFont to add to the set.
 */
tachyfont.TachyFontSet.prototype.addFont = function(font) {
  this.fonts.push(font);
};


/**
 * For the node and sub-nodes remove TachyFont from input fields.
 *
 * @param {!Node} node The starting point for walking the node/sub-nodes.
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
 * @param {!Node} node The node to work on.
 */
tachyfont.TachyFontSet.prototype.removeTachyFontFromInputField =
    function(node) {
  if (node.nodeName != 'INPUT') {
    return;
  }

  var cssFamily = goog.style.getComputedStyle(/** @type {!Element} */ (node),
      'font-family');

  var families = cssFamily.split(',');
  // Remove the TachyFont if it is in the family list.
  goog.array.removeAllIf(families, function(val, index, array) {
    // Handle extra quotes.
    val = tachyfont.IncrementalFontUtils.trimFamilyName(val);
    return this.familyName == val;
  }, this);
  var newCssFamily = families.join(', ');
  node.style.fontFamily = newCssFamily;
};


/**
 * For the node and sub-nodes record the needed text for each TachyFont.
 *
 * @param {?Node} node The starting point for walking the node/sub-nodes.
 */
tachyfont.TachyFontSet.prototype.recursivelyAddTextToFontGroups =
    function(node) {
  if (!node) {
    return;
  }
  this.addTextToFontGroups(node);
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    this.recursivelyAddTextToFontGroups(children[i]);
  }
};


/**
 * Record the needed text for each TachyFont.
 *
 * @param {!Node} node The text node.
 * @return {boolean} Whether text was added.
 */
tachyfont.TachyFontSet.prototype.addTextToFontGroups = function(node) {
  if (node.nodeName != '#text') {
    return false;
  }

  var text = node.nodeValue.trim();
  if (!text) {
    return false;
  }

  var parentNode = /** @type {!Element} */ (node.parentNode);
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
    return false;
  }

  // Normalize the weight; eg, 'normal' -> '400'
  weight = tachyfont.Define.cssWeightToNumber[weight] || weight;
  var fontId = tachyfont.utils.fontId(family, weight);

  // Look for this in the font set.
  var index = this.fontIdToIndex[fontId];
  if (index == undefined) {
    return false;
  }

  var tachyFont = this.fonts[index];
  // Handle UTF16.
  var charArray = tachyfont.utils.stringToChars(text);
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
 * Request an update of a group of TachyFonts.
 *
 * @param {number} startTime The time when the chars were added to the DOM.
 */
tachyfont.TachyFontSet.prototype.requestUpdateFonts = function(startTime) {

  // There is already a pending update.
  if (this.pendingUpdateRequest_ != null) {
    return;
  }

  // If the last update font was long ago then do one now.
  var now = goog.now();
  var timeSinceLastRequestUpdate = now - this.lastRequestUpdateTime_;
  if (timeSinceLastRequestUpdate > tachyfont.TachyFontSet.TIMEOUT) {
    this.updateFonts(startTime, false);
    return;
  }

  // There was a recent update so delay this one.
  this.pendingUpdateRequest_ = setTimeout(function() {
    this.updateFonts(-startTime, false);
  }.bind(this), tachyfont.TachyFontSet.TIMEOUT);
};


/**
 * Switch the CSS to use a group of TachyFonts
 * @param {number} startTime The time when the chars were added to the DOM. If
 *     the number is negative then an intentional delay was happened.
 * @param {!Array<?Array<!Object|!DataView>>} loadResults The fileInfo and
 *     fontData.
 * @return {!goog.Promise}
 *
 */
tachyfont.TachyFontSet.prototype.setFonts = function(startTime, loadResults) {
  var allCssSet = [];
  for (var i = 0; i < loadResults.length; i++) {
    var loadResult = loadResults[i];
    var cssSetResult = this.setFont(i, loadResult, startTime);
    allCssSet.push(cssSetResult);
  }
  return goog.Promise.all(allCssSet);
};


/**
 * Switch the CSS to use a TachyFont.
 * @param {number} index The index of the font in the TachyFontSet.
 * @param {?Array<!Object|!DataView>} loadResult The fileInfo and fontData.
 * @param {number} startTime The time when the chars were added to the DOM. If
 *     the number is negative then an intentional delay was happened.
 * @return {!goog.Promise}
 */
tachyfont.TachyFontSet.prototype.setFont = function(index, loadResult,
    startTime) {
  var fontObj = this.fonts[index].incrfont;
  var weight = fontObj.fontInfo.getWeight();
  var setFontLogId;
  if (fontObj.fontInfo.getPriority()) {
    setFontLogId = tachyfont.TachyFontSet.Log.SET_FONT_PRIORITY;
  } else {
    setFontLogId = tachyfont.TachyFontSet.Log.SET_FONT;
  }
  if (loadResult == null) {
    // No FOUT so 0 FOUT time.
    tachyfont.Reporter.addItem(setFontLogId + weight, 0);
    return goog.Promise.resolve(null);
  }
  // loadResult[0] holds fileInfo.
  var fontData = loadResult[1];
  var cssSetResult = fontObj.setFont(fontData).then(
      function() {
        if (startTime == 0) {
          tachyfont.Reporter.addItemTime(
              tachyfont.TachyFontSet.Log.SET_FONT_DOM_LOADED + weight);
        } else if (startTime >= 0) {
          tachyfont.Reporter.addItem(setFontLogId + weight,
              goog.now() - startTime);
        } else {
          tachyfont.Reporter.addItem(
              tachyfont.TachyFontSet.Log.SET_FONT_DELAYED + weight,
              goog.now() + startTime);
        }
        tachyfont.IncrementalFontUtils.setVisibility(this.style,
            this.fontInfo, true);
      }.bind(fontObj),
      function(e) {
        tachyfont.TachyFontSet.reportError_(
            tachyfont.TachyFontSet.Error.SET_FONT, e);
      });
  return cssSetResult;
};


/**
 * Update a group of TachyFonts
 *
 * @param {number} startTime The time when the chars were added to the DOM. If
 *     the number is negative then an intentional delay was happened.
 * @param {boolean} allowEarlyUse Allow the font to be used before the page has
 *     finished loading.
 * @return {!goog.Promise}
 *
 */
tachyfont.TachyFontSet.prototype.updateFonts =
    function(startTime, allowEarlyUse) {
  this.lastRequestUpdateTime_ = goog.now();
  // Clear any pending request.
  if (this.pendingUpdateRequest_ != null) {
    clearTimeout(this.pendingUpdateRequest_);
    this.pendingUpdateRequest_ = null;
  }
  var msg = 'updateFonts';
  var allUpdated = this.finishPrecedingUpdateFont.getChainedPromise(msg);
  allUpdated.getPrecedingPromise()
      .then(function() {
        var updatingFonts = [];
        for (var i = 0; i < this.fonts.length; i++) {
          var fontObj = this.fonts[i].incrfont;
          var load = fontObj.loadChars();
          updatingFonts.push(load);
        }
        return goog.Promise.all(updatingFonts);
      }.bind(this))
      .thenCatch(function(err) {
        tachyfont.TachyFontSet.reportError_(
            tachyfont.TachyFontSet.Error.UPDATE_FONT_LOAD_CHARS, err);
      })
      .then(function() {
        var fontsData = [];
        for (var i = 0; i < this.fonts.length; i++) {
          var fontObj = this.fonts[i].incrfont;
          if (fontObj.getNeedToSetFont()) {
            fontsData.push(fontObj.getBase);
          } else {
            fontsData.push(goog.Promise.resolve(null));
          }
        }
        return goog.Promise.all(fontsData);
      }.bind(this))
      .then(function(loadResults) {
        return this.setFonts(startTime, loadResults);
      }.bind(this))
      .then(function(setResults) {
        tachyfont.Reporter.sendReport();
        allUpdated.resolve();
      }.bind(this))
      .thenCatch(function(e) {
        tachyfont.TachyFontSet.reportError_(
            tachyfont.TachyFontSet.Error.UPDATE_FONT_SET_FONT,
            'failed to load all fonts' + e.stack);
        allUpdated.reject();
      });
  return allUpdated.getPromise();
};
