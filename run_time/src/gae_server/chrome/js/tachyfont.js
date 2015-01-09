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

/**
 * @typedef {number}
 */
tachyfont.uint8;

/**
 * @typedef {Object}
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

console.log('add a parameter to:  enable "drop IDB" button');

/**
 * The IndexedDB version.
 * Increment this number every time there is a change in the schema.
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
 * Create a list of TachyFonts
 * 
 * @param {Array.<string>} fontList The list of fonts.
 * @param {Object} params Optional parameters.
 * return {Array.<Object>} The list of font objects.
 */
tachyfont.loadFonts = function(fontList, params) {
  params = params || {};
  var fonts = [];
  for (var i = 0; i < fontList.length; i++) {
    var font = new tachyfont.TachyFont(fontList[i], params);
    fonts.push(font);
  }
  return fonts;
};


/**
 * Convert a string to an array of characters.
 * This function handles surrogate pairs.
 * 
 * @param {string} str The input string.
 * @returns {Array.<string>} The array of characters.
 */
tachyfont.stringToChars = function(str) {
  var char_array = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    var cc = c.charCodeAt(0);
    if (cc >= 0xD800 && cc <= 0xDBFF) {
      i += 1;
      c += str.charAt(i);
    }
    char_array.push(c);
  }
  return char_array;
};


/**
 * Convert a char to its codepoint.
 * This function handles surrogate pairs.
 * 
 * @param {string} in_char The input char (string).
 * @returns {number} The numeric value.
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
 * @param {string} fontname The name of the font.
 * @param {Object} params Optional parameters.
 * @return {tachyfont.IncrementalFont.obj_} The incremental font manager object.
 */
tachyfont.IncrementalFont.createManager = function(fontname, params) {

  var initialVisibility = false;
  var initialVisibilityStr = 'hidden';
  if (params['visibility'] == 'visible') {
    initialVisibility = true;
    initialVisibilityStr = 'visible';
  }
  var maxVisibilityTimeout = tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS;
  if (params['maxVisibilityTimeout']) {
    try {
      maxVisibilityTimeout = parseInt(params['maxVisibilityTimeout'])
    } catch(err) {
    }
  }

  // Create a style for this font.
  var style = document.createElement('style');
  document.head.appendChild(style);
  var rule = '.' + fontname + ' { font-family: ' + fontname + '; ' +
    'visibility: ' + initialVisibilityStr + '; }';
  style.sheet.insertRule(rule, 0);

  //tachyfont.timer1.start('load base');
  tachyfont.timer1.start('load Tachyfont base+data for ' + fontname);
  //console.log('check to see if a webfont is in cache');
  var incrFontMgr = new tachyfont.IncrementalFont.obj_(fontname, params);
  //tachyfont.timer1.start('openIndexedDB.open ' + fontname);
//  tachyfont.IncrementalFontUtils.logger(incrFontMgr.url,
//    'need to report info');
  /*
  console.log('It would be good to report status of:\n' +
      '* idb\n' +
      '* chars needed\n' +
      '* webfont in cache\n' +
      '* timing\n' +
      '* way to collect the info\n' +
      '* way to clear old info\n' +
      '* errors');
  */
  incrFontMgr.getIDB_ = incrFontMgr.openIndexedDB(fontname);
  //tachyfont.timer1.end('openIndexedDB.open ' + fontname);

  // Create a class with initial visibility.
  incrFontMgr.style = tachyfont.IncrementalFontUtils.setVisibility(null,
    fontname, initialVisibility);
  // Limit the maximum visibility=hidden time.
  setTimeout(function() {
    tachyfont.IncrementalFontUtils.setVisibility(incrFontMgr.style, fontname,
      true);
  }, maxVisibilityTimeout);
  // When the page finishes loading: automatically load needed chars.
  if (document.readyState == 'loading') {
    document.addEventListener('DOMContentLoaded', function(event) {
      incrFontMgr.loadNeededChars('body');
    });
  } else {
    incrFontMgr.loadNeededChars('body');
  }

  incrFontMgr.getBase = incrFontMgr.getIDB_.
  then(function(idb) {
    var filedata = incrFontMgr.getData_(idb, tachyfont.IncrementalFont.BASE);
    return goog.Promise.all([goog.Promise.resolve(idb), filedata]);
  }).
  then(function(arr) {
    var idb = arr[0];
    var filedata = new DataView(arr[1]);
    var fileinfo = tachyfont.IncrementalFontUtils.parseBaseHeader(filedata);
    var fontdata = new DataView(arr[1], fileinfo.headSize);
    return goog.Promise.all([goog.Promise.resolve(fileinfo), goog.Promise.resolve(fontdata)]);
  }).
  thenCatch(function(e) {
    var bandwidth = tachyfont.ForDebug.getCookie('bandwidth', '0');
    return tachyfont.IncrementalFontUtils.requestURL(incrFontMgr.url +
      '/incremental_fonts/incrfonts/' + incrFontMgr.fontname + '/base', 'GET',
      null, { 'X-TachyFont-bandwidth': bandwidth }, 'arraybuffer').
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
      incrFontMgr.persistDelayed_(tachyfont.IncrementalFont.BASE);
      //tachyfont.timer1.end('uncompact base');
      return [fileinfo, basefont];
    });
  }).
  then(function(arr) {
    //tachyfont.timer1.end('load base');
    var fileinfo = arr[0];
    // Create the @font-face rule.
    //tachyfont.IncrementalFontUtils.setFont(fontname, arr[2], fileinfo.isTTF,
    //  '');
    //tachyfont.timer1.done();
    // Make the class visible.
    //tachyfont.IncrementalFontUtils.setVisibility(incrFontMgr.style, fontname,
    //  true);

    return arr;
  }).
  thenCatch(function(e) {
    console.log('failed to get the font.');
    tachyfont.IncrementalFontUtils.setVisibility(incrFontMgr.style, fontname,
      true);
  });

  // Start the operation to get the list of already fetched chars.
  //console.log('Get the list of already fetched chars.');
  incrFontMgr.getCharList = incrFontMgr.getIDB_.
  then(function(idb) {
    return incrFontMgr.getData_(idb, tachyfont.IncrementalFont.CHARLIST);
  }).
  thenCatch(function(e) {
    return {};
  }).
  then(function(charlist_data) {
    return charlist_data;
  }).thenCatch(function() {
    debugger;
  });

  // For Debug: add a button to clear the IndexedDB.
  tachyfont.ForDebug.addDropIdbButton(incrFontMgr, fontname);

  // For Debug: add a control to set the bandwidth.
  tachyfont.ForDebug.addBandwidthControl();

  // For Debug: add a control to set the timing text size.
  tachyfont.ForDebug.addTimingTextSizeControl();

  return incrFontMgr;
};


/**
 * IncrFontIDB.obj_ - A class to handle interacting the IndexedDB.
 * @param {string} fontname The name of the font.
 * @param {Object} params Optional parameters.
 * @constructor
 * @private
 */
tachyfont.IncrementalFont.obj_ = function(fontname, params) {
  this.fontname = fontname;
  this.req_size = params['req_size'];
  this.url = params['url'];
  this.charsURL = '/incremental_fonts/request';
  this.persistData = true;
  this.persistInfo = {};
  this.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = false;
  this.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = false;
  this.style = null;

  if (params['persistData'] == false) {
    this.persistData = false;
  }

  if (!this.url) {
    this.url = window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
  }

  // Promises
  this.getIDB_ = null;
  this.getBase = null;
  this.getCharList = null;
  this.finishPersistingData = goog.Promise.resolve();
  this.finishPendingCharsRequest = goog.Promise.resolve();
};

