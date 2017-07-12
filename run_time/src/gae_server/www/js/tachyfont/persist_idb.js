'use strict';

/**
 * @license
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

goog.provide('tachyfont.Metadata');
goog.provide('tachyfont.Persist');

goog.require('goog.Promise');
goog.require('goog.Uri');
goog.require('tachyfont.Define');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.SyncPromise');


/**
 * Enum for error values.
 * @enum {string}
 */
// LINT.IfChange
tachyfont.Persist.Error = {
  FILE_ID: 'EPI',
  IDB_OPEN: '01',
  IDB_ON_UPGRAGE_NEEDED: '02',
  DELETED_DATA: '03',
  DELETE_DATA_FAILED: '04',
  DELETE_DATA_BLOCKED: '05',
  SAVE_BEGIN_PREVIOUS_ACTIVITY: '06',
  SAVE_BEGIN_METADATA_WRITE: '07',
  SAVE_DONE_PREVIOUS_ACTIVITY: '08',
  SAVE_DONE_METADATA_WRITE: '09',
  MISSING_CREATED_METADATA_TIME: '10',
  SAVE_BEGIN_AFTER_CREATED_METADATA: '11',
  IDB_GLOBAL_OPEN: '12',
  IDB_GLOBAL_ON_UPGRAGE_NEEDED: '13',
  // 14-15 no longer used.
  GET_STORE: '16',
  PUT_STORE: '17',
  DELETE_IDB: '18',
  END_VALUE: '00'
};
// LINT.ThenChange(//depot/google3/\
//     java/com/google/i18n/tachyfont/http/error-reports.properties)


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.Persist.reportError = function(errNum, errId, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.Persist.Error.FILE_ID + errNum, errId, errInfo);
};


/**
 * Save a data item.
 * @param {!IDBDatabase} idb The IndexedDB object.
 * @param {!Array<string>} names The names of the items.
 * @param {!Array<!*>} datas The data of the items.
 * @return {!goog.Promise<undefined,?>} Operation completion.
 */
tachyfont.Persist.saveData = function(idb, names, datas) {
  return new goog.Promise(function(resolve, reject) {
    var trans = idb.transaction(names, 'readwrite');
    var store = trans.objectStore(names[0]);
    store.put(datas[0], 0);
    trans.oncomplete = function(e) {
      resolve();
    };
    trans.onerror = function(e) {
      reject(e);
    };
  });
};


/**
 * Get the fontDB.
 * @param {string} dbName The name of the database.
 * @param {string} id For error reporting: the id of the font.
 * @return {!tachyfont.SyncPromise} The font DB.
 */
tachyfont.Persist.openIndexedDb = function(dbName, id) {
  return new tachyfont.SyncPromise(function(resolve, reject) {
    return tachyfont.Persist.openIndexedDb_(dbName, id, resolve, reject);
  });
};


/**
 * Get the fontDB.
 * @param {string} dbName The name of the database.
 * @param {string} id For error reporting: the id of the font.
 * @param {(?function(*=): (*|undefined)|undefined)} resolve The function to
 *     resolve the promise.
 * @param {(?function(*=): (*|undefined)|undefined)} reject The function to
 *     reject the promise.
 * @private
 */
tachyfont.Persist.openIndexedDb_ = function(dbName, id, resolve, reject) {
  var dbOpen = window.indexedDB.open(dbName, tachyfont.Define.IDB_VERSION);

  dbOpen.onsuccess = function(e) {
    var db = e.target.result;
    resolve(db);
  };

  dbOpen.onerror = function(e) {
    tachyfont.Persist.reportError(
        tachyfont.Persist.Error.IDB_OPEN, id, '!!! openIndexedDB "' + dbName);
    reject('open ' + dbName);
  };

  // Will get called when the version changes.
  dbOpen.onupgradeneeded = function(e) {
    var db = e.target.result;
    e.target.transaction.onerror = function(e) {
      tachyfont.Persist.reportError(
          tachyfont.Persist.Error.IDB_ON_UPGRAGE_NEEDED, id,
          'onupgradeneeded error: ' + e.value);
      reject(e);
    };
    if (!db.objectStoreNames.contains(tachyfont.Define.METADATA)) {
      var metadataStore = db.createObjectStore(tachyfont.Define.METADATA);
      tachyfont.Metadata.initializePerFont(metadataStore);
    }
    // Compact TachyFont data.
    if (!db.objectStoreNames.contains(tachyfont.Define.COMPACT_FONT)) {
      db.createObjectStore(tachyfont.Define.COMPACT_FONT);
    }
    if (!db.objectStoreNames.contains(tachyfont.Define.COMPACT_FILE_INFO)) {
      db.createObjectStore(tachyfont.Define.COMPACT_FILE_INFO);
    }
    if (!db.objectStoreNames.contains(tachyfont.Define.COMPACT_METADATA)) {
      var compactMetadataStore =
          db.createObjectStore(tachyfont.Define.COMPACT_METADATA);
      // TODO(bstell): does the table initialization belong under
      // tachyfont.Compact ?
      tachyfont.Metadata.initializePerFont(compactMetadataStore);
    }
    if (!db.objectStoreNames.contains(tachyfont.Define.COMPACT_CHAR_LIST)) {
      var compactCharsListStore =
          db.createObjectStore(tachyfont.Define.COMPACT_CHAR_LIST);
      tachyfont.Persist.initializeCharList(compactCharsListStore);
    }
  };
};


