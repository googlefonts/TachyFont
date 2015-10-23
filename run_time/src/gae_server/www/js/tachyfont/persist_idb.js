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

goog.provide('tachyfont.Persist');

goog.require('goog.Promise');


/**
 * Enum for error values.
 * @enum {string}
 * @private
 */
tachyfont.Persist.Error_ = {
  FILE_ID: 'EPI',
  OPEN_IDB: '01',
  IDB_ON_UPGRAGE_NEEDED: '02',
  DELETED_DATA: '03',
  DELETE_DATA_FAILED: '04',
  DELETE_DATA_BLOCKED: '05',
  END_VALUE: '00'
};


/**
 * The error reporter for this file.
 *
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.Persist.reportError_ = function(errNum, errId, errInfo) {
  if (goog.DEBUG) {
    if (!tachyfont.reporter) {
      goog.log.error(tachyfont.logger, 'failed to report error');
    }
  }
  if (tachyfont.reporter) {
    tachyfont.reporter.reportError(
        tachyfont.Persist.Error_.FILE_ID + errNum, errId, errInfo);
  }
};


/**
 * Save a data item.
 * @param {Object} idb The IndexedDB object.
 * @param {string} name The name of the item.
 * @param {Array} data The data.
 * @return {goog.Promise} Operation completion.
 */
tachyfont.Persist.saveData = function(idb, name, data) {
  return new goog.Promise(function(resolve, reject) {
    var trans = idb.transaction([name], 'readwrite');
    var store = trans.objectStore(name);
    var request = store.put(data, 0);
    request.onsuccess = function(e) {
      resolve();
    };
    request.onerror = function(e) {
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
    var dbOpen = window.indexedDB.open(dbName,
        tachyfont.IncrementalFont.version);

    dbOpen.onsuccess = function(e) {
      var db = e.target.result;
      resolve(db);
    };
    dbOpen.onerror = function(e) {
      tachyfont.Persist.reportError_(tachyfont.Persist.Error_.OPEN_IDB,
          id, '!!! openIndexedDB "' + dbName + '": ' + e.value);
      reject();
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        tachyfont.Persist.reportError_(
            tachyfont.Persist.Error_.IDB_ON_UPGRAGE_NEEDED,
            id, 'onupgradeneeded error: ' + e.value);
        reject();
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
  return openIdb;
};


/**
 * Delete the fontDB.
 * @param {string} name The name of the data.
 * @param {string} id An additional identifier of the data.
 * @return {goog.Promise} The font DB.
 */
tachyfont.Persist.deleteDatabase = function(name, id) {
  var deleteDb = new goog.Promise(function(resolve, reject) {
    var dbName = tachyfont.IncrementalFont.DB_NAME + '/' + name + '/' + id;
    var req = window.indexedDB.deleteDatabase(dbName);
    req.onsuccess = function() {
      // If the user cleared the data something may be wrong.
      tachyfont.Persist.reportError_(
          tachyfont.Persist.Error_.DELETED_DATA, id,
          'Deleted database successfully');
      resolve();
    };
    req.onerror = function() {
      tachyfont.Persist.reportError_(
          tachyfont.Persist.Error_.DELETE_DATA_FAILED, id,
          'Delete database failed');
      reject(1);
    };
    req.onblocked = function() {
      tachyfont.Persist.reportError_(
          tachyfont.Persist.Error_.DELETE_DATA_BLOCKED, id,
          'Delete database blocked');
      reject(2);
    };
  });
  return deleteDb;
};


/**
 * Get a part of the font.
 *
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