/**
 * Lazily load the data for these chars.
 * @param {string} element_name The name of the data item.
 * @return {Object}
 */
tachyfont.IncrementalFont.obj_.prototype.loadNeededChars =
  function(element_name) {
  var that = this;
  var chars = '';
  var charlist;
  var remaining = [];
  var element;
  element = document.getElementById(element_name);
  if (!element) {
    element = document.body;
  }
  chars = element.textContent;
  this.finishPendingCharsRequest = this.finishPendingCharsRequest.
  then(function() {
    var pending_resolve, pending_reject;
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
          var neededCodes = [];
          var char_array = tachyfont.stringToChars(chars);
          for (var i = 0; i < char_array.length; i++) {
            var c = char_array[i];
            if (!tmp_charlist[c]) {
              neededCodes.push(tachyfont.charToCode(c));
              tmp_charlist[c] = 1;
            }
          }

          if (neededCodes.length) {
            console.log('load ' + neededCodes.length + ' codes:');
            console.log(neededCodes);
          } else {
            //console.log('do not need anymore characters');
            return null;
          }
          // neededCodes.sort(function(a, b){ return a - b}; );
          //console.log('neededCodes = ' + neededCodes);
          //console.log('neededCodes.length = ' + neededCodes.length);
          if (that.req_size) {
            remaining = neededCodes.slice(that.req_size);
            neededCodes = neededCodes.slice(0, that.req_size);
            //console.log('neededCodes.length = ' + neededCodes.length);
            //console.log('remaining.length = ' + remaining.length);
          }
          for (var i = 0; i < neededCodes.length; i++) {
            var c = String.fromCharCode(neededCodes[i]);
            charlist[c] = 1;
          }
          return tachyfont.IncrementalFontUtils.requestCodepoints(that.url,
            that.fontname, neededCodes).
          then(function(chardata) {
            if (remaining.length) {
              setTimeout(function() {
                that.loadNeededChars(element_name);
              }, 1);
            }
            //console.log('requested char data length = ' +chardata.byteLength);
            return chardata;
          });
        }).
        then(function(chardata) {
          return that.getBase.
          then(function(arr) {
            pending_resolve();
            var fileinfo = arr[0];
            var fontdata = arr[1];
            if (chardata != null) {
              fontdata =
                tachyfont.IncrementalFontUtils.injectCharacters(fileinfo,
                  fontdata, chardata);
              var msg;
              if (remaining.length) {
                msg = 'display ' + Object.keys(charlist).length + ' chars';
              } else {
                msg = '';
                tachyfont.timer1.end('load Tachyfont base+data for ' + that.fontname);
                tachyfont.timer1.done();
              }
              tachyfont.IncrementalFontUtils.setFont(that.fontname, fontdata,
                fileinfo.isTTF, msg);
              tachyfont.IncrementalFontUtils.setVisibility(that.style,
                that.fontname,
                true);
              // Update the data.
              that.getBase = goog.Promise.all([goog.Promise.resolve(fileinfo), goog.Promise.resolve(fontdata)]);
              that.getCharlist = goog.Promise.resolve(charlist);
              that.persistDelayed_(tachyfont.IncrementalFont.BASE);
              that.persistDelayed_(tachyfont.IncrementalFont.CHARLIST);
            } else {
              var msg = '';
              tachyfont.timer1.end('load Tachyfont base+data for ' + that.fontname);
              tachyfont.IncrementalFontUtils.setFont(that.fontname, fontdata,
                fileinfo.isTTF, msg);
              tachyfont.IncrementalFontUtils.setVisibility(that.style,
                that.fontname,
                true);
              tachyfont.timer1.done();
            }
          }).
          thenCatch(function(e) {
            console.log('failed to getBase: ' + e.message);
            pending_reject(null);
          });
        });
      }).
      thenCatch(function(e) {
        console.log('loadNeededChars: ' + e.message);
        debugger;
        pending_reject(null);
      });
  }).thenCatch(function() {
    debugger;
  });
  return this.finishPendingCharsRequest;
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
  //console.log('persistDelayed ' + name);

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
  // Wait for any pending persist operation to finish.
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
          return goog.Promise.all([that.getIDB_, goog.Promise.resolve(arr[0]), goog.Promise.resolve(arr[1])]);
        }).
        then(function(arr) {
          console.log('save base');
          return that.saveData_(arr[0],
            tachyfont.IncrementalFont.BASE, arr[2].buffer);
        });
      }
    }).
    then(function() {
      if (charlist_dirty) {
        return that.getCharList.
        then(function(charlist) {
          return goog.Promise.all([that.getIDB_, goog.Promise.resolve(charlist)]);
        }).
        then(function(arr) {
          console.log('save charlist');
          return that.saveData_(arr[0], tachyfont.IncrementalFont.CHARLIST,
            arr[1]);
        });
      }
    }).
    thenCatch(function(e) {
      console.log('persistDelayed_: ' + e.message);
      debugger;
    }).
    then(function() {
      //console.log('persisted ' + name);
    });
  }).thenCatch(function() {
    debugger;
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
        debugger;
        reject(null);
      };
    }).
    thenCatch(function(e) {
      console.log('saveData ' + name + ': ' + e.message);
      debugger;
    });
  }).thenCatch(function() {
    debugger;
  });
};

/**
 * Get the fontDB.
 * @param {string} fontname The name of the font.
 * @return {goog.Promise} The font DB.
 */
tachyfont.IncrementalFont.obj_.prototype.openIndexedDB = function(fontname) {
  var that = this;

  var openIDB = new goog.Promise(function(resolve, reject) {
    var db_name = tachyfont.IncrementalFont.DB_NAME + '/' + fontname;
    //tachyfont.timer1.start('indexedDB.open ' + db_name);
    var dbOpen = window.indexedDB.open(db_name, tachyfont.IncrementalFont.version);
    //tachyfont.timer1.end('indexedDB.open ' + db_name);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      resolve(db);
    };
    dbOpen.onerror = function(e) {
      console.log('!!! IncrFontIDB.obj_ "' + db_name + '": ' + e.value);
      debugger;
      reject(e);
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        console.log('onupgradeneeded error: ' + e.value);
        debugger;
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
      console.log('e = ' + e);
      debugger;
      reject(e);
    };
  }).
  thenCatch(function(e) {
    return goog.Promise.reject(e);
  });
  return getData;
};



/**
 * Binary Font Editor - A namespace.
 * Binary operation over font file or glyph bundle.
 * Always big endian byte order.
 * @param {DataView} dataView DataView which includes data
 * @param {number} baseOffset Set this offset as 0 offset for operations
 * @constructor
 */
tachyfont.BinaryFontEditor = function(dataView, baseOffset) {
    this.dataView = dataView;
    this.baseOffset = baseOffset;
    this.offset = 0;
};