/**
 * Get the TachyFont global Database.
 * @return {!goog.Promise<!IDBDatabase,?>} A promise for global TachyFont
 *     Database.
 */
tachyfont.Persist.openGlobalDatabase = function() {
  return new goog.Promise(function(resolve, reject) {
    var dbOpen = window.indexedDB.open(
        tachyfont.Define.IDB_GLOBAL_NAME, tachyfont.Define.IDB_GLOBAL_VERSION);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      // TODO(bstell): record that the database was accessed.
      resolve(db);
    };

    dbOpen.onerror = function(e) {
      tachyfont.Persist.reportError(
          tachyfont.Persist.Error.IDB_GLOBAL_OPEN, '',
          '!!! openIndexedDb_ "' + tachyfont.Define.IDB_GLOBAL_NAME);
      reject();
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        tachyfont.Persist.reportError(
            tachyfont.Persist.Error.IDB_GLOBAL_ON_UPGRAGE_NEEDED, '',
            'onupgradeneeded error: ' + e.value);
        reject();
      };
      if (!db.objectStoreNames.contains(tachyfont.Define.METADATA)) {
        var metadataStore = db.createObjectStore(tachyfont.Define.METADATA);
        tachyfont.Metadata.initializeGlobal(metadataStore);
      }
    };
  });
};


/**
 * Initializes the per font char list table.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like incrementalfont.js
tachyfont.Persist.initializeCharList = function(store) {
  store.put({}, 0);
};


/**
 * Initializes the global metadata table.
 * Currently this is the same as the per font metadata store.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.initializeGlobal = function(store) {
  var createTime = goog.now();
  if (goog.DEBUG) {
    // To allow immediate testing make the data appear old enough to make it
    // seem stable.
    createTime = goog.now() - 24 * 60 * 60 * 1000 + 5 * 1000;
  }
  tachyfont.Metadata.initialize(store, createTime);
};


/**
 * Initializes the per font metadata table.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.initializePerFont = function(store) {
  var createTime = goog.now();
  if (goog.DEBUG) {
    // To allow immediate testing make the data appear old enough to make it
    // seem stable.
    createTime = goog.now() - 24 * 60 * 60 * 1000 + 10 * 1000;
  }
  tachyfont.Metadata.initialize(store, createTime);
};


/**
 * Initializes the per font metadata table.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 * @param {number} createTime The timestable to use for the create time.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.initialize = function(store, createTime) {
  var uri = goog.Uri.parse(window.location.href);
  var tachyFontNoDelay = uri.getParameterValue('TachyFontNoDelay');
  if (tachyFontNoDelay == 'true') {
    // Make it appear that the persistence has been stable for a while. This
    // needs to be larger than:
    //     tachyfont.TachyFont.GLOBAL_STABLE_DATA_TIME
    //     tachyfont.IncrementalFont.STABLE_DATA_TIME
    createTime = goog.now() - 2 * 24 * 60 * 60 * 1000;
  }

  // TODO(bstell): make the metadata a real object or struct.
  var metadata = {};
  metadata[tachyfont.Define.ACTIVITY] =
      tachyfont.Define.CREATED_METADATA;
  metadata[tachyfont.Define.ACTIVITY_TIME] =
      metadata[tachyfont.Define.CREATED_METADATA_TIME] = createTime;
  store.put(metadata, 0);
};


/**
 * Delete the fontDB.
 * @param {string} dbName The database name.
 * @param {string} id An additional identifier of the data.
 * @return {!goog.Promise} The font DB.
 */
