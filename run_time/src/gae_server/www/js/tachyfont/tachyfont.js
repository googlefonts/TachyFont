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
goog.provide('tachyfont.Error');
goog.provide('tachyfont.TachyFont');

goog.require('goog.Promise');
goog.require('goog.Uri');
goog.require('goog.debug.Console');
goog.require('goog.debug.Logger');
goog.require('goog.log');
goog.require('goog.log.Level');
/** @suppress {extraRequire} */
goog.require('tachyfont.FontsInfo');
goog.require('tachyfont.IncrementalFont');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Logger');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.TachyFontSet');
goog.require('tachyfont.utils');



/**
 * TachyFont - A namespace.
 * @param {!tachyfont.FontInfo} fontInfo The font info.
 * @param {boolean} dropData If true then drop the persistent store data.
 * @param {Object=} opt_params Optional parameters.
 * @constructor
 */
tachyfont.TachyFont = function(fontInfo, dropData, opt_params) {
  var params = opt_params || {};

  /**
   * The object that handles the binary manipulation of the font data.
   *
   * TODO(bstell): integrate the manager into this object.
   */
  this.incrfont = tachyfont.IncrementalFont.createManager(fontInfo, dropData,
      params);
};


/**
 * Lazily load the data for these chars.;
 */
tachyfont.TachyFont.prototype.loadNeededChars = function() {
  this.incrfont.loadChars();
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.Error = {
  FILE_ID: 'ETF',
  WINDOW_ON_ERROR: '01',  // '01' is deprecated.
  SET_FONT: '02',
  GET_BASE: '03',
  MISSING_FEATURE: '04',
  KNOWN_WINDOW_ON_ERROR: '05',
  UNKNOWN_WINDOW_ON_ERROR: '06',
  NOT_ENOUGH_STORAGE: '07',
  STORAGE_INFORMATION_FUNCTION: '08',
  GET_STORAGE_INFORMATION: '09'
};


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number (encoded in a string);
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.reportError_ = function(errNum, errInfo) {
  if (tachyfont.Reporter.isReady()) {
    tachyfont.Reporter.reportError(tachyfont.Error.FILE_ID + errNum, '000',
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
  goog.log.error(tachyfont.Logger.logger, 'delayedReportError_');
  tachyfont.reportError_(obj.errNum, obj.errInfo);
};


if (window.addEventListener) {
  /**
   * Report any uncaught errors.
   *
   * @param {Event} error The error information.
   * @private
   */
  tachyfont.windowOnError_ = function(error) {
    if (!error['filename']) {
      // The information is stripped from the report because of CORS issues.
      tachyfont.reportError_(tachyfont.Error.UNKNOWN_WINDOW_ON_ERROR, '');
      return;
    }
    var errorObj = {};
    errorObj['message'] = error['message'];
    errorObj['filename'] = error['filename'];
    errorObj['lineno'] = error['lineno'];
    errorObj['colno'] = error['colno'];
    if (error.error) {
      errorObj['stack'] = error['error']['stack'].substring(0, 1000);
    }
    var errorStr = JSON.stringify(errorObj);
    tachyfont.reportError_(tachyfont.Error.KNOWN_WINDOW_ON_ERROR, errorStr);
    tachyfont.reportError_(tachyfont.Error.WINDOW_ON_ERROR, errorStr);
  };
  window.addEventListener('error', tachyfont.windowOnError_, false);
}

if (goog.DEBUG) {
  /**
   * A class variable to limit debug initialization to a single time.
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
    var debugLevelStr =
        uri.getParameterValue('TachyFontDebugLevel') || 'WARNING';
    debugLevel = goog.debug.Logger.Level.getPredefinedLevel(debugLevelStr);
    var debugConsole = new goog.debug.Console();
    debugConsole.setCapturing(true);
    tachyfont.Logger.init(debugLevel);

    /**
     * For debugging: option to disable the obfuscation.
     *
     * Obfuscation is a security feature. If a page was presenting a short
     * security key it is possible that a TachyFont server could figure out the
     * security key from the character request. Obfuscation adds random
     * characters to small character data requests to make this difficult.
     *
     * For debugging this obfuscation adds noise to the characters requests.
     */
    var noObfuscateStr = uri.getParameterValue('TachyFontNoObfuscate') || '';
    tachyfont.utils.noObfuscate = noObfuscateStr.toLowerCase() == 'true';

    /**
     * Enable checking cmap against fileInfo and charList.
     */
    var checkCmapStr = uri.getParameterValue('TachyFontCheckCmap') || '';
    /** @type {boolean} */
    tachyfont.checkCmap = checkCmapStr.toLowerCase() == 'true';
  };
}


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
 * Load a list of TachyFonts
 * @param {string} familyName The font-family name.
 * TODO(bstell): remove the Object type.
 * @param {!tachyfont.FontsInfo} fontsInfo Information about the fonts.
 * @param {Object<string, string>=} opt_params Optional parameters.
 * @return {!goog.Promise<!tachyfont.TachyFontSet>} A promise that returns the
 *     TachyFontSet object.
 */
tachyfont.loadFonts = function(familyName, fontsInfo, opt_params) {
  // TODO(bstell): initialize tachyfont.Reporter here so the errors in
  // isSupportedBrowser can be reported.
  // Check if this browser has the necessary features to run TachyFont.
  if (!tachyfont.isSupportedBrowser()) {
    return goog.Promise.reject('unsupported browser');
  }

  var fontInfos = fontsInfo.getPrioritySortedFonts();
  return tachyfont.manageStorageUsage(fontInfos).then(function() {
    // Initialize the objects.
    var tachyFontSet =
        tachyfont.loadFonts_init_(familyName, fontsInfo, opt_params);
    // Load the fonts.
    tachyfont.loadFonts_loadAndUse_(tachyFontSet);

    // Run this in parallel with loading the fonts.
    tachyfont.loadFonts_setupTextListeners_(tachyFontSet);

    return tachyFontSet;
  });
};


/**
 * Gets the used/quota storage information.
 * @return {!goog.Promise<!Array<number>>}
 */
// TODO(bstell): move the to persist_idb.js
tachyfont.getStorageInfo = function() {
  return new goog
      .Promise(function(resolve, reject) {
        /**
         * Chrome storage object. See
         * https://developers.google.com/chrome/whitepapers/storage for details.
         * @type {StorageQuota}
         */
        var storageInfo = window['navigator'] ?
            window['navigator']['webkitTemporaryStorage'] || null :
            null;
        if (!storageInfo) {
          reject([tachyfont.Error.STORAGE_INFORMATION_FUNCTION, '']);
          return;
        }
        storageInfo.queryUsageAndQuota(
            function(used, quota) {
              resolve([used, quota]);
            },
            function(e) {
              reject([
                tachyfont.Error.GET_STORAGE_INFORMATION, e
              ]);
            });
      })
      .thenCatch(function(errorInfo) {
        tachyfont.reportError_(
            /* errorNumber */ errorInfo[0],
            /* errorMessage */ errorInfo[1]);
        // Failed to get the storage info so pretend there is plenty.
        return [/* used */ 0, /* quota */ 10000000000];
      });
};


/**
 * Manages the persistent storage usage.
 * The intent is to handle low memory by only loading the fonts that can be
 * stored.
 * @param {!Array<!tachyfont.FontInfo>} fontInfos Information about the fonts.
 * @return {!goog.Promise<number,?>}
 */
tachyfont.manageStorageUsage = function(fontInfos) {
  return tachyfont.getAvailableStorage()
      .then(function(available) {
        // Determine if there is enough storage even if we needed to store every
        // font.
        var totalNeeded = 0;
        for (var i = 0; i < fontInfos.length; i++) {
          var fontInfo = fontInfos[i];
          totalNeeded += fontInfo.getSize();
        }
        if (available > totalNeeded) {
          return available - totalNeeded;
        }

        var previousPromise = goog.Promise.resolve(available);
        for (var i = 0; i < fontInfos.length; i++) {
          previousPromise =
              tachyfont.manageFontStorage(fontInfos[i], previousPromise);
        }
        return previousPromise;
      })
      .then(function(available) {
        if (available < 0) {
          tachyfont.reportError_(
              tachyfont.Error.NOT_ENOUGH_STORAGE, '' + available);
        }
        return available;
      })
      .thenCatch(function(e) {
        // Unable to determine if there is enough storage space so just assume
        // there is enough and keep going.
      });
};


/**
 * Checks the available space against the space needed by the font.
 * If font is not already stored then checks if there is enough space to load
 * the font. If there is not enough space then marks the font not to be loaded.
 * @param {!tachyfont.FontInfo} fontInfo The font info.
 * @param {!goog.Promise<number,?>} previousPromise The promise to wait for.
 * @return {!goog.Promise<number,?>}
 */
// TODO(bstell): move the to persist_idb.js
// But first need to move Logger and Reporter into utils.
tachyfont.manageFontStorage = function(fontInfo, previousPromise) {
  return previousPromise.then(function(available) {
    var dbName = tachyfont.IncrementalFont.getDbName(fontInfo);
    return tachyfont.isFontStored(dbName).then(function(isStored) {
      var size = fontInfo.getSize();
      if (!isStored && size > available) {
        fontInfo.setShouldLoad(false);
      }
      return available - size;
    });
  });
};


/**
 * Gets the available storage space.
 * @return {!goog.Promise<number>}
 */
// TODO(bstell): move the to persist_idb.js
tachyfont.getAvailableStorage = function() {
  return new goog.Promise(function(resolve, reject) {
    // Get the storage usage and quota.
    tachyfont.getStorageInfo().then(
        function(storageInfo) {
          var used = storageInfo[0];
          var quota = storageInfo[1];
          resolve(quota - used);
        },
        function(e) { reject(e); });
  });
};


/**
 * Determines if the font is already loaded.
 * @param {string} dbName The data storage name.
 * @return {!goog.Promise<boolean,?>}
 */
// TODO(bstell): move the to persist_idb.js
tachyfont.isFontStored = function(dbName) {
  return new goog.Promise(function(resolve) {
    var request = window.indexedDB.open(dbName);
    request.onsuccess = function(event) {
      var db = event.target.result;
      var objectStoreNames = db.objectStoreNames;
      var isStored = objectStoreNames.contains(tachyfont.utils.IDB_BASE) &&
          objectStoreNames.contains(tachyfont.utils.IDB_CHARLIST);
      resolve(isStored);
    };
    request.onerror = function(e) {
      // Something is wrong with storage so assume the font is not loaded.
      resolve(false);
    };
  });
};


/**
 * Check whether TachyFont will run on this browser.
 * @param {!Window=} opt_windowObject Optional To support testing pass in a
 *     window object.
 * @return {boolean}
 */
tachyfont.isSupportedBrowser = function(opt_windowObject) {
  // Some window values are not overrideable so for testing allow passing in a
  // regular object.
  var windowObject = opt_windowObject || window;

  var errorMessage = '';
  if (typeof windowObject.indexedDB != 'object') {
    errorMessage += 'ID,';
  }
  if (typeof windowObject.MutationObserver != 'function') {
    errorMessage += 'MO,';
  }
  if (typeof windowObject.document.fonts != 'object' ||
      typeof windowObject.document.fonts.load != 'function') {
    errorMessage += 'FL,';
  }

  if (errorMessage) {
    // TODO(bstell): add this error report once tachyfont.Reporter is
    // initialized before this call.
    // tachyfont.reportError_(achyfont.Error_.MISSING_FEATURE, errorMessage);
    return false;
  }
  return true;
};


/**
 * Load and use a list of TachyFonts
 *
 * @param {tachyfont.TachyFontSet} tachyFontSet The list of TachyFonts.
 * @return {!goog.Promise}
 * @private
 */
tachyfont.loadFonts_loadAndUse_ = function(tachyFontSet) {
  var msg = 'loadFonts';
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'loadFonts: wait for preceding update');
  }
  var waitPreviousTime = goog.now();
  var waitForPrecedingPromise =
      tachyFontSet.finishPrecedingUpdateFont.getChainedPromise(msg);
  return waitForPrecedingPromise.getPrecedingPromise().then(function() {
    tachyfont.Reporter.addItem(tachyfont.Log_.LOAD_FONTS_WAIT_PREVIOUS +
            '000', goog.now() - waitPreviousTime);
    return goog.Promise.resolve().then(function() {
      var serialPromise = goog.Promise.resolve(0);
      var fonts = tachyFontSet.fonts;
      for (var i = 0; i < fonts.length; i++) {
        serialPromise = serialPromise.then(function(index) {
          var font = fonts[index];
          // Load the fonts from persistent store or URL.
          return tachyfont.loadFonts_getBaseFonts_([font])
              .then(function(baseData) {
                return tachyfont.loadFonts_useFonts_([font], baseData);
              })
              .then(function() {
                return ++index;
              });
        });
      }
      return serialPromise;
    })
        .then(function(allSetResults) {
          // Release the lock.
          waitForPrecedingPromise.resolve();
        })
        .thenCatch(function(e) {
          waitForPrecedingPromise.reject();
          tachyfont.reportError_(tachyfont.Error.SET_FONT, e);
        });
  })
      .thenCatch(function(e) {
        tachyfont.reportError_(tachyfont.Error.GET_BASE, e);
        waitForPrecedingPromise.reject();
      });
};


