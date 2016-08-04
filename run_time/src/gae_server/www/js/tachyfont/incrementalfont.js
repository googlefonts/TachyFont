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
goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('goog.math');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Browser');
goog.require('tachyfont.Cmap');
goog.require('tachyfont.DemoBackendService');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Logger');
goog.require('tachyfont.Metadata');
goog.require('tachyfont.Persist');
goog.require('tachyfont.RLEDecoder');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.chainedPromises');
goog.require('tachyfont.promise');
goog.require('tachyfont.utils');


/**
 * The maximum time in milliseconds to hide the text to prevent FOUT.
 *
 * @type {number}
 */
tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS = 3000;


/**
 * The database name.
 * @type {string}
 */
tachyfont.IncrementalFont.DB_NAME = 'incrfonts';


/**
 * The time in milliseconds to wait before persisting the data.
 * @type {number}
 */
tachyfont.IncrementalFont.PERSIST_TIMEOUT = 1000;


/**
 * Enum for logging values.
 * @enum {string}
 * @private
 */
tachyfont.IncrementalFont.Log_ = {
  CREATE_TACHYFONT: 'LIFCT.',
  DB_OPEN: 'LIFOI.',
  IDB_GET_BASE: 'LIFIB.',
  PARSE_HEADER: 'LIFPH.',
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
  PERSIST_SAVE_DATA: '19',
  PERSIST_GET_LOCK: '21',
  SAVE_DATA: '22',
  // 23-24 no longer used.
  DB_OPEN: '25',
  // 26 no longer used.
  GET_DATA: '27',
  // 28-40 no longer used.
  NOT_USING_PERSISTED_DATA: '41',
  FINGERPRINT_MISMATCH: '42',
  CHARS_PER_SEGMENT: '43',
  DELETE_IDB: '44',
  END: '00'
};


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.IncrementalFont.reportError = function(errNum, errId, errInfo) {
  if (goog.DEBUG) {
    if (!tachyfont.Reporter.isReady()) {
      goog.log.error(tachyfont.Logger.logger, 'failed to report error');
    }
  }
  if (tachyfont.Reporter.isReady()) {
    tachyfont.Reporter.reportError(
        tachyfont.IncrementalFont.Error.FILE_ID + errNum, errId, errInfo);
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
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {boolean} dropData If true then drop the persistent data.
 * @param {Object} params Parameters.
 * @return {tachyfont.IncrementalFont.obj} The incremental font manager object.
 */
tachyfont.IncrementalFont.createManager = function(fontInfo, dropData, params) {
  var fontName = fontInfo.getName();
  var weight = fontInfo.getWeight();
  var backendService =
      fontInfo.getFontKit() ?
      new tachyfont.GoogleBackendService(fontInfo.getDataUrl()) :
      new tachyfont.DemoBackendService(fontInfo.getDataUrl());

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

  var incrFontMgr =
      new tachyfont.IncrementalFont.obj(fontInfo, params, backendService);
  tachyfont.Reporter.addItem(
      tachyfont.IncrementalFont.Log_.CREATE_TACHYFONT + weight,
      goog.now() - incrFontMgr.startTime);

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
            tachyfont.IncrementalFont.Log_.DB_OPEN + weight,
            goog.now() - incrFontMgr.startTime);
      })
      .thenCatch(function() {
        // Failed to get database;
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.DB_OPEN, weight, 'createManager');
      });

  // Create a class with initial visibility.
  incrFontMgr.style = tachyfont.IncrementalFontUtils.setVisibility(null,
      fontInfo, initialVisibility);
  // Limit the maximum visibility=hidden time.
  setTimeout(function() {
    tachyfont.IncrementalFontUtils.setVisibility(incrFontMgr.style, fontInfo,
        true);
  }, maxVisibilityTimeout);

  return incrFontMgr;
};



/**
 * IncrFontIDB.obj - A class to handle interacting the IndexedDB.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {Object} params Parameters.
 * @param {!tachyfont.BackendService} backendService object used to generate
 *     backend requests.
 * @constructor
 */