tachyfont.Persist.deleteDatabase = function(dbName, id) {
  var deleteDb = new goog.Promise(function(resolve, reject) {
    var req = window.indexedDB.deleteDatabase(dbName);
    req.onsuccess = function() {
      // If the user cleared the data something may be wrong.
      tachyfont.Persist.reportError(
          tachyfont.Persist.Error.DELETED_DATA, id,
          'Deleted database successfully');
      resolve();
    };
    req.onerror = function() {
      tachyfont.Persist.reportError(
          tachyfont.Persist.Error.DELETE_DATA_FAILED, id,
          'Delete database failed');
      reject(1);
    };
    req.onblocked = function() {
      tachyfont.Persist.reportError(
          tachyfont.Persist.Error.DELETE_DATA_BLOCKED, id,
          'Delete database blocked');
      reject(2);
    };
  });
  return deleteDb;
};


/**
 * Get a part of the font.
 * @param {!IDBDatabase} idb The IndexedDB object.
 * @param {string} name The name of the font data to get.
 * @return {!goog.Promise} Promise to return the data.
 */
tachyfont.Persist.getData = function(idb, name) {
  var getData = new goog.Promise(function(resolve, reject) {
    var trans = idb.transaction([name], 'readwrite');
    /** @type {IDBObjectStore} */
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
      reject(e);
    };
  });
  return getData;
};


/**
 * Put data to an object store.
 * @param {!tachyfont.SyncPromise<?,?>} previous The previous
 *     promise to wait for.
 * @param {!IDBTransaction} transaction The transaction object.
 * @param {string} name The name of the store to retrieve.
 * @param {*} value The value to write to the store.
 * @return {!tachyfont.SyncPromise<*,?>} Promise when the data
 *     is written.
 */
tachyfont.Persist.putStore = function(previous, transaction, name, value) {
  return previous.then(function() {
    return new tachyfont.SyncPromise(  //
        function(resolve, reject) {
          var store = transaction.objectStore(name);
          var request = store.put(value, 0);
          request.onsuccess = function(e) {
            resolve(value);  //
          };

          request.onerror = function(e) {
            tachyfont.Persist.reportError(
                tachyfont.Persist.Error.PUT_STORE, name, e);
            reject(e);  //
          };
        });
  });
};


/**
 * Put data to a group of object stores.
 * @param {!IDBTransaction} transaction The transaction object.
 * @param {!Array<string>} names The names of the stores to retrieve.
 * @param {!Array<*>} values The values to write to the stores.
 * @return {!tachyfont.SyncPromise<?,?>} Promise when the data
 *     is written.
 */
tachyfont.Persist.putStores = function(transaction, names, values) {
  var results = [];
  var lastPromise = tachyfont.SyncPromise.resolve([]);
  for (var i = 0; i < names.length; i++) {
    lastPromise = tachyfont.Persist
                      .putStore(lastPromise, transaction, names[i], values[i])
                      .then(function(value) {
                        results.push(value);
                        return results;
                      });
  }
  return lastPromise;
};


/**
 * Get data from an object store.
 * @param {!IDBTransaction} transaction The transaction object.
 * @param {string} name The name of the store to retrieve.
 * @return {!tachyfont.SyncPromise<*,?>} Promise to return the
 *     data.
 */
tachyfont.Persist.getStore = function(transaction, name) {
  return new tachyfont.SyncPromise(  //
      function(resolve, reject) {
        var store = transaction.objectStore(name);
        var request = store.get(0);
        request.onsuccess = function(e) {
          resolve(e.target.result);  //
        };

        request.onerror = function(e) {
          tachyfont.Persist.reportError(
              tachyfont.Persist.Error.GET_STORE, name, e);
          reject(e);  //
        };
      });
};


/**
 * Get data from a group of object stores.
 * @param {!IDBTransaction} transaction An optional transaction object.
 * @param {!Array<string>} names The names of the stores to retrieve.
 * @return {!tachyfont.SyncPromise<!Array<*>,?>} Promise to
 *     return the array of data.
 */
tachyfont.Persist.getStores = function(transaction, names) {
  var promises = [];
  for (var i = 0; i < names.length; i++) {
    promises.push(tachyfont.Persist.getStore(transaction, names[i]));
  }
  return tachyfont.SyncPromise.all(promises);
};