/**
 * Initialization before loading a list of TachyFonts
 *
 * @param {string} familyName The font-family name.
 * TODO(bstell): remove the Object type.
 * @param {!tachyfont.FontsInfo} fontsInfo The information about the
 *     fonts.
 * @param {Object<string, string>=} opt_params Optional parameters.
 * @return {tachyfont.TachyFontSet} The TachyFontSet object.
 * @private
 */
tachyfont.loadFonts_init_ = function(familyName, fontsInfo, opt_params) {
  if (goog.DEBUG) {
    tachyfont.debugInitialization_();
    goog.log.fine(tachyfont.Logger.logger, 'loadFonts');
  }

  var dataUrl = fontsInfo.getDataUrl();
  if (!dataUrl) {
    dataUrl = window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
  }
  var reportUrl = fontsInfo.getReportUrl() || dataUrl;
  tachyfont.Reporter.initReporter(reportUrl);
  tachyfont.Reporter.addItemTime(tachyfont.Log_.LOAD_FONTS + '000');

  // Check if the persistent stores should be dropped.
  var uri = goog.Uri.parse(window.location.href);
  var dropDataStr = uri.getParameterValue('TachyFontDropData') || '';
  var dropData = dropDataStr == 'true';

  var tachyFontSet = new tachyfont.TachyFontSet(familyName);
  var params = opt_params || {};
  var fontInfos = fontsInfo.getPrioritySortedFonts();
  for (var i = 0; i < fontInfos.length; i++) {
    var fontInfo = fontInfos[i];
    fontInfo.setFamilyName(familyName);
    fontInfo.setDataUrl(dataUrl);
    var tachyFont = new tachyfont.TachyFont(fontInfo, dropData, params);
    tachyFontSet.addFont(tachyFont);
    // TODO(bstell): need to support slant/width/etc.
    var fontId = tachyfont.utils.fontId(familyName, fontInfo.getWeight());
    tachyFontSet.fontIdToIndex[fontId] = i;
  }
  return tachyFontSet;
};