/**
 * @return {tachyfont.uint8} Unsigned byte
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getUint8_ = function() {
    var data = this.dataView.getUint8(this.baseOffset + this.offset);
    this.offset++;
    return data;
};

/**
 * @param {number} data Unsigned byte
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setUint8_ = function(data) {
    this.dataView.setUint8(this.baseOffset + this.offset, data);
    this.offset++;
};

/**
 * @return {number} Unsigned short
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getUint16_ = function() {
    var data = this.dataView.getUint16(this.baseOffset + this.offset);
    this.offset += 2;
    return data;
};

/**
 * @param {number} data Unsigned short
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setUint16_ = function(data) {
    this.dataView.setUint16(this.baseOffset + this.offset, data);
    this.offset += 2;
};

/**
 * @param {number} data Signed short
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setInt16_ = function(data) {
    this.dataView.setInt16(this.baseOffset + this.offset, data);
    this.offset += 2;
};

/**
 * @return {number} Unsigned integer
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getUint32_ = function() {
    var data = this.dataView.getUint32(this.baseOffset + this.offset);
    this.offset += 4;
    return data;
};

/**
 * @param {number} data Unsigned integer
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setUint32_ = function(data) {
    this.dataView.setUint32(this.baseOffset + this.offset, data);
    this.offset += 4;
};

/**
 * @return {number} Signed integer
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getInt32_ = function() {
    var data = this.dataView.getInt32(this.baseOffset + this.offset);
    this.offset += 4;
    return data;
};

/**
 * @param {function()} getter One of getUint or getInt functions
 * @param {number} count Size of array
 * @return {Array.<number>}
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getArrayOf_ = function(getter, count) {
    var arr = [];
    for (var i = 0; i < count; i++) {
        arr.push(getter.call(this));
    }
    return arr;
};

/**
 * @param {function(number)} setter One of setUint or setInt functions
 * @param {Array.<number>} arr
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setArrayOf_ = function(setter, arr) {
    var count = arr.length;
    for (var i = 0; i < count; i++) {
        setter.call(this, arr[i]);
    }
};

/**
 * @param {number} offSize Number of bytes in offset
 * @return {number} Offset
 * @private
 */
tachyfont.BinaryFontEditor.prototype.getOffset_ = function(offSize) {
  var offset;
  switch (offSize) {
      case 1:
          offset = this.getUint8_();
          break;
      case 2:
          offset = this.getUint16_();
          break;
      case 3:
          offset = this.getUint32_() >>> 8;
          this.offset--;
          break;
      case 4:
          offset = this.getUint32_();
          break;
      default:
          throw "invalid offset size: " + offSize;
  }
  return offset;
};

/**
 * @param {number} offSize Number of bytes in offset
 * @param {number} value Offset value
 * @private
 */
tachyfont.BinaryFontEditor.prototype.setOffset_ = function(offSize, value) {
  switch (offSize) {
      case 1:
          this.setUint8_(value);
          break;
      case 2:
          this.setUint16_(value);
          break;
      case 3:
          this.setUint16_(value >>> 8);
          this.setUint8_(value & 0xFF);
          break;
      case 4:
          this.setUint32_(value);
          break;
  }
};

/**
 * @param {number} length Length of the string
 * @return {string}
 * @private
 */
tachyfont.BinaryFontEditor.prototype.readString_ = function(length) {
    var str = '';
    for (var i = 0; i < length; i++) {
        str += String.fromCharCode(this.getUint8_());
    }
    return str;
};

/**
 * @param {number} newOffset
 */
tachyfont.BinaryFontEditor.prototype.seek = function(newOffset) {
    this.offset = newOffset;
};

/**
 * @param {number} len
 */
tachyfont.BinaryFontEditor.prototype.skip = function(len) {
    if (len < 0)
        throw 'Only nonnegative numbers are accepted';
    this.offset += len;
};

/**
 * @return {number} current offset
 */
tachyfont.BinaryFontEditor.prototype.tell = function() {
    return this.offset;
};

/**
 * Creates nibble stream reader starting from current position
 * @return {function()} NibbleOfNumber decoder function
 */
tachyfont.BinaryFontEditor.prototype.nibbleReader = function() {
    var that = this, value, nibbleByte, aligned = true;
    return function() {
        if (aligned) {
           nibbleByte = that.getUint8_();
           value = (nibbleByte & 0xF0) >>> 4;
       } else {
           value = (nibbleByte & 0x0F);
       }
       aligned = !aligned;
       return value;
    };
};

/**
 * Starting from current positions read whole extra array table
 * @param {number} extraLen
 * @return {Array.<number>} array of extra numbers
 */
tachyfont.BinaryFontEditor.prototype.readExtraArray = function(extraLen) {
    var readNextNibble = this.nibbleReader(), extraArray = [],
        extraData, sign, numNibbles;
    for (var i = 0; i < extraLen; i++) {
        extraData = 0;
        numNibbles = readNextNibble();
        if (numNibbles < 8) {
            sign = 1;
            numNibbles++;
        } else {
            sign = -1;
            numNibbles -= 7;
        }
        for (var j = 0; j < numNibbles; j++) {
            extraData <<= 4;
            extraData |= readNextNibble();
        }
        extraData *= sign;
        extraArray.push(extraData);
    }
    return extraArray;
};

/**
 * Read following group of segments
 * @return {Object} Group of Segments returned
 */
tachyfont.BinaryFontEditor.prototype.readNextGOS = function() {
    var gos = {};
    var type = this.getUint8_();
    var nGroups = this.getUint16_();
    var segments = [];

    if (type == 5) {
        var startCode, length, gid;
        for (var i = 0; i < nGroups; i++) {
            startCode = this.getUint32_();
            length = this.getUint32_();
            gid = this.getUint32_();
            segments.push([startCode, length, gid]);
        }
    } else if (type == 4) {
        var extraOffset = [];
        var i = 0, nextByte, value;
        while (i < nGroups) {
            nextByte = this.getUint8_();
            for (var j = 0; j < 4; j++) {
                if (i < nGroups) {
                    value = nextByte & (0xC0 >>> (2 * j));
                    value >>>= (6 - 2 * j);
                    segments.push(value);
                    if (value == 3) {
                        extraOffset.push(i);
                    }
                    i++;
                } else {
                    break;
                }
            }
        }
        var extraLen = extraOffset.length,
            extraArray = this.readExtraArray(extraLen);
        for (i = 0; i < extraLen; i++) {
            segments[extraOffset[i]] = extraArray[i];
        }
    } else if (type == 3) {
        var extraOffset = [];
        var startCode, length, gid, segment;
        for (var i = 0; i < nGroups; i++) {
            segment = this.getOffset_(3); //lower 24 bits
            startCode = (segment & 0xF80000) >> 19;
            length = (segment & 0x70000) >> 16;
            gid = segment & 0xFFFF;
            segments.push([startCode, length, gid]);
            if (startCode == 0x1F) {
                extraOffset.push([i, 0]);
            }
            if (length == 0x7) {
                extraOffset.push([i, 1]);
            }
        }
        var extraLen = extraOffset.length,
                extraArray = this.readExtraArray(extraLen);
        for (var i = 0; i < extraLen; i++) {
            segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
        }
        for (var i = 1; i < nGroups; i++) {
            segments[i][0] += segments[i - 1][0];
        }
    } else if (type == 2) {
        var extraOffset = [];
        var deltaStartCode, length, deltaGid, segment;
        for (var i = 0; i < nGroups; i++) {
            segment = this.getUint8_();
            deltaStartCode = (segment & 0xE0) >> 5;
            length = (segment & 0x18) >> 3;
            deltaGid = segment & 0x07;
            segments.push([deltaStartCode, length, deltaGid]);
            if (deltaStartCode == 0x07) {
                extraOffset.push([i, 0]);
            }
            if (length == 0x03) {
                extraOffset.push([i, 1]);
            }
            if (deltaGid == 0x07) {
                extraOffset.push([i, 2]);
            }
        }
        var extraLen = extraOffset.length,
                extraArray = this.readExtraArray(extraLen);
        for (var i = 0; i < extraLen; i++) {
            segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
        }
        for (var i = 1; i < nGroups; i++) {
            segments[i][0] += segments[i - 1][0];
            segments[i][2] += segments[i - 1][2];
        }
    } else if (type == 6 || type == 7) {
        var extraOffset = [];
        var deltaFirst, deltaNleft, segment;
        for (var i = 0; i < nGroups; i++) {
            segment = this.getUint8_();
            deltaFirst = (segment & 0xF8) >> 3;
            deltaNleft = (segment & 0x07);
            segments.push([deltaFirst, deltaNleft]);
            if (deltaFirst == 0x1F) {
                extraOffset.push([i, 0]);
            }
            if (deltaNleft == 0x7) {
                extraOffset.push([i, 1]);
            }
        }
        var extraLen = extraOffset.length,
                extraArray = this.readExtraArray(extraLen);
        for (var i = 0; i < extraLen; i++) {
            segments[extraOffset[i][0]][extraOffset[i][1]] = extraArray[i];
        }
        for (var i = 1; i < nGroups; i++) {
            segments[i][0] += segments[i - 1][0];
            segments[i][1] += segments[i - 1][1];
        }
    }
    gos.segments = segments;
    gos.type = type;
    gos.len = nGroups;
    return gos;
};

