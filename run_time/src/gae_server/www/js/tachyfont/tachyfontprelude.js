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


/**
 * The namespace.
 */
var tachyfontprelude = {};


/** @const {string} The database name prefix. */
tachyfontprelude.DB_NAME = 'incrfonts';


/** @const {string} The db store name for the font base. */
tachyfontprelude.BASE = 'base';


/**
 * The db store name for the list of loaded characters.
 *
 * @const {string}
 */
tachyfontprelude.CHARLIST = 'charlist';


/**
 * The TachyFont magic (reality check) number.
 * The magic number is the 4 numbers in the string 'BSAC': 0x42 0x53 0x41 0x43
 *
 * @const {number}
 */
tachyfontprelude.MAGIC_NUMBER = 0x42534143;


/** @const {string} The Style Sheet ID. */
tachyfontprelude.STYLESHEET_ID = 'Incremental\u00A0Font\u00A0Utils';


/** @const {number} Failed to open IndexedDB error. */
tachyfontprelude.ERROR_INDEXEDDB_OPEN = 1;


/** @const {number} IndexedDB missing the base field error. */
tachyfontprelude.ERROR_MISSING_IDB_BASE = 2;


/** @const {number} The magic number (reality check) is bad. */
tachyfontprelude.ERROR_BAD_MAGIC_NUMBER = 3;


/** @const {number} IndexedDb get BASE returned undefined. */
tachyfontprelude.ERROR_INDEXEDDB_BASE_UNDEFINED = 4;


/** @const {number} The get operation failed. */
tachyfontprelude.ERROR_INDEXEDDB_GET_FAILED = 5;


/**
 * The errors encounter while loading the Tachyfont preludes.
 * These will be reported by the TachyFont library.
 *
 * @private {Array<Array<string|number>>}
 */
tachyfontprelude.reports_ = [];


/** @const {number} TachyFontPrelude start time. */
tachyfontprelude.START_TIME = (new Date()).getTime();



/**
 * The information needed to load a font.
 * @param {string} fontFamily The font name.
 * @param {string} weight The font weight.
 * @param {boolean} isTtf True is TTF and false if OTF.
 * @constructor
 * @private
 */
tachyfontprelude.FontInfo_ = function(fontFamily, weight, isTtf) {
  /** @type {string} The font name. */
  this.fontFamily = fontFamily;

  /** @type {string} The font weight. */
  this.weight = weight;

  /** @type {boolean} isTtf True is TTF and false if OTF. */
  this.isTtf = isTtf;
};


/**
 * Loads the TachyFonts from persistent store if available.
 * @param {string} cssFontFamily The CSS font-family name.
 * @param {!Array<!tachyfontprelude.FontInfo_>} fontInfos The list of fonts to
 *     load.
 * @return {!Promise} A promise that resolves when the preloading has finished.
 * @private
 */
tachyfontprelude.preload_ = function(cssFontFamily, fontInfos) {
  // Start a chain of asynchronous operations.
  var lastPromise = tachyfontprelude.newResolvedPromise();

  // Prevent the browser creating ransom note effects by picking glyphs from
  // other weights in the family.
  var fontDataView = new DataView(new ArrayBuffer(10));
  var fontInfosCopy1 = fontInfos.slice();
  for (var i = 0; i < fontInfos.length; i++) {
    lastPromise = lastPromise
        .then(function() {
          return tachyfontprelude.setFontNoFlash(cssFontFamily, fontDataView,
              fontInfosCopy1.shift());
        });
  }

  // Now load whatever fonts are already persisted.
  var fontInfosCopy2 = fontInfos.slice();
  for (var i = 0; i < fontInfos.length; i++) {
    lastPromise = lastPromise.then(function() {
      return tachyfontprelude.useFont(cssFontFamily, fontInfosCopy2.shift());
    });
  }

  return lastPromise;
};


/**
 * Uses a TachyFont from persistent store if available.
 * @param {!tachyfontprelude.FontInfo_} fontInfo The info on the font to use.
 * @return {Promise} This promise resolves when the font is used.
 */
tachyfontprelude.openIDB = function(fontInfo) {
  return new Promise(function(resolve, reject) {
    var request = window.indexedDB.open(tachyfontprelude.getDbName(fontInfo));
    request.onupgradeneeded = function(e) {
      var idb = e.target.result;
      idb.createObjectStore(tachyfontprelude.BASE);
      idb.createObjectStore(tachyfontprelude.CHARLIST);
    };

    request.onerror = function(event) {
      reject(tachyfontprelude.ERROR_INDEXEDDB_OPEN);
    };

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
  });
};


/**
 * Get the font data from the indexedDB.
 * @param {!tachyfontprelude.FontInfo_} fontInfo Info about this font.
 * @return {Promise} If success promise resolves the header+font ArrayBuffer.
 */
tachyfontprelude.getBaseBytes = function(fontInfo) {
  return tachyfontprelude.openIDB(fontInfo).then(function(db) {
    return db;
  })
      .then(function(db) {
        return new Promise(function(resolve, reject) {
          var trans;
          try {
            trans = db.transaction([tachyfontprelude.BASE], 'readonly');
          } catch (e) {
            reject(tachyfontprelude.ERROR_MISSING_IDB_BASE);
            return;
          }
          var store = trans.objectStore(tachyfontprelude.BASE);
          var request = store.get(0);
          request.onsuccess = function(e) {
            if (e.target.result != undefined) {
              resolve(e.target.result);
            } else {
              reject(tachyfontprelude.ERROR_INDEXEDDB_BASE_UNDEFINED);
            }
          };
          request.onerror = function(e) {
            reject(tachyfontprelude.ERROR_INDEXEDDB_GET_FAILED);
          };
        });
      });
};


