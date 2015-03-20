'use strict';

/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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

goog.require('goog.Promise');
goog.require('goog.Uri');
goog.require('goog.debug.Console');
goog.require('goog.log');
goog.require('goog.log.Logger');
goog.require('goog.net.XhrIo');
goog.require('goog.style');

goog.require('tachyfont.BackendService');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.chainedPromises');
goog.require('tachyfont.promise');
goog.require('tachyfont.RLEDecoder');
goog.require('tachyfont.TachyFontSet');
goog.require('webfonttailor');
goog.require('webfonttailor.FontsInfo');


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
    // Get any URL debug parameters.
    /** @type {goog.Uri} */
    tachyfont.uri = goog.Uri.parse(window.location.href);

    /** @type {goog.debug.Logger.Level} */
    tachyfont.debug_level;
    /** @type {string} */
    tachyfont.debug_level_str =
      tachyfont.uri.getParameterValue('TachyFontDebugLevel') || '';
    if (tachyfont.debug_level_str) {
      tachyfont.debug_level =
        goog.debug.Logger.Level.getPredefinedLevel(tachyfont.debug_level_str);
    }

    // Send the debug output to the console.
    /**
     * @type {goog.debug.Console}
     * @private
     */
    tachyfont.debugConsole_ = new goog.debug.Console();
    tachyfont.debugConsole_.setCapturing(true);
    /**
     * @type {goog.debug.Logger}
     * @private
     */
    tachyfont.logger_ = goog.log.getLogger('debug', tachyfont.debug_level);
    /**
     * @type {boolean}
     * @private
     */
    tachyfont.buildDemo_ = false;
  }
}

/**
 * Enable/disable using/saving persisted data.
 * @typedef {boolean}
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
 * @type {number}
 */
tachyfont.MINIMUM_NON_OBFUSCATION_LENGTH = 20;

/**
 * The range of characters to pick from.
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
 * tachyfont.IncrementalFont - A sub-namespace.
 */
tachyfont.IncrementalFont = function() {
};

/**
 * The IndexedDB version.
 * Increment this number every time there is a change in the schema.
 */
tachyfont.IncrementalFont.version = 1;


/**
 * The maximum time in milliseconds to hide the text to prevent FOUT.
 */
tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS = 3000;


/**
 * The database name.
 */
tachyfont.IncrementalFont.DB_NAME = 'incrfonts';


/**
 * The time in milliseconds to wait before persisting the data.
 */
tachyfont.IncrementalFont.PERSIST_TIMEOUT = 1000;


/**
 * The base name.
 */
tachyfont.IncrementalFont.BASE = 'base';


/**
 * The base is dirty (needs to be persisted) key.
 */
tachyfont.IncrementalFont.BASE_DIRTY = 'base_dirty';


/**
 * The char list name.
 */
tachyfont.IncrementalFont.CHARLIST = 'charlist';


/**
 * The charlist is dirty (needs to be persisted) key.
 */
tachyfont.IncrementalFont.CHARLIST_DIRTY = 'charlist_dirty';


/**
 * Create a font identifing string.
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
 * Walk the DOM.
 *
 * @param {Object} node The starting point for walk.
 * @param {function(Object)} func The function to call for each node.
 * TODO(bstell): The return value should be more flexible.
 * @return {boolean} Boolean result of the function.
 */
tachyfont.walkDom = function(node, func) {
  var addedText = func(node);
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    addedText = tachyfont.walkDom(children[i], func) || addedText;
  }
  return addedText;
};

/**
 * Create a list of TachyFonts
 *
 * @param {string} familyName The font-family name.
 * TODO(bstell): remove the Object type.
 * @param {webfonttailor.FontsInfo|Object} fontsInfo The information about the
 *     fonts.
 * @param {Object.<string, string>} opt_params Optional parameters.
 * @return {tachyfont.TachyFontSet} The TachyFontSet object.
 */
