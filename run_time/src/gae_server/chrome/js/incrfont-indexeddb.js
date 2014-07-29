'use strict';

/*
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


/**
 * IncrementalFont - A namespace.
 */
function IncrementalFont() {
}

/**
 * The IndexedDB version.
 * Increment this number every time there is a change in the schema.
 */
IncrementalFont.version = 1;


/**
 * The the database name.
 */
IncrementalFont.DB_NAME = 'incrfonts';


/**
 * The time in milliseconds to wait before persisting the data.
 */
IncrementalFont.timeoutTime = 1000;


/**
 * The the base name.
 */
IncrementalFont.BASE = 'base';


/**
 * The the base dirty (needs to be persisted) key.
 */
IncrementalFont.BASE_DIRTY = 'base_dirty';


/**
 * The the char list name.
 */
IncrementalFont.CHARLIST = 'charlist';


/**
 * The the char list dirty (needs to be persisted) key.
 */
IncrementalFont.CHARLIST_DIRTY = 'charlist_dirty';

///**
// * The the persist timeout key.
// */
//IncrementalFont.TIMEOUT_ID = 'timeoutID';


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
 * @return {Object} The incremental font object.
 */
IncrementalFont.createManager = function(fontname) {
  var incrFontMgr = new IncrementalFont.obj_(fontname);
  //timer.start('openIndexedDB.open ' + fontname);
  incrFontMgr.getIDB_ = incrFontMgr.openIndexedDB(fontname);
  //timer.end('openIndexedDB.open ' + fontname);

  //console.log('Create a class with visibility: hidden.');
  var style = document.createElement('style');
  //// WebKit hack
  //style.appendChild(document.createTextNode(''));
  document.head.appendChild(style);
  style.sheet.insertRule('.' + fontname +
    ' { font-family: nanum-brush; visibility: hidden; }', 0);

  //console.log('Get the base.');
  // Get the base and charlist in parallel.
  // Start the operation to get the base.
  //timer.start('get the base data ' + fontname);
  //timer.start('did not get the base data ' + fontname);
  incrFontMgr.getBase = incrFontMgr.getData_(IncrementalFont.BASE).
  then(function(data) {
    //timer.end('got the base from IDB: ' + fontname);
    var base_font = data.base;
    return base_font;
  }).
  catch (function(e) {
    //console.log('getData_ caught: ' + e + '/' + e.message);
    //timer.end('did not get the base data ' + fontname);
    console.log('Did not get base from IDB, need to fetch it: ' + fontname);
    return IncrementalFontUtils.requestURL('/fonts/' + incrFontMgr.fontname +
      '/base', 'GET', null, {}, 'arraybuffer').
    then(function(xfer_bytes) {
      //console.log('fetched the raw base: ' + xfer_bytes.byteLength + ' bytes');
      console.log('parseBaseHeader');
      console.log('need to get isTTF from base header');
      incrFontMgr.isTTF = true;
      return IncrementalFontUtils.parseBaseHeader(incrFontMgr, xfer_bytes);
    }).
    then(function(base_font_rle) {
      console.log('RLEDecoder.rleDecode');
      return RLEDecoder.rleDecode(base_font_rle);
    }).
    then(function(raw_base_font) {
      console.log('sanitize');
      return IncrementalFontUtils.sanitizeBaseFont(incrFontMgr, raw_base_font);
    }).
//    then(function(base_font) {
//      console.log('for debug: get some ttf font data so we can test saving' +
//        '  data');
//      return IncrementalFontUtils.requestURL(
//        '../fonts/nanum-brush/NanumBrushScript-Regular.ttf',
//        'GET', null, {}, 'arraybuffer').
//      then(function(base_font) {
//        console.log('fetched the ttf: ' + base_font.byteLength + ' bytes');
//        return base_font;
//      })
//    }).
    then(function(base_font) {
      //console.log('persist the base: ' + base_font.byteLength + ' bytes');
      incrFontMgr.persistDelayed_(IncrementalFont.BASE);
      return base_font;
    }).
    then(function(base_font) {
      //console.log('Set the @font-face');
      IncrementalFont.obj_.setFont_(fontname, base_font,
        'application/x-font-ttf');
      //console.log('make the class visible');
      // style.sheet.rules.length
      style.sheet.deleteRule(0);
      style.sheet.insertRule('.' + fontname +
        ' { font-family: nanum-brush; visibility: visible; }', 0);
      return base_font;
    });
  });

  // Start the operation to get the list of already fetched chars.
  //console.log('Get the list of already fetched chars.');
  incrFontMgr.getCharList = incrFontMgr.getData_(IncrementalFont.CHARLIST).
  then(function(data) {
    debugger;
    return data;
  }).
  catch (function(e) {
    console.log('no charlist');
    return {};
  }).
  then(function(data) {
    return data;
  });

  // For Debug: add a button to clear the IndexedDB.
  ForDebug.addDropDbButton(incrFontMgr, fontname);

  return incrFontMgr;
};


