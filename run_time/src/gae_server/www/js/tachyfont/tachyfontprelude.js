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

  /** @const {string} The database name prefix. */
  var DB_NAME_PREFIX = 'incrfonts';


  /** @const {string} The db store name for the font base. */
  var BASE = 'base';


  /**
   * The TachyFont magic (reality check) number.
   * The magic number is the 4 numbers in the string 'BSAC': 0x42 0x53 0x41 0x43
   *
   * @const {number}
   */
  var MAGIC_NUMBER = 0x42534143;


  /** @const {string} The Style Sheet ID. */
  var STYLESHEET_ID = 'Incremental\u00A0Font\u00A0Utils';


  /** @const {string} Failed to open IndexedDB error. */
  var ERROR_INDEXEDDB_OPEN = '01';


  /** @const {string} IndexedDB missing the base field error. */
  var ERROR_MISSING_IDB_BASE = '02';


  /** @const {string} The magic number (reality check) is bad. */
  var ERROR_BAD_MAGIC_NUMBER = '03';


  /** @const {string} IndexedDb get BASE returned undefined. */
  var ERROR_INDEXEDDB_BASE_UNDEFINED = '04';


  /** @const {string} The get operation failed. */
  var ERROR_INDEXEDDB_GET_FAILED = '05';


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
    // Start a chain of asynchronous operations.
    var lastPromise = newResolvedPromise();

    // Prevent the browser creating ransom note effects by picking glyphs from
    // other weights in the family by specifying a placeholder font.
    var fontDataView = tachyfontprelude.getPlaceholderFont();
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
    var weight = fontInfo.weight;
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
    var tmpFontFamily = 'tmp-' + weight + '-' + cssFontFamily;

    setCssFontRule(sheet, tmpFontFamily, weight, blobUrl, format);

    var fontStr = '400 20px ' + tmpFontFamily;
    return document.fonts.load(fontStr)
        .then(
            undefined,
            function() {
              // Ignore errors of fonts that do not load.
            })
        .then(function(value) {
          setCssFontRule(sheet, cssFontFamily, weight, blobUrl, format);
          var oldBlobUrl = tachyfontprelude[weight];
          if (oldBlobUrl) {
            URL.revokeObjectURL(oldBlobUrl);
          }
          tachyfontprelude[weight] = blobUrl;
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
               reports.push(['l', (new Date()).getTime() - START_TIME,
                 fontInfo.weight]);
             });
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
   * The placeholder data needs to be loaded with the tachyfontprelude
   * code in the <head> section. Thus the placeholder data needs to be
   * a small as possible in the Javascript.
   *
   * To make the placeholder data as small the data is stored as a
   * compacted Hex Ascii string.
   *
   * A Hex Ascii string is compacted by:
   *   - encoding the number of '0' characters as 'G' + the number.
   *     - eg, '00000' is replaced by 'L' (the 5th character after 'G')
   *   - encoding the number after single '0' as 'a' + the number.
   *     - eg, '03' is replaced by 'd' (the 3rd character after 'a')
   */


  /**
   * The start of compacted '0' encodings.
   * Publically visible so it can be used during testing.
   * @type {number}
   */
  tachyfontprelude.zeroRunBase = 71; // 'G'


  /**
   * The maximum number of '0' to encode in a single zeroRunBase.
   * Publically visible so it can be used during testing.
   * @type {number}
   */
  tachyfontprelude.zeroRunMax = 10;


  /**
   * The start of compacted '0?' encodings.
   * Since Hex Ascii has exactly 16 value this range will take 'a'
   * Publically visible so it can be used during testing.
   * @type {number}
   */
  tachyfontprelude.singleZeroBase = 103; // 'g'


  /**
   * Gets a placeholder font.
   * Publically visible so it can be used during testing.
   * @return {!DataView} The font's bytes.
   */
  tachyfontprelude.getPlaceholderFont = function() {
    // Expand the compacted data string.
    var expandedString = '';
    for (var i = 0; i < tachyfontprelude.fontCompacted.length; i++) {
      var aChar = tachyfontprelude.fontCompacted[i];
      var charCode = aChar.charCodeAt(0);
      if (charCode < tachyfontprelude.zeroRunBase) {
        expandedString += aChar;
      } else if (charCode < tachyfontprelude.singleZeroBase) {
        var count = charCode - tachyfontprelude.zeroRunBase;
        while (count--) {
          expandedString += '0';
        }
      } else {
        var secondCharCode = charCode - tachyfontprelude.singleZeroBase;
        expandedString += '0' + secondCharCode.toString(16);
      }
    }
    // Convert the data string to a DataView.
    var length = expandedString.length / 2;
    var dataBytes = new Uint8Array(length);
    var byteStrings = expandedString.match(/.{1,2}/g);
    for (var i = 0; i < byteStrings.length; i++) {
      dataBytes[i] = parseInt(byteStrings[i], 16);
    }
    return new DataView(dataBytes.buffer);
  };


  /**
   * The compacted font.
   * Note that the letter case matters.
   * Publically visible so it can be used during testing.
   * @type {string}
   */
  tachyfontprelude.fontCompacted =
      'J1NAI8K3I2kF532F32FBBAE78CL128M6m36D617KBhC9L18CM2C676C79663EABB9C4L1B' +
      'CM1868656164FC33F49NACM3668686561p4BIANE4M24686D7478hC7I8AL188N46C6F63' +
      '61NCL1B8N46D61787K7I34L1oM2mE616D65J6P1D4N67mF7374FF2AI96L1DCM2K1N13AE' +
      '123BB6A955Fv3CF5I1BoQC84v99AOD2FD754BI8AL13ElCCN9J1QL1L73EFE4EI43hC7I8' +
      'AI89h3EJ1QQQhJ1N1J4J1QhM2FQP4N3k93h9K5J8l9Al33L11Bl9Al33L3D1I66i12olir' +
      'mkiiiiikEKAFF5J78FFM21O4D4F4E4FI4J2vFFClD3FE51h33n3EhB26K1BFDFF7L43Al8' +
      '1M2K4hC7I8AN1J3J1NCJ4I2O4J4J1L196FFFFL196FFFFFE6AJ1QLCJ1I8AL13ElCCJ3K3' +
      '31133118AB4lCCFA34QmN3QIFF27I96QQQQ';



  /**
   * Do the Exports.
   */
  window['tachyfontprelude'] = tachyfontprelude;
  tachyfontprelude['reports'] = reports;
  tachyfontprelude['FontInfo'] = FontInfo;
  tachyfontprelude['load'] = load;

})();
