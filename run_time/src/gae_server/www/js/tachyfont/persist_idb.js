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
goog.require('goog.log');
goog.require('tachyfont.Logger');
goog.require('tachyfont.MetadataDefines');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.utils');


/**
 * Enum for error values.
 * @enum {string}
 */
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
  END_VALUE: '00'
};


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.Persist.reportError = function(errNum, errId, errInfo) {
  if (goog.DEBUG) {
    if (!tachyfont.Reporter.isReady()) {
      goog.log.error(tachyfont.Logger.logger, 'failed to report error');
    }
  }
  if (tachyfont.Reporter.isReady()) {
    tachyfont.Reporter.reportError(
        tachyfont.Persist.Error.FILE_ID + errNum, errId, errInfo);
  }
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
 * @return {goog.Promise} The font DB.
 */
tachyfont.Persist.openIndexedDB = function(dbName, id) {
  var openIdb = new goog.Promise(function(resolve, reject) {
    var dbOpen = window.indexedDB.open(dbName, tachyfont.utils.IDB_VERSION);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      resolve(db);
    };

    dbOpen.onerror = function(e) {
      tachyfont.Persist.reportError(tachyfont.Persist.Error.IDB_OPEN,
          id, '!!! openIndexedDB "' + dbName);
      reject();
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        tachyfont.Persist.reportError(
            tachyfont.Persist.Error.IDB_ON_UPGRAGE_NEEDED,
            id, 'onupgradeneeded error: ' + e.value);
        reject();
      };
      if (!db.objectStoreNames.contains(tachyfont.utils.IDB_BASE)) {
        db.createObjectStore(tachyfont.utils.IDB_BASE);
      }
      if (!db.objectStoreNames.contains(tachyfont.utils.IDB_CHARLIST)) {
        var charListStore = db.createObjectStore(tachyfont.utils.IDB_CHARLIST);
        tachyfont.Persist.initializeCharList(charListStore);
      }
      if (!db.objectStoreNames.contains(tachyfont.MetadataDefines.METADATA)) {
        var metadataStore =
            db.createObjectStore(tachyfont.MetadataDefines.METADATA);
        tachyfont.Metadata.initialize(metadataStore);
      }
    };
  });
  return openIdb;
};


