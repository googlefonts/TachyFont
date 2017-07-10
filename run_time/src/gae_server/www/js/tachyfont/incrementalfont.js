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

goog.provide('tachyfont.IncrementalFont');

goog.require('goog.Promise');
goog.require('goog.asserts');
goog.require('goog.math');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Browser');
goog.require('tachyfont.Cmap');
goog.require('tachyfont.CompactCff');
goog.require('tachyfont.Define');
goog.require('tachyfont.DemoBackendService');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Persist');
goog.require('tachyfont.Promise');
goog.require('tachyfont.RLEDecoder');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.Sfnt');
goog.require('tachyfont.SynchronousResolutionPromise');
goog.require('tachyfont.WorkQueue');
goog.require('tachyfont.log');
goog.require('tachyfont.utils');


/**
 * The maximum time in milliseconds to hide the text to prevent FOUT.
 *
 * @type {number}
 */
tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS = 3000;


/**
 * The persistence 'stable' time.
 * If the data has been in persistent store longer than this then the data is
 * considered to be stable; ie: not being automatically cleared. The time is in
 * milliseconds.
 * @type {number}
 */
tachyfont.IncrementalFont.STABLE_DATA_TIME = 24 * 60 * 60 * 1000;


/**
 * The time in milliseconds to wait before persisting the data.
 * @type {number}
 */
tachyfont.IncrementalFont.PERSIST_TIMEOUT = 1000;


/**
 * Enum for logging values.
 * @enum {string}
 */
tachyfont.IncrementalFont.Log = {
  CREATE_TACHYFONT: 'LIFCT.',
  DB_OPEN: 'LIFDO.',
  URL_GET_BASE: 'LIFUB.',
  MISS_COUNT: 'LIFMC.',
  MISS_RATE: 'LIFMR.'
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.IncrementalFont.Error = {
  FILE_ID: 'EIF',
  // 01-16 no longer used.
  LOAD_CHARS_INJECT_CHARS_2: '17',
  LOAD_CHARS_GET_LOCK: '18',
  // 19-24 no longer used.
  DB_OPEN: '25',
  // 26-41 no longer used.
  FINGERPRINT_MISMATCH: '42',
  DELETE_IDB: '44',
  BELOW_STABLE_TIME: '45',
  SET_FONT_PRECEEDING_PROMISE: '48',
  INJECT_FONT_COMPACT: '49',
  // 50 no longer used.
  INJECT_COMPACT: '51',
  COMPACT_GET_DB: '52',
  COMPACT_GET_STORES: '53',
  COMPACT_CHECK_CMAP: '54',
  // 55 no longer used.
  GET_COMPACT_FROM_URL: '56',
  SAVE_NEW_COMPACT: '57',
  DO_NOT_USE_UNCOMPACTED_FONT: '58',
  INJECT_FONT_INJECT_CHARS: '59',
  // 60-62 no longer used.
  REJECTED_GET_COMPACT_CHARLIST: '63',
  GET_BASE_DATA: '64',
  // 65 no longer used.
  SAVE_BASE_DATA: '66',
  SAVE_CHARLIST_DATA: '67',
  END: '00'
};


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.IncrementalFont.reportError = function(errNum, errId, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.IncrementalFont.Error.FILE_ID + errNum, errId, errInfo);
};


/**
 * Gets the incremental font object.
 * This class does the following:
 * 1. Create an incremental font manager object.
 * 2. Open the IndexedDB.
 * 3. Start the operation to get the base.
 * 4. Start the operation to get the list of fetched/not-fetched chars.
 * 5. Create a "@font-face" rule (need the data to make the blob URL).
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {boolean} dropData If true then drop the persistent data.
 * @param {!Object} params Parameters.
 * @return {!tachyfont.IncrementalFont.obj} The incremental font manager object.
 */
tachyfont.IncrementalFont.createManager = function(fontInfo, dropData, params) {
  var fontId = fontInfo.getFontId();
  var backendService =
      fontInfo.getFontKit() ?
      new tachyfont.GoogleBackendService(fontInfo.getDataUrl()) :
      new tachyfont.DemoBackendService(fontInfo.getDataUrl());

  var incrFontMgr =
      new tachyfont.IncrementalFont.obj(fontInfo, params, backendService);
  tachyfont.Reporter.addItem(
      tachyfont.IncrementalFont.Log.CREATE_TACHYFONT + fontId,
      goog.now() - incrFontMgr.startTime_);

  goog.Promise.resolve()
      .then(function() {
        if (dropData) {
          return incrFontMgr.dropDb();
        }
      })
      .then(function() {
        return incrFontMgr.getDb();
      })
      .then(function() {
        // TODO(bstell): probably want to remove this time reporting code.
        tachyfont.Reporter.addItem(
            tachyfont.IncrementalFont.Log.DB_OPEN + fontId,
            goog.now() - incrFontMgr.startTime_);
      })
      .thenCatch(function() {
        // Failed to get database;
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.DB_OPEN, fontId, 'createManager');
      });

  return incrFontMgr;
};



/**
 * IncrFontIDB.obj - A class to handle interacting the IndexedDB.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {!Object} params Parameters.
 * @param {!tachyfont.BackendService} backendService object used to generate
 *     backend requests.
 * @constructor @struct
 */
