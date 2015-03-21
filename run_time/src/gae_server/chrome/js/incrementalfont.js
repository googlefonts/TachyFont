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

goog.provide('tachyfont.IncrementalFont');
goog.provide('tachyfont.TachyFont');

goog.require('goog.Promise');
goog.require('goog.log');

goog.require('tachyfont.BackendService');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.promise');
goog.require('tachyfont.RLEDecoder');


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
  //TODO(bstell): need to fix the request size.
  this.req_size = params['req_size'] || 2200;

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
        goog.log.info(tachyfont.logger_, '**** switched ' + weight + ' from ' +
            this_style.fontFamily + ' to ' + fontFamily + ' ****');
      }
      this_style.fontFamily = fontFamily;
    }
  });

  return setFontPromise;
};