tachyfont.IncrementalFont.obj = function(fontInfo, params, backendService) {
  /**
   * The creation time for this TachyFont.
   * @type {number}
   */
  this.startTime = goog.now();

  /**
   * The current Blob URL. Free this when creating a new one.
   * @private {?string}
   */
  this.blobUrl_ = null;

  /**
   * Information about the fonts
   * @type {!tachyfont.FontInfo}
   */
  this.fontInfo = fontInfo;

  this.fontName = fontInfo.getName();

  /** @private {!Object} Information about the font file */
  this.fileInfo_;

  /**
   * The character to format 4 / format 12 mapping.
   * @private {!Object<number, !tachyfont.CharCmapInfo>}
   */
  this.cmapMapping_;

  this.charsToLoad = {};
  //TODO(bstell): need to fix the request size.
  this.req_size = params['req_size'] || 2200;

  /**
   * True if new characters have been loaded since last setFont
   * @type {boolean}
   */
  this.needToSetFont = false;

  this.url = fontInfo.getDataUrl();
  this.charsURL = '/incremental_fonts/request';
  this.alreadyPersisted = false;
  this.persistInfo = {};
  this.persistInfo[tachyfont.utils.IDB_BASE_DIRTY] = false;
  this.persistInfo[tachyfont.utils.IDB_CHARLIST_DIRTY] = false;
  this.style = null;

  /** @type {!tachyfont.BackendService} */
  this.backendService = backendService;

  // Promises
  this.getIDB_ = null;
  this.base = new tachyfont.promise();
  this.getBase = this.base.getPromise();
  this.charList = new tachyfont.promise();
  this.getCharList = this.charList.getPromise();

  /**
   * The persist operation takes time so serialize them.
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPersistingData_ =
      new tachyfont.chainedPromises('finishPersistingData_');

  /**
   * The character request operation takes time so serialize them.
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPrecedingCharsRequest_ =
      new tachyfont.chainedPromises('finishPrecedingCharsRequest_');

  /**
   * The setFont operation takes time so serialize them.
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPrecedingSetFont_ =
      new tachyfont.chainedPromises('finishPrecedingSetFont_');
};


/**
 * Get the database handle.
 * @return {goog.Promise} The database handle.
 */
tachyfont.IncrementalFont.obj.prototype.getDb = function() {
  if (this.getIDB_) {
    return this.getIDB_;
  }
  return this.accessDb(false);
};


/**
 * Get the cmap mapping
 * @return {!Object<number, !tachyfont.CharCmapInfo>}
 */
tachyfont.IncrementalFont.obj.prototype.getCmapMapping = function() {
  return this.cmapMapping_;
};


/**
 * Set the cmap mapping
 * @param {!Object<number, !tachyfont.CharCmapInfo>} cmapMapping The map of
 *     codepoint to segment mapping.
 */
tachyfont.IncrementalFont.obj.prototype.setCmapMapping = function(cmapMapping) {
  this.cmapMapping_ = cmapMapping;
};


/**
 * Get the file information.
 * @return {!Object}
 */
tachyfont.IncrementalFont.obj.prototype.getFileInfo = function() {
  return this.fileInfo_;
};


/**
 * Set the file information.
 * @param {!Object} fileInfo The file information.
 */
tachyfont.IncrementalFont.obj.prototype.setFileInfo = function(fileInfo) {
  this.fileInfo_ = fileInfo;
};


/**
 * Get the database handle.
 * @return {goog.Promise} The database handle.
 */
tachyfont.IncrementalFont.obj.prototype.dropDb = function() {
  return this.accessDb(true);
};


/**
 * Get the database handle.
 * @param {boolean} dropDb If true then drop the database before opening it.
 * @return {goog.Promise} The database handle.
 */
// TODO(bstell): break this apart an put it into getDb/dropDb and adjust
// callers.
tachyfont.IncrementalFont.obj.prototype.accessDb = function(dropDb) {
  // Close the database if it is open.
  this.closeDb();
  var weight = this.fontInfo.getWeight();
  var dbName = tachyfont.IncrementalFont.getDbName(this.fontInfo);
  this.getIDB_ = goog.Promise.resolve()
      .then(function() {
        if (dropDb) {
          return tachyfont.Persist.deleteDatabase(dbName, weight)
              .thenCatch(function() {
                tachyfont.IncrementalFont.reportError(
                    tachyfont.IncrementalFont.Error.DELETE_IDB, weight,
                    'accessDb');
                return goog.Promise.reject();
              });

        }
      }.bind(this))
      .then(function() {
        return tachyfont.Persist.openIndexedDB(dbName, weight)
            .thenCatch(function() {
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.DB_OPEN, weight,
                  'accessDb');
              return goog.Promise.reject('failed to open IDB');
            });

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
 * Get the font base from persistent store.
 * @return {goog.Promise} The base bytes in DataView.
 */
tachyfont.IncrementalFont.obj.prototype.getBaseFontFromPersistence =
    function() {
  var persistedBase = this.getDb()
      .then(function(idb) {
        var filedata;
        filedata = tachyfont.Persist.getData(idb, tachyfont.utils.IDB_BASE)
            .thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError(
               tachyfont.IncrementalFont.Error.GET_DATA,
               'base ' + this.fontInfo.getWeight(), e);
              return goog.Promise.reject(e);
            }.bind(this));
        return goog.Promise.all([goog.Promise.resolve(idb), filedata]);
      }.bind(this))
      .then(function(arr) {
        tachyfont.Reporter.addItem(tachyfont.IncrementalFont.Log_.IDB_GET_BASE +
            this.fontInfo.getWeight(), goog.now() - this.startTime);
        var idb = arr[0];
        var filedata = new DataView(arr[1]);
        this.parseBaseHeader(filedata);
        var fontData = new DataView(arr[1], this.fileInfo_.headSize);
        return goog.Promise.resolve([idb, this.fileInfo_, fontData]);
      }.bind(this))
      .then(function(arr) {
        return tachyfont.Persist.getData(arr[0], tachyfont.utils.IDB_CHARLIST)
            .then(function(charList) {
              return [arr[1], arr[2], charList];
            },
            function(e) {
              tachyfont.IncrementalFont.reportError(
               tachyfont.IncrementalFont.Error.GET_DATA,
               'charList ' + this.fontInfo.getWeight(), e);
              return goog.Promise.reject(e);
            }.bind(this));
      }.bind(this))
      .then(function(arr) {
        var isOkay = tachyfont.Cmap.checkCharacters(
            this.fileInfo_, arr[1], arr[2], this.cmapMapping_,
            this.fontInfo.getWeight(), true);
        if (isOkay) {
          this.charList.resolve(arr[2]);
          return goog.Promise.resolve([arr[0], arr[1], arr[2]]);
        } else {
          tachyfont.IncrementalFont.reportError(
              tachyfont.IncrementalFont.Error.NOT_USING_PERSISTED_DATA,
              this.fontInfo.getWeight(), '');
          this.charList.resolve({});
          return goog.Promise.resolve(null);
        }
      }.bind(this))
      .thenCatch(function(e) {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
              'font not persisted: ' + this.fontName);
        }
        this.charList.resolve({});
        return goog.Promise.resolve(null);
      }.bind(this));
  return persistedBase;
};