tachyfont.IncrementalFont.obj = function(fontInfo, params, backendService) {
  var weight = fontInfo.getWeight();
  var fontId = fontInfo.getFontId();

  // Gets the prelude data.
  var prelude = window['tachyfontprelude'] || {};
  var preludeUrls = prelude['urls'] || {};
  var preludeLoaded = prelude['loaded'] || {};

  /**
   * Allow a one time refetch of the Compact font base.
   * @private {boolean}
   */
  this.refetchedCompact_ = false;

  /**
   * The creation time for this TachyFont.
   * @private {number}
   */
  this.startTime_ = goog.now();

  /**
   * Indicates whether the data is stable; ie: not being constantly cleared.
   * @private {boolean}
   */
  this.isStableData_ = false;

  /**
   * The current Blob URL. Free this when creating a new one.
   * @private {?string}
   */
  this.blobUrl_ = preludeUrls[weight] || null;
  // Clear the 'dangling reference'.
  preludeUrls[weight] = undefined;

  /**
   * Information about the fonts
   * @private {!tachyfont.FontInfo}
   */
  // TODO(bstell): make fontInfo private.
  this.fontInfo_ = fontInfo;

  /** @private {!tachyfont.typedef.FileInfo} Information about the font file */
  this.fileInfo_;

  /** @private {boolean} Whether the FileInfo for the font has been read. */
  this.haveReadFileInfo_ = false;

  /** @private {boolean} Whether the font is a TTF or an CFF font. */
  this.isTtf_ = false;

  /** @private {string} The sha1 fingerprint of the font. */
  this.sha1_fingerprint_ = '';

  /** @private {!Object<number, boolean>} A map of the loadable codepoints. */
  this.loadableCodepoints_ = {};

  /** @private {string} */
  this.fontId_ = fontId;

  /** @private {!Object<string, number>} */
  this.charsToLoad_ = {};

  /** @private {number} */
  //TODO(bstell): need to fix the request size.
  this.maximumRequestSize_ = params['req_size'] || 2200;

  /**
   * True if new characters have been loaded since last setFont.
   * If the Prelude code did not set the font then set it even if no new
   * characters are needed.
   * @private {boolean}
   */
  this.needToSetFont_ = !preludeLoaded[weight];

  /** @private {!tachyfont.BackendService} */
  this.backendService_ = backendService;

  /** @private {?goog.Promise<!IDBDatabase,?>} */
  this.getIDB_ = null;

  /**
   * A map of the characters that have been incrementally loaded.
   * The string holds the UTF-16 character and the number is always 1.
   * @private {!tachyfont.Promise.Encapsulated}
   */
  this.compactCharList_ = new tachyfont.Promise.Encapsulated();


  /**
   * The character request operation takes time so serialize them.
   * @private {!tachyfont.Promise.Chained}
   */
  this.finishPrecedingCharsRequest_ =
      new tachyfont.Promise.Chained('finishPrecedingCharsRequest_');

  /**
   * The setFont operation takes time so serialize them.
   * @private {!tachyfont.Promise.Chained}
   */
  this.finishPrecedingSetFont_ =
      new tachyfont.Promise.Chained('finishPrecedingSetFont_');

  /**
   * The worker queue that makes sure the operations are done in order and
   * non-overlapping.
   * @private {!tachyfont.WorkQueue}
   */
  this.workQueue_ = new tachyfont.WorkQueue(this.fontId_);
};


/**
 * Gets whether the font data needs to be pushed to the browser rendering code.
 * @return {!Object<string,number>}
 */
tachyfont.IncrementalFont.obj.prototype.getCharsToLoad = function() {
  return this.charsToLoad_;
};


/**
 * Gets blobUrl member.
 * @return {?string}
 */
tachyfont.IncrementalFont.obj.prototype.getBlobUrl = function() {
  return this.blobUrl_;
};


/**
 * Gets fontInfo member.
 * @return {!tachyfont.FontInfo}
 */
tachyfont.IncrementalFont.obj.prototype.getFontInfo = function() {
  return this.fontInfo_;
};


/**
 * Gets the database handle.
 * @return {!goog.Promise} The database handle.
 */
tachyfont.IncrementalFont.obj.prototype.getDb = function() {
  if (this.getIDB_) {
    return this.getIDB_;
  }
  return this.accessDb(false);
};


/**
 * Gets the cmap mapping
 * @return {!tachyfont.typedef.CmapMapping}
 */
tachyfont.IncrementalFont.obj.prototype.getCmapMapping = function() {
  goog.asserts.assert(this.haveReadFileInfo_);
  return this.fileInfo_.cmapMapping;
};


/**
 * Gets the font name.
 * @return {string}
 */
tachyfont.IncrementalFont.obj.prototype.getFontName = function() {
  return this.fontInfo_.getName();
};


/**
 * Gets the maximum request size.
 * @return {number}
 */
tachyfont.IncrementalFont.obj.prototype.getMaximumRequestSize = function() {
  return this.maximumRequestSize_;
};


/**
 * Gets the file information.
 * @return {!tachyfont.typedef.FileInfo}
 */
tachyfont.IncrementalFont.obj.prototype.getFileInfo = function() {
  goog.asserts.assert(this.haveReadFileInfo_);
  return this.fileInfo_;
};


/**
 * Gets the file information.
 * @return {string}
 */
tachyfont.IncrementalFont.obj.prototype.getFontId = function() {
  return this.fontId_;
};


/**
 * Gets the promise that resolves the db handle.
 * @return {?goog.Promise<!IDBDatabase,?>}
 */
tachyfont.IncrementalFont.obj.prototype.getGetIdb = function() {
  return this.getIDB_;
};


/**
 * Sets the promise that resolves the db handle.
 * @param {?goog.Promise<!IDBDatabase,?>} getIdb A promise for the Db handle.
 */
tachyfont.IncrementalFont.obj.prototype.setGetIdb = function(getIdb) {
  this.getIDB_ = getIdb;
};


