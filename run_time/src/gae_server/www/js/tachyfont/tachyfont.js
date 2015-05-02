'use strict';

/**
 * @license
 * Copyright 2014-2015 Google Inc. All rights reserved.
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
 * Catch all uncaught errors.
 */
window.onerror =


    /**
     * @param {string} errorMsg
     * @param {string} url
     * @param {number} lineNumber
     */
    function(errorMsg, url, lineNumber) {
  if (tachyfont.reportError_) {
    var errorObj = {};
    errorObj['message'] = errorMsg;
    errorObj['url'] = url;
    errorObj['lineNumber'] = lineNumber;
    tachyfont.reportError_(tachyfont.ERROR_WINDOW_ON_ERROR_, 'window.onerror',
        errorObj);
  }

  if (goog.DEBUG) {
    debugger; // window.onerror
    console.log('Error: ' + errorMsg + ' Script: ' + url + ' Line: ' +
            lineNumber);
  }
};

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

    /** @type {goog.Uri} */
    tachyfont.uri = goog.Uri.parse(window.location.href);


    /** @type {goog.debug.Logger.Level} */
    tachyfont.debugLevel;


    /** @type {string} */
    tachyfont.debugLevel_str =
        tachyfont.uri.getParameterValue('TachyFontDebugLevel') || '';
    if (tachyfont.debugLevel_str) {
      tachyfont.debugLevel =
          goog.debug.Logger.Level.getPredefinedLevel(tachyfont.debugLevel_str);
    }

    /**
     * @type {!goog.debug.Console}
     * @private
     */
    tachyfont.debugConsole_ = new goog.debug.Console();
    tachyfont.debugConsole_.setCapturing(true);


    /**
     * @type {goog.debug.Logger}
     */
    tachyfont.logger = goog.log.getLogger('debug', tachyfont.debugLevel);


    /**
     * @type {boolean}
     */
    tachyfont.buildDemo = false;

    /**
     * Disable using persistent store. This is useful for forcing the base and
     * char data to be fetched regardless on what is in persistent store.
     */
    var persistDataStr =
        tachyfont.uri.getParameterValue('TachyFontPersistData') || '';
    // The following code implements this logic:
    // if (persistDataStr.toLowerCase() == 'false') {
    //   tachyfont.persistData = false;
    // }
    /** @type {boolean} */
    tachyfont.persistData = persistDataStr.toLowerCase() != 'false';


    /**
     * Enable reporting the needed characters. There are the chars on the page
     * that are not yet in the charList.
     */
    var reportNeededCharsStr =
        tachyfont.uri.getParameterValue('TachyFontReportNeededChars') || '';
    /** @type {boolean} */
    tachyfont.reportNeededChars = reportNeededCharsStr.toLowerCase() == 'true';

    /**
     * Enable reporting the list of loaded characters.
     */
    var reportCharListStr =
        tachyfont.uri.getParameterValue('TachyFontReportCharList') || '';
    /** @type {boolean} */
    tachyfont.reportCharList = reportCharListStr.toLowerCase() == 'true';

    /**
     * Enable reporting font table checksums.
     */
    var reportChecksumsStr =
        tachyfont.uri.getParameterValue('TachyFontReportChecksums') || '';
    /** @type {boolean} */
    tachyfont.reportChecksums = reportChecksumsStr.toLowerCase() == 'true';

    /**
     * Enable checking cmap against fileInfo and charList.
     */
    var checkCmapStr =
        tachyfont.uri.getParameterValue('TachyFontCheckCmap') || '';
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
 * @param {string} url The base url to send reports to.
 */
tachyfont.initializeReporter = function(url) {
  if (!tachyfont.reporter) {
    tachyfont.reporter = tachyfont.Reporter.getReporter(url);
  }
};


/**
 * The addItem/addItemTime constants.
 */
/** @private {string} */
tachyfont.LOG_LOAD_FONTS_ = 'lf';