/**
 * Magic used in header of the base font.
 * BS:Brian Stell AC:Ahmet Celik :)
 * @type string
 */
tachyfont.BinaryFontEditor.magicHead = 'BSAC';

/**
 * Version of the supported base font
 * @type number
 */
tachyfont.BinaryFontEditor.BASE_VERSION = 1;

/**
 * Reading operations for the header
 * @type {Object}
 */
tachyfont.BinaryFontEditor.readOps = {};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.GLOF = function(editor, font) {
    font.glyphOffset = editor.getUint32_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.GLCN = function(editor, font) {
    font.numGlyphs = editor.getUint16_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.LCOF = function(editor, font) {
    font.glyphDataOffset = editor.getUint32_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.LCFM = function(editor, font) {
    font.offsetSize = editor.getUint8_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.HMOF = function(editor, font) {
    font.hmtxOffset = editor.getUint32_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.VMOF = function(editor, font) {
    font.vmtxOffset = editor.getUint32_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.HMMC = function(editor, font) {
    font.hmetricCount = editor.getUint16_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.VMMC = function(editor, font) {
    font.vmetricCount = editor.getUint16_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.TYPE = function(editor, font) {
    font.isTTF = editor.getUint8_();
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.CM12 = function(editor, font) {
    var cmap12 = {};
    cmap12.offset = editor.getUint32_();
    cmap12.nGroups = editor.getUint32_();
    font.cmap12 = cmap12;
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.CM04 = function(editor, font) {
    var cmap4 = {};
    cmap4.offset = editor.getUint32_();
    cmap4.length = editor.getUint32_();
    font.cmap4 = cmap4;
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.CCMP = function(editor, font) {
    var compact_gos = {};
    var GOSCount = editor.getUint8_();
    var GOSArray = [];
    for (var i = 0; i < GOSCount; i++) {
        GOSArray.push(editor.readNextGOS());
    }
    //If there is both cmap format 4 and format 12 arrays
    //Now generating cmap format 4 arrays
    if (font.cmap4 && font.cmap12 &&
            GOSArray.length == 2 && GOSArray[1].type == 4) {
        var gos_type_4_lens = GOSArray[1];
        var gos_type_12 = GOSArray[0];
        var format_4_arrays = [];
        var glyphIdArray = [];
        var glyphIdIdx = 0;
        var fmt12SegNum = 0, fmt12SegNumBegin, fmt12SegNumEnd;
        var fmt4SegCount = gos_type_4_lens.len;
        var startCode, endCode, idDelta, idRangeOffset, startGid, codeRange;
        for (var i = 0; i < fmt4SegCount; i++) { // fix this
            if (gos_type_4_lens.segments[i] == 0) {
              // The only time there is a format 4 segment with no format 12
              // segment is the format 4 end segment 0xFFFF.
              if (i != fmt4SegCount - 1)
                throw 'invalid segment';
              format_4_arrays.push([0xFFFF, 0xFFFF, 1, 0]); // last segment special
              continue;
            }
            fmt12SegNumBegin = fmt12SegNum;
            fmt12SegNumEnd = fmt12SegNum + gos_type_4_lens.segments[i] - 1;
            startGid = gos_type_12.segments[fmt12SegNumBegin][2];
            startCode = gos_type_12.segments[fmt12SegNumBegin][0];
            endCode = gos_type_12.segments[fmt12SegNumEnd][0] +
                    gos_type_12.segments[fmt12SegNumEnd][1] - 1;
            fmt12SegNum = fmt12SegNumEnd + 1;
            if (gos_type_4_lens.segments[i] == 1) {
                idRangeOffset = 0;
                idDelta = (startGid - startCode + 0x10000) & 0xFFFF;
            } else {
                idDelta = 0;
                idRangeOffset = 2 * (glyphIdIdx - i + fmt4SegCount);
                codeRange = endCode - startCode + 1;
                glyphIdIdx += codeRange;
                var currentSeg = fmt12SegNumBegin,
                    currentSegArr = gos_type_12.segments[currentSeg],
                    gid;
                for (var codePoint = startCode; codePoint <= endCode; ) {
                    if (codePoint >= currentSegArr[0] &&
                      codePoint <= (currentSegArr[0] + currentSegArr[1] - 1)) {
                       gid = currentSegArr[2] + codePoint - currentSegArr[0];
                       glyphIdArray.push(gid);
                       codePoint++;
                    }else if (codePoint >
                            (currentSegArr[0] + currentSegArr[1] - 1)) {
                        currentSeg++;
                        if (currentSeg <= fmt12SegNumEnd)
                            currentSegArr = gos_type_12.segments[currentSeg];
                    }else if (codePoint < currentSegArr[0]) {
                        glyphIdArray.push(0); //missing codepoint
                        codePoint++;
                    }
                }
                if (glyphIdIdx != glyphIdArray.length)
                    throw 'glyphIdArray update failure';
            }
            format_4_arrays.push([startCode, endCode, idDelta, idRangeOffset]);
        }
        compact_gos.cmap4 = {};
        compact_gos.cmap4.segments = format_4_arrays;
        compact_gos.cmap4.glyphIdArray = glyphIdArray;
    }
    compact_gos.cmap12 = GOSArray[0];
    font.compact_gos = compact_gos;
};

/**
 * @param {tachyfont.BinaryFontEditor} editor Editor used to parse header
 * @param {tachyfont.IncrementalFontLoader} font Font loader object
 */
tachyfont.BinaryFontEditor.readOps.CS02 = function(editor, font) {
    var charset = {};
    charset.offset = editor.getUint32_();
    charset.gos = editor.readNextGOS();
    font.charset_fmt = charset;
};

/**
 * Tags defined in the header of the basefont
 * @enum {Object}
 */
tachyfont.BinaryFontEditor.TAGS = {
    'GLOF':
            {'desc': 'Start of the glyphs data relative to font file start',
                'fn': tachyfont.BinaryFontEditor.readOps.GLOF
            },
    'GLCN':
            {'desc': 'Number of glyphs in the font',
                'fn': tachyfont.BinaryFontEditor.readOps.GLCN
            },
    'LCOF':
            {'desc': 'Start of glyph data location offsets',
                'fn': tachyfont.BinaryFontEditor.readOps.LCOF
            },
    'LCFM':
            {'desc': 'Offset size of the offsets in loca table',
                'fn': tachyfont.BinaryFontEditor.readOps.LCFM
            },
    'HMOF':
            {'desc': 'Start of the HMTX table relative to font file start',
                'fn': tachyfont.BinaryFontEditor.readOps.HMOF
            },
    'VMOF':
            {'desc': 'Start of the VMTX table relative to font file start',
                'fn': tachyfont.BinaryFontEditor.readOps.VMOF
            },
    'HMMC':
            {'desc': 'Number of hmetrics in hmtx table',
                'fn': tachyfont.BinaryFontEditor.readOps.HMMC
            },
    'VMMC':
            {'desc': 'Number of vmetrics in vmtx table',
                'fn': tachyfont.BinaryFontEditor.readOps.VMMC
            },
    'TYPE':
            {'desc': 'Type of the font. 1 for TTF and 0 for CFF',
                'fn': tachyfont.BinaryFontEditor.readOps.TYPE
            },
    'CM12':
            {'desc': 'Start offset and number of groups in cmap fmt 12 table',
                'fn': tachyfont.BinaryFontEditor.readOps.CM12
            },
    'CM04':
            {'desc': 'Start offset of cmap fmt 4 table',
                'fn': tachyfont.BinaryFontEditor.readOps.CM04
            },
    'CCMP':
            {'desc': 'Compact cmap, groups of segments',
                'fn': tachyfont.BinaryFontEditor.readOps.CCMP
            },
    'CS02':
            {'desc': 'CFF Charset format 2 in compacted format',
                'fn': tachyfont.BinaryFontEditor.readOps.CS02
            }
};

/**
 * Parse the header of the base font.
 * Set information as attributes in given loader object
 * @return {Object} Results of parsing the header.
 */
tachyfont.BinaryFontEditor.prototype.parseBaseHeader = function() {
    var magic = this.readString_(4);
    if (magic != tachyfont.BinaryFontEditor.magicHead) {
      throw 'magic number mismatch: expected ' +
        tachyfont.BinaryFontEditor.magicHead + ' but got ' + magic;
    }
    var results = {};
    results.headSize = this.getInt32_();
    results.version = this.getInt32_();
    if (results.version != tachyfont.BinaryFontEditor.BASE_VERSION) {
        throw 'Incompatible Base Font Version detected!';
    }
    var count = this.getUint16_();
    var tags = [], tag, tagOffset, saveOffset,
            dataStart = count * 8 + 4 + 4 + 2 + 4;//magic,ver,count,headSize
    for (var i = 0; i < count; i++) {
        tag = this.readString_(4);
        tagOffset = this.getUint32_();
        if (!tachyfont.BinaryFontEditor.TAGS.hasOwnProperty(tag)) {//unknown tag
            throw 'Unknown Base Font Header TAG';
        }
        saveOffset = this.tell();
        this.seek(dataStart + tagOffset);
        tachyfont.BinaryFontEditor.TAGS[tag]['fn'](this, results);
        this.seek(saveOffset);
    }
    return results;
};

/**
 * Sets side bearing in MTX tables
 * @param {number} start Beginning of MTX table
 * @param {number} metricCount Count of the metrics
 * @param {number} gid Glyph id
 * @param {number} value Side bearing value
 */
tachyfont.BinaryFontEditor.prototype.setMtxSideBearing =
  function(start, metricCount,
 gid, value) {
    if (gid < metricCount) {
        this.seek(start + gid * 4 + 2);
        this.setInt16_(value);
    }else {
        this.seek(start + 2 * gid + 2 * metricCount);
        this.setInt16_(value);
    }
};

/**
 * Gets the glyph location for the given gid
 * @param {number} start Beginning of the glyph offsets(loca) table
 * @param {number} offSize Number of bytes in the offset
 * @param {number} gid Glyph id
 * @return {number} Offset
 */
tachyfont.BinaryFontEditor.prototype.getGlyphDataOffset =
  function(start, offSize, gid) {
    this.seek(start + gid * offSize);
    return this.getOffset_(offSize);
};

/**
 * Sets the glyph location for the given gid
 * @param {number} start Beginning of the glyph offsets(loca) table
 * @param {number} offSize Number of bytes in the offset
 * @param {number} gid Glyph id
 * @param {number} value New offset
 */
// TODO(bstell) This function should be setLocaOffset
tachyfont.BinaryFontEditor.prototype.setGlyphDataOffset =
  function(start, offSize, gid,
 value) {
    this.seek(start + gid * offSize);
    this.setOffset_(offSize, value);
};


/**
 * TachyFont - A namespace.
 * @param {string} fontname The fontname.
 * @param {Object} params Optional parameters.
 * @constructor
 */
tachyfont.TachyFont = function(fontname, params) {
  params = params || {};

  // TODO(bstell) integrate the manager into this object.
  this.incrfont = tachyfont.IncrementalFont.createManager(fontname, params);
};

/**
 * Lazily load the data for these chars.;
 * @param {string|null} element_name The name of the data item.
 */
tachyfont.TachyFont.prototype.loadNeededChars = function(element_name) {
  this.incrfont.loadNeededChars(element_name);
};

/**
 * Incremental font loader utilities. A separate namespace is not longer needed.
 */
tachyfont.IncrementalFontUtils = {};


/**
 * Enum for flags in the coming glyph bundle
 * @enum {number}
 */
tachyfont.IncrementalFontUtils.FLAGS = {
    HAS_HMTX: 1,
    HAS_VMTX: 2,
    HAS_CFF: 4
};

/**
 * Segment size in the loca table
 * @const {number}
 */
tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE = 64;

/**
 * The Style Sheet ID
 * @const {string}
 */
tachyfont.IncrementalFontUtils.STYLESHEET_ID =
  'Incremental\u00A0Font\u00A0Utils';

/**
 * Inject glyphs in the glyphData to the baseFont
 * @param {Object} obj The object with the font header information.
 * @param {DataView} baseFont Current base font
 * @param {ArrayBuffer} glyphData New glyph data
 * @return {DataView} Updated base font
 */
tachyfont.IncrementalFontUtils.injectCharacters = function(obj, baseFont,
  glyphData) {
  // time_start('inject')
  obj.dirty = true;
  var bundleBinEd = new tachyfont.BinaryFontEditor(new DataView(glyphData), 0);
  var baseBinEd = new tachyfont.BinaryFontEditor(baseFont, 0);

  var count = bundleBinEd.getUint16_();
  var flags = bundleBinEd.getUint8_();

  var isCFF = flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_CFF;
  var offsetDivisor = 1;
  if (!isCFF && obj.offsetSize == 2) {
    // For the loca "short version":
    //   "The actual local offset divided by 2 is stored."
    offsetDivisor = 2;
  }
  for (var i = 0; i < count; i += 1) {
    var id = bundleBinEd.getUint16_();
    var nextId = id + 1;
    var hmtx, vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
        hmtx = bundleBinEd.getUint16_();
        baseBinEd.setMtxSideBearing(obj.hmtxOffset, obj.hmetricCount,
            id, hmtx);
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
        vmtx = bundleBinEd.getUint16_();
        baseBinEd.setMtxSideBearing(obj.vmtxOffset, obj.vmetricCount,
            id, vmtx);
    }
    var offset = bundleBinEd.getUint32_();
    var length = bundleBinEd.getUint16_();

    if (!isCFF) {
      // Set the loca for this glyph.
      baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize,
        id, offset / offsetDivisor);
      var oldNextOne = baseBinEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, nextId);
      var newNextOne = offset + length;
      // Set the length of the current glyph (at the loca of nextId).
      baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize,
        nextId, newNextOne / offsetDivisor);

      // Fix the sparse loca values before this new value.
      var prev_id = id - 1;
      while (prev_id >= 0 && baseBinEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, prev_id) > offset) {
        baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize,
            prev_id, offset / offsetDivisor);
        prev_id--;
      }
      /*
       * Fix up the sparse loca values after this glyph.
       *
       * If value is changed and length is nonzero we should make the next glyph
       * a dummy glyph(ie: write -1 to make it a composite glyph).
       */
      var isChanged = oldNextOne != newNextOne;
      isChanged = isChanged && nextId < obj.numGlyphs;
      if (isChanged) {
        // Fix the loca value after this one.
        baseBinEd.seek(obj.glyphOffset + newNextOne);
        if (length > 0) {
          baseBinEd.setInt16_(-1);
        }else if (length == 0) {
           /*if it is still zero,then could write -1*/
          var currentUint1 = baseBinEd.getUint32_(),
              currentUint2 = baseBinEd.getUint32_();
          if (currentUint1 == 0 && currentUint2 == 0) {
            baseBinEd.seek(obj.glyphOffset + newNextOne);
            baseBinEd.setInt16_(-1);
          }
        }
      }
    } else {
      baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize,
        id, offset);
      var oldNextOne = baseBinEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, nextId);
      baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize, nextId,
        offset + length);
      nextId = id + 2;
      var offsetCount = obj.numGlyphs + 1;
      var currentIdOffset = offset + length, nextIdOffset;
      if (oldNextOne < currentIdOffset && nextId - 1 < offsetCount - 1) {
        baseBinEd.seek(obj.glyphOffset + currentIdOffset);
        baseBinEd.setUint8_(14);
      }
      while (nextId < offsetCount) {
          nextIdOffset = baseBinEd.getGlyphDataOffset(obj.glyphDataOffset,
            obj.offsetSize, nextId);
          if (nextIdOffset <= currentIdOffset) {
            currentIdOffset++;
            baseBinEd.setGlyphDataOffset(obj.glyphDataOffset, obj.offsetSize,
                nextId, currentIdOffset);
            if (nextId < offsetCount - 1) {
                baseBinEd.seek(obj.glyphOffset + currentIdOffset);
                baseBinEd.setUint8_(14);
            }
            nextId++;
          } else {
              break;
          }
      }
    }

    var bytes = bundleBinEd.getArrayOf_(bundleBinEd.getUint8_, length);
    baseBinEd.seek(obj.glyphOffset + offset);
    baseBinEd.setArrayOf_(baseBinEd.setUint8_, bytes);
  }
  // time_end('inject')

  return baseFont;
};

/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCmap12 = function(baseFont, headerInfo) {
    if (!headerInfo.cmap12)
        return;
    var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.cmap12.offset + 16);
    var nGroups = headerInfo.cmap12.nGroups;
    var segments = headerInfo.compact_gos.cmap12.segments;
    for (var i = 0; i < nGroups; i++) {
        binEd.setUint32_(segments[i][0]);
        binEd.setUint32_(segments[i][0] + segments[i][1] - 1);
        binEd.setUint32_(segments[i][2]);
    }
};

/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCmap4 = function(baseFont, headerInfo) {
    if (!headerInfo.cmap4)
        return;
    var segments = headerInfo.compact_gos.cmap4.segments;
    var glyphIdArray = headerInfo.compact_gos.cmap4.glyphIdArray;
    var binEd = new tachyfont.BinaryFontEditor(baseFont,
      headerInfo.cmap4.offset + 6);
    var segCount = binEd.getUint16_() / 2;
    if (segCount != segments.length) {
      alert('segCount=' + segCount + ', segments.length=' + segments.length);
      debugger;
    }
    var glyphIdArrayLen = (headerInfo.cmap4.length - 16 - segCount * 8) / 2;
    headerInfo.cmap4.segCount = segCount;
    headerInfo.cmap4.glyphIdArrayLen = glyphIdArrayLen;
    binEd.skip(6); //skip searchRange,entrySelector,rangeShift
    // Write endCount values.
    for (var i = 0; i < segCount; i++) {
        binEd.setUint16_(segments[i][1]);
    }
    binEd.skip(2);//skip reservePad
    // Write startCount values.
    for (var i = 0; i < segCount; i++) {
        binEd.setUint16_(segments[i][0]);
    }
    // Write idDelta values.
    for (var i = 0; i < segCount; i++) {
        binEd.setUint16_(segments[i][2]);
    }
    // Write idRangeOffset vValues.
    for (var i = 0; i < segCount; i++) {
        binEd.setUint16_(segments[i][3]);
    }
    // Write glyphIdArray values.
    if (glyphIdArrayLen > 0)
        binEd.setArrayOf_(binEd.setUint16_, glyphIdArray);
};

/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @param {Object} headerInfo Header information
 */
tachyfont.IncrementalFontUtils.writeCharsetFormat2 =
  function(baseFont, headerInfo) {
    if (!headerInfo.charset_fmt)
        return;
    var binEd = new tachyfont.BinaryFontEditor(baseFont,
                                        headerInfo.charset_fmt.offset + 1);
    var nGroups = headerInfo.charset_fmt.gos.len;
    var segments = headerInfo.charset_fmt.gos.segments;
    var is_fmt_2 = (headerInfo.charset_fmt.gos.type == 6);
    for (var i = 0; i < nGroups; i++) {
        binEd.setUint16_(segments[i][0]);
        if (is_fmt_2)
            binEd.setUint16_(segments[i][1]);
        else
            binEd.setUint8_(segments[i][1]);
    }
};

/**
 * Parses base font header, set properties.
 * @param {DataView} baseFont Base font with header.
 * @return {Object} The header information.
 */
tachyfont.IncrementalFontUtils.parseBaseHeader = function(baseFont) {

    var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
    var results = binEd.parseBaseHeader();
    if (!results.headSize) {
      throw 'missing header info';
    }
    return results;
};


/**
 * Send a log message to the server
 * @param {String} url The url of the Incremental Font server.
 * @param {string} msg The message to log.
 * @return {goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
tachyfont.IncrementalFontUtils.logger = function(url, msg) {

  return tachyfont.IncrementalFontUtils.requestURL(
    url + '/incremental_fonts/logger',
    'POST',
    msg,
    // Google App Engine servers do not support CORS so we cannot say
    // the 'Content-Type' is 'application/json'.
    //{'Content-Type': 'application/json'},
    {'Content-Type': 'text/plain'},
    'text');
};


/**
 * Request codepoints from server
 * @param {string} url The url of the Incremental Font server.
 * @param {string} fontname The fontname.
 * @param {Array.<number>} codes Codepoints to be requested
 * @return {goog.Promise} Promise to return ArrayBuffer for the response bundle
 */
tachyfont.IncrementalFontUtils.requestCodepoints =
  function(url, fontname, codes) {

  var bandwidth = tachyfont.ForDebug.getCookie('bandwidth', '0');
  return tachyfont.IncrementalFontUtils.requestURL(
    url + '/incremental_fonts/request',
    'POST',
    JSON.stringify({'font': fontname, 'arr': codes}),
    // Google App Engine servers do not support CORS so we cannot say
    // the 'Content-Type' is 'application/json'.
    //{'Content-Type': 'application/json'},
    {'Content-Type': 'text/plain', 'X-TachyFont-bandwidth': bandwidth},
    'arraybuffer');
};


/**
 * Async XMLHttpRequest to given url using given method, data and header
 * @param {string} url Destination url
 * @param {string} method Request method
 * @param {(string|null)} data Request data
 * @param {Object} headerParams Request headers
 * @param {string} responseType Response type
 * @return {goog.Promise} Promise to return response
 */
tachyfont.IncrementalFontUtils.requestURL =
  function(url, method, data, headerParams, responseType) {
  //tachyfont.timer1.start('fetch ' + cnt + ' ' + url);
  return new goog.Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (var param in headerParams)
      xhr.setRequestHeader(param, headerParams[param]);
    xhr.responseType = responseType;
    xhr.onload = function(oEvent) {
      if (xhr.status == 200) {
        //tachyfont.timer1.end('fetch ' + cnt + ' ' + url);
        resolve(xhr.response);
      } else
        reject(xhr.status + ' ' + xhr.statusText);
    };
    xhr.onerror = function() {
      reject(Error('Network Error'));
    };
    xhr.send(data);
  });
};