/**
 * Set the file information.
 * @param {!tachyfont.typedef.FileInfo} fileInfo The file information.
 */
tachyfont.IncrementalFont.obj.prototype.setFileInfo = function(fileInfo) {
  var codepoints = Object.keys(fileInfo.cmapMapping);
  for (var i = 0; i < codepoints.length; i++) {
    var codepoint = parseInt(codepoints[i], 10);
    this.loadableCodepoints_[codepoint] = true;
  }
  this.isTtf_ = fileInfo.isTtf;
  this.sha1_fingerprint_ = fileInfo.sha1_fingerprint;
  this.fileInfo_ = fileInfo;
  this.haveReadFileInfo_ = true;
};


/**
 * Gets whether the CSS should be updated.
 * @return {boolean}
 */
tachyfont.IncrementalFont.obj.prototype.getNeedToSetFont = function() {
  return this.needToSetFont_ && this.isStableData_;
};


/**
 * Gets the compact charList promise.
 * @return {!goog.Promise<!Object<string, number>,?>}
 */
tachyfont.IncrementalFont.obj.prototype.getCompactCharList = function() {
  return this.compactCharList_.getPromise();
};


/**
 * Sets the compact charList promise.
 * @param {!Object<string, number>} charList The new char list.
 */
tachyfont.IncrementalFont.obj.prototype.setCompactCharList = function(
    charList) {
  this.compactCharList_.resolve(charList);
};


/**
 * Gets the database handle.
 * @return {!goog.Promise} The database handle.
 */
tachyfont.IncrementalFont.obj.prototype.dropDb = function() {
  return this.accessDb(true);
};


/**
 * Gets the database handle.
 * @param {boolean} dropDb If true then drop the database before opening it.
 * @return {!goog.Promise<!IDBDatabase,string>} The database handle.
 */
// TODO(bstell): break this apart an put it into getDb/dropDb and adjust
// callers.
tachyfont.IncrementalFont.obj.prototype.accessDb = function(dropDb) {
  // Close the database if it is open.
  this.closeDb();
  var dbName = this.fontInfo_.getDbName();
  this.getIDB_ =
      goog.Promise.resolve()
          .then(function() {
            if (dropDb) {
              return tachyfont.Persist.deleteDatabase(dbName, this.fontId_)
                  .thenCatch(function() {
                    tachyfont.IncrementalFont.reportError(
                        tachyfont.IncrementalFont.Error.DELETE_IDB,
                        this.fontId_, 'accessDb');
                    return goog.Promise.reject();
                  }.bind(this));
            }
          }.bind(this))
          .then(function() {
            return tachyfont.Persist.openIndexedDB(dbName, this.fontId_)
                .then(function(db) {
                  return tachyfont.Persist
                      .getData(db, tachyfont.Define.METADATA)
                      .then(function(metadata) {
                        var name = tachyfont.Define.CREATED_METADATA_TIME;
                        if (metadata && metadata[name]) {
                          var dataAge = goog.now() - metadata[name];
                          if (dataAge >=
                              tachyfont.IncrementalFont.STABLE_DATA_TIME) {
                            this.isStableData_ = true;
                          } else {
                            tachyfont.IncrementalFont.reportError(
                                tachyfont.IncrementalFont.Error
                                    .BELOW_STABLE_TIME,
                                this.fontId_, '');
                          }
                        }
                        return db;
                      }.bind(this))
                      .thenCatch(function() {
                        // Return the db handle even if there was a problem
                        // getting the age of the data.
                        return db;
                      });
                }.bind(this))
                .thenCatch(function() {
                  tachyfont.IncrementalFont.reportError(
                      tachyfont.IncrementalFont.Error.DB_OPEN, this.fontId_,
                      'accessDb');
                  return goog.Promise.reject('failed to open IDB');
                }.bind(this));

          }.bind(this));

  return this.getIDB_;
};


/**
 * Close the database handle.
 * Closing the database can cause pending transactions to fail so
 * just drop the handle.
 */
tachyfont.IncrementalFont.obj.prototype.closeDb = function() {
  if (!this.getIDB_) {
    return;
  }
  this.getIDB_.then(function(idb) {
        this.getIDB_ = null;
      }.bind(this));
};


/**
 * Gets the compact font base from persistent store.
 * @return {!tachyfont.SynchronousResolutionPromise<
 *               tachyfont.typedef.CompactFontWorkingData,?>}
 *   The Compact font's data, charlist, and metadata.
 */