/**
 * Get the base fonts for a list of TachyFonts
 *
 * @param {Array<tachyfont.TachyFont>} tachyFonts The list of TachyFonts for
 *     which to get the base fonts
 * @return {goog.Promise} The promise for the base fonts (fonts ready to have
 *     character data added).
 * @private
 */
tachyfont.loadFonts_getBaseFonts_ = function(tachyFonts) {
  // Try to get the base from persistent store.
  var bases = [];
  for (var i = 0; i < tachyFonts.length; i++) {
    var incrfont = tachyFonts[i].incrfont;
    var persistedBase = incrfont.getBaseFontFromPersistence();
    bases.push(persistedBase);
  }
  return goog.Promise.all(bases)
      .then(function(arrayBaseData) {
        for (var i = 0; i < tachyFonts.length; i++) {
          var loadedBase = arrayBaseData[i];
          var incrfont = tachyFonts[i].incrfont;
          if (loadedBase != null) {
            incrfont.alreadyPersisted = true;
            incrfont.needToSetFont = true;
            arrayBaseData[i] = goog.Promise.resolve(loadedBase);
          } else {
            // If not persisted the fetch the base from the URL.
            arrayBaseData[i] = incrfont.getBaseFontFromUrl(
               incrfont.backendService, incrfont.fontInfo);
          }
        }
        return goog.Promise.all(arrayBaseData);
      });
};


