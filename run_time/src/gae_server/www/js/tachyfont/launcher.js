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


  /** @const {string} The Style Sheet ID. */
  var STYLESHEET_ID = 'Incremental\u00A0Font\u00A0Utils';


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
            promises.push(launcher.setFontNoFlash(
                sheet, cssFontFamily, null, fontInfos1[i]));
          }
          return Promise.all(promises);
        })
        .then(function() {
          // Now load whatever fonts are already persisted.
          fontInfos1 = fontInfos.slice();
          promises = [];
          for (var i = 0; i < fontInfos1.length; i++) {
            promises.push(
                launcher.useFont(sheet, cssFontFamily, fontInfos1[i]));
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
   * Set the CSS \@font-face rule.
   *
   * @param {!CSSStyleSheet} sheet The style sheet.
   * @param {string} cssFontFamily The fontFamily.
   * @param {string} weight The weight.
   * @param {string} srcStr The src string for the \@font-face
   */
  function setCssFontRule(sheet, cssFontFamily, weight, srcStr) {
    var rule_str = '@font-face{' +
        'font-family: ' + cssFontFamily + ';' +
        'font-weight: ' + weight + ';' +
        'src: ' + srcStr +  //
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
   * @param {!launcher.FontInfo} fontInfo Info about this font.
   * @return {!Promise} The promise resolves when the glyphs are displaying.
   */
  launcher.setFontNoFlash = function(
      sheet, cssFontFamily, fontDataView, fontInfo) {
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
  launcher.useFont = function(sheet, cssFontFamily, fontInfo) {
    return launcher.getFontData(fontInfo)
        .then(function(fontDataView) {
          return launcher
              .setFontNoFlash(sheet, cssFontFamily, fontDataView, fontInfo)
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

    // Update the CSS.
    launcher.recursivelyAdjustCssFontFamilies(
        cssFontFamily, cssFontFamilyToAugment, document.documentElement);
    // Now that the cssFontFamily and cssFontFamilyToAugment are available
    // update the Mutation observer to automatically update the CSS.
    launcher.addDomMutationObserver(cssFontFamily, cssFontFamilyToAugment);

    // Start fetching the tachyfont code so it can come in while the fonts are
    // being loaded from persistence.
    var tachyfontCodePromise = launcher.loadUrlText(tachyfontCodeUrl);

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
   * Export the objects and functions. Data exports may be done elsewhere in
   * this file.
   */
  window['tachyfont_launcher'] = launcher;
  launcher['reports'] = reports;
  launcher['loadFonts'] = launcher.loadFonts;
  launcher['startTachyFont'] = launcher.startTachyFont;
})();