tachyfont.loadFonts = function(familyName, fontsInfo, opt_params) {
  if (goog.DEBUG) {
    tachyfont.debugInitialization_();
    goog.log.fine(tachyfont.logger_, 'loadFonts');
  }
  var tachyFontSet = new tachyfont.TachyFontSet(familyName);
  var tachyFonts = tachyFontSet.fonts_;
  // TODO(bstell): this initialization of TachyFontSet should be in the
  // constructor or and init function.
  opt_params = opt_params || {};
  var url = fontsInfo['url'];
  var fonts = fontsInfo['fonts'];
  for (var i = 0; i < fonts.length; i++) {
    var fontInfo = fonts[i];
    fontInfo['familyName'] = familyName;
    fontInfo['url'] = url;
    var tachyFont = new tachyfont.TachyFont(fontInfo, opt_params);
    tachyFontSet.addFont(tachyFont);
    // TODO(bstell): need to support slant/width/etc.
    var fontId = tachyfont.fontId(familyName, fontInfo['weight']);
    tachyFontSet.fontIdToIndex[fontId] = i;
  }
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
      'loadFonts: wait for preceding update');
  }
  var allLoaded = tachyFontSet.finishPrecedingUpdateFont_.getChainedPromise();
  allLoaded.getPrecedingPromise().
  then(function() {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'loadFonts: done waiting for preceding update');
    }
    // Try to get the base from persistent store.
    var bases = [];
    for (var i = 0; i < tachyFonts.length; i++) {
      var incrfont = tachyFonts[i].incrfont;
      var persistedBase = incrfont.getPersistedBase_();
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
        incrfont.needToSetFont_ = true;
      } else {
        // If not persisted the fetch the base from the URL.
        loadedBase = incrfont.getUrlBase_(incrfont.backendService,
            incrfont.fontInfo_);
      }
      arrayBaseData[i] = goog.Promise.resolve(loadedBase);
    }
    // Have loaded fonts from persistent store or URL.
    goog.Promise.all(arrayBaseData).
    then(function(arrayBaseData) {
      var allCssSet = [];
      for (var i = 0; i < tachyFonts.length; i++) {
        var incrfont = tachyFonts[i].incrfont;
        var loadedBase = arrayBaseData[i];
        // If not persisted then need to wait for DOMContentLoaded to set the
        // font.
        if (!incrfont.alreadyPersisted) {
          incrfont.base.resolve(loadedBase);
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger_, 'loadFonts: not persisted');
          }
          allCssSet.push(goog.Promise.resolve(null));
          continue;
        }
        // The font was in persistent store so:
        // * it is very likely that the font _already_ has the UI text so
        //   immediately show the UI in the TachyFont.
        if (goog.DEBUG) {
          goog.log.fine(tachyfont.logger_, 'loadFonts: setFont_');
        }
        // TODO(bstell): only set the font if there are characters.
        var cssSet = incrfont.setFont(loadedBase[1], loadedBase[0].isTtf).
          then(function(cssSetResult) {
            if (goog.DEBUG) {
              goog.log.fine(tachyfont.logger_, 'loadFonts: setFont_ done');
            }
            tachyfont.IncrementalFontUtils.setVisibility(incrfont.style,
              incrfont.fontInfo_, true);
            // Release other operations to proceede.
            incrfont.base.resolve(loadedBase);
          });
        allCssSet.push(cssSet);
      }
      return goog.Promise.all(allCssSet);
    }).
    then(function(allSetResults) {
      if (goog.DEBUG) {
        goog.log.fine(tachyfont.logger_, 'loadFonts: all fonts loaded');
      }
      // Allow any pending updates to happen.
      allLoaded.resolve();

    }).
    thenCatch(function(e) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger_, 'failed to get the font: ' +
          e.stack);
        debugger;
      }
    });
  });

  if (goog.DEBUG) {
    // Need to handle input fields
    if (typeof tachyfont.todo_handle_input_fields == 'undefined') {
      tachyfont.todo_handle_input_fields = 1;
      goog.log.error(tachyfont.logger_, 'need to handle input fields');
    }
  }

  // Get any characters that are already in the DOM.
  tachyfont.walkDom(document.documentElement, function(node) {
    if (node.nodeName == '#text') {
      return this.addTextToFontGroups(node);
    } else {
      return false;
    }
  }.bind(tachyFontSet));

  // Add DOM mutation observer.
  // This records the changes on a per-font basis.
  // Note: mutation observers do not look at INPUT field changes.
  //create an observer instance
  var observer = new MutationObserver(function(mutations) {
    if (goog.DEBUG) {
      goog.log.fine(tachyfont.logger_, 'MutationObserver');
    }
    mutations.forEach(function(mutation) {
      if (mutation.type == 'childList') {
        for (var i = 0; i < mutation.addedNodes.length; i++) {
          var node = mutation.addedNodes[i];
          // Look for text elements.
          if (node.nodeName == '#text') {
            tachyFontSet.addTextToFontGroups(node);
          }
        }
      } else if (mutation.type == 'characterData') {
        if (mutation.target.nodeName == '#text') {
          tachyFontSet.addTextToFontGroups(mutation.target);
        } else {
          if (goog.DEBUG) {
            goog.log.info(tachyfont.logger_,
                'need to handle characterData for non-text');
          }
        }
      }
    });
    // TODO(bstell): need to figure out if pendingChars_ is helpful in
    // determining when to update the char data and/or update the CSS.
    //console.log('tachyFontSet.pendingChars_ = ' + tachyFontSet.pendingChars_);
    // TODO(bstell): Should check if there were any chars.
    // If this is the 1st mutation event and it happened after DOMContentLoaded
    // then do the update now.
    var immediateUpdate;
    if (!tachyFontSet.hadMutationEvents_ && tachyFontSet.domContentLoaded_) {
      immediateUpdate = true;
    } else {
      immediateUpdate = false;
    }
    tachyFontSet.hadMutationEvents_ = true;
    if (immediateUpdate) {
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger_, 'mutation observer: updateFont');
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
    tachyFontSet.domContentLoaded_ = true;
    // On DOMContentLoaded we want to update the fonts. If there have been
    // mutation events then do the update now. Characters should be in the DOM
    // now but the order of DOMContentLoaded and mutation events is not defined
    // and a mutation event should be coming right after this. We could scan the
    // DOM and do the update right now but scanning the DOM is expensive. So
    // instead wait for the mutation event.
    if (tachyFontSet.hadMutationEvents_) {
      // We have characters so update the fonts.
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger_, 'DOMContentLoaded: updateFonts');
      }
      tachyFontSet.updateFonts(true);
    } else {
      // The mutation event should be very soon.
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger_,
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
      goog.log.info(tachyfont.logger_,
          'tachyfont.updateFonts: passing in an array is deprecated');
    }
    for (var i = 0; i < tachyFonts.length; i++) {
      var tachyFont = tachyFonts[i];
      tachyFont.incrfont.loadChars();
    }
  } else if (tachyFonts.constructor == tachyfont.TachyFontSet) {
    if (goog.DEBUG) {
      goog.log.info(tachyfont.logger_, 'tachyfont.updateFonts');
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
 * @param {string} in_char The input char (string).
 * @return {number} The numeric value.
 */
tachyfont.charToCode = function(in_char) {
  var cc = in_char.charCodeAt(0);
  if (cc >= 0xD800 && cc <= 0xDBFF) {
    var high = (cc - 0xD800) << 10;
    var low = in_char.charCodeAt(1) - 0xDC00;
    var codepoint = high + low + 0x10000;
    return codepoint;
  } else {
    return cc;
  }
};


/**
 * Get the incremental font object.
 * This class does the following:
 * 1. Create a class using the "@font-face" rule and with visibility=hidden
 * 2. Create an incremental font manager object.
 * 3. Open the IndexedDB.
 * 4. Start the operation to get the base.
 * 5. Start the operation to get the list of fetched/not-fetched chars.
 * 6. Create a "@font-face" rule (need the data to make the blob URL).
 * 7. When the base is available set the class visibility=visible
 *
 * @param {Object.<string, string>} fontInfo Info about this font.
 * @param {Object} params Optional parameters.
 * @return {tachyfont.IncrementalFont.obj_} The incremental font manager object.
 */
tachyfont.IncrementalFont.createManager = function(fontInfo, params) {
  var fontName = fontInfo['name'];
  var backendService =
      fontInfo['fontkit'] ?
      new tachyfont.GoogleBackendService(fontInfo['url']) :
      new tachyfont.BackendService(fontInfo['url']);

  var initialVisibility = false;
  var initialVisibilityStr = 'hidden';
  if (params['visibility'] == 'visible') {
    initialVisibility = true;
    initialVisibilityStr = 'visible';
  }
  var maxVisibilityTimeout = tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS;
  if (params['maxVisibilityTimeout']) {
    try {
      maxVisibilityTimeout = parseInt(params['maxVisibilityTimeout'], 10);
    } catch (err) {
    }
  }

  // Create a style for this font.
  var style = document.createElement('style');
  document.head.appendChild(style);
  var rule = '.' + fontName + ' { font-family: ' + fontName + '; ' +
    'visibility: ' + initialVisibilityStr + '; }';
  style.sheet.insertRule(rule, 0);

  //tachyfont.timer1.start('load base');
  tachyfont.timer1.start('load Tachyfont base+data for ' + fontName);
  // if (goog.DEBUG) {
  //   goog.log.info(tachyfont.logger_,
  //     'check to see if a webfont is in cache');
  // }
  var incrFontMgr =
      new tachyfont.IncrementalFont.obj_(fontInfo, params, backendService);
  //tachyfont.timer1.start('openIndexedDB.open ' + fontName);
//  tachyfont.IncrementalFontUtils.logger(incrFontMgr.url,
//    'need to report info');
  /*
  if (goog.DEBUG) {
    goog.log.info(tachyfont.logger_, 'It would be good to report status of:\n' +
        '* idb\n' +
        '* chars needed\n' +
        '* webfont in cache\n' +
        '* timing\n' +
        '* way to collect the info\n' +
        '* way to clear old info\n' +
        '* errors');
  }
  */
  incrFontMgr.getIDB_ = incrFontMgr.openIndexedDB(fontName);
  //tachyfont.timer1.end('openIndexedDB.open ' + fontName);

  // Create a class with initial visibility.
  incrFontMgr.style = tachyfont.IncrementalFontUtils.setVisibility(null,
    fontInfo, initialVisibility);
  // Limit the maximum visibility=hidden time.
  setTimeout(function() {
    tachyfont.IncrementalFontUtils.setVisibility(incrFontMgr.style, fontInfo,
      true);
  }, maxVisibilityTimeout);

  // Start the operation to get the list of already fetched chars.
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
      'Get the list of already fetched chars.');
  }
  incrFontMgr.getCharList = incrFontMgr.getIDB_.
  then(function(idb) {
    if (tachyfont.persistData) {
      return incrFontMgr.getData_(idb, tachyfont.IncrementalFont.CHARLIST);
    } else {
      var e = new Event('not using persisting charlist');
      return goog.Promise.reject(e);
    }
  }).
  thenCatch(function(e) {
    return {};
  }).
  then(function(charlist_data) {
    return charlist_data;
  }).thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger_, e.stack);
      debugger;
    }
  });

  if (tachyfont.buildDemo_) {
    tachyfont.buildDemo_ = false;
    // For Debug: add a button to clear the IndexedDB.
    tachyfont.ForDebug.addDropIdbButton(incrFontMgr, fontName);

    // For Debug: add a control to set the bandwidth.
    tachyfont.ForDebug.addBandwidthControl();

    // For Debug: add a control to set the timing text size.
    tachyfont.ForDebug.addTimingTextSizeControl();
  }

  return incrFontMgr;
};