tachyfont.IncrementalFont.obj.prototype.getCompactFontFromPersistence =
    function() {
  var fontId = this.fontId_;
  var dbName = this.fontInfo_.getDbName();
  return tachyfont.Persist
      .openIndexedDbSynchronousResolutionPromise(dbName, fontId)
      .thenCatch(function(e) {  // TODO(bstell): remove this debug code
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.COMPACT_GET_DB, fontId, e);
        return tachyfont.SynchronousResolutionPromise.reject(e);
      }.bind(this))
      .then(function(db) {
        // TODO(bstell): the concept of a transaction belongs in the
        // persistence level.
        var transaction =
            db.transaction(tachyfont.Define.compactStoreNames, 'readonly');
        return tachyfont.Persist
            // TODO(bstell): Reuse code in readDbTable instead of getStores.
            .getStores(transaction, tachyfont.Define.compactStoreNames)
            .thenCatch(function(e) {  // TODO(bstell): remove this debug code
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.COMPACT_GET_STORES, fontId,
                  e);
              return tachyfont.SynchronousResolutionPromise.reject(e);
            }.bind(this));
      })
      .then(function(arr) {
        // Check there was data.
        var fontData = arr[0];
        var fileInfo = arr[1];
        var charList = arr[2];
        // metadata is in arr[3];
        if (!fontData || !fileInfo || !charList) {
          // Missing data is not nessarily an error
          var missing = 'missing: ' +    //
              (!fontData ? 'f' : '_') +  //
              (!fileInfo ? 'i' : '_') +  //
              (!charList ? 'c' : '_');
          return tachyfont.SynchronousResolutionPromise.reject(missing);
        }
        // TODO(bstell): remove this after 2016-10-11
        if (fontData.byteLength > 3000000) {
          // Due to a bug uncompacted fonts were saved as compacted fonts.
          // Report the data is not there and new data will be fetched.
          tachyfont.IncrementalFont.reportError(
             tachyfont.IncrementalFont.Error.DO_NOT_USE_UNCOMPACTED_FONT,
             fontId, '');
          return tachyfont.SynchronousResolutionPromise.reject();
        }
        var isOkay = tachyfont.Cmap.checkCharacters(
            fileInfo, fontData, charList, fontId, true);
        if (!isOkay) {
          tachyfont.IncrementalFont.reportError(
              tachyfont.IncrementalFont.Error.COMPACT_CHECK_CMAP, fontId, '');
          return tachyfont.SynchronousResolutionPromise.reject();
        }
        return {fontBytes: fontData, fileInfo: fileInfo, charList: charList};
      }.bind(this));
};


/**
 * Gets the Compact font for a TachyFont.
 * @return {!tachyfont.SynchronousResolutionPromise<
 *               ?tachyfont.typedef.CompactFontWorkingData,?>}
 */
tachyfont.IncrementalFont.obj.prototype.getCompactFont = function() {
  // Try to get the base from persistent store.
  return this
      .getCompactFontFromPersistence()  //
      .then(function(compactWorkingData) {
        this.setFileInfo(compactWorkingData.fileInfo);
        this.compactCharList_.resolve(compactWorkingData.charList);
        return compactWorkingData;
      }.bind(this))
      .thenCatch(function() {
        // Not persisted so fetch from the URL.
        return this.getCompactFontFromUrl(this.backendService_, this.fontInfo_)
            .then(function(compactWorkingData) {
              this.setFileInfo(compactWorkingData.fileInfo);
              this.compactCharList_.resolve(compactWorkingData.charList);
              return compactWorkingData;
            }.bind(this))
            .thenCatch(function(e) {
              this.compactCharList_.reject();
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.GET_COMPACT_FROM_URL,
                  this.fontId_, e);
              // Clear the font.
              return tachyfont.CompactCff
                  .clearDataStores(
                      tachyfont.Define.compactStoreNames, this.fontInfo_)
                  .then(function() {
                    return goog.Promise.reject(e);  //
                  });
            }.bind(this));
      }.bind(this));
};


/**
 * Gets the Compact font base from a URL.
 * @param {!Object} backendService The object that interacts with the backend.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @return {!goog.Promise<!tachyfont.typedef.CompactFontWorkingData,?>} The
 *     compact font data, fileInfo, and charList.
 */
tachyfont.IncrementalFont.obj.prototype.getCompactFontFromUrl = function(
    backendService, fontInfo) {
  return backendService
      .requestFontBase(fontInfo)  // Curse you clang formatter.
      .then(function(urlBaseBytes) {
        tachyfont.Reporter.addItem(
            tachyfont.IncrementalFont.Log.URL_GET_BASE + this.fontId_,
            goog.now() - this.startTime_);
        var results = tachyfont.IncrementalFont.processUrlBase(
            urlBaseBytes, this.fontId_, true);
        // Compact the data.
        var uncompactedFileInfo =
            /** @type {!tachyfont.typedef.FileInfo} */ (results[0]);
        var uncompactedFontData = /** @type {!DataView} */ (results[1]);
        var fontTableData = {
          sfnt: tachyfont.Sfnt.getFont(uncompactedFontData),
          fileInfo: uncompactedFileInfo,
          charList: {},
          metadata: {}
        };
        var compactCff = new tachyfont.CompactCff(this.fontId_, fontTableData);
        compactCff.compact();
        var compactFontTableData = compactCff.getTableData();
        return this
            .saveNewCompactFont(compactFontTableData)  //
            .thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.SAVE_NEW_COMPACT,
                  this.fontId_, e);
              // Clear the font.
              return tachyfont.CompactCff.clearDataStores(
                  tachyfont.Define.compactStoreNames, this.fontInfo_)
                  .then(function() {
                    return goog.Promise.reject(e);
                  });
            }.bind(this));
      }.bind(this))
      .then(function(newData) {
        return {
          fontBytes: newData[0],
          charList: newData[2],
          fileInfo: newData[1]
        };
      }.bind(this));
};


/**
 * Saves the Compact data overwriting any previous data.
 * @param {!tachyfont.typedef.FontTableData} fontTableData The compact font
 *     bytes, fileInfo, charList, and metadata.
 * @return {!tachyfont.SynchronousResolutionPromise<!Array<*>,?>} The updated
 *     data.
 */