/**
 * Gets the font DataView if valid.
 * @param {!ArrayBuffer} fileBuffer The header+font ArrayBuffer.
 * @return {Promise} If success the promise resolves the font dataview.
 */
tachyfontprelude.getFontData = function(fileBuffer) {
  var fileData = new DataView(fileBuffer);
  var magicNumber = fileData.getUint32(0);
  if (magicNumber != tachyfontprelude.MAGIC_NUMBER) {
    return new Promise(function(resolve, reject) {
      reject(tachyfontprelude.ERROR_BAD_MAGIC_NUMBER);
    });
  }
  var headerSize = fileData.getInt32(4);
  var fontDataView = new DataView(fileBuffer, headerSize);
  return tachyfontprelude.newResolvedPromise(fontDataView);
};


/**
 * Set the CSS \@font-face rule.
 *
 * @param {CSSStyleSheet} sheet The style sheet.
 * @param {string} fontFamily The fontFamily.
 * @param {string} weight The weight.
 * @param {string} blobUrl The blob URL of the font data.
 * @param {string} format The format (truetype vs opentype) of the font.
 */
tachyfontprelude.setCssFontRule =
    function(sheet, fontFamily, weight, blobUrl, format) {
  var rule_str = '@font-face{' +
      'font-family: ' + fontFamily + ';' +
      'font-weight: ' + weight + ';' +
      'src: url("' + blobUrl + '")' +
      'format("' + format + '");' +
      '}\n';
  sheet.insertRule(rule_str, sheet.cssRules.length);
};


/**
 * @param {string} cssFontFamily The CSS font-family name.
 * @param {!DataView} fontDataView The font data.
 * @param {!tachyfontprelude.FontInfo_} fontInfo Info about this font.
 * @return {!Promise} The promise resolves when the glyphs are displaying.
 */
tachyfontprelude.setFontNoFlash =
    function(cssFontFamily, fontDataView, fontInfo) {
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
  var style = document.getElementById(tachyfontprelude.STYLESHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = tachyfontprelude.STYLESHEET_ID;
    document.head.appendChild(style);
  }
  var sheet = style.sheet;
  var tmpFontFamily = 'tmp-' + fontInfo.weight + '-' + cssFontFamily;

  tachyfontprelude.setCssFontRule(sheet, tmpFontFamily, fontInfo.weight,
      blobUrl, format);

  var fontStr = '400 20px ' + tmpFontFamily;
  return document.fonts.load(fontStr)
      .then(function(value) {
        tachyfontprelude.setCssFontRule(sheet, cssFontFamily,
            fontInfo.weight, blobUrl, format);
      });
};


/**
 * Uses a TachyFont from persistent store if available.
 * @param {string} cssFontFamily The CSS font-family name.
 * @param {!tachyfontprelude.FontInfo_} fontInfo The info on the font to use.
 * @return {!Promise} This promise resolves when the font is used.
 */
tachyfontprelude.useFont = function(cssFontFamily, fontInfo) {
  return tachyfontprelude.getBaseBytes(fontInfo)
      .then(tachyfontprelude.getFontData)
      .then(function(fontDataView) {
        return tachyfontprelude.setFontNoFlash(cssFontFamily, fontDataView,
            fontInfo)
            .then(function() {
               // Record the font ready time.
               tachyfontprelude.reports_.push(
                   [10 + (new Date()).getTime() - tachyfontprelude.START_TIME,
                    fontInfo.weight]);
            });
      })
      .then(undefined, function(errorNumber) {
        // Report the error.
        tachyfontprelude.reports_.push([errorNumber, fontInfo.weight]);
        return tachyfontprelude.newResolvedPromise();
      });
};


/**
 * Uses a TachyFont from persistent store if available.
 * @param {!tachyfontprelude.FontInfo_} fontInfo The info on the font to use.
 * @return {string} This database name
 */
tachyfontprelude.getDbName = function(fontInfo) {
  return tachyfontprelude.DB_NAME +
      '/' + fontInfo.fontFamily +
      '/' + fontInfo.weight;
};


/**
 * Gets a resolved promise.
 * @param {*=} value The value the promise resolves to.
 * @return {!Promise}
 */
tachyfontprelude.newResolvedPromise = function(value) {
  return new Promise(function(resolve) {
    resolve(value);
  });
};


/**
 * Do the Exports.
 */
window['tachyfontprelude'] = tachyfontprelude;
tachyfontprelude['reports'] = tachyfontprelude.reports_;


/**
 * Export the new FontInfo_ Function.
 *
 * @param {string} fontFamily The font name.
 * @param {string} weight The font weight.
 * @param {boolean} isTtf True is TTF and false if OTF.
 * @return {!tachyfontprelude.FontInfo_} The info to load a font.
 */
tachyfontprelude['newFontInfo'] = function(fontFamily, weight, isTtf) {
  return new tachyfontprelude.FontInfo_(fontFamily, weight, isTtf);
};


/**
 * Export the main load function.
 *
 * @param {string} cssFontFamily The CSS font-family name.
 * @param {!Array<!tachyfontprelude.FontInfo_>} fontInfos The list of fonts to
 *     load.
 * @return {!Promise} A promise that resolves when the preloading is done.
 */
tachyfontprelude['load'] = function(cssFontFamily, fontInfos) {
  return tachyfontprelude.preload_(cssFontFamily, fontInfos);
};