/**
 * IncrFontIDB.obj_ - A class to handle interacting the IndexedDB.
 * @param {Object.<string, string>} fontInfo Info about this font.
 * @param {Object} params Optional parameters.
 * @param {Object} backendService object used to generate backend requests.
 * @constructor
 * @private
 */
tachyfont.IncrementalFont.obj_ = function(fontInfo, params, backendService) {
  /**
   * Information about the fonts
   *
   * @private {Object.<string, string>}
   */
  this.fontInfo_ = fontInfo;

  this.fontName = fontInfo['name'];
  this.charsToLoad = {};
  this.req_size = params['req_size'];

  /**
   * True if new characters have been loaded since last setFont
   *
   * @private {boolean}
   */
  this.needToSetFont_ = false;

  this.url = fontInfo['url'];
  this.charsURL = '/incremental_fonts/request';
  this.alreadyPersisted = false;
  this.persistData = true;
  this.persistInfo = {};
  this.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = false;
  this.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = false;
  this.style = null;
  this.backendService = backendService;

  if (params['persistData'] == false || !tachyfont.persistData) {
    this.persistData = false;
  }

  if (!this.url) {
    this.url = window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
  }

  // Promises
  this.getIDB_ = null;
  this.base = new tachyfont.promise();
  this.getBase = this.base.getPromise();
  this.getCharList = null;
  // TODO(bstell): Use ChainedPromise to properly serialize the promises.
  this.finishPersistingData = goog.Promise.resolve();

  /**
   * The character request operation takes time so serialize them.
   *
   * TODO(bstell): Use ChainedPromise to properly serialize the promises.
   *
   * @private {goog.Promise}
   */
  this.finishPrecedingCharsRequest_ = goog.Promise.resolve();

  /**
   * The setFont operation takes time so serialize them.
   *
   * TODO(bstell): Use ChainedPromise to properly serialize the promises.
   *
   * @private {goog.Promise}
   */
  this.finishPrecedingSetFont_ = goog.Promise.resolve();
};


