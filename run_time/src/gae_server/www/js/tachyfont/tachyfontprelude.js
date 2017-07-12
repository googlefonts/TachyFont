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


  /** @type {!Object} The URL for the fonts which were loaded */
  tachyfontprelude['urls'] = {};


  /** @type {boolean} Indicates a DOM mutation has occured. */
  tachyfontprelude['DomMutationObserved'] = false;


  // Create a DOM mutation observer.
  var observer = new MutationObserver(function(mutations) {
    tachyfontprelude['DomMutationObserved'] = true;
  });
  // Watch for these mutations.
  var config = /** @type {!MutationObserverInit} */ (
      {'childList': true, 'subtree': true, 'characterData': true});
  observer.observe(document.documentElement, config);


  /** @type {boolean} Indicates the DOM content is fully loaded. */
  tachyfontprelude['DomContentLoaded'] = false;


  // Check the DOM when it reports loading the page is done.
  document.addEventListener('DOMContentLoaded', function(event) {
    tachyfontprelude['DOMContentLoaded'] = true;
  });


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
  tachyfontprelude.FontInfo = function(fontFamily, weight, priority, isTtf) {
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
  };


  /**
   * Loads the TachyFonts from persistent store if available.
   * @param {string} fontFamily The font's family name.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {boolean} isTtf Whether is a TrueType or CFF type font.
   * @param {!Array<string>} weights The list of font weights to load.
   * @return {!Promise<boolean>} Resolves true if all the fonts were persisted.
   */
  tachyfontprelude.loadFonts = function(
      cssFontFamily, fontFamily, isTtf, weights) {
    var fontInfos = [];
    for (var i = 0; i < weights.length; i++) {
      fontInfos.push(
          new tachyfontprelude.FontInfo(fontFamily, weights[i], false, isTtf));
    }

    var fontInfos1;
    var promises;
    return newResolvedPromise()
        .then(function() {
          // Prevent the browser creating ransom note effects by picking glyphs
          // from other weights in the family by specifying a placeholder font.
          fontInfos1 = fontInfos.slice();
          var antiFlickerFont = tachyfontprelude.getPlaceholderFont();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(tachyfontprelude.setFontNoFlash(
                cssFontFamily, antiFlickerFont, fontInfos1[i], false));
          }
          return Promise.all(promises);
        })
        .then(function() {
          // Now load whatever fonts are already persisted.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(
                tachyfontprelude.useFont(cssFontFamily, fontInfos1[i]));
          }
          return Promise.all(promises).then(function(loadedFonts) {
            var allLoaded = true;
            for (var i = 0; i < loadedFonts.length; i++) {
              allLoaded = allLoaded && loadedFonts[i];
            }
            return allLoaded;
          });
        });
  };


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {!tachyfontprelude.FontInfo} fontInfo The info on the font to use.
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
  tachyfontprelude.getData = function(db, name) {
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
  };


  /**
   * Get the font data from the indexedDB.
   * @param {!tachyfontprelude.FontInfo} fontInfo Info about this font.
   * @return {!Promise} If success promise resolves the header+font ArrayBuffer.
   */
  tachyfontprelude.getFontData = function(fontInfo) {
    return openIDB(fontInfo)
        .then(function(db) {
          return tachyfontprelude.getData(db, COMPACT_META)
              .then(
                  function(metadata) {
                    // Check metadata age.
                    var age = START_TIME -
                        (metadata[CREATED_METADATA_TIME] || START_TIME);
                    if (age < STABLE_DATA_TIME) {
                      db.close();
                      return newRejectedPromise(
                          ERROR_PRELUDE_BELOW_STABLE_TIME);
                    }
                    return db;
                  },
                  function() {
                    db.close();
                    return newRejectedPromise(ERROR_PRELUDE_MISSING_METADATA);
                  });
        })
        .then(function(db) {
          return tachyfontprelude.getData(db, COMPACT_FONT)
              .then(
                  function(data) {
                    db.close();
                    return data;
                  },
                  function() {
                    db.close();
                    return newRejectedPromise(ERROR_PRELUDE_MISSING_BASE);
                  });
        });
  };


  /**
   * A function that does nothing. Useful for places that need a function but
   * that function does not need to do anything.
   */
  function nullFunction() {}


  /**
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {?DataView} fontDataView The font data.
   * @param {!tachyfontprelude.FontInfo} fontInfo Info about this font.
   * @param {boolean} reportTime Whether the font loading time should be
   *     reported.
   * @return {!Promise} The promise resolves when the glyphs are displaying.
   */
  tachyfontprelude.setFontNoFlash = function(
      cssFontFamily, fontDataView, fontInfo, reportTime) {
    var weight = fontInfo.weight;

    var mimeType;
    var format;
    if (fontInfo.isTtf) {
      mimeType = 'font/ttf';  // 'application/x-font-ttf';
      format = 'truetype';
    } else {
      mimeType = 'font/otf';  // 'application/font-sfnt';
      format = 'opentype';
    }
    var blob = new Blob([fontDataView], {type: mimeType});
    var blobUrl = window.URL.createObjectURL(blob);
    var srcStr = 'url("' + blobUrl + '") ' +
        'format("' + format + '");';

    // Load the font data under a font-face that is not getting used.
    var fontFaceTmp =
        new FontFace('tmp-' + weight + '-' + cssFontFamily, srcStr);
    document.fonts.add(fontFaceTmp);
    return fontFaceTmp.load()
        .then(nullFunction, nullFunction)  // Ignore loading errors.
        .then(function(value) {
          var fontFace = new FontFace(cssFontFamily, srcStr);
          fontFace.weight = weight;
          document.fonts.add(fontFace);
          return fontFace.load().then(
              nullFunction, nullFunction);  // Ignore loading errors.
        })
        .then(function(value) {
          if (!reportTime) {
            return;
          }
          // Report the font ready time.
          reports.push(['l', (new Date()).getTime() - START_TIME, weight]);
          var oldBlobUrl = tachyfontprelude[weight];
          if (oldBlobUrl) {
            URL.revokeObjectURL(oldBlobUrl);
          }
          tachyfontprelude['urls'][weight] = blobUrl;
        }, nullFunction);
  };


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!tachyfontprelude.FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  tachyfontprelude.useFont = function(cssFontFamily, fontInfo) {
    return tachyfontprelude.getFontData(fontInfo)
        .then(function(fontDataView) {
          return tachyfontprelude
              .setFontNoFlash(cssFontFamily, fontDataView, fontInfo, true)
              .then(function() {
                return true;
              });
        })
        .then(undefined, function(errorNumber) {
          // Report the error.
          reports.push(['e', errorNumber, fontInfo.weight]);
          return newResolvedPromise(false);
        });
  };


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
  tachyfontprelude.zeroRunBase = 71;  // 'G'


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
  tachyfontprelude.singleZeroBase = 103;  // 'g'


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
   * Export the objects and functions. Data exports may be done elsewhere in
   * this file.
   */
  window['tachyfontprelude'] = tachyfontprelude;
  tachyfontprelude['reports'] = reports;
  tachyfontprelude['loadFonts'] = tachyfontprelude.loadFonts;
})();