/**
 * Make use of a list of TachyFonts
 *
 * @param {Array<tachyfont.TachyFont>} tachyFonts The list of TachyFonts for
 *     which to get the base fonts
 * @param {Array<Array<Object>>} arrayBaseData The TachyFont base fonts.
 * @return {goog.Promise} The promise for the base fonts (fonts ready to have
 *     character data added).
 * @private
 */
tachyfont.loadFonts_useFonts_ = function(tachyFonts, arrayBaseData) {
  var allCssSet = [];
  for (var i = 0; i < tachyFonts.length; i++) {
    var incrFont = tachyFonts[i].incrfont;
    var loadedBase = arrayBaseData[i];
    incrFont.base.resolve(loadedBase);
    // If not persisted then need to wait for DOMContentLoaded to
    // set the font.
    if (!incrFont.alreadyPersisted) {
      if (goog.DEBUG) {
        goog.log.fine(tachyfont.Logger.logger, 'loadFonts: not persisted');
      }
      allCssSet.push(goog.Promise.resolve(null));
      continue;
    }
    // The font was in persistent store so:
    // * it is very likely that the font _already_ has the UI text
    //   so immediately show the UI in the TachyFont.
    if (goog.DEBUG) {
      goog.log.fine(tachyfont.Logger.logger, 'loadFonts: setFont_');
    }
    // TODO(bstell): only set the font if there are characters.
    incrFont.sfeStart_ = goog.now();
    var cssSet = incrFont.setFont(/** @type {!DataView} */ (loadedBase[1])).
        then(function() {
          // Report Set Font Early.
          var weight = this.fontInfo.getWeight();
          tachyfont.Reporter.addItem(tachyfont.Log_.SWITCH_FONT +
              weight, goog.now() - incrFont.startTime);
          var deltaTime = goog.now() - this.sfeStart_;
          tachyfont.Reporter.addItem(
              tachyfont.Log_.SWITCH_FONT_DELTA_TIME + weight,
              deltaTime);
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.Logger.logger, 'loadFonts: setFont_ done');
          }
          tachyfont.IncrementalFontUtils.setVisibility(this.style,
              this.fontInfo, true);
          // Release other operations to proceed.
          this.base.resolve(loadedBase);
        }.bind(incrFont));
    allCssSet.push(cssSet);
  }
  return goog.Promise.all(allCssSet);
};


