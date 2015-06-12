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

goog.provide('tachyfont');
goog.provide('tachyfont.IncrementalFontLoader');
goog.provide('tachyfont.uint8');

goog.require('goog.Promise');
goog.require('goog.Uri');
goog.require('goog.debug.Console');
goog.require('goog.debug.Logger');
goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.FontsInfo');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.TachyFont');
goog.require('tachyfont.TachyFontSet');


/**
 * Enum for error values.
 * @enum {string}
 * @private
 */
tachyfont.Error_ = {
  FILE_ID: 'ETF',
  WINDOW_ON_ERROR: '01',
  SET_FONT: '02',
  GET_BASE: '03'
};


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number (encoded in a string);
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.reportError_ = function(errNum, errInfo) {
  if (tachyfont.reporter) {
    tachyfont.reporter.reportError(tachyfont.Error_.FILE_ID + errNum, '000',
        errInfo);
  } else {
    var obj = {};
    obj.errNum = errNum;
    obj.errInfo = errInfo;
    setTimeout(function() {
      tachyfont.delayedReportError_(obj);
    }.bind(obj), 1000);
  }
};


/**
 * Re-run the error report.
 *
 * @param {Object} obj An object holding the parameters for the error report.
 * @private
 */
tachyfont.delayedReportError_ = function(obj) {
  goog.log.error(tachyfont.logger, 'delayedReportError_');
  tachyfont.reportError_(obj.errNum, obj.errInfo);
};


/**
 * Report any uncaught errors.
 *
 * @param {Event} error The error information.
 * @private
 */
tachyfont.windowOnError_ = function(error) {
  var errorObj = {};
  errorObj['message'] = error.error;
  errorObj['url'] = error.filename;
  errorObj['lineNumber'] = error.lineno;
  tachyfont.reportError_(tachyfont.Error_.WINDOW_ON_ERROR, errorObj);
};

if (window.addEventListener) {
  window.addEventListener('error', tachyfont.windowOnError_, false);
} else if (window.attachEvent) { // for versions previous to IE9
  window.attachEvent('onerror', tachyfont.windowOnError_);
}

if (goog.DEBUG) {
  /**
   * A class variable to limit debug initialization to a single time.
   *
   * @private {boolean}
   */
  tachyfont.hasInitializedDebug_ = false;

  /**
   * A function to initialize the debug setup.
   *
   * @private
   */
  tachyfont.debugInitialization_ = function() {
    if (tachyfont.hasInitializedDebug_) {
      return;
    }

    tachyfont.hasInitializedDebug_ = true;

    var uri = goog.Uri.parse(window.location.href);
    var debugLevel;
    var debugLevelStr = uri.getParameterValue('TachyFontDebugLevel') || '';
    if (debugLevelStr) {
      debugLevel = goog.debug.Logger.Level.getPredefinedLevel(debugLevelStr);
    }
    var debugConsole = new goog.debug.Console();
    debugConsole.setCapturing(true);


    /**
     * @type {goog.debug.Logger}
     */
    tachyfont.logger = goog.log.getLogger('debug', debugLevel);


    /**
     * @type {boolean}
     */
    tachyfont.buildDemo = false;

    /**
     * Disable using persistent store. This is useful for forcing the base and
     * char data to be fetched regardless on what is in persistent store.
     */
    var persistDataStr = uri.getParameterValue('TachyFontPersistData') || '';
    // The following code implements this logic:
    // if (persistDataStr.toLowerCase() == 'false') {
    //   tachyfont.persistData = false;
    // }
    /** @type {boolean} */
    tachyfont.persistData = persistDataStr.toLowerCase() != 'false';

    /**
     * Enable checking cmap against fileInfo and charList.
     */
    var checkCmapStr = uri.getParameterValue('TachyFontCheckCmap') || '';
    /** @type {boolean} */
    tachyfont.checkCmap = checkCmapStr.toLowerCase() == 'true';
  };
}


/**
 * Enable/disable using/saving persisted data.
 *
 * @type {boolean}
 */
tachyfont.persistData = true;


/**
 * A mapping from css weight names to weights.
 *
 * @type {!Object.<string, string>}
 */
tachyfont.cssWeightToNumber = {
  'lighter': '300',
  'normal': '400',
  'bold': '700',
  'bolder': '800'
};


/**
 * A map of the codepoints that should be blank.
 *
 * @type {!Object.<number, number>}
 */