/**
 * IncrFontIDB.obj_ - A class to handle interacting the IndexedDB.
 * @param {string} fontname The name of the font.
 * @constructor
 * @private
 */
IncrementalFont.obj_ = function(fontname) {
  this.fontname = fontname;
  this.charsURL = '/incremental_fonts/request';
  this.persistInfo = {};
  this.persistInfo[IncrementalFont.BASE_DIRTY] = false;
  this.persistInfo[IncrementalFont.CHARLIST_DIRTY] = false;
  this.isTTF = false;

  // Promises
  this.getIDB_ = null;
  this.getBase = null;
  this.getCharList = null;
  this.finishPersistingData = Promise.resolve();
};


/**
 * Lazily data for these chars.
 * @param {string} element_name The name of the data item.
 * @private
 */
IncrementalFont.obj_.prototype.loadNeededChars = function(element_name) {
  var that = this;
  //console.log('persist ' + name);
  var chars = document.getElementById(element_name).innerText;
  this.getCharList.
  then(function(charlist) {
    //console.log('charlist = ' + Object.keys(charlist));
    var neededCodes = [];
    for (var i = 0; i < chars.length; i++) {
      var c = chars.charAt(i);
      if (!charlist[c]) {
        neededCodes.push(c.charCodeAt(0));
        charlist[c] = 1;
      }
    }
    //console.log(neededCodes);
    if (neededCodes.length == 0) {
      debugger;
      return null;
    }
    neededCodes.sort(function(a, b){return a-b});
    //console.log(neededCodes);
    return IncrementalFontUtils.requestCodepoints(that.fontname, neededCodes).
    then(function(chardata) {
      //console.log('requested char data length = ' + chardata.byteLength);
      return chardata;
    });
  }).
  then(function(chardata) {
    //console.log('need to decouple injectBundle from IncrementalFontLoader');
    if (chardata != null) {
      return that.getBase.
      then(function(base) {
        //console.log('that = ' + Object.keys(that));
        //console.log('base.byteLength = ' + base.byteLength);
        //console.log('chardata.byteLength = ' + chardata.byteLength);
        var fontdata = IncrementalFontUtils.injectCharacters(that, base, chardata);
        that.persistInfo[IncrementalFont.CHARLIST_DIRTY] = true;
        var blobURL = URL.createObjectURL(new Blob([fontdata],
            {type: 'application/font-sfnt'}));
        IncrementalFontUtils.setTheFont(that.fontname, blobURL, function() {});
      });
    }
  });
};

/**
 * Save data that needs to be persisted.
 * @param {string} name The name of the data item.
 * @private
 */
IncrementalFont.obj_.prototype.persistDelayed_ = function(name) {
  var that = this;
  //console.log('persist ' + name);

  // Note what needs to be persisted.
  if (name == IncrementalFont.BASE) {
    this.persistInfo[IncrementalFont.BASE_DIRTY] = true;
  } else if (name == IncrementalFont.CHARLIST) {
    this.persistInfo[IncrementalFont.CHARLIST_DIRTY] = true;
  }

  // Wait for any pending persist operation to finish.
  this.finishPersistingData.then(function() {
    // Previous persists may have already saved the data so see if there is
    // anything still to persist.
//    debugger;
    var base_dirty = that.persistInfo[IncrementalFont.BASE_DIRTY];
    var charlist_dirty = that.persistInfo[IncrementalFont.CHARLIST_DIRTY];
    if (!base_dirty && !charlist_dirty) {
      return;
    }

    // What ever got in upto this point will get saved.
    that.persistInfo[IncrementalFont.BASE_DIRTY] = false;
    that.persistInfo[IncrementalFont.CHARLIST_DIRTY] = false;

    // Wait a bit before persisting.
    that.finishPersistingData = new Promise(function(resolve, reject) {
      setTimeout(function() {
        //console.log('persist timeout');
        resolve();
      }, IncrementalFont.timeoutTime);
    }).
    then(function() {
//      debugger;
      if (base_dirty) {
        return that.getBase.
        then(function(base) {
//          debugger;
          return that.saveData_(IncrementalFont.BASE, base);
        });
      }
    }).
    then(function() {
      if (charlist_dirty) {
        return that.getCharList().
        then(function(charlist) {
          return that.saveData_(IncrementalFont.CHARLIST, charlist);
        });
      }
    }).
    catch (function(e) {
      console.log('persistDelayed_: ' + e.message);
      debugger;
    }).
    then(function() {
      //console.log('persisted ' + name);
    });
  });
};