/**
 * Make use of a list of TachyFonts
 *
 * @param {tachyfont.TachyFontSet} tachyFontSet The TachyFont objects.
 * @private
 */
tachyfont.loadFonts_setupTextListeners_ = function(tachyFontSet) {
  // Get any characters that are already in the DOM.
  tachyFontSet.recursivelyAddTextToFontGroups(document.documentElement);

  // Remove TachyFont from INPUT fields.
  tachyFontSet.recursivelyRemoveTachyFontFromInputFields(
      document.documentElement);

  // Create a DOM mutation observer.
  var observer = new MutationObserver(function(mutations) {
    tachyfont.loadFonts_domMutationObserver_(tachyFontSet, mutations);
  });

  // Watch for these mutations.
  var config = /** @type {!MutationObserverInit} */ ({ 'childList': true,
    'subtree': true, 'characterData': true });
  observer.observe(document.documentElement, config);

  // Check the DOM when it reports loading the page is done.
  document.addEventListener('DOMContentLoaded', function(event) {
    tachyfont.loadFonts_handleDomContentLoaded_(tachyFontSet, event);
  });
};


/**
 * TachyFont DOM Mutation Observer
 *
 * This records the changes on a per-font basis.
 * Note: mutation observers do not look at INPUT field changes.
 *
 * @param {tachyfont.TachyFontSet} tachyFontSet The TachyFont objects.
 * @param {Array<MutationRecord>} mutations The mutation records.
 * @private
 */
tachyfont.loadFonts_domMutationObserver_ = function(tachyFontSet, mutations) {
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.Logger.logger, 'MutationObserver');
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
          goog.log.info(tachyfont.Logger.logger,
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
      goog.log.info(tachyfont.Logger.logger, 'mutation observer: updateFonts');
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
};


/**
 * TachyFont DOM Mutation Observer
 *
 * This records the changes on a per-font basis.
 * Note: mutation observers do not look at INPUT field changes.
 *
 * @param {tachyfont.TachyFontSet} tachyFontSet The TachyFont objects.
 * @param {Event} event The DOMContentLoaded event.
 * @private
 */
tachyfont.loadFonts_handleDomContentLoaded_ = function(tachyFontSet, event) {
  // Update the fonts when the page content is loaded.
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
      goog.log.info(tachyfont.Logger.logger, 'DOMContentLoaded: updateFonts');
    }
    tachyFontSet.updateFonts(0, true);
  } else {
    // The mutation event should be very soon.
    if (goog.DEBUG) {
      goog.log.info(tachyfont.Logger.logger,
          'DOMContentLoaded: wait for mutation event');
    }
  }
};

goog.exportSymbol('tachyfont.loadFonts', tachyfont.loadFonts);