tachyfont.BLANK_CHARS = {
  // White space characters.
  0x0009: 1, 0x000A: 1, 0x000B: 1, 0x000C: 1, 0x000D: 1, 0x0020: 1, 0x0085: 1,
  0x00A0: 1, 0x1680: 1, 0x2000: 1, 0x2001: 1, 0x2002: 1, 0x2003: 1, 0x2004: 1,
  0x2005: 1, 0x2006: 1, 0x2007: 1, 0x2008: 1, 0x2009: 1, 0x200A: 1, 0x2028: 1,
  0x2029: 1, 0x202F: 1, 0x205F: 1, 0x3000: 1,

  // Default ignorable character set Source:
  // http://www.unicode.org/L2/L2002/02368-default-ignorable.pdf
  // "Default-ignorable code points ... have no visible glyph"
  0x00AD: 1, 0x034F: 1, 0x061C: 1, 0x115F: 1, 0x1160: 1, 0x17B4: 1, 0x17B5: 1,
  0x3164: 1, 0x180B: 1, 0x180C: 1, 0x180D: 1, 0x180E: 1, 0x200B: 1, 0x200C: 1,
  0x200D: 1, 0x200E: 1, 0x200F: 1, 0x202A: 1, 0x202B: 1, 0x202C: 1, 0x202D: 1,
  0x202E: 1, 0x2060: 1, 0x2061: 1, 0x2062: 1, 0x2063: 1, 0x2064: 1, 0x2065: 1,
  0x2066: 1, 0x2067: 1, 0x2068: 1, 0x2069: 1, 0x206A: 1, 0x206B: 1, 0x206C: 1,
  0x206D: 1, 0x206E: 1, 0x206F: 1, 0xFE00: 1, 0xFE01: 1, 0xFE02: 1, 0xFE03: 1,
  0xFE04: 1, 0xFE05: 1, 0xFE06: 1, 0xFE07: 1, 0xFE08: 1, 0xFE09: 1, 0xFE0A: 1,
  0xFE0B: 1, 0xFE0C: 1, 0xFE0D: 1, 0xFE0E: 1, 0xFE0F: 1, 0xFEFF: 1, 0xFFA0: 1,
  0x1D173: 1, 0x1D174: 1, 0x1D175: 1, 0x1D176: 1, 0x1D177: 1, 0x1D178: 1,
  0x1D179: 1, 0x1D17A: 1
};


/**
 * If the number of characters in the request is less than this count then add
 * additional characters to obfuscate the actual request.
 *
 * @type {number}
 */
tachyfont.MINIMUM_NON_OBFUSCATION_LENGTH = 20;


/**
 * The range of characters to pick from.
 *
 * @type {number}
 */
tachyfont.OBFUSCATION_RANGE = 256;


/**
 * @typedef {number}
 */
tachyfont.uint8;


/**
 * @typedef {Object}
 * TODO(bstell): this probably belongs in BinaryFontEditor.
 */
tachyfont.IncrementalFontLoader;


/**
 * Logging and error reporter.
 *
 * @type {!tachyfont.Reporter}
 */
tachyfont.reporter;


/**
 * Initialize the tachyfont reporter.
 *
 * @param {string} reportUrl The base url to send reports to.
 */
tachyfont.initializeReporter = function(reportUrl) {
  if (!tachyfont.reporter) {
    tachyfont.reporter = tachyfont.Reporter.getReporter(reportUrl);
  }
};


/**
 * Enum for logging values.
 * @enum {string}
 * @private
 */
tachyfont.Log_ = {
  LOAD_FONTS: 'LTFLF.',
  LOAD_FONTS_WAIT_PREVIOUS: 'LTFLW.',
  SWITCH_FONT: 'LTFSE.',
  SWITCH_FONT_DELTA_TIME: 'LTFSD.'
};


/**
 * Create a font identifying string.
 *
 * @param {string} family The font family name;
 * @param {string} weight The font weight;
 * @return {string} The identifier for this font.
 */
tachyfont.fontId = function(family, weight) {
  // TODO(bstell): need to support slant/width/etc.
  var fontId = family + ';' + weight;
  return fontId;
};


/**
 * Create a list of TachyFonts
 *
 * @param {string} familyName The font-family name.
 * TODO(bstell): remove the Object type.
 * @param {!tachyfont.FontsInfo} fontsInfo The information about the
 *     fonts.
 * @param {Object.<string, string>=} opt_params Optional parameters.
 * @return {tachyfont.TachyFontSet} The TachyFontSet object.
 */
