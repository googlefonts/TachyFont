'use strict';

/**
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


(function() {

  // Declares the public namespace. This is used to make items publically
  // visible.
  var tachyfontprelude = {};


  /** @type {!Object} Indicates which fonts were loaded */
  tachyfontprelude['loaded'] = {};


  /** @type {!Object} The URL for the fonts which were loaded */
  tachyfontprelude['urls'] = {};


  /** @const {string} The database name prefix. */
  var DB_NAME_PREFIX = 'incrfonts';


  /** @const {string} The db store name for the font base. */
  var COMPACT_FONT = 'compact_font';


  /** @const {string} The db store name for the metadata. */
  var COMPACT_META = 'compact_metadata';


  /** @const {string} The db store name for the metadata. */
  var CREATED_METADATA_TIME = 'created_metadata_time';


  /**
   * The persistence 'stable' time in milliseconds.
   * If the data was only recently created then it could be the first time the
   * client has ever used TachyFont. This should be fairly infrequent. However,
   * it is also possible that the data was recently created because the client
   * has an auto clean feature that is automatically deleting the data. This is
   * the sum of the global and per font stable times.
   * @type {number}
   */
  var STABLE_DATA_TIME = 24 * 60 * 60 * 1000;


  /** @const {string} The Style Sheet ID. */
  var STYLESHEET_ID = 'Incremental\u00A0Font\u00A0Utils';


  /** @const {string} Failed to open IndexedDB error. */
  var ERROR_PRELUDE_INDEXEDDB_OPEN = '01';


  /** @const {string} IndexedDB missing the base field error. */
  var ERROR_PRELUDE_MISSING_BASE = '02';


  /** @const {string} IndexedDB missing the metadata field error. */
  var ERROR_PRELUDE_MISSING_METADATA = '06';


  /**
   * Indicates the data is younger than the 'stable' time.
   * @const {string}
   */
  var ERROR_PRELUDE_BELOW_STABLE_TIME = '07';


  /**
   * The errors encounter while loading the Tachyfont preludes.
   * These will be reported by the TachyFont library.
   *
   * @type {!Array<!Array<string|number>>}
   */
  var reports = [];


  /** @const {number} TachyFontPrelude start time. */
  var START_TIME = (new Date()).getTime();


  /**
   * The information needed to load a font.
   * @param {string} fontFamily The font name.
   * @param {string} weight The font weight.
   * @param {boolean} priority Whether this is a priority font.
   * @param {boolean} isTtf True is TTF and false if OTF.
   * @constructor
   */
  function FontInfo(fontFamily, weight, priority, isTtf) {
    /** @type {string} The font name. */
    this.fontFamily = fontFamily;

    /** @type {string} The font weight. */
    this.weight = weight;

    /**
     * True if this is a priority font that should be prioritized ahead of other
     * fonts.
     * @type {boolean}
     */
    this.priority = priority;

    /** @type {boolean} isTtf True is TTF and false if OTF. */
    this.isTtf = isTtf;
  }


  /**
   * Loads the TachyFonts from persistent store if available.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!Array<!FontInfo>} fontInfos The list of fonts to
   *     load.
   * @return {!Promise} A promise that resolves when the loading has finished.
   */
  function load(cssFontFamily, fontInfos) {
    var style = document.getElementById(STYLESHEET_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLESHEET_ID;
      document.head.appendChild(style);
    }
    var sheet = style.sheet;

    var fontInfos1;
    var promises;
    return newResolvedPromise()
        .then(function() {
          // Prevent the browser creating ransom note effects by picking glyphs
          // from other weights in the family by specifying a placeholder font.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(
                setFontNoFlash(sheet, cssFontFamily, null, fontInfos1.shift()));
          }
          return Promise.all(promises);
        })
        .then(function() {
          // Now load whatever fonts are already persisted.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(useFont(sheet, cssFontFamily, fontInfos1.shift()));
          }
          return Promise.all(promises);
        });
  }


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {!FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  function openIDB(fontInfo) {
    return new Promise(function(resolve, reject) {
      var request = window.indexedDB.open(
          DB_NAME_PREFIX + '/' + fontInfo.fontFamily + '/' + fontInfo.weight);

      request.onerror = function(event) {
        reject(ERROR_PRELUDE_INDEXEDDB_OPEN);
      };

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };
    });
  }


  /**
   * Get data from the database.
   * @param {!IDBDatabase} db The database handle.
   * @param {string} name The store name.
   * @return {!Promise<!ArrayBuffer,?>}
   */
  function getData(db, name) {
    return new Promise(function(resolve, reject) {
      var trans;
      try {
        trans = db.transaction([name], 'readonly');
      } catch (e) {
        reject();
        return;
      }
      var store = trans.objectStore(name);
      var request = store.get(0);
      request.onsuccess = function(e) {
        if (e.target.result != undefined) {
          resolve(e.target.result);
        } else {
          reject();
        }
      };
      request.onerror = function(e) { reject(); };
    });
  }


  /**
   * Get the font data from the indexedDB.
   * @param {!FontInfo} fontInfo Info about this font.
   * @return {!Promise} If success promise resolves the header+font ArrayBuffer.
   */
  function getFontData(fontInfo) {
    return openIDB(fontInfo)
        .then(function(db) {
          return getData(db, COMPACT_META).then(
              function(metadata) {
                // Check metadata age.
                var age = START_TIME -
                    (metadata[CREATED_METADATA_TIME] || START_TIME);
                if (age < STABLE_DATA_TIME) {
                  return newRejectedPromise(ERROR_PRELUDE_BELOW_STABLE_TIME);
                }
                return db;
              },
              function() {
                return newRejectedPromise(ERROR_PRELUDE_MISSING_METADATA);
              });
        })
        .then(function(db) {
          return getData(db, COMPACT_FONT).then(undefined, function() {
            return newRejectedPromise(ERROR_PRELUDE_MISSING_BASE);
          });
        });
  }


  /**
   * Set the CSS \@font-face rule.
   *
   * @param {!CSSStyleSheet} sheet The style sheet.
   * @param {string} fontFamily The fontFamily.
   * @param {string} weight The weight.
   * @param {string} srcStr The src string for the \@font-face
   */
  function setCssFontRule(sheet, fontFamily, weight, srcStr) {
    var rule_str = '@font-face{' +
        'font-family: ' + fontFamily + ';' +
        'font-weight: ' + weight + ';' +
        'src: ' + srcStr + '' +
        '}\n';
    sheet.insertRule(rule_str, sheet.cssRules.length);
  }


  /**
   * A function that does nothing. Useful for places that need a function but
   * that function does not need to do anything.
   */
  function nullFunction() {}


  /**
   * @param {!CSSStyleSheet} sheet The style sheet.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {?DataView} fontDataView The font data.
   * @param {!FontInfo} fontInfo Info about this font.
   * @return {!Promise} The promise resolves when the glyphs are displaying.
   */
  function setFontNoFlash(sheet, cssFontFamily, fontDataView, fontInfo) {
    var weight = fontInfo.weight;

    var mimeType;
    var format;
    var srcStr;
    if (fontDataView) {
      if (fontInfo.isTtf) {
        mimeType = 'font/ttf';  // 'application/x-font-ttf';
        format = 'truetype';
      } else {
        mimeType = 'font/otf';  // 'application/font-sfnt';
        format = 'opentype';
      }
      var blob = new Blob([fontDataView], {type: mimeType});
      var blobUrl = window.URL.createObjectURL(blob);
      srcStr = 'url("' + blobUrl + '") ' + 'format("' + format + '");';
    } else {
      srcStr = 'local("sans-serif");';
    }

    // Load the font data under a CSS style sheet that is not getting used.
    var tmpFontFamily = 'tmp-' + weight + '-' + cssFontFamily;
    setCssFontRule(sheet, tmpFontFamily, weight, srcStr);
    var fontStr = '400 20px ' + tmpFontFamily;
    return document.fonts.load(fontStr)
        .then(nullFunction, nullFunction)  // Ignore loading errors.
        .then(function(value) {
          setCssFontRule(sheet, cssFontFamily, weight, srcStr);
          if (!fontDataView) {
            return;
          }
          // Record the font ready time.
          reports.push(['l', (new Date()).getTime() - START_TIME, weight]);
          var oldBlobUrl = tachyfontprelude[weight];
          if (oldBlobUrl) {
            URL.revokeObjectURL(oldBlobUrl);
          }
          tachyfontprelude['urls'][weight] = blobUrl;
          tachyfontprelude['loaded'][weight] = true;
        }, nullFunction);
  }


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  function useFont(sheet, cssFontFamily, fontInfo) {
    return getFontData(fontInfo)
        .then(function(fontDataView) {
          return setFontNoFlash(sheet, cssFontFamily, fontDataView, fontInfo);
        })
        .then(undefined, function(errorNumber) {
          // Report the error.
          reports.push(['e', errorNumber, fontInfo.weight]);
          return newResolvedPromise();
        });
  }


  /**
   * Gets a resolved promise.
   * @param {*=} opt_value The value the promise resolves to.
   * @return {!Promise}
   */
  function newResolvedPromise(opt_value) {
    return new Promise(function(resolve) {
      resolve(opt_value);
    });
  }


  /**
   * Gets a rejected promise.
   * @param {*=} opt_value The value the promise rejects with.
   * @return {!Promise}
   */
  function newRejectedPromise(opt_value) {
    return new Promise(function(resolve, reject) { reject(opt_value); });
  }


  /**
   * Do the Exports.
   */
  window['tachyfontprelude'] = tachyfontprelude;
  tachyfontprelude['reports'] = reports;
  tachyfontprelude['FontInfo'] = FontInfo;
  tachyfontprelude['loadFont'] = load;
})();
