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
goog.require('goog.style');
goog.require('tachyfont.Define');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Promise');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.utils');



/**
 * Manage a group of TachyFonts.
 * @param {string} cssFontFamily The font family name for this set.
 * @param {string} cssFontFamilyToAugment The cssFontFamily to augment.
 * @constructor @struct
 */
tachyfont.TachyFontSet = function(cssFontFamily, cssFontFamilyToAugment) {
  /**
   * The TachyFonts managed in this set.
   * @type {!Array<!tachyfont.TachyFont>}
   */
  this.fonts = [];

  /** @type {!Object} */
  this.fontIdToIndex = {};

  /**
   * Map of CSS family spec to TachyFont family.
   * @type {!Object<string, string>}
   */
  this.cssFamilyToTachyFontFamily = {};

  /** @type {string} */
  this.cssFontFamilyToAugment = cssFontFamilyToAugment;

  /** @type {string} */
  this.cssFontFamily = cssFontFamily;

  /**
   * Sigh, for really slow sites do not set the CSS until the page is loaded.
   * @type {boolean}
   */
  this.domContentLoaded = false;

  /**
   * Do not need to scan the DOM if there have been mutation events before
   * DOMContentLoaded.
   * @type {boolean}
   */
  this.hadMutationEvents = false;

  /**
   * The updateFont operation takes time so serialize them.
   * @type {!tachyfont.Promise.Chained}
   */
  this.finishPrecedingUpdateFont =
      new tachyfont.Promise.Chained('finishPrecedingUpdateFont');

  /**
   * Timeout indicating there is a pending update fonts request.
   * @private {?number} The timerID from setTimeout.
   */
  this.pendingUpdateRequest_ = null;

  /**
   * Time of the last request update fonts.
   * @private {number} The timerID from setTimeout.
   */
  this.lastRequestUpdateTime_ = 0;

};


/**
 * Enum for logging values.
 * @enum {string}
 */
// LINT.IfChange
tachyfont.TachyFontSet.Log = {
  SET_FONT: 'LTSSF.',
  SET_FONT_PRIORITY: 'LTSSP.',
  SET_FONT_DELAYED: 'LTSSD.',
  SET_FONT_DOM_LOADED: 'LTSSL.'
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/http/log-reports.properties)


/**
 * Enum for error values.
 * @enum {string}
 */
// LINT.IfChange
tachyfont.TachyFontSet.Error = {
  FILE_ID: 'ETS',
  UPDATE_FONT_LOAD_CHARS: '01',
  // 02 no longer used.
  SET_FONT: '03'
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/http/error-reports.properties)


/**
 * The error reporter for this file.
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
 * @type {number}
 */
tachyfont.TachyFontSet.TIMEOUT = 3000;


/**
 * Add a TachyFont.
 * @param {!tachyfont.TachyFont} font The TachyFont to add to the set.
 */
tachyfont.TachyFontSet.prototype.addFont = function(font) {
  this.fonts.push(font);
};


/**
 * For the node and sub-nodes remove TachyFont from input fields.
 * @param {!Node} node The starting point for walking the node/sub-nodes.
 */
tachyfont.TachyFontSet.prototype.recursivelyAdjustCssFontFamilies = function(
    node) {
  this.adjustCssFontFamilies(node);
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    this.recursivelyAdjustCssFontFamilies(children[i]);
  }
};


/**
 * Remove TachyFont from an input field.
 * @param {!Node} node The node to work on.
 */
tachyfont.TachyFontSet.prototype.adjustCssFontFamilies = function(node) {
  if (node.nodeType != Node.ELEMENT_NODE) {
    return;
  }
  var needToAdjustedCss = false;
  var cssFamily = goog.style.getComputedStyle(
      /** @type {!Element} */ (node), 'font-family');
  var families = cssFamily.split(',');
  var trimmedFamilies = [];
  for (var i = 0; i < families.length; i++) {
    var cssFontFamily =
        tachyfont.IncrementalFontUtils.trimCssFontFamily(families[i]);
    if (node.nodeName == 'INPUT') {
      // Drop TachyFont from input fields.
      if (cssFontFamily == this.cssFontFamily) {
        needToAdjustedCss = true;
      } else {
        trimmedFamilies.push(cssFontFamily);
      }
      continue;
    } else {
      if (!this.cssFontFamilyToAugment ||
          (cssFontFamily != this.cssFontFamilyToAugment)) {
        trimmedFamilies.push(cssFontFamily);
        continue;
      }
      // Check if this font is already augmented by TachyFont.
      if (i + 1 < families.length) {
        var nextName =
            tachyfont.IncrementalFontUtils.trimCssFontFamily(families[i + 1]);
        if (nextName == this.cssFontFamily) {
          // Already augmented.
          continue;
        }
      }
    }
    // Need to augment with TachyFont.
    needToAdjustedCss = true;
    trimmedFamilies.push(cssFontFamily);
    // Add TachyFont for this element.
    trimmedFamilies.push(this.cssFontFamily);
  }
  if (needToAdjustedCss) {
    var newCssFamily = trimmedFamilies.join(', ');
    node.style.fontFamily = newCssFamily;
  }
};


/**
 * For the node and sub-nodes record the needed text for each TachyFont.
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
      var aCssFontFamily =
          tachyfont.IncrementalFontUtils.trimCssFontFamily(families[i]);
      if (aCssFontFamily == this.cssFontFamily) {
        this.cssFamilyToTachyFontFamily[cssFamily] = this.cssFontFamily;
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
  var charlist = tachyFont.getIncrfont().getCharsToLoad();
  for (var i = 0; i < charArray.length; i++) {
    var c = charArray[i];
    if (charlist[c] != 1) {
      textAdded = true;
    }
    charlist[c] = 1;
  }
  return textAdded;
};


/**
 * Request an update of a group of TachyFonts.
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
 * Update a group of TachyFonts
 * @param {number} startTime The time when the chars were added to the DOM. If
 *     the number is negative then an intentional delay was happened.
 * @param {boolean} allowEarlyUse Allow the font to be used before the page has
 *     finished loading.
 * @return {!goog.Promise}
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
  return allUpdated.getPrecedingPromise()
      .then(function() {
        var updatingFonts = [];
        for (var i = 0; i < this.fonts.length; i++) {
          var fontObj = this.fonts[i].getIncrfont();
          // loadChars calls setFont
          var load = fontObj.loadChars();
          updatingFonts.push(load);
        }
        return goog.Promise.all(updatingFonts);
      }.bind(this))
      .then(
          function() {
            if (startTime == 0) {
              tachyfont.Reporter.addItemTime(
                  tachyfont.TachyFontSet.Log.SET_FONT_DOM_LOADED, '000');
            } else if (startTime >= 0) {
              tachyfont.Reporter.addItem(
                  tachyfont.TachyFontSet.Log.SET_FONT, '000',
                  goog.now() - startTime);
            } else {
              tachyfont.Reporter.addItem(
                  tachyfont.TachyFontSet.Log.SET_FONT_DELAYED, '000',
                  goog.now() + startTime);
            }
            tachyfont.Reporter.sendReport();
          },
          function(error) {
            tachyfont.TachyFontSet.reportError_(
                tachyfont.TachyFontSet.Error.UPDATE_FONT_LOAD_CHARS, error);
          },
          this)
      .thenAlways(function() {  //
        allUpdated.resolve();
      });
};
