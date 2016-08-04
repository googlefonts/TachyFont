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

  /** @const {string} The database name prefix. */
  var DB_NAME_PREFIX = 'incrfonts';


  /** @const {string} The db store name for the font base. */
  var BASE = 'base';


  /**
   * The db store name for the list of loaded characters.
   *
   * @const {string}
   */
  var CHARLIST = 'charlist';


  /**
   * The TachyFont magic (reality check) number.
   * The magic number is the 4 numbers in the string 'BSAC': 0x42 0x53 0x41 0x43
   *
   * @const {number}
   */
  var MAGIC_NUMBER = 0x42534143;


  /** @const {string} The Style Sheet ID. */
  var STYLESHEET_ID = 'Incremental\u00A0Font\u00A0Utils';


  /** @const {number} Failed to open IndexedDB error. */
  var ERROR_INDEXEDDB_OPEN = 1;


  /** @const {number} IndexedDB missing the base field error. */
  var ERROR_MISSING_IDB_BASE = 2;


  /** @const {number} The magic number (reality check) is bad. */
  var ERROR_BAD_MAGIC_NUMBER = 3;


  /** @const {number} IndexedDb get BASE returned undefined. */
  var ERROR_INDEXEDDB_BASE_UNDEFINED = 4;


  /** @const {number} The get operation failed. */
  var ERROR_INDEXEDDB_GET_FAILED = 5;


  /**
   * The errors encounter while loading the Tachyfont preludes.
   * These will be reported by the TachyFont library.
   *
   * @type {Array<Array<string|number>>}
   */
  var reports = [];


  /** @const {number} TachyFontPrelude start time. */
  var START_TIME = (new Date()).getTime();



  /**
   * The information needed to load a font.
   * @param {string} fontFamily The font name.
   * @param {string} weight The font weight.
   * @param {boolean} isTtf True is TTF and false if OTF.
   * @constructor
   */
  function FontInfo(fontFamily, weight, isTtf) {
    /** @type {string} The font name. */
    this.fontFamily = fontFamily;

    /** @type {string} The font weight. */
    this.weight = weight;

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
    // Start a chain of asynchronous operations.
    var lastPromise = newResolvedPromise();

    // Prevent the browser creating ransom note effects by picking glyphs from
    // other weights in the family.
    var fontDataView = new DataView(new ArrayBuffer(10));
    var fontInfos1 = fontInfos.slice();
    for (var i = 0; i < fontInfos.length; i++) {
      lastPromise = lastPromise.then(function() {
        return setFontNoFlash(cssFontFamily, fontDataView, fontInfos1.shift());
      });
    }

    // Now load whatever fonts are already persisted.
    var fontInfos2 = fontInfos.slice();
    for (var i = 0; i < fontInfos.length; i++) {
      lastPromise = lastPromise.then(function() {
        return useFont(cssFontFamily, fontInfos2.shift());
      });
    }

    return lastPromise;
  }


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {!FontInfo} fontInfo The info on the font to use.
   * @return {Promise} This promise resolves when the font is used.
   */
  function openIDB(fontInfo) {
    return new Promise(function(resolve, reject) {
      var request = window.indexedDB.open(
          DB_NAME_PREFIX + '/' + fontInfo.fontFamily + '/' + fontInfo.weight);
      request.onupgradeneeded = function(e) {
        var idb = e.target.result;
        idb.createObjectStore(BASE);
        idb.createObjectStore(CHARLIST);
      };

      request.onerror = function(event) {
        reject(ERROR_INDEXEDDB_OPEN);
      };

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };
    });
  }


  /**
   * Get the font data from the indexedDB.
   * @param {!FontInfo} fontInfo Info about this font.
   * @return {Promise} If success promise resolves the header+font ArrayBuffer.
   */
  function getBaseBytes(fontInfo) {
    return openIDB(fontInfo)
        .then(function(db) {
          return db;
        })
        .then(function(db) {
          return new Promise(function(resolve, reject) {
            var trans;
            try {
              trans = db.transaction([BASE], 'readonly');
            } catch (e) {
              reject(ERROR_MISSING_IDB_BASE);
              return;
            }
            var store = trans.objectStore(BASE);
            var request = store.get(0);
            request.onsuccess = function(e) {
              if (e.target.result != undefined) {
                resolve(e.target.result);
              } else {
                reject(ERROR_INDEXEDDB_BASE_UNDEFINED);
              }
            };
            request.onerror = function(e) {
              reject(ERROR_INDEXEDDB_GET_FAILED);
            };
          });
        });
  }


  /**
   * Gets the font DataView if valid.
   * @param {!ArrayBuffer} fileBuffer The header+font ArrayBuffer.
   * @return {Promise} If success the promise resolves the font dataview.
   */
  function getFontData(fileBuffer) {
    var fileData = new DataView(fileBuffer);
    if (fileData.getUint32(0) != MAGIC_NUMBER) {
      return new Promise(function(resolve, reject) {
        reject(ERROR_BAD_MAGIC_NUMBER);
      });
    }
    var fontDataView = new DataView(fileBuffer,
        /* headerSize */ fileData.getInt32(4));
    return newResolvedPromise(fontDataView);
  }


  /**
   * Set the CSS \@font-face rule.
   *
   * @param {CSSStyleSheet} sheet The style sheet.
   * @param {string} fontFamily The fontFamily.
   * @param {string} weight The weight.
   * @param {string} blobUrl The blob URL of the font data.
   * @param {string} format The format (truetype vs opentype) of the font.
   */
  function setCssFontRule(sheet, fontFamily, weight, blobUrl, format) {
    var rule_str = '@font-face{' +
        'font-family: ' + fontFamily + ';' +
        'font-weight: ' + weight + ';' +
        'src: url("' + blobUrl + '")' +
        'format("' + format + '");' +
        '}\n';
    sheet.insertRule(rule_str, sheet.cssRules.length);
  }


  /**
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!DataView} fontDataView The font data.
   * @param {!FontInfo} fontInfo Info about this font.
   * @return {!Promise} The promise resolves when the glyphs are displaying.
   */
  function setFontNoFlash(cssFontFamily, fontDataView, fontInfo) {
    var mimeType;
    var format;
    if (fontInfo.isTtf) {
      mimeType = 'font/ttf'; // 'application/x-font-ttf';
      format = 'truetype';
    } else {
      mimeType = 'font/otf'; // 'application/font-sfnt';
      format = 'opentype';
    }
    var blob = new Blob([fontDataView], { type: mimeType });
    var blobUrl = window.URL.createObjectURL(blob);
    var style = document.getElementById(STYLESHEET_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLESHEET_ID;
      document.head.appendChild(style);
    }
    var sheet = style.sheet;
    var tmpFontFamily = 'tmp-' + fontInfo.weight + '-' + cssFontFamily;

    setCssFontRule(sheet, tmpFontFamily, fontInfo.weight, blobUrl, format);

    var fontStr = '400 20px ' + tmpFontFamily;
    return document.fonts.load(fontStr)
        .then(undefined, function() {
          // Ignore errors of fonts that do not load.
        })
        .then(function(value) {
          setCssFontRule(sheet, cssFontFamily, fontInfo.weight, blobUrl,
              format);
        });
  }


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  function useFont(cssFontFamily, fontInfo) {
    return getBaseBytes(fontInfo)
        .then(getFontData)
        .then(function(fontDataView) {
          return setFontNoFlash(cssFontFamily, fontDataView, fontInfo)
             .then(function() {
               // Record the font ready time.
               reports.push([10 + (new Date()).getTime() - START_TIME,
                 fontInfo.weight]);
             });
        })
        .then(undefined, function(errorNumber) {
          // Report the error.
          reports.push([errorNumber, fontInfo.weight]);
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
   * Do the Exports.
   */
  var tachyfontprelude = {};
  window['tachyfontprelude'] = tachyfontprelude;
  tachyfontprelude['reports'] = reports;
  tachyfontprelude['FontInfo'] = FontInfo;
  tachyfontprelude['load'] = load;

})();