/**
 * Sanitize base font to pass OTS
 * @param {Object} obj The object with the font header information.
 * @param {DataView} baseFont Base font as DataView
 * @return {DataView} Sanitized base font
 */
tachyfont.IncrementalFontUtils.sanitizeBaseFont = function(obj, baseFont) {

  if (obj.isTTF) {
    obj.dirty = true;
    var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = obj.glyphOffset;
    var glyphCount = obj.numGlyphs;
    var glyphSize, thisOne, nextOne;
    for (var i = (tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE - 1);
      i < glyphCount;
      i += tachyfont.IncrementalFontUtils.LOCA_BLOCK_SIZE) {
        thisOne = binEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, i);
        nextOne = binEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, i + 1);
      glyphSize = nextOne - thisOne;
      if (glyphSize) {
          binEd.seek(glyphOffset + thisOne);
          binEd.setInt16_(-1);
      }
    }
  } else {
    obj.dirty = true;
    var binEd = new tachyfont.BinaryFontEditor(baseFont, 0);
    var glyphOffset = obj.glyphOffset;
    var glyphCount = obj.numGlyphs;
    var lastRealOffset = binEd.getGlyphDataOffset(obj.glyphDataOffset,
            obj.offsetSize, 0);
    var delta = 0, thisOne;
    for (var i = 0; i < glyphCount + 1; i++) {
        thisOne = binEd.getGlyphDataOffset(obj.glyphDataOffset,
         obj.offsetSize, i);
        if (lastRealOffset == thisOne) {
            thisOne = lastRealOffset + delta;
            binEd.setGlyphDataOffset(obj.glyphDataOffset,
                obj.offsetSize, i, thisOne);
            delta++;
        } else {
            lastRealOffset = thisOne;
            delta = 1;
        }
        if (i < glyphCount) {
            binEd.seek(glyphOffset + thisOne);
            binEd.setUint8_(14);
        }
    }
  }
  return baseFont;
};