tachyfont.IncrementalFont.obj.prototype.saveNewCompactFont = function(
    fontTableData) {
  // Update the data.
  var fontId = this.fontId_;
  var dbName = this.fontInfo_.getDbName();
  return tachyfont.Persist
      .openIndexedDbSynchronousResolutionPromise(dbName, fontId)
      .then(function(db) {
        var transaction =
            db.transaction(tachyfont.Define.compactStoreNames, 'readwrite');
        return tachyfont.Persist
            .getStores(transaction, [tachyfont.Define.COMPACT_METADATA])
            .then(function(getData) {
              // TODO(bstell): fix up metadata if needed.
              // TODO(bstell): modify the metadata info to record the current
              // activity.
              var newValues = [
                fontTableData.sfnt.getFontData(),     // fontBytes,
                fontTableData.fileInfo,               // fileInfo,
                fontTableData.charList,               // charList,
                getData[0] || fontTableData.metadata  // metadata
              ];
              return tachyfont.Persist.putStores(
                  transaction, tachyfont.Define.compactStoreNames, newValues);
            }.bind(this));
      }.bind(this));
};


/**
 * Process the font base fetched from a URL.
 * @param {!ArrayBuffer} urlBaseBytes The fetched data.
 * @param {string} fontId A font identifier for error messages.
 * @param {boolean} compact Whether glyph offsets should be compacted.
 * @return {!Array<(!tachyfont.typedef.FileInfo|!DataView)>} The fileInfo and
 *     the font data ready for character data to be added.
 */
tachyfont.IncrementalFont.processUrlBase = function(
    urlBaseBytes, fontId, compact) {
  var fileInfo = tachyfont.BinaryFontEditor.parseBaseHeader(urlBaseBytes);
  var headerData = new DataView(urlBaseBytes, 0, fileInfo.headSize);
  var rleFontData = new DataView(urlBaseBytes, fileInfo.headSize);
  var raw_base = tachyfont.RLEDecoder.rleDecode([headerData, rleFontData]);
  var raw_basefont = new DataView(raw_base.buffer, headerData.byteLength);
  tachyfont.Cmap.writeCmap12(fileInfo, raw_basefont);
  tachyfont.Cmap.writeCmap4(fileInfo, raw_basefont, fontId);
  tachyfont.IncrementalFontUtils.writeCharsetFormat2(raw_basefont, fileInfo);
  var basefont = tachyfont.IncrementalFontUtils.fixGlyphOffsets(
      fileInfo, raw_basefont, compact);
  return [fileInfo, basefont];
};


/**
 * Inject glyphs in the glyphData to the baseFontView
 * @param {!DataView} baseFontView Current base font
 * @param {!tachyfont.typedef.FileInfo} fileInfo File info; eg, offsets to
 *     various tables in the font.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {!Object<number, !Array<number>>} glyphToCodeMap This is both an
 *     input and an output:
 *       Input: the glyph Id to code point mapping;
 *       Output: the glyph Ids that were expected but not in the bundleResponse.
 * @param {!Array<number>} extraGlyphs An output list of the extra glyph Ids.
 * @return {!DataView} Updated base font
 */
tachyfont.IncrementalFont.obj.prototype.injectCharacters = function(
    baseFontView, fileInfo, bundleResponse, glyphToCodeMap, extraGlyphs) {
  goog.asserts.assert(this.haveReadFileInfo_);
  // time_start('inject')
  var baseBinaryEditor = new tachyfont.BinaryFontEditor(baseFontView, 0);

  var count = bundleResponse.getGlyphCount();
  var flags = bundleResponse.getFlags();
  var glyphDataArray = bundleResponse.getGlyphDataArray();

  var isCff = flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_CFF;
  var offsetDivisor = 1;
  if (!isCff && fileInfo.offsetSize == 2) {
    // For the loca "short version":
    //   "The actual local offset divided by 2 is stored."
    offsetDivisor = 2;
  }
  var glyphIds = [];
  for (var i = 0; i < count; i += 1) {
    var glyphData = glyphDataArray[i];
    var id = glyphData.getId();
    glyphIds.push(id);
    var nextId = id + 1;
    tachyfont.IncrementalFontUtils.setMtx(
        flags, glyphData, baseBinaryEditor, fileInfo);

    var offset = glyphData.getOffset();
    var length = glyphData.getLength();

    if (!isCff) {
      // Set the loca for this glyph.
      baseBinaryEditor.setGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, id,
          offset / offsetDivisor);
      var oldNextOne = baseBinaryEditor.getGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId);
      var newNextOne = offset + length;
      // Set the length of the current glyph (at the loca of nextId).
      baseBinaryEditor.setGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId,
          newNextOne / offsetDivisor);

      // Fix the sparse loca values before this new value.
      var prev_id = id - 1;
      while (prev_id >= 0 &&
             baseBinaryEditor.getGlyphDataOffset(
                 fileInfo.glyphDataOffset, fileInfo.offsetSize, prev_id) >
                 offset) {
        baseBinaryEditor.setGlyphDataOffset(
            fileInfo.glyphDataOffset, fileInfo.offsetSize, prev_id,
            offset / offsetDivisor);
        prev_id--;
      }
      /*
       * Fix up the sparse loca values after this glyph.
       *
       * If value is changed and length is nonzero we should make the next glyph
       * a dummy glyph(ie: write -1 to make it a composite glyph).
       */
      var isChanged = oldNextOne != newNextOne;
      isChanged = isChanged && nextId < fileInfo.numGlyphs;
      if (isChanged) {
        // Fix the loca value after this one.
        baseBinaryEditor.seek(fileInfo.glyphOffset + newNextOne);
        if (length > 0) {
          baseBinaryEditor.setInt16(-1);
        }else if (length == 0) {
          // If it is still zero, then could write -1.
          var currentUint1 = baseBinaryEditor.getUint32(),
              currentUint2 = baseBinaryEditor.getUint32();
          if (currentUint1 == 0 && currentUint2 == 0) {
            baseBinaryEditor.seek(fileInfo.glyphOffset + newNextOne);
            baseBinaryEditor.setInt16(-1);
          }
        }
      }
    } else {
      baseBinaryEditor.setGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, id, offset);
      var oldNextOne = baseBinaryEditor.getGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId);
      baseBinaryEditor.setGlyphDataOffset(
          fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId,
          offset + length);
      nextId = id + 2;
      var offsetCount = fileInfo.numGlyphs + 1;
      var currentIdOffset = offset + length, nextIdOffset;
      if (oldNextOne < currentIdOffset && nextId - 1 < offsetCount - 1) {
        baseBinaryEditor.seek(fileInfo.glyphOffset + currentIdOffset);
        baseBinaryEditor.setUint8(14);
      }
      while (nextId < offsetCount) {
        nextIdOffset = baseBinaryEditor.getGlyphDataOffset(
            fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId);
        if (nextIdOffset <= currentIdOffset) {
          currentIdOffset++;
          baseBinaryEditor.setGlyphDataOffset(
              fileInfo.glyphDataOffset, fileInfo.offsetSize, nextId,
              currentIdOffset);
          if (nextId < offsetCount - 1) {
            baseBinaryEditor.seek(fileInfo.glyphOffset + currentIdOffset);
            baseBinaryEditor.setUint8(14);
          }
          nextId++;
        } else {
          break;
        }
      }
    }

    var bytes = glyphData.getBytes();
    baseBinaryEditor.seek(fileInfo.glyphOffset + offset);
    baseBinaryEditor.setArrayOf(baseBinaryEditor.setUint8, bytes);
  }
  // Set the glyph Ids in the cmap format 12 subtable;
  tachyfont.Cmap.setFormat12GlyphIds(
      fileInfo, baseFontView, glyphIds, glyphToCodeMap, this.fontId_);

  // Set the glyph Ids in the cmap format 4 subtable;
  tachyfont.Cmap.setFormat4GlyphIds(
      fileInfo, baseFontView, glyphIds, glyphToCodeMap, this.fontId_);

  // Remove the glyph Ids that were in the bundleResponse and record
  // the extra glyphs.
  for (var i = 0; i < glyphIds.length; i++) {
    if (glyphToCodeMap[glyphIds[i]]) {
      delete glyphToCodeMap[glyphIds[i]];
    } else {
      extraGlyphs.push(glyphIds[i]);
    }
  }

  // time_end('inject')

  return baseFontView;
};