/**
 * Get the font base from persistent store.
 * @return {goog.Promise} The base bytes in DataView.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.getPersistedBase_ = function() {
  var that = this;
  var persistedBase = this.getIDB_.
  then(function(idb) {
    var filedata;
    if (tachyfont.persistData) {
      filedata = that.getData_(idb, tachyfont.IncrementalFont.BASE);
    } else {
      var e = new Event('not using persisting data');
      filedata = goog.Promise.all([goog.Promise.resolve(idb),
          goog.Promise.reject(e)]);
    }
    return goog.Promise.all([goog.Promise.resolve(idb), filedata]);
  }).
  then(function(arr) {
    var idb = arr[0];
    var filedata = new DataView(arr[1]);
    var fileinfo = tachyfont.IncrementalFontUtils.parseBaseHeader(filedata);
    var fontdata = new DataView(arr[1], fileinfo.headSize);
    return goog.Promise.all([goog.Promise.resolve(fileinfo),
        goog.Promise.resolve(fontdata)]);
  }).
  thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'font not persisted: ' + e.stack);
    }
    return null;
  });
  return persistedBase;
};


/**
 * Get the font base from a URL.
 * @param {Object} backendService The object that interacts with the backend.
 * @param {Object.<string, string>} fontInfo Info about this font.
 * @return {goog.Promise} The base bytes in DataView.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.getUrlBase_ =
  function(backendService, fontInfo) {
  var that = this;
  var rslt = backendService.requestFontBase(fontInfo).
  then(function(xfer_bytes) {
    //tachyfont.timer1.start('uncompact base');
    var xfer_data = new DataView(xfer_bytes);
    var fileinfo = tachyfont.IncrementalFontUtils.parseBaseHeader(xfer_data);
    var header_data = new DataView(xfer_bytes, 0, fileinfo.headSize);
    var rle_fontdata = new DataView(xfer_bytes, fileinfo.headSize);
    var raw_base = tachyfont.RLEDecoder.rleDecode([header_data,
                                                   rle_fontdata]);
    var raw_basefont = new DataView(raw_base.buffer, header_data.byteLength);
    tachyfont.IncrementalFontUtils.writeCmap12(raw_basefont, fileinfo);
    tachyfont.IncrementalFontUtils.writeCmap4(raw_basefont, fileinfo);
    tachyfont.IncrementalFontUtils.writeCharsetFormat2(raw_basefont,
      fileinfo);
    var basefont =
      tachyfont.IncrementalFontUtils.sanitizeBaseFont(fileinfo, raw_basefont);
    that.persistDelayed_(tachyfont.IncrementalFont.BASE);
    //tachyfont.timer1.end('uncompact base');
    return [fileinfo, basefont];
  });
  return rslt;
};


/**
 * Set the \@font-face rule.
 * @param {DataView} fontdata The font dataview.
 * @param {boolean} isTtf True if the font is a TrueType font.
 * @return {goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj_.prototype.setFont = function(fontdata, isTtf) {
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
      'setFont: wait for preceding');
  }
  return this.finishPrecedingSetFont_
  .then(function() {
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'setFont: done waiting for preceding');
    }
    this.needToSetFont_ = false;
    this.finishPrecedingSetFont_ = new goog.Promise(function(resolve) {
      if (goog.DEBUG) {
        goog.log.fine(tachyfont.logger_, 'setFont ' + this.fontInfo_['name']);
      }
      var mimeType, format;
      if (isTtf) {
        mimeType = 'font/ttf'; // 'application/x-font-ttf';
        format = 'truetype';
      } else {
        mimeType = 'font/otf'; // 'application/font-sfnt';
        format = 'opentype';
      }
      var blobUrl = tachyfont.IncrementalFontUtils.getBlobUrl(
        this.fontInfo_, fontdata, mimeType);

      return this.setFontNoFlash(this.fontInfo_, format, blobUrl).
        then(function() {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger_, 'setFont: setFont done');
          }
          resolve();
        });
    }.bind(this));
    return this.finishPrecedingSetFont_;
  }.bind(this));
};

/**
 * Obfuscate small requests to make it harder for a TachyFont server to
 * determine the content on a page.
 * @param {Array<number>} codes The codepoints to add obusfuscation to.
 * @param {Object} charlist The chars that have already been requested.
 * @return {Array<number>} The codepoints with obusfuscation.
 */