tachyfont.loadFonts = function(familyName, fontsInfo, opt_params) {
  if (goog.DEBUG) {
    tachyfont.debugInitialization_();
    goog.log.fine(tachyfont.logger, 'loadFonts');
  }

  var dataUrl = fontsInfo.getDataUrl();
  if (!dataUrl) {
    dataUrl = window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
  }
  var reportUrl = fontsInfo.getReportUrl() || dataUrl;
  tachyfont.initializeReporter(reportUrl);
  tachyfont.reporter.addItemTime(tachyfont.Log_.LOAD_FONTS + '000');

  // Check if the persistent stores should be dropped.
  var uri = goog.Uri.parse(window.location.href);
  var dropDataStr = uri.getParameterValue('TachyFontDropData') || '';
  var dropData = dropDataStr == 'true';

  // TODO(bstell): this initialization of TachyFontSet should be in the
  // constructor or and init function.
  var tachyFontSet = new tachyfont.TachyFontSet(familyName);
  var tachyFonts = tachyFontSet.fonts;
  var params = opt_params || {};
  var fonts = fontsInfo.getFonts();
  for (var i = 0; i < fonts.length; i++) {
    var fontInfo = fonts[i];
    fontInfo.setFamilyName(familyName);
    fontInfo.setDataUrl(dataUrl);
    var tachyFont = new tachyfont.TachyFont(fontInfo, dropData, params);
    tachyFontSet.addFont(tachyFont);
    // TODO(bstell): need to support slant/width/etc.
    var fontId = tachyfont.fontId(familyName, fontInfo.getWeight());
    tachyFontSet.fontIdToIndex[fontId] = i;
  }
  var msg = 'loadFonts';
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'loadFonts: wait for preceding update');
  }
  var waitPreviousTime = goog.now();
  var allLoaded = tachyFontSet.finishPrecedingUpdateFont.getChainedPromise(msg);
  // TODO(bstell): this call 'getPrecedingPromise' should be the return from the
  // getChainedPromise. getChainedPromise should be waitForPrecedingPromise.
  allLoaded.getPrecedingPromise().
      then(function() {
        tachyfont.reporter.addItem(tachyfont.Log_.LOAD_FONTS_WAIT_PREVIOUS +
            '000', goog.now() - waitPreviousTime);
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'loadFonts: done waiting for preceding update');
        }
        // Try to get the base from persistent store.
        var bases = [];
        for (var i = 0; i < tachyFonts.length; i++) {
          var incrfont = tachyFonts[i].incrfont;
          var persistedBase = incrfont.getPersistedBase();
          bases.push(persistedBase);
        }
        return goog.Promise.all(bases);
      }).
      then(function(arrayBaseData) {
        var fetchedBases = [];
        for (var i = 0; i < tachyFonts.length; i++) {
          var loadedBase = arrayBaseData[i];
          var incrfont = tachyFonts[i].incrfont;
          if (loadedBase != null) {
            incrfont.alreadyPersisted = true;
            incrfont.needToSetFont = true;
          } else {
            // If not persisted the fetch the base from the URL.
            loadedBase = incrfont.getUrlBase(incrfont.backendService,
                incrfont.fontInfo);
          }
          arrayBaseData[i] = goog.Promise.resolve(loadedBase);
        }
        // Have loaded fonts from persistent store or URL.
        goog.Promise.all(arrayBaseData).
            then(function(arrayBaseData) {
              var allCssSet = [];
              for (var i = 0; i < tachyFonts.length; i++) {
                var incrFont = tachyFonts[i].incrfont;
                var loadedBase = arrayBaseData[i];
                incrFont.base.resolve(loadedBase);
                // If not persisted then need to wait for DOMContentLoaded to
                // set the font.
                if (!incrFont.alreadyPersisted) {
                  if (goog.DEBUG) {
                    goog.log.fine(tachyfont.logger, 'loadFonts: not persisted');
                  }
                  allCssSet.push(goog.Promise.resolve(null));
                  continue;
                }
                // The font was in persistent store so:
                // * it is very likely that the font _already_ has the UI text
                //   so immediately show the UI in the TachyFont.
                if (goog.DEBUG) {
                  goog.log.fine(tachyfont.logger, 'loadFonts: setFont_');
                }
                // TODO(bstell): only set the font if there are characters.
                incrFont.sfeStart_ = goog.now();
                var cssSet = incrFont.setFont(loadedBase[1],
                    loadedBase[0].isTtf).
                then(function() {
                  // Report Set Font Early.
                  var weight = this.fontInfo.getWeight();
                  tachyfont.reporter.addItem(tachyfont.Log_.SWITCH_FONT +
                  weight, goog.now() - incrFont.startTime);
                  var deltaTime = goog.now() - this.sfeStart_;
                  tachyfont.reporter.addItem(
                      tachyfont.Log_.SWITCH_FONT_DELTA_TIME + weight,
                      deltaTime);
                  if (goog.DEBUG) {
                    goog.log.fine(tachyfont.logger, 'loadFonts: setFont_ done');
                  }
                  tachyfont.IncrementalFontUtils.setVisibility(this.style,
                      this.fontInfo, true);
                  // Release other operations to proceed.
                  this.base.resolve(loadedBase);
                }.bind(incrFont));
                allCssSet.push(cssSet);
              }
              return goog.Promise.all(allCssSet);
            }).
            then(function(allSetResults) {
              if (goog.DEBUG) {
                goog.log.fine(tachyfont.logger, 'loadFonts: all fonts loaded');
              }
              // Allow any pending updates to happen.
              allLoaded.resolve();
            }).
            thenCatch(function(e) {
              allLoaded.reject();
              tachyfont.reportError_(tachyfont.Error_.SET_FONT, e);
            });
      }).
      thenCatch(function(e) {
        tachyfont.reportError_(tachyfont.Error_.GET_BASE, e);
        allLoaded.reject();
      });


  // Get any characters that are already in the DOM.
  tachyFontSet.recursivelyAddTextToFontGroups(document.documentElement);
  // Remove TachyFont from INPUT fields.
  tachyFontSet.recursivelyRemoveTachyFontFromInputFields(
      document.documentElement);

  // Add DOM mutation observer.
  // This records the changes on a per-font basis.
  // Note: mutation observers do not look at INPUT field changes.
  //create an observer instance
  var observer = new MutationObserver(function(mutations) {
    if (goog.DEBUG) {
      goog.log.fine(tachyfont.logger, 'MutationObserver');
    }
    var mutationTime = goog.now();
    mutations.forEach(function(mutation) {
      if (mutation.type == 'childList') {
        for (var i = 0; i < mutation.addedNodes.length; i++) {
          var node = mutation.addedNodes[i];
          tachyFontSet.recursivelyAddTextToFontGroups(node);
          // Remove TachyFont from INPUT fields.
          tachyFontSet.recursivelyRemoveTachyFontFromInputFields(node);
        }
      } else if (mutation.type == 'characterData') {
        if (goog.DEBUG) {
          if (mutation.target.nodeName !== '#text') {
            goog.log.info(tachyfont.logger,
                'need to handle characterData for non-text');
          }
        }
        tachyFontSet.recursivelyAddTextToFontGroups(mutation.target);
      }
    });
    // If this is the 1st mutation event and it happened after DOMContentLoaded
    // then do the update now.
    var immediateUpdate;
    if (!tachyFontSet.hadMutationEvents && tachyFontSet.domContentLoaded) {
      immediateUpdate = true;
    } else {
      immediateUpdate = false;
    }
    tachyFontSet.hadMutationEvents = true;
    if (immediateUpdate) {
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger, 'mutation observer: updateFonts');
      }
      tachyFontSet.updateFonts(mutationTime, true);
    } else {
      // For pages that load new data slowly: request the fonts be updated soon.
      // This attempts to minimize expensive operations:
      //     1. The round trip delays to fetch data.
      //     2. The set @font-family time (it takes significant time to pass the
      //        blobUrl data from Javascript to C++).
      tachyFontSet.requestUpdateFonts(mutationTime);
    }
  });

  // Watch for these mutations.
  var config = /** @type {!MutationObserverInit} */ ({ 'childList': true,
    'subtree': true, 'characterData': true });
  observer.observe(document.documentElement, config);

  // Update the fonts when the page content is loaded.
  document.addEventListener('DOMContentLoaded', function(event) {
    tachyFontSet.domContentLoaded = true;
    // On DOMContentLoaded we want to update the fonts. If there have been
    // mutation events then do the update now. Characters should be in the DOM
    // now but the order of DOMContentLoaded and mutation events is not defined
    // and a mutation event should be coming right after this. We could scan the
    // DOM and do the update right now but scanning the DOM is expensive. So
    // instead wait for the mutation event.
    if (tachyFontSet.hadMutationEvents) {
      // We have characters so update the fonts.
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger, 'DOMContentLoaded: updateFonts');
      }
      tachyFontSet.updateFonts(0, true);
    } else {
      // The mutation event should be very soon.
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger,
            'DOMContentLoaded: wait for mutation event');
      }
    }
  });

  return tachyFontSet;
};


/**
 * Convert a string to an array of characters.
 * This function handles surrogate pairs.
 *
 * @param {string} str The input string.
 * @return {Array.<string>} The array of characters.
 */
tachyfont.stringToChars = function(str) {
  var charArray = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    var cc = c.charCodeAt(0);
    if (cc >= 0xD800 && cc <= 0xDBFF) {
      i += 1;
      c += str.charAt(i);
    }
    charArray.push(c);
  }
  return charArray;
};


/**
 * Convert a char to its codepoint.
 * This function handles surrogate pairs.
 *
 * @param {string} inputChar The input char (string).
 * @return {number} The numeric value.
 */
tachyfont.charToCode = function(inputChar) {
  var cc = inputChar.charCodeAt(0);
  if (cc >= 0xD800 && cc <= 0xDBFF) {
    var high = (cc - 0xD800) << 10;
    var low = inputChar.charCodeAt(1) - 0xDC00;
    var codepoint = high + low + 0x10000;
    return codepoint;
  } else {
    return cc;
  }
};


goog.exportSymbol('tachyfont.loadFonts', tachyfont.loadFonts);