/**
 * Set the \@font-face rule.
 * @param {!DataView} fontData The font dataview.
 * @return {!goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj.prototype.setFont = function(fontData) {
  var msg = this.fontInfo_.getName() + ' setFont.' + this.fontId_;
  var finishPrecedingSetFont =
      this.finishPrecedingSetFont_.getChainedPromise(msg);
  return finishPrecedingSetFont.getPrecedingPromise()
      .then(function() {
        this.needToSetFont_ = false;
        goog.asserts.assert(this.haveReadFileInfo_);
        return tachyfont.Browser
            .setFont(fontData, this.fontInfo_, this.isTtf_, this.blobUrl_)
            .then(function(newBlobUrl) {
              this.blobUrl_ = newBlobUrl;
            }.bind(this));
      }.bind(this))
      .thenCatch(function(e) {
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.SET_FONT_PRECEEDING_PROMISE,
            this.fontId_, e);
        return goog.Promise.reject(e);
      }.bind(this))
      .thenAlways(function() {  //
        finishPrecedingSetFont.resolve();
      });
};


/**
 * Obfuscate small requests to make it harder for a TachyFont server to
 * determine the content on a page.
 * @param {!Array<number>} codes The codepoints to add obusfuscation to.
 * @param {!Object} alreadyRequestedChars The chars that have already been
 *     requested.
 * @param {!Object<number,boolean>} loadableCodepoints A map of the
 *     codepoints supported in the font.
 * @return {!Array<number>} The codepoints with obusfuscation.
 */
tachyfont.IncrementalFont.possibly_obfuscate = function(
    codes, alreadyRequestedChars, loadableCodepoints) {
  if (tachyfont.utils.noObfuscate == true) {
    return codes;
  }

  // Check if we need to obfuscate the request.
  if (codes.length >= tachyfont.Define.MINIMUM_NON_OBFUSCATION_LENGTH)
    return codes;

  var code_map = {};
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    code_map[code] = code;
  }
  var num_new_codes =
      tachyfont.Define.MINIMUM_NON_OBFUSCATION_LENGTH - codes.length;
  var target_length = tachyfont.Define.MINIMUM_NON_OBFUSCATION_LENGTH;
  var max_tries = num_new_codes * 10 + 100;
  for (var i = 0;
      Object.keys(code_map).length < target_length && i < max_tries;
      i++) {
    var code = codes[i % codes.length];
    var bottom = code - tachyfont.Define.OBFUSCATION_RANGE / 2;
    if (bottom < 0) {
      bottom = 0;
    }
    var top = code + tachyfont.Define.OBFUSCATION_RANGE / 2;
    var newCode = Math.floor(goog.math.uniformRandom(bottom, top + 1));
    if (!loadableCodepoints[newCode]) {
      // This code is not supported in the font.
      continue;
    }
    var newChar = tachyfont.utils.stringFromCodePoint(newCode);
    if (alreadyRequestedChars[newChar] == undefined) {
      code_map[newCode] = newCode;
      alreadyRequestedChars[newChar] = 1;
    }
  }

  var combined_codes = [];
  var keys = Object.keys(code_map);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    combined_codes.push(code_map[key]);
  }
  return combined_codes;
};