tachyfont.possibly_obfuscate = function(codes, charlist) {
  // Check if we need to obfuscate the request.
  if (codes.length >= tachyfont.MINIMUM_NON_OBFUSCATION_LENGTH)
    return codes;

  var code_map = {};
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    code_map[code] = code;
  }
  var num_new_codes = tachyfont.MINIMUM_NON_OBFUSCATION_LENGTH - codes.length;
  var target_length = tachyfont.MINIMUM_NON_OBFUSCATION_LENGTH;
  var max_tries = num_new_codes * 10 + 100;
  for (var i = 0;
      Object.keys(code_map).length < target_length && i < max_tries;
      i++) {
    var code = codes[i % codes.length];
    var bottom = code - tachyfont.OBFUSCATION_RANGE / 2;
    if (bottom < 0) {
      bottom = 0;
    }
    var top = code + tachyfont.OBFUSCATION_RANGE / 2;
    var new_code = Math.floor(goog.math.uniformRandom(bottom, top + 1));
    if (charlist[new_code] == undefined) {
      code_map[new_code] = new_code;
      var new_char = String.fromCharCode(new_code);
      charlist[new_char] = 1;
    }
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        Object.keys(code_map).length.toString());
    }
  }

  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'before obfuscation: codes.length = ' + codes.length);
    codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.logger_, 'codes = ' + codes);
  }
  var combined_codes = [];
  var keys = Object.keys(code_map);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    combined_codes.push(code_map[key]);
  }
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'after obfuscation: combined_codes.length = ' + combined_codes.length);
    combined_codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.logger_, 'combined_codes = ' +
        combined_codes);
  }
  return combined_codes;
};


/**
 * Load the data for needed chars.
 *
 * @return {goog.Promise} Returns the getBase promise.
 * successfully
 */