/**
 * Parses base font header, set properties.
 * @param {!DataView} baseFontView Base font with header.
 */
tachyfont.IncrementalFont.obj.prototype.parseBaseHeader =
    function(baseFontView) {
  var binaryEditor = new tachyfont.BinaryFontEditor(baseFontView, 0);
  var fileInfo = binaryEditor.parseBaseHeader();
  if (!fileInfo.headSize) {
    tachyfont.Reporter.addItem(tachyfont.IncrementalFont.Log_.PARSE_HEADER +
        this.fontInfo.getWeight(), goog.now() - this.startTime);
    throw 'missing header info';
  }
  this.fileInfo_ = fileInfo;
  if (!tachyfont.Cmap.isOneCharPerSeg(this.fileInfo_)) {
    tachyfont.IncrementalFont.reportError(
        tachyfont.IncrementalFont.Error.CHARS_PER_SEGMENT,
        this.fontInfo.getWeight(), '');
    throw 'not one-char-per-segment';
  }
  this.cmapMapping_ = tachyfont.IncrementalFontUtils.getCmapMapping(fileInfo);
};


/**
 * Get the font base from a URL.
 * @param {Object} backendService The object that interacts with the backend.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @return {goog.Promise} The base bytes in DataView.
 */
tachyfont.IncrementalFont.obj.prototype.getBaseFontFromUrl =
    function(backendService, fontInfo) {
  var rslt = backendService.requestFontBase(fontInfo)
      .then(function(urlBaseBytes) {
        tachyfont.Reporter.addItem(tachyfont.IncrementalFont.Log_.URL_GET_BASE +
            this.fontInfo.getWeight(), goog.now() - this.startTime);
        var results = this.processUrlBase(urlBaseBytes);
        this.persistDelayed(tachyfont.utils.IDB_CHARLIST);
        this.persistDelayed(tachyfont.utils.IDB_BASE);
        return results;
      }.bind(this));
  return rslt;
};


/**
 * Process the font base fetched from a URL.
 * @param {ArrayBuffer} urlBaseBytes The fetched data.
 * @return {Array<Object>} The fileInfo (information about the font bytes) and
 *     the font data ready for character data to be added.
 */