/**
 * Load the data for needed chars.
 * TODO(bstell): fix the return value.
 * @return {!goog.Promise} Returns the true if characters loaded.
 */
tachyfont.IncrementalFont.obj.prototype.loadChars = function() {
  var neededCodes = [];

  var msg = this.fontInfo_.getName() + ' loadChars';
  var finishPrecedingCharsRequest =
      this.finishPrecedingCharsRequest_.getChainedPromise(msg);
  return finishPrecedingCharsRequest.getPrecedingPromise()
      .then(function() {
        goog.asserts.assert(this.haveReadFileInfo_);
        return this.calcNeededChars()
            .then(function(neededCodes_) {
              neededCodes = neededCodes_;
              return this.fetchChars(neededCodes_);
            }.bind(this))
            .then(function(bundleResponse) {
              if (bundleResponse == null) {
                return goog.Promise.reject('bundleResponse == null');
              }
              var glyphCount = bundleResponse.getGlyphCount();
              if (glyphCount != 0) {
                this.needToSetFont_ = true;
              }
              // Use getCompactCharList as a lock to wait if the font is not yet
              // loaded.
              // TODO(bstell): use a work queue to make sure the operations are
              // correctly serialized.
              return this.getCompactCharList()
                  .then(function() {
                    this.injectCompact(neededCodes, bundleResponse);
                  }.bind(this))
                  .thenCatch(function(e) {
                    // Try fetching the Compact font again and then
                    // injecting.
                    if (this.refetchedCompact_) {
                      return goog.Promise.reject(e);
                    }
                    // To avoid an infinite loop limit the retries.
                    this.refetchedCompact_ = true;
                    return this
                        .getCompactFontFromUrl(
                            this.backendService_, this.fontInfo_)
                        .then(function(compactWorkingData) {
                          this.compactCharList_.resolve(
                              compactWorkingData.charList);
                        }.bind(this))
                        .then(function() {
                          return this.injectCompact(
                              neededCodes, bundleResponse);
                        }.bind(this));
                  }.bind(this))
                  .thenCatch(function(e) {
                    tachyfont.IncrementalFont.reportError(
                        tachyfont.IncrementalFont.Error.INJECT_COMPACT,
                        this.fontId_, e);
                    return tachyfont.CompactCff.clearDataStores(
                        tachyfont.Define.compactStoreNames, this.fontInfo_);
                  }.bind(this));
            }.bind(this))
            .thenCatch(function(e) {
              // No chars to fetch.
              this.closeDb();
            }.bind(this));
      }.bind(this))
      .thenCatch(function(e) {
        // Failed to get the char data so release the lock.
        finishPrecedingCharsRequest.resolve('finishPrecedingCharsRequest');
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.LOAD_CHARS_GET_LOCK, this.fontId_,
            e);
      }.bind(this))
      .thenAlways(function() {  //
        finishPrecedingCharsRequest.resolve();
      });
};


/**
 * Calls the CompactCff injectChars code.
 * @param {!Array<number>} neededCodes The codes to be injected.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse The char request
 *     (glyph bungle) data.
 * @return {!tachyfont.SynchronousResolutionPromise<!tachyfont.CompactCff,?>} A
 *     promise for the CompactCff font.
 */
tachyfont.IncrementalFont.obj.prototype.injectCompact = function(
    neededCodes, bundleResponse) {
  return tachyfont.CompactCff
      .injectChars(this.fontInfo_, neededCodes, bundleResponse)
      .thenCatch(function(e) {
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.INJECT_FONT_INJECT_CHARS,
            this.fontId_, e);
        // Something is wrong with the font so reload it.
        var dbName = this.fontInfo_.getDbName();
        return tachyfont.Persist.deleteDatabase(dbName, this.fontId_)
            .thenCatch(function() {})
            .then(function() {
              return tachyfont.SynchronousResolutionPromise.reject(e);
            });
      }.bind(this))
      .then(function(compactCff) {
        var fontData = compactCff.getSfnt().getFontData();
        goog.asserts.assert(this.haveReadFileInfo_);
        return tachyfont.Browser
            .setFont(fontData, this.fontInfo_, this.isTtf_, this.blobUrl_)
            .then(function(blobUrl) {
              this.blobUrl_ = blobUrl;
              var tables = compactCff.getTableData();
              if (tables && tables[2]) {
                this.compactCharList_.resolve(tables[2]);
              }
              return compactCff;
            }.bind(this))
            .thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.INJECT_FONT_COMPACT,
                  this.fontId_, e);
              return goog.Promise.reject(e);
            }.bind(this));
      }.bind(this));
};


/**
 * Determine the codepoints that are in the font but not yet loaded.
 * @return {!goog.Promise} If successful returns a resolved promise.
 */
