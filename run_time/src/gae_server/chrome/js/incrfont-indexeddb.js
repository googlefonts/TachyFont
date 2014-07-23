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
 * Get the incremental font object.
 * @param {string} fontname The name of the font.
 * @return {Object} The incremental font object.
 */
// 1. Create an incremental font manager object.
// 2. Create a class using the @font-face rule and with visibility=hidden
// 3. Open the IndexedDB.
// 4. Start the operation to get the base.
// 5. Start the operation to get the list of fetched/not-fetched chars.
// 6ODO(bstell) need to code the following.
// 5. Create a @font-face rule.
// 7. When the base is available set the class visibility=visible 
IncrementalFont.createManager = function(fontname) {
  var incrFontMgr = new IncrementalFont.obj_(fontname);
  incrFontMgr.getIDB_ = incrFontMgr.openIndexedDB(fontname);
  // Do the next two operations in parallel.
  // Start the operation to get the base.
  console.log('Get the base.');
  var style;
  incrFontMgr.getBase = incrFontMgr.getData_('base').
  catch(function(e) {
    console.log('Need to fetch the data');
    return IncrementalFontLoader.requestURL('/fonts/' + incrFontMgr.fontname + 
      '/base', 'GET', null, {}, 'arraybuffer').
      then(function(xfer_bytes) {
        style = document.createElement('style');
        // WebKit hack
        style.appendChild(document.createTextNode(''));
        document.head.appendChild(style);
        style.sheet.insertRule('.' + fontname + 
          ' { font-family: nanum-brush; visibility: hidden; }', 0);
        return xfer_bytes;
      }).
      then(function(xfer_bytes) {
      console.log('fetched the raw base');
      incrFontMgr.base_dirty = true;
      console.log('need to parseBaseHeader_');
      var base_font_rle = xfer_bytes;
      return base_font_rle;
    }).
    then(function(base_font_rle) {
      console.log('need to RLEDecoder.rleDecode');
      var base_font_pre_sanitize = base_font_rle;
      return base_font_pre_sanitize;
    }).
    then(function(base_font_pre_sanitize) {
      console.log('need to sanitize');
      var base_font = base_font_pre_sanitize;
      return base_font;
    }).
    then(function(base_font_pre_sanitize) {
      console.log('for debug: get some ttf font data so we can test the blob url');
      return IncrementalFontLoader.requestURL(
        '../fonts/nanum-brush/NanumBrushScript-Regular.ttf',
        'GET', null, {}, 'arraybuffer')
    }).
    then(function(base_font) {
      console.log('Set the @font-face');
      IncrementalFont.obj_.setFont_(fontname, base_font,
        'application/x-font-ttf');
      console.log('make the class visible');
      // style.sheet.rules.length
      style.sheet.deleteRule(0);
      style.sheet.insertRule('.' + fontname + 
        ' { font-family: nanum-brush; visibility: visible; }', 0);

//      console.log('make the elements with this class visible');
//      var elements = document.getElementsByClassName(fontname);
//      for (var i in elements) {
//        if (elements.hasOwnProperty(i)) {
//          elements[i].style.visibility = 'visible';
//        }
//      }
      return base_font;
    });
  });
  // Start the operation to get the list of already fetched chars.
  console.log('Need to get the list of already fetched chars.');
  incrFontMgr.getCharList = incrFontMgr.getData_('charList').
  then(function(data) {
    debugger;
    return data;
  }).
  catch(function(e) {
    console.log('no charList');
    incrFontMgr.charList_dirty = true;
    return {};
  }).
  then(function(data) {
    return data;
  });
  return incrFontMgr;
};

/**
 * IncrFontIDB.obj_ - A class to handle interacting the IndexedDB.
 * @param {string} fontname The name of the font.
 * @constructor
 * @private
 */
IncrementalFont.obj_ = function(fontname) {
  this.version = 4;
  this.storeName = 'incrfonts.';
  this.fontname = fontname;
  this.charsURL = '/incremental_fonts/request';
  this.base_dirty = false;

  // Promises
  this.getIDB_ = null;
  this.getBase = null;
  this.getCharList = null;
};


/**
 * Add the @font-face rule
 * @param {string} fontname The CSS fontname
 * @param {Array} data The font data.
 * @param {string} mime_type The mime type of the font.
 * @private
 */
IncrementalFont.obj_.setFont_ = function(fontname, data, mime_type) {
  console.log(data);
  var blob = new Blob([data], { type: mime_type });
  var blobUrl = window.URL.createObjectURL(blob);
  console.log('fontname = ' + fontname);
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
    var dbOpen = indexedDB.open(that.storeName + fontname, that.version);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      console.log('open storeName "' + that.storeName + '"');
      resolve(db);
    };
    dbOpen.onerror = function(e) {
      console.log('!!! IncrFontIDB.obj_ "' + that.fontname + '": ' + e.value);
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
      }
      console.log('before deletes');
      if (db.objectStoreNames.contains('base')) {
        console.log('onupgradeneeded base');
        db.deleteObjectStore('base');
      }
      if (db.objectStoreNames.contains('charList')) {
        console.log('onupgradeneeded charList');
        db.deleteObjectStore('charList');
      }
      console.log('before creates');
      var store = db.createObjectStore('base',
        { keypath: 'fontname' });
      var store = db.createObjectStore('charList',
        { keypath: 'fontname' });
      console.log('after create');
    };
  }).then(function(db) {
    // TODO(bstell) timing call
    return db;
  });
  return openIDB;
};


/**
 * Get a part of the font.
 * @param {string} dataname The name of the font data to get.
 * @return {Promise} Promise to return the data.
 */
IncrementalFont.obj_.prototype.getData_ = function(dataname) {
  var that = this;
  var data = '';
  console.log('getData_');
  var getData = new Promise(function(resolve, reject) {
    console.log('create transaction');
    that.getIDB_.then(function(db) {
      try {
        var trans = db.transaction([dataname], 'readwrite');
        var store = trans.objectStore(dataname);
        var keyRange = IDBKeyRange.lowerBound(0);
        var cursorRequest = store.openCursor(keyRange);
      } catch (e) {
        debugger;
        console.log('e = ' + e.message);
      }
  
      console.log('define cursor onsuccess');
      cursorRequest.onsuccess = function(e) {
        var result = e.target.result;
        console.log('cursor onsuccess: result = ' + result);
        if (!!result == false) {
          if (data) {
            resolve(data);
          } else {
            reject(e);
          }
          return;
        }
        console.log('result = ' + result.value);
        data += result.value;
        result.continue();
      };
  
      console.log('define cursor onerror');
      cursorRequest.onerror = function(e) {
        console.log('result = ' + result.value);
        debugger;
        reject(e);
      };
      console.log('after define cursor onerror');
    });
  });
  return getData;
};


/**
 * Update a data itme.
 * @param {string} dataname The name of the font data to get.
 * @return {Promise} Promise when the data is written.
 */
IncrementalFont.obj_.prototype.updateData = function(dataname) {
  var that = this;
  if (this.base_dirty) {
    console.log('need to updateData');
  } else {
    console.log('no need to updateData');
  }
};
