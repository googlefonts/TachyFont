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
goog.require('goog.asserts');
goog.require('goog.debug.Logger');
goog.require('tachyfont.Define');
goog.require('tachyfont.DemoBackendService');
/** @suppress {extraRequire} */
goog.require('tachyfont.FontsInfo');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.GoogleCloudBackend');
goog.require('tachyfont.IncrementalFont');
goog.require('tachyfont.LauncherInfo');
goog.require('tachyfont.MergedData');
goog.require('tachyfont.Persist');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.TachyFontSet');
goog.require('tachyfont.log');
goog.require('tachyfont.utils');


/**
 * Reports uncaught errors.
 */
if (window.addEventListener) {
  /**
   * Report any uncaught errors.
   * @param {!Event} error The error information.
   * @private
   */
  tachyfont.windowOnError_ = function(error) {
    if (!error['filename']) {
      // The information is stripped from the report because of CORS issues.
      tachyfont.reportError(tachyfont.Error.UNKNOWN_WINDOW_ON_ERROR);
      return;
    }
    var errorObj = {};
    errorObj['message'] = error['message'];
    errorObj['filename'] = error['filename'];
    errorObj['lineno'] = error['lineno'];
    errorObj['colno'] = error['colno'];
    if (error['error'] && error['error']['stack']) {
      errorObj['stack'] = error['error']['stack'].substring(0, 1000);
    }
    var errorStr = JSON.stringify(errorObj);
    tachyfont.reportError(tachyfont.Error.KNOWN_WINDOW_ON_ERROR, errorStr);
  };
  window.addEventListener('error', tachyfont.windowOnError_, false);
}


/**
 * Adds debug functionality.
 */