tachyfont.IncrementalFont.obj.prototype.calcNeededChars = function() {
  // Check if there are any new characters.
  var charArray = Object.keys(this.charsToLoad_);
  if (charArray.length == 0) {
    return goog.Promise.resolve([]);
  }

  return this.getCompactCharList()
      .thenCatch(
          function(e) {
            // TODO(bstell): should the one time refresh happen here?
            tachyfont.IncrementalFont.reportError(
                tachyfont.IncrementalFont.Error.REJECTED_GET_COMPACT_CHARLIST,
                this.fontId_, e);
            return goog.Promise.reject(e);
          },
          this)
      .then(function(charlist) {
        var neededCodes = [];
        // Make a tmp copy in case we are chunking the requests.
        var tmp_charlist = {};
        for (var key in charlist) {
          tmp_charlist[key] = charlist[key];
        }
        for (var i = 0; i < charArray.length; i++) {
          var c = charArray[i];
          var code = tachyfont.utils.charToCode(c);
          // Check if the font supports the char and it is not loaded.
          if (this.loadableCodepoints_[code] && !tmp_charlist[c]) {
            neededCodes.push(code);
            tmp_charlist[c] = 1;
          }
        }

        // Report the miss rate/count (*before* obfuscation).
        var missCount = neededCodes.length;
        var missRate = (neededCodes.length * 100) / charArray.length;
        tachyfont.Reporter.addItem(
            tachyfont.IncrementalFont.Log.MISS_COUNT + this.fontId_, missCount);
        tachyfont.Reporter.addItem(
            tachyfont.IncrementalFont.Log.MISS_RATE + this.fontId_, missRate);
        if (neededCodes.length == 0) {
          return goog.Promise.reject('no chars to load');
        }
        goog.asserts.assert(this.haveReadFileInfo_);
        neededCodes = tachyfont.IncrementalFont.possibly_obfuscate(
            neededCodes, charlist, this.loadableCodepoints_);
        if (goog.DEBUG) {
          tachyfont.log.info(
              this.fontInfo_.getName() + ' ' + this.fontId_ + ': load ' +
              neededCodes.length + ' codes:');
        }
        var remaining;
        if (this.maximumRequestSize_) {
          remaining = neededCodes.slice(this.maximumRequestSize_);
          neededCodes = neededCodes.slice(0, this.maximumRequestSize_);
        } else {
          remaining = [];
        }
        for (var i = 0; i < neededCodes.length; i++) {
          var c = tachyfont.utils.stringFromCodePoint(neededCodes[i]);
          // Add the character to the charlist.
          charlist[c] = 1;
          delete this.charsToLoad_[c];
        }
        if (remaining.length) {
          setTimeout(function() {
            // TODO(bstell): this is the wrong protocol level to make this call.
            this.loadChars();
          }.bind(this), 1);
        }

        neededCodes.sort(function(a, b) { return a - b; });
        // TODO(bstell): change the return to add a flag that there is more to
        // load.
        return neededCodes;
      }.bind(this));
};


/**
 * Fetch glyph data for the requested codepoints.
 * @param {!Array<number>} requestedCodes The codes to be injected.
 * @return {!goog.Promise} If successful return a resolved promise.
 */
tachyfont.IncrementalFont.obj.prototype.fetchChars =
    function(requestedCodes) {
  if (requestedCodes.length == 0) {
    return goog.Promise.reject('no chars to fetch');
  }
  return this.backendService_.requestCodepoints(this.fontInfo_, requestedCodes)
      .then(function(bundleResponse) {
        return this.checkFingerprint(bundleResponse);
      }.bind(this))
      .thenCatch(function(bundleResponse) {
        return this.handleFingerprintMismatch();
      }.bind(this));
};


/**
 * Check if the font file fingerprint (SHA-1) from the char request matches the
 * fingerprint in the font base.
 * @param {?tachyfont.GlyphBundleResponse} bundleResponse The char request
 *     (glyph bungle) data.
 * @return {!goog.Promise} The promise resolves if fingerprint ok else rejects.
 */
tachyfont.IncrementalFont.obj.prototype.checkFingerprint = function(
    bundleResponse) {
  // If no char data then no fingerprint to possibly mismatch.
  if (bundleResponse == null) {
    return goog.Promise.resolve(bundleResponse);
  }
  goog.asserts.assert(this.haveReadFileInfo_);
  if (this.sha1_fingerprint_ == bundleResponse.signature) {
    return goog.Promise.resolve(bundleResponse);
  }
  return goog.Promise.reject('reject fingerprint');
};


/**
 * Handle the fingerprint mismatch:
 * - close and drop the database
 * - return a rejected promise
 * @return {!goog.Promise} Returns a promise which will eventually reject.
 */
tachyfont.IncrementalFont.obj.prototype.handleFingerprintMismatch = function() {
  tachyfont.IncrementalFont.reportError(
      tachyfont.IncrementalFont.Error.FINGERPRINT_MISMATCH, this.fontId_, '');

  return this.dropDb()
      .then(function(db) {
             return goog.Promise.reject('deleted database');
      }.bind(this));
};


/**
 * Inject glyph data and enable the chars in the cmaps.
 * @param {!DataView} fontData The font data bytes.
 * @param {!Array<number>} neededCodes The codes to be injected.
 * @param {!Object<number, !Array<number>>} glyphToCodeMap A map from the glyph
 *     id to the codepoints.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data.
 */
tachyfont.IncrementalFont.obj.prototype.injectChars = function(
    fontData, neededCodes, glyphToCodeMap, bundleResponse) {
  var extraGlyphs = [];
  fontData = this.injectCharacters(
      fontData, this.fileInfo_, bundleResponse, glyphToCodeMap, extraGlyphs);
  var missingCodes = Object.keys(glyphToCodeMap);
  if (missingCodes.length != 0) {
    missingCodes = missingCodes.slice(0, 5);
    tachyfont.IncrementalFont.reportError(
        tachyfont.IncrementalFont.Error.LOAD_CHARS_INJECT_CHARS_2, this.fontId_,
        missingCodes.toString());
  }
};


/**
 * Adds a task to the worker queue.
 * @param {function(?)} taskFunction The function to call.
 * @param {*} data The data to pass to the function.
 * @return {!tachyfont.WorkQueue.Task} The task object.
 */
tachyfont.IncrementalFont.obj.prototype.addTask = function(taskFunction, data) {
  var task = this.workQueue_.addTask(taskFunction, data, this.fontId_);
  return task;
};