/**
 * Set a style's visibility.
 * @param {Object} style The style object
 * @param {string} fontname name of the font
 * @param {boolean} visible True is setting visibility to visible.
 * @return {Object} New style object for given font and visibility
 */
tachyfont.IncrementalFontUtils.setVisibility = function(style, fontname,
  visible) {
  if (!style) {
    style = document.createElement('style');
    document.head.appendChild(style);
  }
  if (style.sheet.cssRules.length) {
    style.sheet.deleteRule(0);
  }
  var visibility;
  if (visible) {
    visibility = 'visible';
  } else {
    visibility = 'hidden';
  }
  var rule = '.' + fontname + ' { font-family: ' + fontname + '; ' +
    'visibility: ' + visibility + '; }';

  style.sheet.insertRule(rule, style.sheet.cssRules.length);

  return style;
};

/**
 * Add the '@font-face' rule
 * @param {string} fontname The CSS fontname
 * @param {DataView} data The font data.
 * @param {boolean} isTTF True is the font is of type TTF.
 * @param {string} msg A message to display in a timer.
 */
tachyfont.IncrementalFontUtils.setFont = function(fontname, data, isTTF, msg) {
  if (msg) {
    tachyfont.timer1.start(msg);
  }
  var mime_type = '';
  if (isTTF) {
    mime_type = 'font/ttf'; // 'application/x-font-ttf';
  } else {
    mime_type = 'font/otf'; // 'application/font-sfnt';
  }

  var blob;
  try {
    blob = new Blob([data], { type: mime_type });
  } catch (e) {
    // IE 11 does not like using DataView here.
    if (e.name == 'InvalidStateError') {
      var buffer = data.buffer.slice(data.byteOffset);
      blob = new Blob([buffer], { type: mime_type});
    }
  }
  var blobUrl = window.URL.createObjectURL(blob);

  if (typeof FontFace == 'undefined') {
    tachyfont.IncrementalFontUtils.setFont_oldStyle(fontname, blobUrl, isTTF);
    return;
  } else {
    var font = new FontFace(fontname, 'url(' + blobUrl + ')', {});
    document.fonts.add(font);
    font.load();
  }
};