/** @private {string} */
tachyfont.LOG_LOAD_FONTS_WAIT_PREVIOUS_ = 'lfw';


/** @private {string} */
tachyfont.LOG_LOAD_FONTS_BEGIN_ = 'lfb';


/** @private {string} */
tachyfont.LOG_SWITCH_FONT_ = 'sfe';


/** @private {number} */
tachyfont.LOG_TIME_BUCKET_SIZE_ = 50;


/** @private {string} */
tachyfont.LOG_SWITCH_FONT_DELTA_TIME_ = 'sfe.d';


/**
 * The reportError constants.
 */
/** @private {string} */
tachyfont.ERROR_FILE_ID_ = 'tf';


/** @private {number} */
tachyfont.ERROR_WINDOW_ON_ERROR_ = 1;


/** @private {number} */
tachyfont.ERROR_SET_FONT_ = 2;


/** @private {number} */
tachyfont.ERROR_GET_BASE_ = 3;


/**
 * The error reporter for this file.
 *
 * @param {number} errNum The error number;
 * @param {string} errId The error identifier;
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.reportError_ = function(errNum, errId, errInfo) {
  if (tachyfont.reporter) {
    tachyfont.reporter.reportError(tachyfont.ERROR_FILE_ID_ + errNum, errId,
        errInfo);
  } else {
    var obj = {};
    obj.errNum = errNum;
    obj.errId = errId;
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
  tachyfont.reportError_(obj.errNum, obj.errId, obj.errInfo);
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

  var url = fontsInfo.getUrl();
  if (!url) {
    url = window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
  }
  tachyfont.initializeReporter(url);
  tachyfont.reporter.addItemTime(tachyfont.LOG_LOAD_FONTS_);

  // TODO(bstell): this initialization of TachyFontSet should be in the
  // constructor or and init function.
  var tachyFontSet = new tachyfont.TachyFontSet(familyName);
  var tachyFonts = tachyFontSet.fonts;
  var params = opt_params || {};
  var fonts = fontsInfo.getFonts();
  for (var i = 0; i < fonts.length; i++) {
    var fontInfo = fonts[i];
    fontInfo.setFamilyName(familyName);
    fontInfo.setUrl(url);
    var tachyFont = new tachyfont.TachyFont(fontInfo, params);
    tachyFontSet.addFont(tachyFont);
    // TODO(bstell): need to support slant/width/etc.
    var fontId = tachyfont.fontId(familyName, fontInfo.getWeight());
    tachyFontSet.fontIdToIndex[fontId] = i;
  }
  var msg;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'loadFonts: wait for preceding update');
    msg = 'loadFonts';
  }
  tachyfont.reporter.addItemTime(tachyfont.LOG_LOAD_FONTS_WAIT_PREVIOUS_);
  var allLoaded = tachyFontSet.finishPrecedingUpdateFont.getChainedPromise(msg);
  // TODO(bstell): this call 'getPrecedingPromise' should be the return from the
  // getChainedPromise. getChainedPromise should be waitForPrecedingPromise.
  allLoaded.getPrecedingPromise().
      then(function() {
        tachyfont.reporter.addItemTime(tachyfont.LOG_LOAD_FONTS_BEGIN_);
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
                  tachyfont.reporter.addItemTime(
                      tachyfont.LOG_SWITCH_FONT_ + weight,
                      tachyfont.LOG_TIME_BUCKET_SIZE_);
                  var deltaTime = goog.now() - this.sfeStart_;
                  tachyfont.reporter.addItem(
                      tachyfont.LOG_SWITCH_FONT_DELTA_TIME_ + weight,
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
              tachyfont.reportError_(tachyfont.ERROR_SET_FONT_, '000', e);
            });
      }).
      thenCatch(function(e) {
        tachyfont.reportError_(tachyfont.ERROR_GET_BASE_, '000', e);
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
    // TODO(bstell): need to figure out if pendingChars_ is helpful in
    // determining when to update the char data and/or update the CSS.
    //console.log('tachyFontSet.pendingChars_ = ' + tachyFontSet.pendingChars_);
    // TODO(bstell): Should check if there were any chars.
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
        goog.log.info(tachyfont.logger, 'mutation observer: updateFont');
      }
      tachyFontSet.updateFonts(true);
    } else {
      // For pages that load new data slowly: request the fonts be updated soon.
      // This attempts to minimize expensive operations:
      //     1. The round trip delays to fetch data.
      //     2. The set @font-family time (it takes significant time to pass the
      //        blobUrl data from Javascript to C++).
      tachyFontSet.requestUpdateFonts();
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
      tachyFontSet.updateFonts(true);
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
 * Update a list of TachyFonts
 *
 * TODO(bstell): remove the tachyfont.TachyFont type.
 * @param {Array.<tachyfont.TachyFont>|tachyfont.TachyFontSet} tachyFonts The
 *     list of font objects.
 */
