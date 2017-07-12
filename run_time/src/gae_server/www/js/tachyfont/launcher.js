'use strict';

/**
 * @license
 * Copyright 2017 Google Inc. All rights reserved.
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
  var launcher = {};


  /** @type {!Object} The URL for the fonts which were loaded */
  launcher['urls'] = {};


  /** @type {boolean} Indicates a DOM mutation has occured. */
  launcher['DomMutationObserved'] = false;


  /**
   * The DOM Mutation Observer.
   * @type {?MutationObserver}
   */
  launcher.mutationObserver = null;


  /** @type {boolean} Indicates the DOM content is fully loaded. */
  launcher['DomContentLoaded'] = false;


  // Check the DOM when it reports loading the page is done.
  document.addEventListener('DOMContentLoaded', function(event) {
    launcher['DOMContentLoaded'] = true;
  });



  /** @const {string} The database name prefix. */
  var DB_NAME_PREFIX = 'incrfonts';


  /** @const {string} The db store name for the font base. */
  var COMPACT_FONT = 'compact_font';


  /** @const {string} Failed to open IndexedDB error. */
  var ERROR_LAUNCHER_INDEXEDDB_OPEN = '01';


  /** @const {string} IndexedDB missing the base field error. */
  var ERROR_LAUNCHER_MISSING_BASE = '02';


  /**
   * The errors encountered while launching Tachyfont.
   * These will be reported by the TachyFont library.
   *
   * @type {!Array<!Array<string|number>>}
   */
  var reports = [];


  /** @const {number} Launcher start time. */
  var START_TIME = (new Date()).getTime();


  /**
   * Adds a DOM MutationObserver.
   * @param {?string} cssFontFamily The TachyFont's CSS font family.
   * @param {?string} cssFontFamilyToAugment The CSS font family to
   *     automatically add TachyFont after.
   */
  launcher.addDomMutationObserver = function(
      cssFontFamily, cssFontFamilyToAugment) {
    // Stop the old one from firing.
    if (launcher.mutationObserver) {
      launcher.mutationObserver.disconnect();
    }
    // Create a DOM mutation observer.
    launcher.mutationObserver = new MutationObserver(function(mutations) {
      launcher['DomMutationObserved'] = true;
      if (cssFontFamily && cssFontFamilyToAugment) {
        launcher.recursivelyAdjustCssFontFamilies(
            cssFontFamily, cssFontFamilyToAugment, document.documentElement);
      }
    });
    // Watch for these mutations.
    var config = /** @type {!MutationObserverInit} */ (
        {'childList': true, 'subtree': true, 'characterData': true});
    launcher.mutationObserver.observe(document.documentElement, config);
  };


  // Initially add the mutation observer so it can be watching before the the
  // TachyFonts get loaded.
  launcher.addDomMutationObserver(null, null);


  /**
   * The information needed to load a font.
   * @param {string} fontFamily The font name.
   * @param {string} weight The font weight.
   * @param {boolean} priority Whether this is a priority font.
   * @param {boolean} isTtf True is TTF and false if OTF.
   * @constructor
   */
  launcher.FontInfo = function(fontFamily, weight, priority, isTtf) {
    /** @type {string} The font family name. */
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
   * Loads an ArrayBuffer using XHR.
   * @param {string} url The URL to the file.
   * @return {!Promise<!ArrayBuffer, ?>} A promise for the url data.
   */
  launcher.loadUrlArrayBuffer = function(url) {
    return launcher.loadUrl(url, 'arraybuffer');
  };


  /**
   * Loads a text string using XHR.
   * @param {string} url The URL to the file.
   * @return {!Promise<string, ?>} A promise for the url data.
   */
  launcher.loadUrlText = function(url) {
    return launcher.loadUrl(url, 'text');
  };


  /**
   * Loads a file using XHR.
   * @param {string} url The URL to the file.
   * @param {string} responseType The requested response type.
   * @return {!Promise<?, ?>} A promise for the url data.
   */
  launcher.loadUrl = function(url, responseType) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.responseType = responseType;
      xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
          if (xhr.status == 200) {
            resolve(xhr.response);
          } else {
            reject(xhr.statusText);
          }
        }
      };
      xhr.open('GET', url, true);
      xhr.send();
    });
  };


  /**
   * Loads the TachyFonts from persistent store if available.
   * @param {string} cssFontFamily The font's family name.
   * @param {string} fontFamily The CSS font-family name.
   * @param {boolean} isTtf Whether is a TrueType or CFF type font.
   * @param {!Array<string>} weights The list of font weights to load.
   * @return {!Promise<boolean>} Resolves true if all the fonts were persisted.
   */
  launcher.loadFonts = function(cssFontFamily, fontFamily, isTtf, weights) {
    var fontInfos = [];
    for (var i = 0; i < weights.length; i++) {
      fontInfos.push(
          new launcher.FontInfo(fontFamily, weights[i], false, isTtf));
    }

    var fontInfos1;
    var antiFlickerFont = launcher.getPlaceholderFont();
    var promises;
    return newResolvedPromise()
        .then(function() {
          // Prevent the browser creating ransom note effects by picking glyphs
          // from other weights in the family by specifying a placeholder font.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(launcher.setFontNoFlash(
                cssFontFamily, antiFlickerFont, fontInfos1[i], false));
          }
          return Promise.all(promises);
        })
        .then(function() {
          // Now load whatever fonts are already persisted.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(launcher.useFont(cssFontFamily, fontInfos1[i]));
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
   * @param {!launcher.FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  function openIDB(fontInfo) {
    return new Promise(function(resolve, reject) {
      var request = window.indexedDB.open(
          DB_NAME_PREFIX + '/' + fontInfo.fontFamily + '/' + fontInfo.weight);

      request.onerror = function(event) {
        reject(ERROR_LAUNCHER_INDEXEDDB_OPEN);
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
  launcher.getData = function(db, name) {
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
   * @param {!launcher.FontInfo} fontInfo Info about this font.
   * @return {!Promise} If success promise resolves the header+font ArrayBuffer.
   */
  launcher.getFontData = function(fontInfo) {
    return openIDB(fontInfo)
        .then(function(db) {
          return launcher.getData(db, COMPACT_FONT)
              .then(
                  function(data) {
                    db.close();
                    return data;
                  },
                  function() {
                    db.close();
                    return newRejectedPromise(ERROR_LAUNCHER_MISSING_BASE);
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
   * @param {!launcher.FontInfo} fontInfo Info about this font.
   * @param {boolean} reportTime Whether to report the font loading time.
   * @return {!Promise} The promise resolves when the glyphs are displaying.
   */
  launcher.setFontNoFlash = function(
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
          var oldBlobUrl = launcher[weight];
          if (oldBlobUrl) {
            URL.revokeObjectURL(oldBlobUrl);
          }
          launcher['urls'][weight] = blobUrl;
        }, nullFunction);
  };


  /**
   * Uses a TachyFont from persistent store if available.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {!launcher.FontInfo} fontInfo The info on the font to use.
   * @return {!Promise} This promise resolves when the font is used.
   */
  launcher.useFont = function(cssFontFamily, fontInfo) {
    return launcher.getFontData(fontInfo)
        .then(function(fontDataView) {
          return launcher
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
   * Loads data and starts TachyFont.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {string} cssFontFamilyToAugment Add coverage to this cssFontFamily.
   * @param {string} fontFamily The font's family name.
   * @param {boolean} isTtf Whether is a TrueType or CFF font.
   * @param {!Array<string>} weights The list of font weights to load.
   * @param {string} tachyfontCodeUrl The URL of the TachyFont code.
   * @param {string} mergedFontbasesUrl The URL of the merged fontbases.
   * @param {string} dataUrl The URL for data and reporting.
   */
  launcher.startTachyFont = function(
      cssFontFamily, cssFontFamilyToAugment, fontFamily, isTtf, weights,
      tachyfontCodeUrl, mergedFontbasesUrl, dataUrl) {

    // Start fetching the tachyfont code so it can come in while other things
    // are being done.
    var tachyfontCodePromise = launcher.loadUrlText(tachyfontCodeUrl);

    // Update the CSS.
    launcher.recursivelyAdjustCssFontFamilies(
        cssFontFamily, cssFontFamilyToAugment, document.documentElement);
    // Now that the cssFontFamily and cssFontFamilyToAugment are available
    // update the Mutation observer to automatically update the CSS.
    launcher.addDomMutationObserver(cssFontFamily, cssFontFamilyToAugment);

    return launcher.loadFonts(cssFontFamily, fontFamily, isTtf, weights)
        .then(function(allLoaded) {
          launcher.requestMergedFontbases(allLoaded, mergedFontbasesUrl);
          return tachyfontCodePromise;
        })
        .then(function(tachyfontCode) {
          // Load the TachyFont library.
          launcher.loadTachyFontCode(tachyfontCode);
          // Load the TachyFonts.
          launcher.loadTachyFonts(
              cssFontFamily, cssFontFamilyToAugment, fontFamily, weights,
              dataUrl);
        });
  };


  /**
   * Loads the TachyFont code.
   * @param {string} tachyfontCode The TachyFont code.
   * @param {string=} opt_id An optional id. Useful for testing.
   */
  launcher.loadTachyFontCode = function(tachyfontCode, opt_id) {
    // Load the tachyfont code into the DOM.
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = tachyfontCode;
    script.id = opt_id || '';
    document.getElementsByTagName('head')[0].appendChild(script);
  };


  /**
   * Loads the TachyFonts.
   * @param {string} cssFontFamily The CSS font-family name.
   * @param {string} cssFontFamilyToAugment Add coverage to this cssFontFamily.
   * @param {string} fontFamily The font's family name.
   * @param {!Array<string>} weights The list of font weights to load.
   * @param {string} dataUrl The URL for data and reporting.
   */
  launcher.loadTachyFonts = function(
      cssFontFamily, cssFontFamilyToAugment, fontFamily, weights, dataUrl) {
    // Load the TachyFonts.
    var tachyfont = window['tachyfont'];
    var FontInfo = tachyfont['FontInfo'];
    var fontInfos = [];
    var priority = false;
    for (var i = 0; i < weights.length; i++) {
      var fontInfo = new FontInfo(fontFamily, weights[i], priority);
      fontInfos.push(fontInfo);
    }
    var FontsInfo = tachyfont['FontsInfo'];
    var fontsInfo = new FontsInfo(fontInfos, dataUrl, dataUrl);
    var params = {};
    params['cssFontFamilyToAugment'] = cssFontFamilyToAugment;
    params['noStartUpDelay'] = true;
    params['mutationObserver'] = launcher.mutationObserver;
    var loadTachyFonts = tachyfont['loadFonts'];
    loadTachyFonts(cssFontFamily, fontsInfo, params);
  };


  /**
   * Starts the loading of the merged fontbases if needed.
   * @param {boolean} allLoaded Whether all the fontbase were able to be loaded
   *     from persistent storage.
   * @param {string} mergedFontbasesUrl The url to the merged fontbases.
   */
  launcher.requestMergedFontbases = function(allLoaded, mergedFontbasesUrl) {
    // If not all the fonts are loaded then load the merged font bases.
    if (!allLoaded) {
      // Will need the merged fontbases so start loading them now.
      // But do not wait for them to load.
      launcher['mergedFontBases'] =
          launcher.loadUrlArrayBuffer(mergedFontbasesUrl);
    }
  };


  /**
   * For the node and sub-nodes remove TachyFont from input fields.
   * @param {string} cssFontFamily The TachyFont font family.
   * @param {string} cssFontFamilyToAugment The font family to augment with
   *     TachyFont
   * @param {!Node} node The starting point for walking the node/sub-nodes.
   */
  launcher.recursivelyAdjustCssFontFamilies = function(
      cssFontFamily, cssFontFamilyToAugment, node) {
    launcher.adjustCssFontFamilies(cssFontFamily, cssFontFamilyToAugment, node);
    var children = node.childNodes;
    for (var i = 0; i < children.length; i++) {
      launcher.recursivelyAdjustCssFontFamilies(
          cssFontFamily, cssFontFamilyToAugment, children[i]);
    }
  };


  /**
   * Remove TachyFont from an input field.
   * @param {string} cssFontFamily The TachyFont font family.
   * @param {string} cssFontFamilyToAugment The font family to augment with
   *     TachyFont
   * @param {!Node} node The node to work on.
   */
  launcher.adjustCssFontFamilies = function(
      cssFontFamily, cssFontFamilyToAugment, node) {
    if (node.nodeType != Node.ELEMENT_NODE) {
      return;
    }
    var needToAdjustedCss = false;
    var cssFamily =
        launcher.getComputedFontFamily(/** @type {!Element} */ (node));
    var families = cssFamily.split(',');
    var trimmedFamilies = [];
    for (var i = 0; i < families.length; i++) {
      var aCssFontName = launcher.trimCssFontFamily(families[i]);
      if (node.nodeName == 'INPUT') {
        // Drop TachyFont from input fields.
        if (aCssFontName == cssFontFamily) {
          needToAdjustedCss = true;
        } else {
          trimmedFamilies.push(aCssFontName);
        }
        continue;
      } else {
        if (!cssFontFamilyToAugment ||
            (aCssFontName != cssFontFamilyToAugment)) {
          trimmedFamilies.push(aCssFontName);
          continue;
        }
        // Check if this font is already augmented by TachyFont.
        if (i + 1 < families.length) {
          var nextName = launcher.trimCssFontFamily(families[i + 1]);
          if (nextName == cssFontFamily) {
            // Already augmented.
            continue;
          }
        }
      }
      // Need to augment with TachyFont.
      needToAdjustedCss = true;
      trimmedFamilies.push(aCssFontName);
      // Add TachyFont for this element.
      trimmedFamilies.push(cssFontFamily);
    }
    if (needToAdjustedCss) {
      var newCssFamily = trimmedFamilies.join(', ');
      node.style.fontFamily = newCssFamily;
    }
  };


  /**
   * Trim a CSSStyleSheet font-family string.
   * @param {!Element} element The element to get the font family.
   * @return {string} The font-family string.
   */
  launcher.getComputedFontFamily = function(element) {
    var style = getComputedStyle(element);
    return style.fontFamily;
  };


  /**
   * Trim a CSSStyleSheet font-family string.
   *
   * @param {string} cssFontFamily The font-family name to trim.
   * @return {string} The trimed font-family name.
   */
  launcher.trimCssFontFamily = function(cssFontFamily) {
    var trimmedName = cssFontFamily.trim();
    var firstChar = trimmedName.charAt(0);
    var lastChar = trimmedName.charAt(trimmedName.length - 1);
    if (firstChar != lastChar) {
      // Not wrapped by the same character.
      return trimmedName;
    }
    if ((firstChar != '"') && (firstChar != '\'')) {
      // Not wrapped by quotes.
      return trimmedName;
    }
    // Remove the wrapping quotes.
    return trimmedName.substring(1, trimmedName.length - 1);
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
   * The placeholder data needs to be loaded with the launcher
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
  launcher.zeroRunBase = 71;  // 'G'


  /**
   * The maximum number of '0' to encode in a single zeroRunBase.
   * Publically visible so it can be used during testing.
   * @type {number}
   */
  launcher.zeroRunMax = 10;


  /**
   * The start of compacted '0?' encodings.
   * Since Hex Ascii has exactly 16 value this range will take 'a'
   * Publically visible so it can be used during testing.
   * @type {number}
   */
  launcher.singleZeroBase = 103;  // 'g'


  /**
   * Gets a placeholder font.
   * Publically visible so it can be used during testing.
   * @return {!DataView} The font's bytes.
   */
  launcher.getPlaceholderFont = function() {
    // Expand the compacted data string.
    var expandedString = '';
    for (var i = 0; i < launcher.fontCompacted.length; i++) {
      var aChar = launcher.fontCompacted[i];
      var charCode = aChar.charCodeAt(0);
      if (charCode < launcher.zeroRunBase) {
        expandedString += aChar;
      } else if (charCode < launcher.singleZeroBase) {
        var count = charCode - launcher.zeroRunBase;
        while (count--) {
          expandedString += '0';
        }
      } else {
        var secondCharCode = charCode - launcher.singleZeroBase;
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
  launcher.fontCompacted =
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
  window['tachyfont_launcher'] = launcher;
  launcher['reports'] = reports;
  launcher['loadFonts'] = launcher.loadFonts;
  launcher['startTachyFont'] = launcher.startTachyFont;
})();