/**
 * Initializes the char list table.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like incrementalfont.js
tachyfont.Persist.initializeCharList = function(store) {
  store.put({}, 0);
};


/**
 * Initializes the metadata table.
 * @param {!IDBObjectStore} store The IndexedDB object store.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.initialize = function(store) {
  // TODO(bstell): make the metadata a real object or struct.
  var metadata = {};
  metadata[tachyfont.MetadataDefines.ACTIVITY] =
      tachyfont.MetadataDefines.CREATED_METADATA;
  metadata[tachyfont.MetadataDefines.ACTIVITY_TIME] =
      metadata[tachyfont.MetadataDefines.CREATED_METADATA_TIME] = goog.now();
  store.put(metadata, 0);
};


/**
 * Records that a save data operation is about to begin.
 * @param {!IDBDatabase} db The IndexedDB handle.
 * @param {string} id Identifies the font.
 * @return {!goog.Promise<!Object,?>} Resolves when the metadata has been
 *     recorded.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.beginSave = function(db, id) {
  var name = tachyfont.MetadataDefines.METADATA;
  return tachyfont.Persist.getData(db, name)
      .then(function(storedMetadata) {
        var metadata = tachyfont.Metadata.cleanUpMetadata(storedMetadata, id);
        if (metadata[tachyfont.MetadataDefines.ACTIVITY] !=
            tachyfont.MetadataDefines.SAVE_DONE) {
          if (metadata[tachyfont.MetadataDefines.ACTIVITY] ==
              tachyfont.MetadataDefines.CREATED_METADATA) {
            tachyfont.Persist.reportError(
                tachyfont.Persist.Error.SAVE_BEGIN_AFTER_CREATED_METADATA, id,
                metadata[tachyfont.MetadataDefines.ACTIVITY]);
          } else {
            tachyfont.Persist.reportError(
                tachyfont.Persist.Error.SAVE_BEGIN_PREVIOUS_ACTIVITY, id,
                metadata[tachyfont.MetadataDefines.ACTIVITY]);
          }
        }
        metadata[tachyfont.MetadataDefines.ACTIVITY] =
            tachyfont.MetadataDefines.BEGIN_SAVE;
        metadata[tachyfont.MetadataDefines.ACTIVITY_TIME] = goog.now();
        return tachyfont.Persist.saveData(db, [name], [metadata])
            .then(function() {
              return metadata;
            });
      })
      .thenCatch(function(e) {
        tachyfont.Persist.reportError(
           tachyfont.Persist.Error.SAVE_BEGIN_METADATA_WRITE, id, e);
        console.log('beginSave FAILED TO WRITE the activity');
      });
};


/**
 * Records that a save data operation just finished.
 * @param {!IDBDatabase} db The IndexedDB handle.
 * @param {!Object} metadata The metadata.
 * @param {string} id Identifies the font.
 * @return {!goog.Promise<?,?>} Resolves when the metadata has been recorded.
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.saveDone = function(db, metadata, id) {
  var name = tachyfont.MetadataDefines.METADATA;
  if (metadata[tachyfont.MetadataDefines.ACTIVITY] !=
      tachyfont.MetadataDefines.BEGIN_SAVE) {
    tachyfont.Persist.reportError(
        tachyfont.Persist.Error.SAVE_DONE_PREVIOUS_ACTIVITY, id,
        metadata[tachyfont.MetadataDefines.ACTIVITY]);
  }
  metadata[tachyfont.MetadataDefines.ACTIVITY] =
      tachyfont.MetadataDefines.SAVE_DONE;
  metadata[tachyfont.MetadataDefines.ACTIVITY_TIME] = goog.now();

  return tachyfont.Persist.saveData(db, [name], [metadata])
      .thenCatch(function(e) {
        tachyfont.Persist.reportError(
           tachyfont.Persist.Error.SAVE_DONE_METADATA_WRITE, id, e);
      });
};


/**
 * Cleans up the metadata by:
 *   - removing no longer used fields
 *   - adding missing new fields
 * @param {!Object} inputMetadata The incoming metadata.
 * @param {string} id Identifies the font.
 * @return {!Object}
 */
// TODO(bstell): this is a 'policy' function so move it out of the db layer;
// move it to a file like metadata.js
tachyfont.Metadata.cleanUpMetadata = function(inputMetadata, id) {
  var outputMetadata = {};
  if (!inputMetadata[tachyfont.MetadataDefines.CREATED_METADATA_TIME]) {
    inputMetadata[tachyfont.MetadataDefines.CREATED_METADATA_TIME] = goog.now();
    tachyfont.Persist.reportError(
        tachyfont.Persist.Error.MISSING_CREATED_METADATA_TIME, id, '');
  }
  outputMetadata[tachyfont.MetadataDefines.CREATED_METADATA_TIME] =
      inputMetadata[tachyfont.MetadataDefines.CREATED_METADATA_TIME];
  outputMetadata[tachyfont.MetadataDefines.ACTIVITY] =
      inputMetadata[tachyfont.MetadataDefines.ACTIVITY] ||
      tachyfont.MetadataDefines.CREATED_METADATA;
  outputMetadata[tachyfont.MetadataDefines.ACTIVITY_TIME] =
      inputMetadata[tachyfont.MetadataDefines.ACTIVITY_TIME] || goog.now();
  return outputMetadata;
};


/**
 * Delete the fontDB.
 * @param {string} dbName The database name.
 * @param {string} id An additional identifier of the data.
 * @return {goog.Promise} The font DB.
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
 * @param {Object} idb The IndexedDB object.
 * @param {string} name The name of the font data to get.
 * @return {goog.Promise} Promise to return the data.
 */
tachyfont.Persist.getData = function(idb, name) {
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
      reject(e);
    };
  });
  return getData;
};