tachyfont.IncrementalFont.obj.prototype.processUrlBase =
    function(urlBaseBytes) {
  var urlBaseData = new DataView(urlBaseBytes);
  this.parseBaseHeader(urlBaseData);
  var headerData = new DataView(urlBaseBytes, 0, this.fileInfo_.headSize);
  var rleFontData = new DataView(urlBaseBytes, this.fileInfo_.headSize);
  var raw_base = tachyfont.RLEDecoder.rleDecode([headerData, rleFontData]);
  var raw_basefont = new DataView(raw_base.buffer, headerData.byteLength);
  tachyfont.Cmap.writeCmap12(this.fileInfo_, raw_basefont);
  tachyfont.Cmap.writeCmap4(this.fileInfo_, raw_basefont,
      this.fontInfo.getWeight());
  tachyfont.IncrementalFontUtils.writeCharsetFormat2(raw_basefont,
      this.fileInfo_);
  var basefont = tachyfont.IncrementalFontUtils.sanitizeBaseFont(this.fileInfo_,
      raw_basefont);
  return [this.fileInfo_, basefont];
};


/**
 * Inject glyphs in the glyphData to the baseFontView
 * @param {!DataView} baseFontView Current base font
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {!Object<number, Array<number>>} glyphToCodeMap An input and output
 *     value.
 *       Input: the glyph Id to code point mapping;
 *       Output: the glyph Ids that were expected but not in the bundleResponse.
 * @param {!Array<number>} extraGlyphs An output list of the extra glyph Ids.
 * @return {!DataView} Updated base font
 */
tachyfont.IncrementalFont.obj.prototype.injectCharacters =
    function(baseFontView, bundleResponse, glyphToCodeMap, extraGlyphs) {
  // time_start('inject')
  this.fileInfo_.dirty = true;
  var baseBinaryEditor = new tachyfont.BinaryFontEditor(baseFontView, 0);

  var count = bundleResponse.getGlyphCount();
  var flags = bundleResponse.getFlags();
  var glyphDataArray = bundleResponse.getGlyphDataArray();

  var isCff = flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_CFF;
  var offsetDivisor = 1;
  if (!isCff && this.fileInfo_.offsetSize == 2) {
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
    var hmtx;
    var vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
      hmtx = glyphData.getHmtx();
      baseBinaryEditor.setMtxSideBearing(this.fileInfo_.hmtxOffset,
          this.fileInfo_.hmetricCount, id, hmtx);
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
      vmtx = glyphData.getVmtx();
      baseBinaryEditor.setMtxSideBearing(this.fileInfo_.vmtxOffset,
          this.fileInfo_.vmetricCount, id, vmtx);
    }
    var offset = glyphData.getOffset();
    var length = glyphData.getLength();

    if (!isCff) {
      // Set the loca for this glyph.
      baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, id, offset / offsetDivisor);
      var oldNextOne = baseBinaryEditor.getGlyphDataOffset(
          this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
      var newNextOne = offset + length;
      // Set the length of the current glyph (at the loca of nextId).
      baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, nextId, newNextOne / offsetDivisor);

      // Fix the sparse loca values before this new value.
      var prev_id = id - 1;
      while (prev_id >= 0 &&
          baseBinaryEditor.getGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, prev_id) > offset) {
        baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
            this.fileInfo_.offsetSize, prev_id, offset / offsetDivisor);
        prev_id--;
      }
      /*
       * Fix up the sparse loca values after this glyph.
       *
       * If value is changed and length is nonzero we should make the next glyph
       * a dummy glyph(ie: write -1 to make it a composite glyph).
       */
      var isChanged = oldNextOne != newNextOne;
      isChanged = isChanged && nextId < this.fileInfo_.numGlyphs;
      if (isChanged) {
        // Fix the loca value after this one.
        baseBinaryEditor.seek(this.fileInfo_.glyphOffset + newNextOne);
        if (length > 0) {
          baseBinaryEditor.setInt16(-1);
        }else if (length == 0) {
          // If it is still zero, then could write -1.
          var currentUint1 = baseBinaryEditor.getUint32(),
              currentUint2 = baseBinaryEditor.getUint32();
          if (currentUint1 == 0 && currentUint2 == 0) {
            baseBinaryEditor.seek(this.fileInfo_.glyphOffset + newNextOne);
            baseBinaryEditor.setInt16(-1);
          }
        }
      }
    } else {
      baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, id, offset);
      var oldNextOne = baseBinaryEditor.getGlyphDataOffset(
          this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
      baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, nextId, offset + length);
      nextId = id + 2;
      var offsetCount = this.fileInfo_.numGlyphs + 1;
      var currentIdOffset = offset + length, nextIdOffset;
      if (oldNextOne < currentIdOffset && nextId - 1 < offsetCount - 1) {
        baseBinaryEditor.seek(this.fileInfo_.glyphOffset + currentIdOffset);
        baseBinaryEditor.setUint8(14);
      }
      while (nextId < offsetCount) {
        nextIdOffset = baseBinaryEditor.getGlyphDataOffset(
            this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
        if (nextIdOffset <= currentIdOffset) {
          currentIdOffset++;
          baseBinaryEditor.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
              this.fileInfo_.offsetSize, nextId, currentIdOffset);
          if (nextId < offsetCount - 1) {
            baseBinaryEditor.seek(this.fileInfo_.glyphOffset + currentIdOffset);
            baseBinaryEditor.setUint8(14);
          }
          nextId++;
        } else {
          break;
        }
      }
    }

    var bytes = glyphData.getBytes();
    baseBinaryEditor.seek(this.fileInfo_.glyphOffset + offset);
    baseBinaryEditor.setArrayOf(baseBinaryEditor.setUint8, bytes);
  }
  // Set the glyph Ids in the cmap format 12 subtable;
  tachyfont.Cmap.setFormat12GlyphIds(this.fileInfo_, baseFontView,
      glyphIds, glyphToCodeMap, this.cmapMapping_, this.fontInfo.getWeight());

  // Set the glyph Ids in the cmap format 4 subtable;
  tachyfont.Cmap.setFormat4GlyphIds(this.fileInfo_, baseFontView,
      glyphIds, glyphToCodeMap, this.cmapMapping_, this.fontInfo.getWeight());

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
 * @return {goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj.prototype.setFont = function(fontData) {
  var weight = this.fontInfo.getWeight();
  var msg = this.fontInfo.getName() + ' setFont.' + weight;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'setFont.' + weight + ': wait for preceding');
  }
  var finishPrecedingSetFont =
      this.finishPrecedingSetFont_.getChainedPromise(msg);
  finishPrecedingSetFont.getPrecedingPromise()
      .then(function() {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
              'setFont.' + weight + ': done waiting for preceding');
        }
        this.needToSetFont = false;
        return goog.Promise.resolve()
            .then(function() {
              if (goog.DEBUG) {
                goog.log.fine(tachyfont.Logger.logger, 'setFont ' +
                 this.fontInfo.getName());
              }
              return tachyfont.Browser.setFont(fontData, this.fontInfo,
                  this.fileInfo_.isTtf, this.blobUrl_);
            }.bind(this))
            .then(function(newBlobUrl) {
              this.blobUrl_ = newBlobUrl;
              finishPrecedingSetFont.resolve();
            }.bind(this));
      }.bind(this))
      .thenCatch(function(e) {
        if (goog.DEBUG) {
          goog.log.fine(tachyfont.Logger.logger, 'setFont.' + weight +
              ': failed');
        }
        finishPrecedingSetFont.resolve();
      });
  return finishPrecedingSetFont.getPromise();
};