tachyfont.IncrementalFont.obj_.prototype.loadChars = function() {
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger_, 'loadChars');
  }
  var that = this;
  var chars = '';
  var charlist;
  var neededCodes = [];
  var remaining = [];
  // TODO(bstell): this method of serializing the requests seems like it could
  // allow multiple requests to wait on a single promise. When that promise
  // resolved all the waiting requests would be unblocked.
  //
  // This probably needs to be replaced with a queue of requests that works as
  // follows:
  //
  //   An initial resolved promise is added to the front of the queue. As a new
  //   request comes it addes itself to the end of the queue and waits on the
  //   previous request to resolve.
  this.finishPrecedingCharsRequest_ = this.finishPrecedingCharsRequest_.
  then(function() {
    var charArray = Object.keys(that.charsToLoad);
    // Check if there are any new characters.
    // TODO(bstell): until the serializing is fixed this stops multiple requests
    // running on the same resolved promise.
    if (charArray.length == 0) {
      return null;
    }
    var pending_resolve, pending_reject;
    // TODO(bstell): use tachfont.promise here?
    return new goog.Promise(function(resolve, reject) {
      pending_resolve = resolve;
      pending_reject = reject;

        return that.getCharList.
        then(function(charlist_) {
          charlist = charlist_;
          // Make a tmp copy in case we are chunking the requests.
          var tmp_charlist = {};
          for (var key in charlist) {
            tmp_charlist[key] = charlist[key];
          }
          for (var i = 0; i < charArray.length; i++) {
            var c = charArray[i];
            if (!tmp_charlist[c]) {
              neededCodes.push(tachyfont.charToCode(c));
              tmp_charlist[c] = 1;
            }
          }

          if (neededCodes.length) {
            neededCodes = tachyfont.possibly_obfuscate(neededCodes,
                tmp_charlist);
            if (goog.DEBUG) {
              goog.log.info(tachyfont.logger_, that.fontInfo_['name'] +
                  ': load ' + neededCodes.length + ' codes:');
              goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
                  '' + neededCodes);
            }
          } else {
            if (goog.DEBUG) {
              goog.log.fine(tachyfont.logger_, 'no new characters');
            }
            return null;
          }
          neededCodes.sort(function(a, b) { return a - b; });
          if (that.req_size) {
            remaining = neededCodes.slice(that.req_size);
            neededCodes = neededCodes.slice(0, that.req_size);
          }
          for (var i = 0; i < neededCodes.length; i++) {
            var c = String.fromCharCode(neededCodes[i]);
            charlist[c] = 1;
            delete that.charsToLoad[c];
          }
          return that.backendService.requestCodepoints(that.fontInfo_,
                                                       neededCodes).
          then(function(bundleResponse) {
            if (remaining.length) {
              setTimeout(function() {
                that.loadChars();
              }, 1);
            }
            // if (goog.DEBUG) {
            //   goog.log.info(tachyfont.logger_,
            //     'requested char data length = ' +chardata.byteLength);
            // }
            return bundleResponse;
          });
        }).
        then(function(bundleResponse) {
          return that.getBase.
          then(function(arr) {
            var fileinfo = arr[0];
            var fontdata = arr[1];
            var dataLength = 0;
            if (bundleResponse != null) {
              dataLength = bundleResponse.getDataLength();
              if (dataLength != 0) {
                that.needToSetFont_ = true;
              }
              if (goog.DEBUG) {
                goog.log.info(tachyfont.logger_,
                    'injectCharacters: glyph count / data length = ' +
                    bundleResponse.getGlyphCount() + ' / ' + dataLength);
              }
              fontdata = tachyfont.IncrementalFontUtils.injectCharacters(
                  fileinfo, fontdata, bundleResponse);
              var msg;
              if (remaining.length) {
                msg = 'display ' + Object.keys(charlist).length + ' chars';
              } else {
                msg = '';
                tachyfont.timer1.end('load Tachyfont base+data for ' +
                    that.fontName);
                tachyfont.timer1.done();
              }
              // Update the data promises.
              that.getBase = goog.Promise.all([goog.Promise.resolve(fileinfo),
                  goog.Promise.resolve(fontdata)]);
              that.getCharlist = goog.Promise.resolve(charlist);

              // Persist the data.
              that.persistDelayed_(tachyfont.IncrementalFont.BASE);
              that.persistDelayed_(tachyfont.IncrementalFont.CHARLIST);
            } else {
              var msg = '';
              tachyfont.timer1.end('load Tachyfont base+data for ' +
                  that.fontName);
              tachyfont.timer1.done();
            }
            pending_resolve(true);
          }).
          thenCatch(function(e) {
            if (goog.DEBUG) {
              goog.log.error(tachyfont.logger_, 'failed to getBase: ' +
                e.stack);
              debugger;
            }
            pending_reject(false);
          });
        });
      }).
      thenCatch(function(e) {
        if (goog.DEBUG) {
          goog.log.error(tachyfont.logger_, 'loadChars: ' + e.stack);
          debugger;
        }
        pending_reject(false);
      });
  }).thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger_, e.stack);
      debugger;
    }
  });
  return this.finishPrecedingCharsRequest_;
};