/**
 * Add the '@font-face' rule without using CSS Fonts Module Level 3.
 * @param {string} fontname The CSS fontname
 * @param {string} blobUrl The blob URL of the font data.
 * @param {boolean} isTTF True is the font is of type TTF.
 */
tachyfont.IncrementalFontUtils.setFont_oldStyle = function(fontname, blobUrl,
  isTTF) {
  // Get the style sheet.
  var style = document.getElementById(
    tachyfont.IncrementalFontUtils.STYLESHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = tachyfont.IncrementalFontUtils.STYLESHEET_ID;
    document.head.appendChild(style);
  }
  var sheet = style.sheet;

  // Delete the rule for this font (if it exists).
  var rule_to_delete = -1;
  var rules = sheet.cssRules || sheet.rules;
  if (rules) {
    for (var i = 0; i < rules.length; i++) {
      var this_rule = rules[i];
      if (this_rule.type == CSSRule.FONT_FACE_RULE) {
        //console.log('found an @font-face rule');
        var this_style = this_rule.style;
        var font_family = this_style.getPropertyValue('font-family');
        // TODO(bstell) consider using weight/slant.
        if (font_family == fontname) {
          rule_to_delete = i;
          break;
        }
      }
    }
  }

  var format;
  if (isTTF) {
    format = 'truetype';
  } else {
    format = 'opentype';
  }
  var rule_str = '@font-face {\n' +
    '    font-family: ' + fontname + ';\n' +
    '    src: url("' + blobUrl + '")' +
    ' format("' + format + '")' +
    ';' +
    '}';

  sheet.insertRule(rule_str, sheet.cssRules.length);

  if (rule_to_delete >= 0) {
    if (sheet.deleteRule) {
      sheet.deleteRule(rule_to_delete);
    } else if (sheet.removeRule) {
      sheet.removeRule(rule_to_delete);
    } else {
      console.log('no delete/drop rule');
    }
  }

};