/**
 * Save a data item.
 * @param {string} name The name of the item.
 * @param {Array} data The data.
 * @return {Promise} Operation completion.
 * @private
 */
IncrementalFont.obj_.prototype.saveData_ = function(name, data) {
  var that = this;
  //console.log('save ' + name);
  return that.getIDB_.
  then(function(db) {
    // the initialization form x = { varname: value } handles the key is a literal
    // string. If a variable varname is used for the key then the string varname
    // will be used ... NOT the value of the varname.
    return new Promise(function(resolve, reject) {
      var value = {};
      value[name] = data;
      var trans = db.transaction([name], 'readwrite');
      var store = trans.objectStore(name);
      var request = store.put(value, 0);
      request.onsuccess = function(e) {
        resolve();
      };
      request.onerror = function(e) {
        debugger;
        reject();
      };
    }).
    catch (function(e) {
      console.log('saveData ' + name + ': ' + e.message);
      debugger;
    });
  });
};

/**
 * Add the "@font-face" rule
 * @param {string} fontname The CSS fontname
 * @param {Array} data The font data.
 * @param {string} mime_type The mime type of the font.
 * @private
 */
IncrementalFont.obj_.setFont_ = function(fontname, data, mime_type) {
  var blob = new Blob([data], { type: mime_type });
  var blobUrl = window.URL.createObjectURL(blob);
  //console.log('fontname = ' + fontname);
  var font = new FontFace(fontname, 'url(' + blobUrl + ')', {});
  document.fonts.add(font);
  font.load();
};


/**
 * Get the fontDB.
 * @param {string} fontname The name of the font.
 * @return {Promise} The font DB.
 */
IncrementalFont.obj_.prototype.openIndexedDB = function(fontname) {
  var that = this;

  var openIDB = new Promise(function(resolve, reject) {
    var db_name = IncrementalFont.DB_NAME + '/' + fontname;
    //timer.start('indexedDB.open ' + db_name);
    var dbOpen = indexedDB.open(db_name, IncrementalFont.version);
    //timer.end('indexedDB.open ' + db_name);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      console.log('open db "' + db_name + '"');
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
      console.log('onupgradeneeded');
      e.target.transaction.onerror = function(e) {
        console.log('!!! onupgradeneeded: ' + e.value);
        debugger;
        reject(e);
      };
      //console.log('before deletes');
      if (db.objectStoreNames.contains(IncrementalFont.BASE)) {
        console.log('onupgradeneeded base');
        db.deleteObjectStore(IncrementalFont.BASE);
      }
      if (db.objectStoreNames.contains(IncrementalFont.CHARLIST)) {
        console.log('onupgradeneeded charlist');
        db.deleteObjectStore(IncrementalFont.CHARLIST);
      }
      //console.log('before creates');
      var store = db.createObjectStore(IncrementalFont.BASE,
        { keypath: 'id' });
      var store = db.createObjectStore(IncrementalFont.CHARLIST,
        { keypath: 'id' });
      //console.log('after create');
    };
  }).then(function(db) {
    // TODO(bstell) timing call
    return db;
  });
  return openIDB;
};


/**
 * Get a part of the font.
 * @param {string} name The name of the font data to get.
 * @return {Promise} Promise to return the data.
 * @private
 */
IncrementalFont.obj_.prototype.getData_ = function(name) {
  var that = this;
  //console.log('getData_');
  var getData = new Promise(function(resolve, reject) {
    //console.log('create transaction');
    that.getIDB_.then(function(db) {
      var trans = db.transaction([name], 'readwrite');
      var store = trans.objectStore(name);
      var request = store.get(0);
      request.onsuccess = function(e) {
        var result = e.target.result;
        console.log('request onsuccess: result = ' + result);
        if (result != undefined) {
          resolve(result);
        } else {
          reject(e);
        }
        return; // I think this is unnecessary.
      };

      request.onerror = function(e) {
        console.log('result = ' + result.value);
        debugger;
        reject(e);
      };
    });
//  }).
//  catch (function(e) {
//    console.log('getData_: ' + e.message);
//    debugger;
  });
  return getData;
};