if (goog.DEBUG) {
  /**
   * A class variable to limit debug initialization to a single time.
   * @private {boolean}
   */
  tachyfont.hasInitializedDebug_ = false;

  /**
   * A function to initialize the debug setup.
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
    tachyfont.log.setLogLevel(debugLevel);

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
  };
}



/**
 * TachyFont - A namespace.
 * @param {!tachyfont.FontInfo} fontInfo The font info.
 * @param {!tachyfont.BackendService} backend The backend to use.
 * @param {!Object<string, string>} params Optional parameters.
 * @constructor
 */
tachyfont.TachyFont = function(fontInfo, backend, params) {
  /**
   * The object that handles the binary manipulation of the font data.
   * @private {!tachyfont.IncrementalFont.obj}
   * TODO(bstell): integrate the manager into this object.
   */
  this.incrfont_ =
      tachyfont.IncrementalFont.createManager(fontInfo, backend, params);
};


/**
 * Lazily load the data for these chars.
 */
tachyfont.TachyFont.prototype.getIncrfont = function() {
  return this.incrfont_;
};


/**
 * Lazily load the data for these chars.
 */
tachyfont.TachyFont.prototype.loadNeededChars = function() {
  this.incrfont_.loadChars();
};


/**
 * The persistence 'stable' time.
 * If the data has been in persistent store longer than this then the data is
 * considered to be stable; ie: not being automatically cleared. The time is in
 * milliseconds.
 * @type {number}
 */
tachyfont.TachyFont.GLOBAL_STABLE_DATA_TIME = 24 * 60 * 60 * 1000;


/**
 * Enum for error values.
 * @enum {string}
 */
// LINT.IfChange
tachyfont.Error = {
  FILE_ID: 'ETF',
  // 02-03 no longer used.
  KNOWN_WINDOW_ON_ERROR: '05',
  UNKNOWN_WINDOW_ON_ERROR: '06',
  NOT_ENOUGH_STORAGE: '07',
  STORAGE_INFORMATION_FUNCTION: '08',
  GET_STORAGE_INFORMATION: '09',
  NO_LAUNCHER_REPORTS: '10',
  LAUNCHER_REPORT_TYPE: '11',
  BELOW_GLOBAL_STABLE_TIME: '12',
  OPEN_GLOBAL_DATABASE: '13',
  NO_INDEXED_DB: '14',
  NO_MUTATION_OBSERVER: '15',
  NO_FONT_LOADER: '16',
  PAGE_LOADED: '17',
  GET_COMPACT_FONT: '18',
  // 19 no longer used.
  DISPLAY_COMPACT_FONT: '20',
  NO_UINT8ARRAY_FROM: '21',
  END: '00'
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/boq/gen204/error-reports.properties)


/**
 * Enum for logging values.
 * @enum {string}
 * @private
 */
// LINT.IfChange
tachyfont.Log_ = {
  LOAD_FONTS: 'LTFLF',
  LOAD_FONTS_WAIT_PREVIOUS: 'LTFLW',
  END: ''
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/boq/gen204/log-reports.properties)


/**
 * The error reporter for this file.
 * @param {string} errNum The error number (encoded in a string);
 * @param {*=} opt_errInfo Optional error object;
 * @param {string} opt_fontId Optional identifier for the font.
 */
tachyfont.reportError = function(errNum, opt_errInfo, opt_fontId) {
  var errInfo = opt_errInfo || '';
  var fontId = opt_fontId || '000';
  tachyfont.Reporter.reportError(
      tachyfont.Error.FILE_ID + errNum, fontId, errInfo);
};


/**
 * Gets the backend to use.
 * @param {string} appName The application's name.
 * @param {!tachyfont.FontsInfo} fontsInfo Information about the fonts.
 * @return {!tachyfont.BackendService}
 */
tachyfont.getBackend = function(appName, fontsInfo) {
  var useGoogleCloudBackend = fontsInfo.getApiVersion() == 1;
  var fontInfos = fontsInfo.getPrioritySortedFonts();
  var useGoogleWebfontBackend =
      (fontInfos.length > 0 && fontInfos[0].getFontKit()) ? true : false;
  var dataUrl = fontsInfo.getDataUrl();
  var backend;
  if (useGoogleCloudBackend) {
    backend = new tachyfont.GoogleCloudBackend(appName, dataUrl);
  } else if (useGoogleWebfontBackend) {
    backend = new tachyfont.GoogleBackendService(appName, dataUrl);
  } else {
    backend = new tachyfont.DemoBackendService(appName, dataUrl);
  }
  return backend;
};


/**
 * Loads and services a list of TachyFonts
 * @param {string} cssFontFamily The CSS font-family name.
 * @param {!tachyfont.FontsInfo} fontsInfo Information about the fonts.
 * @param {!Object<string, string>=} opt_params Optional parameters.
 * @return {!goog.Promise<?tachyfont.TachyFontSet,?>} A promise that returns the
 *     TachyFontSet object or null if the fonts are not loaded.
 */
tachyfont.loadFonts = function(cssFontFamily, fontsInfo, opt_params) {
  var params = opt_params || {};
  if (goog.DEBUG) {
    tachyfont.debugInitialization_();
  }
  var launcherInfo = new tachyfont.LauncherInfo(params);
  tachyfont.loadFonts_initFontInfosUrls(fontsInfo);
  var appName = launcherInfo.getAppName();
  var backend = tachyfont.getBackend(appName, fontsInfo);
  tachyfont.loadFonts_initReporter(backend, fontsInfo);
  // Sent an "error" report so the number of page loads can be determined on the
  // dashboard.
  tachyfont.reportError(tachyfont.Error.PAGE_LOADED);
  tachyfont.sendLauncherReports(launcherInfo);
  var noStartUpDelay = !!params['noStartUpDelay'];
  return tachyfont.checkSystem(noStartUpDelay)
      .then(function() {
        // Check how much can be stored.
        var fontInfos = fontsInfo.getPrioritySortedFonts();
        return tachyfont.manageStorageUsage(fontInfos);
      })
      .then(function() {
        return launcherInfo.getMergedFontbasesBytes();
      })
      .then(function(mergedFontbasesBytes) {
        // Initialize the objects.
        var tachyFontSet = tachyfont.loadFonts_init_(
            backend, cssFontFamily, fontsInfo, params);
        // Load the fonts.
        var xdelta3Decoder = launcherInfo.getXDeltaDecoder();
        var fontbases =
            new tachyfont.MergedData(mergedFontbasesBytes, xdelta3Decoder);
        return tachyfont.loadFonts_loadAndUse_(tachyFontSet, fontbases)
            .then(function() {
              tachyfont.loadFonts_setupTextListeners_(
                  tachyFontSet, launcherInfo);
              return tachyFontSet;
            });
      })
      .thenCatch(function() {
        // Catch any errors.
        return null;
      });
};


/**
 * Checks that the system can use TachyFont.
 * @param {boolean} noStartUpDelay Whether to delay TachyFont because of excess
 *     loading concerns.
 * @return {!goog.Promise<?,?>}
 */
tachyfont.checkSystem = function(noStartUpDelay) {
  // Check if this browser has the necessary features to run TachyFont.
  if (!tachyfont.isSupportedBrowser()) {
    return goog.Promise.reject('unsupported browser');
  }

  // Check for TachyFont metadata.
  return tachyfont.Persist.openGlobalDatabase().then(
      function(db) {
        // Check if storage is stable (ie: is not auto clearing).
        return tachyfont.Persist.getData(db, tachyfont.Define.METADATA)
            .then(function(metadata) {
              db.close();
              if (noStartUpDelay) {
                return;
              }
              var name = tachyfont.Define.CREATED_METADATA_TIME;
              if (metadata && metadata[name]) {
                var dataAge = goog.now() - metadata[name];
                // The following commented out code is how to see the times in
                // hours.
                // var millisSecondsPerHour = 60 * 60 * 1000;
                // var dataAgeHours =
                //     (dataAge / millisSecondsPerHour).toFixed(2);
                // var stableTime = tachyfont.TachyFont.GLOBAL_STABLE_DATA_TIME;
                // var stableTimeHours =
                //     (stableTime / millisSecondsPerHour).toFixed(2);
                // console.log('stableTimeHours = ' + stableTimeHours);
                // console.log('dataAgeHours = ' + dataAgeHours);
                if (dataAge >= tachyfont.TachyFont.GLOBAL_STABLE_DATA_TIME) {
                  return;
                }
              }
              tachyfont.reportError(tachyfont.Error.BELOW_GLOBAL_STABLE_TIME);
              return goog.Promise.reject();
            });
      },
      function(e) {
        tachyfont.reportError(tachyfont.Error.OPEN_GLOBAL_DATABASE);
        return goog.Promise.reject();
      });
};


/**
 * Sends the launcher/prelude logs and errors.
 * @param {!tachyfont.LauncherInfo} launcherInfo The launcher/prelude info.
 */
tachyfont.sendLauncherReports = function(launcherInfo) {
  var reports = launcherInfo.getReports();
  if (reports.length == 0) {
    tachyfont.reportError(tachyfont.Error.NO_LAUNCHER_REPORTS);
    return;
  }
  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];
    if (!report || report.constructor.name != 'Array' || report.length != 3) {
      tachyfont.reportError(tachyfont.Error.LAUNCHER_REPORT_TYPE);
      return;
    }
    var reportType = report[0];
    var id = report[2];
    if (reportType == 'e') {  // Error report.
      var errorNumber = report[1];
      tachyfont.Reporter.reportError('EPL' + errorNumber, id, '');
    } else if (reportType == 'l') {  // Log report.
      var time = report[1];
      // LINT.IfChange
      tachyfont.Reporter.addLog('LPLLT', id, parseInt(time, 10));
      // LINT.ThenChange(//depot/google3/\
      //     java/com/google/i18n/tachyfont/boq/gen204/error-reports.properties)
    }
  }
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
         * @type {!StorageQuota}
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
        tachyfont.reportError(
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
          tachyfont.reportError(
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
    var dbName = fontInfo.getDbName();
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
      var isStored = objectStoreNames.contains(tachyfont.Define.COMPACT_FONT) &&
          objectStoreNames.contains(tachyfont.Define.COMPACT_FILE_INFO) &&
          objectStoreNames.contains(tachyfont.Define.COMPACT_CHAR_LIST) &&
          objectStoreNames.contains(tachyfont.Define.COMPACT_METADATA);
      db.close();
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
  var isSupported = true;

  if (typeof windowObject.indexedDB != 'object') {
    tachyfont.reportError(tachyfont.Error.NO_INDEXED_DB);
    isSupported = false;
  }
  if (typeof windowObject.MutationObserver != 'function') {
    tachyfont.reportError(tachyfont.Error.NO_MUTATION_OBSERVER);
    isSupported = false;
  }
  if (typeof windowObject.FontFace != 'function') {
    tachyfont.reportError(tachyfont.Error.NO_FONT_LOADER);
    isSupported = false;
  }
  if (typeof Uint8Array.from != 'function') {
    tachyfont.reportError(
        tachyfont.Error.NO_UINT8ARRAY_FROM,
        'typeof=' + (typeof Uint8Array.from));
    isSupported = false;
  }

  return isSupported;
};


/**
 * Load and use a list of TachyFonts
 * @param {!tachyfont.TachyFontSet} tachyFontSet The list of TachyFonts.
 * @param {!tachyfont.MergedData} fontbases The fontbases object.
 * @return {!goog.Promise}
 * @private
 */
tachyfont.loadFonts_loadAndUse_ = function(tachyFontSet, fontbases) {
  var msg = 'loadFonts';
  var hadError = false;
  var waitPreviousTime = goog.now();
  var waitForPrecedingPromise =
      tachyFontSet.finishPrecedingUpdateFont.getChainedPromise(msg);
  return waitForPrecedingPromise.getPrecedingPromise()
      .then(function() {
        tachyfont.Reporter.addLog(
            tachyfont.Log_.LOAD_FONTS_WAIT_PREVIOUS, '000',
            goog.now() - waitPreviousTime);
        // Load the fonts in serial. Loading them in serial gives small gaps
        // between each which allows the UI to remain responsive. It is faster
        // to load the fonts in parallel but with the merged fontbases they can
        // load without any gaps (eg, from downloading data). Without the gaps
        // the UI would appear to freeze.
        var serialPromise = goog.Promise.resolve(0);
        var fonts = tachyFontSet.fonts;
        for (var i = 0; i < fonts.length; i++) {
          serialPromise = serialPromise.then(function(index) {
            var incrfont = fonts[index].incrfont_;
            // Load the fonts from persistent store or URL.
            return incrfont.getCompactFont(fontbases)
                .thenCatch(function(e) {
                  // Report an error happened.
                  hadError = true;
                  tachyfont.reportError(
                      tachyfont.Error.GET_COMPACT_FONT, incrfont.getFontId());
                })
                .then(function() {
                  // Advance to the next font.
                  return ++index;
                });
          });
        }
        return serialPromise;
      })
      .then(function(e) {
        if (hadError) {
          return goog.Promise.reject(e);
        }
      })
      .thenAlways(function() {  //
        waitForPrecedingPromise.resolve();
      });
};


/**
 * Initializes the FontInfos URLs.
 * @param {!tachyfont.FontsInfo} fontsInfo The information about the
 *     fonts.
 */
tachyfont.loadFonts_initFontInfosUrls = function(fontsInfo) {
  var port = goog.asserts.assertString(window.location.port);
  var serverUrl = window.location.protocol + '//' + window.location.hostname +
      (port ? ':' + port : '');
  var uri = goog.Uri.parse(window.location.href);
  var tachyFontDataUrl = uri.getParameterValue('TachyFontDataUrl');
  if (tachyFontDataUrl) {
    fontsInfo.setDataUrl(tachyFontDataUrl);
    fontsInfo.setReportUrl(tachyFontDataUrl);
  }
  if (!fontsInfo.getDataUrl()) {
    fontsInfo.setDataUrl(serverUrl);
  }
  if (!fontsInfo.getReportUrl()) {
    fontsInfo.setReportUrl(fontsInfo.getDataUrl());
  }
};


/**
 * Initializes the TachyFont reporter.
 * @param {!tachyfont.BackendService} backend The backend to use.
 * @param {!tachyfont.FontsInfo} fontsInfo The information about the
 *     fonts.
 */
tachyfont.loadFonts_initReporter = function(backend, fontsInfo) {
  var reportUrl = fontsInfo.getReportUrl();
  tachyfont.Reporter.initReporter(
      backend, reportUrl, fontsInfo.getApiVersion());
  tachyfont.Reporter.addLogTime(tachyfont.Log_.LOAD_FONTS, '000');
};


/**
 * Initialization before loading a list of TachyFonts
 * @param {!tachyfont.BackendService} backend The backend to use.
 * @param {string} cssFontFamily The font-family name.
 * TODO(bstell): remove the Object type.
 * @param {!tachyfont.FontsInfo} fontsInfo The information about the
 *     fonts.
 * @param {!Object<string, string>} params Optional parameters.
 * @return {!tachyfont.TachyFontSet} The TachyFontSet object.
 * @private
 */
tachyfont.loadFonts_init_ = function(
    backend, cssFontFamily, fontsInfo, params) {
  var cssFontFamilyToAugment = params['cssFontFamilyToAugment'] || '';
  var fontInfos = fontsInfo.getPrioritySortedFonts();

  var tachyFontSet =
      new tachyfont.TachyFontSet(cssFontFamily, cssFontFamilyToAugment);
  for (var i = 0; i < fontInfos.length; i++) {
    var fontInfo = fontInfos[i];
    fontInfo.setCssFontFamily(cssFontFamily);
    var tachyFont = new tachyfont.TachyFont(fontInfo, backend, params);
    tachyFontSet.addFont(tachyFont);
    // TODO(bstell): need to support slant/width/etc.
    var fontId = tachyfont.utils.fontId(cssFontFamily, fontInfo.getWeight());
    tachyFontSet.fontIdToIndex[fontId] = i;
  }
  return tachyFontSet;
};


/**
 * Make use of a list of TachyFonts
 * @param {!tachyfont.TachyFontSet} tachyFontSet The TachyFont objects.
 * @param {!tachyfont.LauncherInfo} launcherInfo The info from the bootstrap
 *     code.
 * @private
 */
tachyfont.loadFonts_setupTextListeners_ = function(tachyFontSet, launcherInfo) {
  // Get any characters that are already in the DOM.
  tachyFontSet.recursivelyAddTextToFontGroups(document.documentElement);

  // Augment with TachyFont and remove TachyFont from INPUT fields.
  tachyFontSet.recursivelyAdjustCssFontFamilies(document.documentElement);

  // Disconnect the launcher's mutation observer.
  launcherInfo.disconnectMutationObserver();

  // Create a DOM mutation observer.
  var observer = new MutationObserver(function(mutations) {
    // So that testing can disconnect the observer pass it along.
    tachyfont.loadFonts_domMutationObserver_(tachyFontSet, mutations, observer);
  });

  // Watch for these mutations.
  var config = /** @type {!MutationObserverInit} */ ({ 'childList': true,
    'subtree': true, 'characterData': true });
  observer.observe(document.documentElement, config);

  // If the page has already loaded then update the TachyFonts.
  if (launcherInfo.getDomContentLoaded()) {
    tachyFontSet.updateFonts(0);
  } else {
    // Check the DOM when it reports loading the page is done.
    document.addEventListener('DOMContentLoaded', function(event) {
      tachyFontSet.updateFonts(0);
    }, false);
  }
};


/**
 * TachyFont DOM Mutation Observer
 *
 * This records the changes on a per-font basis.
 * Note: mutation observers do not look at INPUT field changes.
 *
 * @param {!tachyfont.TachyFontSet} tachyFontSet The TachyFont objects.
 * @param {?Array<!MutationRecord>} mutations The mutation records.
 * @param {!MutationObserver} observer For testing: the observer object.
 * @private
 */
tachyfont.loadFonts_domMutationObserver_ = function(
    tachyFontSet, mutations, observer) {
  if (!mutations) {
    return;
  }
  var mutationTime = goog.now();
  mutations.forEach(function(mutation) {
    if (mutation.type == 'childList') {
      for (var i = 0; i < mutation.addedNodes.length; i++) {
        var node = mutation.addedNodes[i];
        tachyFontSet.recursivelyAddTextToFontGroups(node);
        // Remove TachyFont from INPUT fields.
        tachyFontSet.recursivelyAdjustCssFontFamilies(node);
      }
    } else if (mutation.type == 'characterData') {
      if (goog.DEBUG) {
        if (mutation.target.nodeName !== '#text') {
          tachyfont.log.info('need to handle characterData for non-text');
        }
      }
      tachyFontSet.recursivelyAddTextToFontGroups(mutation.target);
    }
  });
  tachyFontSet.updateFonts(mutationTime);
};


goog.exportSymbol('tachyfont.loadFonts', tachyfont.loadFonts);