/**
 * Save data that needs to be persisted.
 *
 * @param {string} name The name of the data item.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.persistDelayed_ = function(name) {
  if (!this.persistData) {
    return;
  }
  var that = this;
  // if (goog.DEBUG) {
  //   goog.log.fine(tachyfont.logger_, 'persistDelayed ' + name);
  // }

  // Note what needs to be persisted.
  if (name == tachyfont.IncrementalFont.BASE) {
    this.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = true;
  } else if (name == tachyfont.IncrementalFont.CHARLIST) {
    this.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = true;
  }

  // In a little bit do the persisting.
  setTimeout(function() {
    that.persist_(name);
  }, tachyfont.IncrementalFont.PERSIST_TIMEOUT);
};


/**
 * Save data that needs to be persisted.
 * @param {string} name The name of the data item.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.persist_ = function(name) {
  var that = this;
  // Wait for any preceding persist operation to finish.
  this.finishPersistingData.then(function() {
    // Previous persists may have already saved the data so see if there is
    // anything still to persist.
    var base_dirty = that.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY];
    var charlist_dirty =
      that.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY];
    if (!base_dirty && !charlist_dirty) {
      return;
    }

    // What ever got in upto this point will get saved.
    that.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = false;
    that.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = false;

    // Note that there is now a persist operation running.
    that.finishPersistingData = goog.Promise.resolve().
    then(function() {
      if (base_dirty) {
        return that.getBase.
        then(function(arr) {
          return goog.Promise.all([that.getIDB_, goog.Promise.resolve(arr[0]),
                                   goog.Promise.resolve(arr[1])]);
        }).
        then(function(arr) {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger_, 'save base');
          }
          return that.saveData_(arr[0],
            tachyfont.IncrementalFont.BASE, arr[2].buffer);
        });
      }
    }).
    then(function() {
      if (charlist_dirty) {
        return that.getCharList.
        then(function(charlist) {
          return goog.Promise.all([that.getIDB_,
                                   goog.Promise.resolve(charlist)]);
        }).
        then(function(arr) {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger_, 'save charlist');
          }
          return that.saveData_(arr[0], tachyfont.IncrementalFont.CHARLIST,
            arr[1]);
        });
      }
    }).
    thenCatch(function(e) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger_, 'persistDelayed_: ' + e.stack);
        debugger;
      }
    }).
    then(function() {
      // if (goog.DEBUG) {
      //   goog.log.fine(tachyfont.logger_, 'persisted ' + name);
      // }
    });
  }).thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger_, e.stack);
      debugger;
    }
  });
};


/**
 * Save a data item.
 * @param {Object} idb The IndexedDB object.
 * @param {string} name The name of the item.
 * @param {Array} data The data.
 * @return {goog.Promise} Operation completion.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.saveData_ = function(idb, name, data) {
  var that = this;
  return that.getIDB_.
  then(function(db) {
    // the initialization form x = { varname: value } handles the key is a
    // literal string. If a variable varname is used for the key then the
    // string varname will be used ... NOT the value of the varname.
    return new goog.Promise(function(resolve, reject) {
      var trans = db.transaction([name], 'readwrite');
      var store = trans.objectStore(name);
      var request = store.put(data, 0);
      request.onsuccess = function(e) {
        resolve();
      };
      request.onerror = function(e) {
        if (goog.DEBUG) {
          debugger;
        }
        reject(null);
      };
    }).
    thenCatch(function(e) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger_, 'saveData ' + db.name + ' ' + name +
            ': ' + e.stack);
        debugger;
      }
    });
  }).thenCatch(function(e) {
    if (goog.DEBUG) {
      goog.log.error(tachyfont.logger_, e.stack);
      debugger;
    }
  });
};

/**
 * Get the fontDB.
 * @param {string} fontName The name of the font.
 * @return {goog.Promise} The font DB.
 */
tachyfont.IncrementalFont.obj_.prototype.openIndexedDB = function(fontName) {
  var that = this;

  var openIDB = new goog.Promise(function(resolve, reject) {
    var db_name = tachyfont.IncrementalFont.DB_NAME + '/' + fontName;
    //tachyfont.timer1.start('indexedDB.open ' + db_name);
    var dbOpen = window.indexedDB.open(db_name,
      tachyfont.IncrementalFont.version);
    //tachyfont.timer1.end('indexedDB.open ' + db_name);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      resolve(db);
    };
    dbOpen.onerror = function(e) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger_, '!!! IncrFontIDB.obj_ "' + db_name +
          '": ' + e.value);
        debugger;
      }
      reject(e);
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        if (goog.DEBUG) {
          goog.log.error(tachyfont.logger_, 'onupgradeneeded error: ' +
            e.value);
          debugger;
        }
        reject(e);
      };
      if (db.objectStoreNames.contains(tachyfont.IncrementalFont.BASE)) {
        db.deleteObjectStore(tachyfont.IncrementalFont.BASE);
      }
      if (db.objectStoreNames.contains(tachyfont.IncrementalFont.CHARLIST)) {
        db.deleteObjectStore(tachyfont.IncrementalFont.CHARLIST);
      }
      db.createObjectStore(tachyfont.IncrementalFont.BASE);
      db.createObjectStore(tachyfont.IncrementalFont.CHARLIST);
    };
  });
  return openIDB;
};


/**
 * Get a part of the font.
 *
 * @param {Object} idb The IndexedDB object.
 * @param {string} name The name of the font data to get.
 * @return {goog.Promise} Promise to return the data.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.getData_ = function(idb, name) {
  var that = this;
  var getData = new goog.Promise(function(resolve, reject) {
    var trans = idb.transaction([name], 'readwrite');
    var store = trans.objectStore(name);
    var request = store.get(0);
    request.onsuccess = function(e) {
      var result = e.target.result;
      if (result != undefined) {
        resolve(result);
      } else {
        reject(e);
      }
    };

    request.onerror = function(e) {
      if (goog.DEBUG) {
        goog.log.error(tachyfont.logger_, 'e = ' + e);
        debugger;
      }
      reject(e);
    };
  }).
  thenCatch(function(e) {
    return goog.Promise.reject(e);
  });
  return getData;
};


/**
 * TachyFont - A namespace.
 * @param {Object.<string, string>} fontInfo The font info.
 * @param {Object} params Optional parameters.
 * @constructor
 */