/**
 * Obfuscate small requests to make it harder for a TachyFont server to
 * determine the content on a page.
 * @param {!Array<number>} codes The codepoints to add obusfuscation to.
 * @param {!Object} charlist The chars that have already been requested.
 * @param {!Object<number, !tachyfont.CharCmapInfo>} cmapMapping A map of the
 *     characters in the font.
 * @return {!Array<number>} The codepoints with obusfuscation.
 */
tachyfont.IncrementalFont.possibly_obfuscate =
    function(codes, charlist, cmapMapping) {
  if (tachyfont.utils.noObfuscate == true) {
    return codes;
  }

  // Check if we need to obfuscate the request.
  if (codes.length >= tachyfont.utils.MINIMUM_NON_OBFUSCATION_LENGTH)
    return codes;

  var code_map = {};
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    code_map[code] = code;
  }
  var num_new_codes =
      tachyfont.utils.MINIMUM_NON_OBFUSCATION_LENGTH - codes.length;
  var target_length = tachyfont.utils.MINIMUM_NON_OBFUSCATION_LENGTH;
  var max_tries = num_new_codes * 10 + 100;
  for (var i = 0;
      Object.keys(code_map).length < target_length && i < max_tries;
      i++) {
    var code = codes[i % codes.length];
    var bottom = code - tachyfont.utils.OBFUSCATION_RANGE / 2;
    if (bottom < 0) {
      bottom = 0;
    }
    var top = code + tachyfont.utils.OBFUSCATION_RANGE / 2;
    var newCode = Math.floor(goog.math.uniformRandom(bottom, top + 1));
    if (!cmapMapping[newCode]) {
      // This code is not supported in the font.
      continue;
    }
    var newChar = tachyfont.utils.stringFromCodePoint(newCode);
    if (charlist[newChar] == undefined) {
      code_map[newCode] = newCode;
      charlist[newChar] = 1;
    }
    if (goog.DEBUG) {
      goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
          Object.keys(code_map).length.toString());
    }
  }

  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'before obfuscation: codes.length = ' + codes.length);
    codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.Logger.logger, 'codes = ' + codes);
  }
  var combined_codes = [];
  var keys = Object.keys(code_map);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    combined_codes.push(code_map[key]);
  }
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'after obfuscation: combined_codes.length = ' + combined_codes.length);
    combined_codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.Logger.logger, 'combined_codes = ' +
        combined_codes);
  }
  return combined_codes;
};