/**
 * Load a web font.
 * This is currently only used for demos but in the future loading web fonts
 * could become an integral part of TachyFont.
 * @param {string} fontname The CSS fontname
 * @param {string} fonturl The url of the webfont.
 * @param {string} fonttype The type of the font; eg truetype or opentype.
 * @return {(Object|null)}
 */
// THIS SHOULD NOT BE IN TACHYFONT.JS
tachyfont.IncrementalFontUtils.loadWebFont = function(fontname, fonturl,
  fonttype) {
  tachyfont.timer2.start('load web font');
  var timeout_id;
  function font_loading_timeout() {
    tachyfont.timer2.end('load web font');
    timeout_id = setTimeout(font_loading_timeout, 100);
  }
  font_loading_timeout();

  var bandwidth = tachyfont.ForDebug.getCookie('bandwidth', '0');
  if (typeof window.FontFace == 'undefined') {
    var style = document.createElement('style');
    document.head.appendChild(style);
    var sheet = style.sheet;
    var rule_str =
      '@font-face {\n' +
      '    font-family: "' + fontname + '";\n' +
      '    src: url("' + fonturl + '?bandwidth=' + bandwidth +
      '&ts=' + Date.now() + '") format("' + fonttype + '")\n' +
      '}';
    sheet.insertRule(rule_str, 0);
    // A lazy way to time the web font.
    window.addEventListener('load', function(event) {
      clearTimeout(timeout_id);
      tachyfont.timer2.end('load web font');
      tachyfont.timer2.done();
    });
    return null;
  }

  var face = new FontFace(fontname, 'url(' + fonturl +
    '?bandwidth=' + bandwidth + '&ts=' + Date.now() + ')', {});
  face.load().then(function(loadedFace) {
    document.fonts.add(loadedFace);
    document.body.style.fontFamily = fontname;
    tachyfont.timer2.end('load web font:<br>' + fontname);
    tachyfont.timer2.done();
    clearTimeout(timeout_id);
  });
  return face; // NOTE: the face has to be stored in a global variable or
               // the font seems to disappear.
};

/**
 * tachyfont.RLEDecoder class to decode RLE'd data
 * @constructor
 */
tachyfont.RLEDecoder = function() {};

/**
 * Defined RLE operations
 * @type {Object}
 */
tachyfont.RLEDecoder.RLE_OPS = {
    0xC0: 'copy',
    0xC8: 'fill'
};

/**
 * Masks to interpret byte code
 * @type {Object}
 */
tachyfont.RLEDecoder.MASKS = {
    SIZE: 0x03,
    OP: 0xFC
};

/**
 * Interpret the byte code
 * @param {number} op Byte code
 * @return {Array.<number>} Array of byte cound and operation
 */
tachyfont.RLEDecoder.byteOp = function(op) {
  var byteCount = op & tachyfont.RLEDecoder.MASKS.SIZE;
  var byteOperation =
    tachyfont.RLEDecoder.RLE_OPS[op & tachyfont.RLEDecoder.MASKS.OP];
  return [byteCount, byteOperation];
};

/**
 * Decode given rle encoded data and return decoded data
 * @param {Array.<DataView>} arr Holds the Rle encoded header data and font data.
 * @return {DataView} Decoded data
 */
tachyfont.RLEDecoder.rleDecode = function(arr) {
  // time_start('rle');
  var header_data = arr[0];
  var fontdata = arr[1];
  var readOffset = 0;
  var writeOffset = 0;
  var totalSize = fontdata.getUint32(readOffset);
  if (header_data) {
    writeOffset = header_data.byteLength;
    totalSize += writeOffset;
  }
  var fill_byte;
  var byteOperation;
  var operationSize;
  var operationInfo;
  var i;
  readOffset += 4;
  // time_start('rle_alloc');
  var decodedData = new DataView(new ArrayBuffer(totalSize));
  // time_end('rle_alloc');
  if (header_data) {
    for (i = 0; i < header_data.byteLength; i++) {
      decodedData.setUint8(i, header_data.getUint8(i));
    }
  }
  while (writeOffset < totalSize) {
    byteOperation = fontdata.getUint8(readOffset);
    readOffset++;
    operationInfo = tachyfont.RLEDecoder.byteOp(byteOperation);

    if (operationInfo[0] == 0) {
      operationSize = fontdata.getUint8(readOffset);
      readOffset += 1;
    } else if (operationInfo[0] == 1) {
      operationSize = fontdata.getUint16(readOffset);
      readOffset += 2;
    } else if (operationInfo[0] == 2) {
      operationSize = fontdata.getUint32(readOffset);
      readOffset += 4;
    }
    if (operationInfo[1] == 'copy') {
      // time_start('rle copy ' + operationSize);
      // Each DataView operation is slow so minimize the number of operations.
      // https://code.google.com/p/chromium/issues/detail?id=225811
      var long_len = operationSize & ~3;
      i = 0;
      // This loop tests for "less than" but increments by 4. We know this works
      // because the long_len was forced down to a multiple of 4.
      for (; i < long_len; i += 4) {
        decodedData.setUint32(writeOffset, fontdata.getUint32(readOffset));
        readOffset += 4;
        writeOffset += 4;
      }
      for (; i < operationSize; i++) {
        decodedData.setUint8(writeOffset, fontdata.getUint8(readOffset));
        readOffset++;
        writeOffset++;
      }
      // time_end('rle copy ' + operationSize);
    } else if (operationInfo[1] == 'fill') {
      fill_byte = fontdata.getUint8(readOffset);
      // time_start('rle fill ' + fill_byte + ' ' + operationSize);
      readOffset++;
      if (fill_byte != 0) {
        for (i = 0; i < operationSize; i++) {
          decodedData.setUint8(writeOffset, fill_byte);
          writeOffset++;
        }
      } else {
        writeOffset += operationSize;
      }
      // time_end('rle fill ' + fill_byte + ' ' + operationSize);
    }

  }
  // time_end('rle');
  return decodedData;
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
   * @param {string} fontname The font name.
   */
  tachyfont.ForDebug.addDropIdbButton = function(incrFontMgr, fontname) {};
  /** Stub out the debug functions. */
  tachyfont.ForDebug.addBandwidthControl = function() {};
  /** Stub out the debug functions. */
  tachyfont.ForDebug.addTimingTextSizeControl = function() {};
}