tachyfont.updateFonts = function(tachyFonts) {
  if (tachyFonts.constructor == Array) {
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger,
          'tachyfont.updateFonts: passing in an array is deprecated');
    }
    for (var i = 0; i < tachyFonts.length; i++) {
      var tachyFont = tachyFonts[i];
      tachyFont.incrfont.loadChars();
    }
  } else if (tachyFonts.constructor == tachyfont.TachyFontSet) {
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger, 'tachyfont.updateFonts');
    }
    tachyFonts.updateFonts(true);
  }
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


/**
 * Timing object for performance analysis.
 *
 * @type {Object}
 */
window.timer1;


/**
 * Timing object for performance analysis.
 * @type {Object}
 */
window.timer2;


/**
 * TachyFontEnv - A namespace.
 */
tachyfont.TachyFontEnv = function() {
};



/**
 * Timing class for performance analysis.
 * @constructor
 */
tachyfont.Timer = function() {
};


/**
 * Placeholder for recording a timer start time.
 */
tachyfont.Timer.prototype.start = function() {
};


/**
 * Placeholder for recording a timer end time.
 */
tachyfont.Timer.prototype.end = function() {
};


/**
 * Placeholder for recording a timer done time (which changes the color).
 */
tachyfont.Timer.prototype.done = function() {
};


/**
 * Timing object for performance analysis.
 * @type {Object}
 */
tachyfont.timer2;


/**
 * Timing object for performance analysis.
 * @type {Object}
 */
tachyfont.timer1;

//Support running without demo features.
if (window.Timer) {
  tachyfont.timer1 = window.timer1;
  tachyfont.timer2 = window.timer2;

} else {
  /** Stub out timer functions. */
  tachyfont.timer1 = new tachyfont.Timer();
  tachyfont.timer2 = new tachyfont.Timer();
}


/**
 * Debugging help
 * Stub out the debug functions.
 * @type {Object}
 */
tachyfont.ForDebug = function() {
};


/**
 * Useful for debugging.
 * @type {Object}
 */
window.ForDebug;

if (window.ForDebug) {
  tachyfont.ForDebug = window.ForDebug;
} else {

  /** Stub out the debug functions.
   * @param {string} name The cookie name.
   * @param {*} fallback A value to return if the cookie is not found.
   * @return {*}
   */
  tachyfont.ForDebug.getCookie = function(name, fallback) {
    return fallback;
  };

  /** Stub out the debug functions.
   * @param {Object} incrFontMgr The incremental font manager object.
   * @param {string} fontName The font name.
   */
  tachyfont.ForDebug.addDropIdbButton = function(incrFontMgr, fontName) {};
  /** Stub out the debug functions. */
  tachyfont.ForDebug.addBandwidthControl = function() {};
  /** Stub out the debug functions. */
  tachyfont.ForDebug.addTimingTextSizeControl = function() {};
}

goog.exportSymbol('tachyfont.loadFonts', tachyfont.loadFonts);