/**
 * Load the data for needed chars.
 * TODO(bstell): fix the return value.
 * @return {goog.Promise} Returns the true if characters loaded.
 */
tachyfont.IncrementalFont.obj.prototype.loadChars = function() {
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.Logger.logger, 'loadChars');
  }
  var neededCodes = [];

  var msg = this.fontInfo.getName() + ' loadChars';
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        this.fontInfo.getName() +
        ' updateFonts: wait for preceding char data request');
  }
  var finishPrecedingCharsRequest =
      this.finishPrecedingCharsRequest_.getChainedPromise(msg);
  finishPrecedingCharsRequest.getPrecedingPromise()
      .then(function() {
        return this.calcNeededChars_().then(function(neededCodes_) {
          neededCodes = neededCodes_;
          return this.fetchChars(neededCodes_);
        }.bind(this))
            .then(function(bundleResponse) {
              return this.injectChars(neededCodes, bundleResponse);
            }.bind(this)).then(function() {
              // Persist the data.
              this.persistDelayed(tachyfont.utils.IDB_BASE);
              this.persistDelayed(tachyfont.utils.IDB_CHARLIST);
            }.bind(this))
            .thenCatch(function(e) {
              // No chars to fetch.
              this.closeDb();
            }.bind(this));
      }.bind(this))
      .then(function() {
        // All done getting the char data so release the lock.
        finishPrecedingCharsRequest.resolve();
        if (goog.DEBUG) {
          goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
              'finished loadChars for ' + this.fontName);
        }
      }.bind(this))
      .thenCatch(function(e) {
        // Failed to get the char data so release the lock.
        finishPrecedingCharsRequest.reject('finishPrecedingCharsRequest');
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.LOAD_CHARS_GET_LOCK,
            this.fontInfo.getWeight(), e);
        return goog.Promise.resolve(false);
      }.bind(this));
  return finishPrecedingCharsRequest.getPromise();
};


/**
 * Determine the codepoints that are in the font but not yet loaded.
 * @return {goog.Promise} If successful returns a resolved promise.
 * @private
 */