tachyfont.TachyFont = function(fontInfo, params) {
  params = params || {};

  /**
   * The object that handles the binary manipulation of the font data.
   *
   * TODO(bstell): integrate the manager into this object.
   *
   * @type {tachyfont.IncrementalFont.obj_}
   */
  this.incrfont = tachyfont.IncrementalFont.createManager(fontInfo, params);
};

/**
 * Lazily load the data for these chars.;
 */
tachyfont.TachyFont.prototype.loadNeededChars = function() {
  this.incrfont.loadChars();
};


/**
 * Add the '@font-face' rule.
 *
 * Simply setting the \@font-face causes a Flash Of Invisible Text (FOIT). The
 * FOIT is the time it takes to:
 *   1. Pass the blobUrl data from Javascript memory to browser (C++) memory.
 *   2. Check the font with the OpenType Sanitizer (OTS).
 *   3. Rasterize the outlines into pixels.
 *
 * To avoid the FOIT this function first passes the blobUrl data to a temporary
 * \@font-face rule that is not being used to display text. Once the temporary
 * \@font-face is ready (ie: the data has been transferred, and OTS has run) any
 * existing \@font-face is deleted and the temporary \@font-face switched to be
 * the desired \@font-face.
 *
 * @param {Object.<string, string>} fontInfo Info about this font.
 * @param {string} format The \@font-face format.
 * @param {string} blobUrl The blobUrl to the font data.
 * @return {goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj_.prototype.setFontNoFlash =
  function(fontInfo, format, blobUrl) {
  // The desired @font-face font-family.
  var fontFamily = fontInfo['familyName'];
  // The temporary @font-face font-family.
  var tmpFontFamily = 'tmp-' + fontFamily;
  var fontName = fontInfo['name']; // The font name.
  var weight = fontInfo['weight'];
  var sheet = tachyfont.IncrementalFontUtils.getStyleSheet();

  // Create a temporary @font-face rule to transfer the blobUrl data from
  // Javascript to the browser side.
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
        'setFont: ' + tmpFontFamily + '/' + weight);
  }
  tachyfont.IncrementalFontUtils.setCssFontRule(sheet, tmpFontFamily, weight,
    blobUrl, format);

  var setFontPromise = new goog.Promise(function(resolve, reject) {
    // Transfer the data.
    // TODO(bstell): Make this cross platform.
    var fontStr = weight + ' 20px ' + tmpFontFamily;
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'setFont: fontStr = ' + fontStr);
    }
    document.fonts.load(fontStr).
    then(function(value) {
      if (goog.DEBUG) {
        goog.log.fine(tachyfont.logger_, 'loaded ' + tmpFontFamily + '/' +
            weight);
      }
      resolve();
    });
  }).
  then(function() {
    // Now that the font is ready switch the @font-face to the desired name.
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger_, goog.log.Level.FINER,
          'switch to fontFamily');
    }
    // Delete the old @font-face.
    var ruleToDelete = tachyfont.IncrementalFontUtils.findFontFaceRule(sheet,
      fontFamily, weight);
    tachyfont.IncrementalFontUtils.deleteCssRule(ruleToDelete, sheet);
    // Switch the name to use the newly transfered blobUrl data.
    var rule_to_switch = tachyfont.IncrementalFontUtils.findFontFaceRule(sheet,
      tmpFontFamily, weight);
    var rules = sheet.cssRules || sheet.rules;
    if (rules && rule_to_switch != -1) {
      var this_rule = rules[rule_to_switch];
      var this_style = this_rule.style;
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger_, '**** switched ' + weight + 'from ' +
            this_style.fontFamily + ' to ' + fontFamily + ' ****');
      }
      this_style.fontFamily = fontFamily;
    }
  });

  return setFontPromise;
};


/**
 * @param {string} version
 * @param {string} signature
 * @param {number} count
 * @param {number} flags
 * @param {number} offsetToGlyphData
 * @param {ArrayBuffer} glyphData
 * @constructor
 */
tachyfont.GlyphBundleResponse = function(
    version, signature, count, flags, offsetToGlyphData, glyphData) {
  this.version = version;
  this.signature = signature;
  this.count = count;
  this.flags = flags;
  this.offsetToGlyphData = offsetToGlyphData;
  this.glyphData = glyphData;
};

/**
 * @return {number} the length of the glyph data in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getDataLength = function() {
  return this.glyphData.byteLength - this.offsetToGlyphData;
};

/**
 * @return {tachyfont.BinaryFontEditor} a font editor for the glyph data in this
 *         response.
 */
tachyfont.GlyphBundleResponse.prototype.getFontEditor = function() {
  return new tachyfont.BinaryFontEditor(new DataView(this.glyphData),
                                        this.offsetToGlyphData);
};

/**
 * @return {number} Number of glyphs in this response.
 */
tachyfont.GlyphBundleResponse.prototype.getGlyphCount = function() {
  return this.count;
};

/**
 * @return {number} flags binary for this response.
 */
tachyfont.GlyphBundleResponse.prototype.getFlags = function() {
  return this.flags;
};


/**
 * Timing object for performance analysis.
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