tachyfont.IncrementalFont.obj.prototype.calcNeededChars_ = function() {
  // Check if there are any new characters.
  var charArray = Object.keys(this.charsToLoad);
  if (charArray.length == 0) {
    return goog.Promise.resolve([]);
  }

  return this.getCharList
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
          if (this.cmapMapping_[code] && !tmp_charlist[c]) {
            neededCodes.push(code);
            tmp_charlist[c] = 1;
          }
        }

        // Report the miss rate/count (*before* obfuscation).
        var missCount = neededCodes.length;
        var missRate = (neededCodes.length * 100) / charArray.length;
        var weight = this.fontInfo.getWeight();
        tachyfont.Reporter.addItem(
           tachyfont.IncrementalFont.Log_.MISS_COUNT + weight, missCount);
        tachyfont.Reporter.addItem(
           tachyfont.IncrementalFont.Log_.MISS_RATE + weight, missRate);
        if (neededCodes.length == 0) {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.Logger.logger, 'no new characters');
          }
          return goog.Promise.reject('no chars to load')
              // Need a '.thenCatch' to stop debugging errors. See
              // https://bugs.chromium.org/p/v8/issues/detail?id=3093
              .thenCatch(function() {});
        }
        neededCodes = tachyfont.IncrementalFont.possibly_obfuscate(neededCodes,
            charlist, this.cmapMapping_);
        if (goog.DEBUG) {
          goog.log.info(tachyfont.Logger.logger, this.fontInfo.getName() + ' ' +
              this.fontInfo.getWeight() + ': load ' + neededCodes.length +
              ' codes:');
          goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER, '' +
              neededCodes);
        }
        var remaining;
        if (this.req_size) {
          remaining = neededCodes.slice(this.req_size);
          neededCodes = neededCodes.slice(0, this.req_size);
        } else {
          remaining = [];
        }
        for (var i = 0; i < neededCodes.length; i++) {
          var c = tachyfont.utils.stringFromCodePoint(neededCodes[i]);
          charlist[c] = 1;
          delete this.charsToLoad[c];
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
 * @param {Array<number>} requestedCodes The codes to be injected.
 * @return {goog.Promise} If successful return a resolved promise.
 */
tachyfont.IncrementalFont.obj.prototype.fetchChars =
    function(requestedCodes) {
  if (requestedCodes.length == 0) {
    return goog.Promise.reject('no chars to fetch');
  }
  return this.backendService.requestCodepoints(this.fontInfo, requestedCodes)
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
 * @param {tachyfont.GlyphBundleResponse} bundleResponse The char request (glyph
 *     bungle) data.
 * @return {goog.Promise} The promise resolves if fingerprint ok else rejects.
 */
tachyfont.IncrementalFont.obj.prototype.checkFingerprint = function(
    bundleResponse) {
  // If no char data then no fingerprint to possibly mismatch.
  if (bundleResponse == null) {
    return goog.Promise.resolve(bundleResponse);
  }
  var base_signature = this.fileInfo_.sha1_fingerprint;
  if (base_signature == bundleResponse.signature) {
    return goog.Promise.resolve(bundleResponse);
  }
  return goog.Promise.reject('reject fingerprint');
};


/**
 * Handle the fingerprint mismatch:
 * - close and drop the database
 * - return a rejected promise
 * @return {goog.Promise} Returns a promise which will eventually reject.
 */
tachyfont.IncrementalFont.obj.prototype.handleFingerprintMismatch =
    function() {
  tachyfont.IncrementalFont.reportError(
      tachyfont.IncrementalFont.Error.FINGERPRINT_MISMATCH,
      this.fontInfo.getWeight(), '');

  return this.dropDb()
      .then(function(db) {
             return goog.Promise.reject('deleted database');
      }.bind(this));
};


/**
 * Inject glyph data and enable the chars in the cmaps.
 * @param {Array<number>} neededCodes The codes to be injected.
 * @param {tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @return {goog.Promise} The list of needed chars.
 */
tachyfont.IncrementalFont.obj.prototype.injectChars = function(neededCodes,
    bundleResponse) {
  return this.getBase
      .then(function(arr) {
        // arr[0] holds fileInfo.
        var fontData = arr[1];
        if (bundleResponse != null) {
          var glyphCount = bundleResponse.getGlyphCount();
          if (glyphCount != 0) {
            this.needToSetFont = true;
          }
          var glyphToCodeMap = {};
          for (var i = 0; i < neededCodes.length; i++) {
            var code = neededCodes[i];
            var charCmapInfo = this.cmapMapping_[code];
            if (charCmapInfo) {
              // Handle multiple codes sharing a glyphId.
              if (glyphToCodeMap[charCmapInfo.glyphId] ==
                 undefined) {
                glyphToCodeMap[charCmapInfo.glyphId] = [];
              }
              glyphToCodeMap[charCmapInfo.glyphId].push(code);
            }
            if (goog.DEBUG) {
              if (!charCmapInfo) {
                goog.log.warning(tachyfont.Logger.logger,
                   'no glyph for codepoint 0x' + code.toString(16));
              }
            }
          }
          var extraGlyphs = [];
          fontData = this.injectCharacters(fontData, bundleResponse,
             glyphToCodeMap, extraGlyphs);
          var missingCodes = Object.keys(glyphToCodeMap);
          if (missingCodes.length != 0) {
            missingCodes = missingCodes.slice(0, 5);
            tachyfont.IncrementalFont.reportError(
               tachyfont.IncrementalFont.Error.LOAD_CHARS_INJECT_CHARS_2,
               this.fontInfo.getWeight(), missingCodes.toString());
          }
          if (goog.DEBUG) {
            if (extraGlyphs.length != 0) {
              // TODO(bstell): this probably belongs somewhere else.
              if (!this.glyphToCodeMap_) {
                this.glyphToCodeMap_ = {};
                var codepoints = Object.keys(this.cmapMapping_);
                for (var j = 0; j < codepoints.length; j++) {
                  var codepoint = parseInt(codepoints[j], 10);
                  var cmapMap = this.cmapMapping_[codepoint];
                  this.glyphToCodeMap_[cmapMap.glyphId] = codepoint;
                }
              }
              for (var j = 0; j < extraGlyphs.length; j++) {
                var extraGlyphId = extraGlyphs[j];
                var codepoint = this.glyphToCodeMap_[extraGlyphId];
                if (codepoint) {
                  goog.log.warning(tachyfont.Logger.logger,
                     'extraGlyphId / codepoint = ' + extraGlyphId +
                     ' / 0x' + parseInt(codepoint, 10).toString(16));
                }
              }
            }
          }
          return goog.Promise.resolve();
        } else {
          return goog.Promise.reject('bundleResponse == null');
        }
      }.bind(this));
};


/**
 * Get the database name for this font.
 * @param {!tachyfont.FontInfo} fontInfo Info about the font.
 * @return {string} The database name.
 */
tachyfont.IncrementalFont.getDbName = function(fontInfo) {
  // TODO(bstell): Add style(slant), stretch(width), variant.
  var dbName = tachyfont.IncrementalFont.DB_NAME + '/' + fontInfo.getName() +
      '/' + fontInfo.getWeight();
  return dbName;
};


/**
 * Save data that needs to be persisted.
 * @param {string} name The name of the data item.
 */
tachyfont.IncrementalFont.obj.prototype.persistDelayed = function(name) {
  var that = this;

  // Note what needs to be persisted.
  if (name == tachyfont.utils.IDB_BASE) {
    this.persistInfo[tachyfont.utils.IDB_BASE_DIRTY] = true;
  } else if (name == tachyfont.utils.IDB_CHARLIST) {
    this.persistInfo[tachyfont.utils.IDB_CHARLIST_DIRTY] = true;
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
tachyfont.IncrementalFont.obj.prototype.persist_ = function(name) {
  var that = this;
  var id = that.fontInfo.getWeight();
  // Wait for any preceding persist operation to finish.
  var msg = this.fontInfo.getName() + ' persist_';
  if (goog.DEBUG) {
    goog.log.log(tachyfont.Logger.logger, goog.log.Level.FINER,
        'updateFonts: wait for preceding persist');
  }
  var finishedPersisting = this.finishPersistingData_.getChainedPromise(msg);
  finishedPersisting.getPrecedingPromise()
      .then(function() {
        // Previous persists may have already saved the data so see if there is
        // anything still to persist.
        var base_dirty = that.persistInfo[tachyfont.utils.IDB_BASE_DIRTY];
        var charlist_dirty =
            that.persistInfo[tachyfont.utils.IDB_CHARLIST_DIRTY];
        if (!base_dirty && !charlist_dirty) {
          // Nothing to persist so release the lock.
          finishedPersisting.resolve();
          return;
        }

        // What ever got in upto this point will get saved.
        that.persistInfo[tachyfont.utils.IDB_BASE_DIRTY] = false;
        that.persistInfo[tachyfont.utils.IDB_CHARLIST_DIRTY] = false;

        // Do the persisting.
        var metadata;
        return that.getDb()
            .then(function(db) {
              // Set the next activity to begin_save.
              return tachyfont.Metadata.beginSave(db, id);
            })
            .then(function(storedMetadata) {
              metadata = storedMetadata;
              if (base_dirty) {
                return that.getBase
                 .then(function(arr) {
                   return goog.Promise.all([that.getDb(),
                     goog.Promise.resolve(arr[0]),
                     goog.Promise.resolve(arr[1])]);
                 })
                 .then(function(arr) {
                   if (goog.DEBUG) {
                     goog.log.fine(tachyfont.Logger.logger, 'save base');
                   }
                   return tachyfont.Persist.saveData(arr[0],
                   [tachyfont.utils.IDB_BASE], [arr[2].buffer])
                   .thenCatch(function(e) {
                     tachyfont.IncrementalFont.reportError(
                     tachyfont.IncrementalFont.Error.SAVE_DATA,
                     'base ' + id, e);
                   });
                 });
              }
            })
            .then(function() {
              if (charlist_dirty) {
                return that.getCharList
                 .then(function(charlist) {
                   return goog.Promise.all([that.getDb(),
                     goog.Promise.resolve(charlist)]);
                 })
                 .then(function(arr) {
                   if (goog.DEBUG) {
                     goog.log.fine(tachyfont.Logger.logger, 'save charlist');
                   }
                   return tachyfont.Persist.saveData(arr[0],
                   [tachyfont.utils.IDB_CHARLIST], [arr[1]])
                   .thenCatch(function(e) {
                     tachyfont.IncrementalFont.reportError(
                     tachyfont.IncrementalFont.Error.SAVE_DATA,
                     'charList ' + id, e);
                   });
                 });
              }
            })
            .then(function() {
              // Set the last activity to save_done.
              return that.getDb().then(function(db) {
                return tachyfont.Metadata.saveDone(db, metadata, id);
              });
            })
            .thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError(
                  tachyfont.IncrementalFont.Error.PERSIST_SAVE_DATA,
                  that.fontInfo.getWeight(), e);
            })
            .then(function() {
              // Done persisting so close the db and release the lock.
              that.closeDb();
              finishedPersisting.resolve();
              if (goog.DEBUG) {
                goog.log.fine(tachyfont.Logger.logger, 'persisted ' + name);
              }
            });
      })
      .thenCatch(function(e) {
        tachyfont.IncrementalFont.reportError(
            tachyfont.IncrementalFont.Error.PERSIST_GET_LOCK,
            that.fontInfo.getWeight(), e);
        // Release the lock.
        finishedPersisting.reject('persisting');
      });
};
