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
goog.require('goog.log.Level');
goog.require('goog.math');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.CharCmapInfo');
goog.require('tachyfont.DemoBackendService');
goog.require('tachyfont.FontInfo');
goog.require('tachyfont.GoogleBackendService');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.RLEDecoder');
goog.require('tachyfont.chainedPromises');
goog.require('tachyfont.promise');
goog.require('tachyfont.utils');


/**
 * tachyfont.IncrementalFont - A sub-namespace.
 */
tachyfont.IncrementalFont = function() {
};


/**
 * The IndexedDB version.
 * Increment this number every time there is a change in the schema.
 *
 * @type {number}
 */
tachyfont.IncrementalFont.version = 1;


/**
 * The maximum time in milliseconds to hide the text to prevent FOUT.
 *
 * @type {number}
 */
tachyfont.IncrementalFont.MAX_HIDDEN_MILLISECONDS = 3000;


/**
 * The database name.
 *
 * @type {string}
 */
tachyfont.IncrementalFont.DB_NAME = 'incrfonts';


/**
 * The time in milliseconds to wait before persisting the data.
 *
 * @type {number}
 */
tachyfont.IncrementalFont.PERSIST_TIMEOUT = 1000;


/**
 * The base name.
 *
 * @type {string}
 */
tachyfont.IncrementalFont.BASE = 'base';


/**
 * The base is dirty (needs to be persisted) key.
 *
 * @type {string}
 */
tachyfont.IncrementalFont.BASE_DIRTY = 'base_dirty';


/**
 * The char list name.
 *
 * @type {string}
 */
tachyfont.IncrementalFont.CHARLIST = 'charlist';


/**
 * The charlist is dirty (needs to be persisted) key.
 *
 * @type {string}
 */
tachyfont.IncrementalFont.CHARLIST_DIRTY = 'charlist_dirty';


/**
 * The addItem/addItemTime constants.
 */
/** @private {string} */
tachyfont.IncrementalFont.LOG_OPEN_IDB_ = 'oi';


/** @private {string} */
tachyfont.IncrementalFont.LOG_IDB_GET_CHARLIST_ = 'ic';


/** @private {string} */
tachyfont.IncrementalFont.LOG_IDB_GET_BASE_ = 'ib';


/** @private {string} */
tachyfont.IncrementalFont.LOG_PARSE_HEADER_ = 'ph';


/** @private {string} */
tachyfont.IncrementalFont.LOG_URL_GET_BASE_ = 'ub';


/** @private {string} */
tachyfont.IncrementalFont.LOG_MISS_COUNT_ = 'mc';


/** @private {string} */
tachyfont.IncrementalFont.LOG_MISS_RATE_ = 'mr';


/** @private {number} */
tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_ = 50;


/**
 * The reportError constants.
 */
/** @private {string} */
tachyfont.IncrementalFont.ERROR_FILE_ID_ = 'if';


/** @private {number} */
tachyfont.IncrementalFont.ERROR_WRITE_CMAP4_SEGMENT_COUNT_ = 1;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_COUNT_ = 2;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_END_CODE_ = 3;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_LENGTH_ = 4;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_START_CODE_ = 5;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_ALREADY_SET_ = 6;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_ID_RANGE_OFFSET_ = 7;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_CHAR_CMAP_INFO_ = 8;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_ = 9;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_CHAR_CMAP_INFO_ = 10;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_START_CODE_ = 11;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_END_CODE_ = 12;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_SEGMENT_LENGTH_ = 13;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_ALREADY_SET_ = 14;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_MISMATCH_ = 15;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_LOAD_CHARS_INJECT_CHARS_ = 16;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_LOAD_CHARS_INJECT_CHARS_2_ = 17;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_LOAD_CHARS_GET_LOCK_ = 18;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_PERSIST_SAVE_DATA_ = 19;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_PERSIST_GET_LOCK_ = 21;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_SAVE_DATA_ = 22;

// /* * @private {number} */
// tachyfont.IncrementalFont.ERROR_SAVE_DATA_2_ = 23;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_SAVE_DATA_GET_IDB_ = 24;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_OPEN_IDB_ = 25;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_IDB_ON_UPGRAGE_NEEDED_ = 26;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_GET_DATA_ = 27;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_CMAP4_CHARS_PER_SEGMENT_ = 28;


/** @private {number} */
tachyfont.IncrementalFont.ERROR_CMAP12_CHARS_PER_SEGMENT_ = 29;


/**
 * The error reporter for this file.
 *
 * @param {number} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 * @private
 */
tachyfont.IncrementalFont.reportError_ = function(errNum, errId, errInfo) {
  if (goog.DEBUG) {
    if (!tachyfont.reporter) {
      debugger; // Failed to report error.
      goog.log.error(tachyfont.logger, 'failed to report error');
    }
  }
  if (tachyfont.reporter) {
    tachyfont.reporter.reportError(
        tachyfont.IncrementalFont.ERROR_FILE_ID_ + errNum, errId, errInfo);
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
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {Object} params Optional parameters.
 * @return {tachyfont.IncrementalFont.obj_} The incremental font manager object.
 */
tachyfont.IncrementalFont.createManager = function(fontInfo, params) {
  var fontName = fontInfo.getName();
  var weight = fontInfo.getWeight();
  var backendService =
      fontInfo.getFontKit() ?
      new tachyfont.GoogleBackendService(fontInfo.getUrl()) :
      new tachyfont.DemoBackendService(fontInfo.getUrl());

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
  //   goog.log.info(tachyfont.logger,
  //     'check to see if a webfont is in cache');
  // }
  var incrFontMgr =
      new tachyfont.IncrementalFont.obj_(fontInfo, params, backendService);
  //tachyfont.timer1.start('openIndexedDB.open ' + fontName);
  //  tachyfont.IncrementalFontUtils.logger(incrFontMgr.url,
  //    'need to report info');
  /*
  if (goog.DEBUG) {
    goog.log.info(tachyfont.logger, 'It would be good to report status of:\n' +
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
  incrFontMgr.getIDB_.then(function() {
        tachyfont.reporter.addItemTime(
            tachyfont.IncrementalFont.LOG_OPEN_IDB_ + weight,
            tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_);
      });
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
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
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
        tachyfont.reporter.addItemTime(
            tachyfont.IncrementalFont.LOG_IDB_GET_CHARLIST_ + weight,
            tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_);
        return charlist_data;
        // }).thenCatch(function(e) {
        //   tachyfont.IncrementalFont.reportError_( 20, weight, e);
      });

  if (tachyfont.buildDemo) {
    tachyfont.buildDemo = false;
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
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {Object} params Optional parameters.
 * @param {!tachyfont.BackendService} backendService object used to generate
 *     backend requests.
 * @constructor
 * @private
 */
tachyfont.IncrementalFont.obj_ = function(fontInfo, params, backendService) {
  /**
   * Information about the fonts
   *
   * @type {!tachyfont.FontInfo}
   */
  this.fontInfo = fontInfo;

  this.fontName = fontInfo.getName();

  /** @private {!Object} Information about the font file */
  this.fileInfo_;

  /**
   * Indicates if the cmap may be easily kept accurate.
   * @type {boolean}
   */
  this.hasOneCharPerSeg = false;

  /**
   * The character to format 4 / format 12 mapping.
   *
   * @private {Object.<number, !tachyfont.CharCmapInfo>}
   */
  this.cmapMapping_;

  this.charsToLoad = {};
  //TODO(bstell): need to fix the request size.
  this.req_size = params['req_size'] || 2200;

  /**
   * True if new characters have been loaded since last setFont
   *
   * @type {boolean}
   */
  this.needToSetFont = false;

  this.url = fontInfo.getUrl();
  this.charsURL = '/incremental_fonts/request';
  this.alreadyPersisted = false;
  this.persistData = true;
  this.persistInfo = {};
  this.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = false;
  this.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = false;
  this.style = null;

  /** @type {!tachyfont.BackendService} */
  this.backendService = backendService;

  if (params['persistData'] == false || !tachyfont.persistData) {
    this.persistData = false;
  }

  // Promises
  this.getIDB_ = null;
  this.base = new tachyfont.promise();
  this.getBase = this.base.getPromise();
  this.getCharList = null;

  /**
   * The persist operation takes time so serialize them.
   *
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPersistingData_ = new tachyfont.chainedPromises();
  if (goog.DEBUG) {
    this.finishPersistingData_.setDebugMessage('finishPersistingData_');
  }

  /**
   * The character request operation takes time so serialize them.
   *
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPrecedingCharsRequest_ = new tachyfont.chainedPromises();
  if (goog.DEBUG) {
    this.finishPrecedingCharsRequest_.setDebugMessage(
        'finishPrecedingCharsRequest_');
  }

  /**
   * The setFont operation takes time so serialize them.
   *
   * @private {!tachyfont.chainedPromises}
   */
  this.finishPrecedingSetFont_ = new tachyfont.chainedPromises();
  if (goog.DEBUG) {
    this.finishPrecedingSetFont_.setDebugMessage('finishPrecedingSetFont_');
  }
};


/**
 * Get the font base from persistent store.
 * @return {goog.Promise} The base bytes in DataView.
 */
tachyfont.IncrementalFont.obj_.prototype.getPersistedBase = function() {
  var persistedBase = this.getIDB_.
      then(function(idb) {
        var filedata;
        if (tachyfont.persistData) {
          filedata = this.getData_(idb, tachyfont.IncrementalFont.BASE);
        } else {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger,
                'not using persisting data: ' + this.fontName);
          }
          filedata = goog.Promise.resolve(null);
        }
        return goog.Promise.all([goog.Promise.resolve(idb), filedata]);
      }.bind(this)).
      then(function(arr) {
        tachyfont.reporter.addItemTime(
            tachyfont.IncrementalFont.LOG_IDB_GET_BASE_ +
            this.fontInfo.getWeight(),
            tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_);
        var idb = arr[0];
        var filedata = new DataView(arr[1]);
        this.parseBaseHeader(filedata);
        var fontData = new DataView(arr[1], this.fileInfo_.headSize);
        return goog.Promise.all([goog.Promise.resolve(this.fileInfo_),
              goog.Promise.resolve(fontData)]);
      }.bind(this)).
      thenCatch(function(e) {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'font not persisted: ' + this.fontName);
        }
        return goog.Promise.resolve(null);
      }.bind(this));
  return persistedBase;
};


/**
 * Parses base font header, set properties.
 * @param {DataView} baseFontView Base font with header.
 */
tachyfont.IncrementalFont.obj_.prototype.parseBaseHeader =
    function(baseFontView) {
  var binEd = new tachyfont.BinaryFontEditor(baseFontView, 0);
  var fileInfo = binEd.parseBaseHeader();
  if (!fileInfo.headSize) {
    tachyfont.reporter.addItemTime(
        tachyfont.IncrementalFont.LOG_PARSE_HEADER_ + this.fontInfo.getWeight(),
        tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_);
    throw 'missing header info';
  }
  this.fileInfo_ = fileInfo;
  this.determineIfOneCharPerSeg();
  this.cmapMapping_ = tachyfont.IncrementalFontUtils.getCmapMapping(fileInfo);
};


/**
 * Get the font base from a URL.
 * @param {Object} backendService The object that interacts with the backend.
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @return {goog.Promise} The base bytes in DataView.
 */
tachyfont.IncrementalFont.obj_.prototype.getUrlBase =
    function(backendService, fontInfo) {
  var rslt = backendService.requestFontBase(fontInfo).
      then(function(fetchedBytes) {
        tachyfont.reporter.addItemTime(
            tachyfont.IncrementalFont.LOG_URL_GET_BASE_ +
            this.fontInfo.getWeight(),
            tachyfont.IncrementalFont.LOG_TIME_BUCKET_SIZE_);
        var results = this.processUrlBase_(fetchedBytes);
        this.persistDelayed_(tachyfont.IncrementalFont.BASE);
        return results;
      }.bind(this));
  return rslt;
};


/**
 * Process the font base fetched from a URL.
 * @param {ArrayBuffer} fetchedBytes The fetched data.
 * @return {Array.<Object>} The fileInfo (information about the font bytes) and
 *     the font data ready for character data to be added.
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.processUrlBase_ =
    function(fetchedBytes) {
  //tachyfont.timer1.start('uncompact base');
  var fetchedData = new DataView(fetchedBytes);
  this.parseBaseHeader(fetchedData);
  var headerData = new DataView(fetchedBytes, 0, this.fileInfo_.headSize);
  var rleFontData = new DataView(fetchedBytes, this.fileInfo_.headSize);
  var raw_base = tachyfont.RLEDecoder.rleDecode([headerData, rleFontData]);
  var raw_basefont = new DataView(raw_base.buffer, headerData.byteLength);
  this.writeCmap12(raw_basefont);
  this.writeCmap4(raw_basefont);
  tachyfont.IncrementalFontUtils.writeCharsetFormat2(raw_basefont,
      this.fileInfo_);
  var basefont = tachyfont.IncrementalFontUtils.sanitizeBaseFont(this.fileInfo_,
      raw_basefont);
  //tachyfont.timer1.end('uncompact base');
  return [this.fileInfo_, basefont];
};


/**
 * Parses base font header, set properties.
 * @param {!DataView} baseFontView Base font with header.
 */
tachyfont.IncrementalFont.obj_.prototype.writeCmap12 = function(baseFontView) {
  if (!this.fileInfo_.compact_gos.cmap12) {
    return;
  }
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      this.fileInfo_.cmap12.offset + 16);
  var nGroups = this.fileInfo_.cmap12.nGroups;
  var segments = this.fileInfo_.compact_gos.cmap12.segments;
  for (var i = 0; i < nGroups; i++) {
    binEd.setUint32(segments[i][0]);
    binEd.setUint32(segments[i][0] + segments[i][1] - 1);
    if (this.hasOneCharPerSeg) {
      binEd.setUint32(0);
    } else {
      binEd.setUint32(segments[i][2]);
    }
  }
};


/**
 * Parses base font header, set properties.
 * @param {!DataView} baseFontView Base font with header.
 */
tachyfont.IncrementalFont.obj_.prototype.writeCmap4 = function(baseFontView) {
  if (!this.fileInfo_.compact_gos.cmap4) {
    return;
  }
  var segments = this.fileInfo_.compact_gos.cmap4.segments;
  var glyphIdArray = this.fileInfo_.compact_gos.cmap4.glyphIdArray;
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      this.fileInfo_.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    tachyfont.IncrementalFont.reportError_(
        tachyfont.IncrementalFont.ERROR_WRITE_CMAP4_SEGMENT_COUNT_,
        this.fontInfo.getWeight(), 'segCount=' + segCount +
        ', segments.length=' + segments.length);
  }
  var glyphIdArrayLen = (this.fileInfo_.cmap4.length - 16 - segCount * 8) / 2;
  this.fileInfo_.cmap4.segCount = segCount;
  this.fileInfo_.cmap4.glyphIdArrayLen = glyphIdArrayLen;
  binEd.skip(6); //skip searchRange,entrySelector,rangeShift
  // Write endCode values.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][1]);
  }
  binEd.skip(2);//skip reservePad
  // Write startCode values.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][0]);
  }
  // Write idDelta values.
  for (var i = 0; i < segCount; i++) {
    if (this.hasOneCharPerSeg) {
      // Make the single code point in this segment point to .notdef.
      var startCode = segments[i][0];
      binEd.setUint16(0x10000 - startCode);
    } else {
      // Use the normal starting glyphId
      binEd.setUint16(segments[i][2]);
    }
  }
  // Write idRangeOffset vValues.
  for (var i = 0; i < segCount; i++) {
    binEd.setUint16(segments[i][3]);
  }
  // Write glyphIdArray values.
  if (glyphIdArrayLen > 0) {
    binEd.setArrayOf(binEd.setUint16, glyphIdArray);
  }
};


/**
 * Inject glyphs in the glyphData to the baseFontView
 * @param {DataView} baseFontView Current base font
 * @param {tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {Object.<number, Array.<number>>} glyphToCodeMap  The glyph Id to
 *     code point mapping;
 * @return {DataView} Updated base font
 */
tachyfont.IncrementalFont.obj_.prototype.injectCharacters =
    function(baseFontView, bundleResponse, glyphToCodeMap) {
  // time_start('inject')
  this.fileInfo_.dirty = true;
  var bundleBinEd = bundleResponse.getFontEditor();
  var baseBinEd = new tachyfont.BinaryFontEditor(baseFontView, 0);

  var count = bundleResponse.getGlyphCount();
  var flags = bundleResponse.getFlags();

  var isCFF = flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_CFF;
  var offsetDivisor = 1;
  if (!isCFF && this.fileInfo_.offsetSize == 2) {
    // For the loca "short version":
    //   "The actual local offset divided by 2 is stored."
    offsetDivisor = 2;
  }
  var glyphIds = [];
  for (var i = 0; i < count; i += 1) {
    var id = bundleBinEd.getUint16();
    glyphIds.push(id);
    var nextId = id + 1;
    var hmtx, vmtx;
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_HMTX) {
      hmtx = bundleBinEd.getUint16();
      baseBinEd.setMtxSideBearing(this.fileInfo_.hmtxOffset,
          this.fileInfo_.hmetricCount, id, hmtx);
    }
    if (flags & tachyfont.IncrementalFontUtils.FLAGS.HAS_VMTX) {
      vmtx = bundleBinEd.getUint16();
      baseBinEd.setMtxSideBearing(this.fileInfo_.vmtxOffset,
          this.fileInfo_.vmetricCount, id, vmtx);
    }
    var offset = bundleBinEd.getUint32();
    var length = bundleBinEd.getUint16();

    if (!isCFF) {
      // Set the loca for this glyph.
      baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, id, offset / offsetDivisor);
      var oldNextOne = baseBinEd.getGlyphDataOffset(
          this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
      var newNextOne = offset + length;
      // Set the length of the current glyph (at the loca of nextId).
      baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, nextId, newNextOne / offsetDivisor);

      // Fix the sparse loca values before this new value.
      var prev_id = id - 1;
      while (prev_id >= 0 &&
              baseBinEd.getGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, prev_id) > offset) {
        baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
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
        baseBinEd.seek(this.fileInfo_.glyphOffset + newNextOne);
        if (length > 0) {
          baseBinEd.setInt16(-1);
        }else if (length == 0) {
          /*if it is still zero,then could write -1*/
          var currentUint1 = baseBinEd.getUint32(),
              currentUint2 = baseBinEd.getUint32();
          if (currentUint1 == 0 && currentUint2 == 0) {
            baseBinEd.seek(this.fileInfo_.glyphOffset + newNextOne);
            baseBinEd.setInt16(-1);
          }
        }
      }
    } else {
      baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, id, offset);
      var oldNextOne = baseBinEd.getGlyphDataOffset(
          this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
      baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
          this.fileInfo_.offsetSize, nextId, offset + length);
      nextId = id + 2;
      var offsetCount = this.fileInfo_.numGlyphs + 1;
      var currentIdOffset = offset + length, nextIdOffset;
      if (oldNextOne < currentIdOffset && nextId - 1 < offsetCount - 1) {
        baseBinEd.seek(this.fileInfo_.glyphOffset + currentIdOffset);
        baseBinEd.setUint8(14);
      }
      while (nextId < offsetCount) {
        nextIdOffset = baseBinEd.getGlyphDataOffset(
            this.fileInfo_.glyphDataOffset, this.fileInfo_.offsetSize, nextId);
        if (nextIdOffset <= currentIdOffset) {
          currentIdOffset++;
          baseBinEd.setGlyphDataOffset(this.fileInfo_.glyphDataOffset,
              this.fileInfo_.offsetSize, nextId, currentIdOffset);
          if (nextId < offsetCount - 1) {
            baseBinEd.seek(this.fileInfo_.glyphOffset + currentIdOffset);
            baseBinEd.setUint8(14);
          }
          nextId++;
        } else {
          break;
        }
      }
    }

    var bytes = bundleBinEd.getArrayOf(bundleBinEd.getUint8, length);
    baseBinEd.seek(this.fileInfo_.glyphOffset + offset);
    baseBinEd.setArrayOf(baseBinEd.setUint8, bytes);
  }
  if (this.hasOneCharPerSeg) {
    // Set the glyph Ids in the cmap format 12 subtable;
    this.setFormat12GlyphIds_(baseFontView, glyphIds, glyphToCodeMap);

    // Set the glyph Ids in the cmap format 4 subtable;
    this.setFormat4GlyphIds_(baseFontView, glyphIds, glyphToCodeMap);
  }

  // time_end('inject')

  return baseFontView;
};


/**
 * Set the format 4 glyph Ids.
 *
 * Note: this is not well tested.
 *
 * @param {DataView} baseFontView Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.setFormat4GlyphIds_ =
    function(baseFontView, glyphIds, glyphToCodeMap) {
  if (!this.fileInfo_.compact_gos.cmap4) {
    return;
  }
  var weight = this.fontInfo.getWeight();
  var segments = this.fileInfo_.compact_gos.cmap4.segments;
  var binEd = new tachyfont.BinaryFontEditor(baseFontView,
      this.fileInfo_.cmap4.offset + 6);
  var segCount = binEd.getUint16() / 2;
  if (segCount != segments.length) {
    tachyfont.IncrementalFont.reportError_(
        tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_COUNT_,
        weight, 'segCount=' + segCount + ', segments.length=' +
        segments.length);
    return;
  }
  binEd.seek(8);
  for (var i = 0; i < segCount; i++) {
    // Check the end code.
    var segEndCode = binEd.getUint16();
    if (segEndCode != segments[i][1]) {
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_END_CODE_,
          weight, 'segment ' + i + ': segEndCode (' + segEndCode +
          ') != segments[' + i + '][1] (' + segments[i][1] + ')');
      return;
    }
    // Check the segment is one char long
    if (segEndCode != segments[i][0]) {
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_LENGTH_,
          weight, 'segment ' + i +
          ' is ' + (segments[i][1] - segments[i][0] + 1) + ' chars long');
      return;
    }
  }
  binEd.skip(2);//skip reservePad
  for (var i = 0; i < segCount; i++) {
    var segStartCode = binEd.getUint16();
    if (segStartCode != segments[i][0]) {
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_START_CODE_,
          weight, 'segment ' + i +
          ': segStartCode (' + segStartCode + ') != segments[' + i + '][1] (' +
          segments[i][0] + ')');
      return;
    }
  }
  var idDeltaOffset = binEd.tell();
  for (var i = 0; i < segCount; i++) {
    var segIdDelta = binEd.getUint16();
    var segGlyphId = (segIdDelta + segments[i][0]) & 0xFFFF;
    if (segGlyphId != 0) {
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_ALREADY_SET_,
          weight, 'format 4 segment ' + i + ': segIdDelta (' + segIdDelta +
          ') != segments[' + i + '][1] (' + segments[i][2] + ')');
      if (goog.DEBUG) {
        if (segIdDelta == segments[i][2]) {
          goog.log.info(tachyfont.logger, 'format 4 segment ' + i +
              ': segIdDelta already set');
        }
        return;
      }
    }
  }
  for (var i = 0; i < segCount; i++) {
    var segIdRangeOffset = binEd.getUint16();
    if (segIdRangeOffset != 0) {
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_ID_RANGE_OFFSET_,
          weight, 'format 4 segment ' + i + ': segIdRangeOffset (' +
          segIdRangeOffset + ') != 0');
      return;
    }
  }
  for (var i = 0; i < glyphIds.length; i++) {
    // Set the glyph Id
    var glyphId = glyphIds[i];
    var codes = glyphToCodeMap[glyphId];
    if (codes == undefined) {
      continue;
    }
    for (var j = 0; j < codes.length; j++) {
      var code = codes[0];
      if (goog.DEBUG) {
        goog.log.info(tachyfont.logger, 'format 4: code = ' + code);
      }
      var charCmapInfo = this.cmapMapping_[code];
      if (!charCmapInfo) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_CHAR_CMAP_INFO_,
            weight, 'format 4, code ' + code + ': no CharCmapInfo');
        continue;
      }
      var format4Seg = charCmapInfo.format4Seg;
      if (format4Seg == null) {
        if (code <= 0xFFFF) {
          tachyfont.IncrementalFont.reportError_(
              tachyfont.IncrementalFont.ERROR_FORMAT4_GLYPH_IDS_SEGMENT_,
              weight, 'format 4, missing segment for code ' + code);
        }
        // Character is not in the format 4 segment.
        continue;
      }
      binEd.seek(idDeltaOffset + format4Seg * 2);
      binEd.setUint16(segments[format4Seg][2]);
    }
  }
};


/**
 * Set the format 12 glyph Ids.
 *
 * @param {DataView} baseFontView Current base font
 * @param {Array.<number>} glyphIds The glyph Ids to set.
 * @param {Object.<number, Array.<number>>} glyphToCodeMap The glyph Id to code
 *     point mapping;
 * @private
 */
tachyfont.IncrementalFont.obj_.prototype.setFormat12GlyphIds_ =
    function(baseFontView, glyphIds, glyphToCodeMap) {
  if (!this.fileInfo_.cmap12) {
    return;
  }
  var weight = this.fontInfo.getWeight();
  var segEd = new tachyfont.BinaryFontEditor(baseFontView,
      this.fileInfo_.cmap12.offset + 16);
  var segments = this.fileInfo_.compact_gos.cmap12.segments;
  for (var i = 0; i < glyphIds.length; i += 1) {
    var id = glyphIds[i];
    var codes = glyphToCodeMap[id];
    if (codes == undefined) {
      continue;
    }
    for (var j = 0; j < codes.length; j++) {
      var code = codes[0];
      if (goog.DEBUG) {
        goog.log.log(tachyfont.logger, goog.log.Level.FINER,
            'format 12: code = ' + code);
      }
      var charCmapInfo = this.cmapMapping_[code];
      if (!charCmapInfo) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_CHAR_CMAP_INFO_,
            weight, 'format 12, code ' + code + ': no CharCmapInfo');
        continue;
      }

      // Set the glyphId for format 12
      var format12Seg = charCmapInfo.format12Seg;
      var segment = segments[format12Seg];
      var segStartCode = segment[0];
      var segEndCode = segStartCode + segment[1] - 1;
      var segStartGlyphId = segment[2];
      var segOffset = format12Seg * 12;
      segEd.seek(segOffset);
      var inMemoryStartCode = segEd.getUint32();
      var inMemoryEndCode = segEd.getUint32();
      var inMemoryGlyphId = segEd.getUint32();
      // Check the code point.
      if (inMemoryStartCode != segStartCode) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_START_CODE_,
            weight, 'format 12, code ' + code + ', seg ' + format12Seg +
            ': startCode mismatch');
      }
      if (inMemoryEndCode != segEndCode) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_END_CODE_,
            weight, 'format 12 code ' + code + ', seg ' + format12Seg +
            ': endCode mismatch');
      }
      if (segStartCode != segEndCode) { // TODO(bstell): check length
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_SEGMENT_LENGTH_,
            weight, 'format 12 code ' + code + ', seg ' + format12Seg +
            ': length != 1');
      }
      if (inMemoryGlyphId != 0) {
        if (inMemoryGlyphId == segStartGlyphId) {
          tachyfont.IncrementalFont.reportError_(
              tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_ALREADY_SET_,
              weight, 'format 12 code ' + code + ', seg ' + format12Seg +
              ' glyphId already set');
        } else {
          tachyfont.IncrementalFont.reportError_(
              tachyfont.IncrementalFont.ERROR_FORMAT12_GLYPH_IDS_MISMATCH_,
              weight, 'format 12 code ' + code + ', seg ' + format12Seg +
              ' glyphId mismatch');
        }
      }
      // Seek to the glyphId.
      segEd.seek(segOffset + 8);
      // Set the glyphId.
      segEd.setUint32(segStartGlyphId);
    }
  }
};


/**
 * Set the \@font-face rule.
 * @param {!DataView} fontData The font dataview.
 * @param {boolean} isTtf True if the font is a TrueType font.
 * @return {goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj_.prototype.setFont = function(fontData, isTtf) {
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'setFont: wait for preceding');
  }
  var msg;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'updateFonts: wait for preceding setFont');
    msg = this.fontInfo.getName() + ' setFont';
  }
  var finishPrecedingSetFont =
      this.finishPrecedingSetFont_.getChainedPromise(msg);
  finishPrecedingSetFont.getPrecedingPromise().
      then(function() {
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'setFont: done waiting for preceding');
        }
        this.needToSetFont = false;
        return goog.Promise.resolve().
            then(function() {
              if (goog.DEBUG) {
                return this.getCharList.
                then(function(charList) {
                  if (tachyfont.reportCharList) {
                    tachyfont.utils.reportCharList(this.fontInfo.getName() +
                    ' setFont charList', charList);
                  }
                  if (tachyfont.checkCmap) {
                    tachyfont.utils.checkCmap(charList, this.fileInfo_,
                        fontData);
                  }
                  if (tachyfont.reportChecksums) {
                    tachyfont.utils.reportChecksums(charList, this.fileInfo_,
                        fontData);
                  }
                }.bind(this));
              }
            }.bind(this)).
            then(function() {
              if (goog.DEBUG) {
                goog.log.fine(tachyfont.logger, 'setFont ' +
                this.fontInfo.getName());
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
              this.fontInfo, fontData, mimeType);

              return this.setFontNoFlash(this.fontInfo, format, blobUrl).
              then(function() {
                if (goog.DEBUG) {
                  goog.log.fine(tachyfont.logger, 'setFont: setFont done');
                }
              });
            }.bind(this)).
            then(function() {
              finishPrecedingSetFont.resolve();
            });
      }.bind(this));
  return finishPrecedingSetFont.getPromise();
};


/**
 * Determine if the font was preprocessed to have only one character per
 * segment. Fonts with this arrangement easily support keeping the cmap
 * accurate as character data is added.
 */
tachyfont.IncrementalFont.obj_.prototype.determineIfOneCharPerSeg = function() {
  if (this.fileInfo_.compact_gos.cmap4) {
    var segments = this.fileInfo_.compact_gos.cmap4.segments;
    for (var i = 0; i < segments.length; i++) {
      var segStartCode = segments[i][0];
      var segEndCode = segments[i][1];
      var idRangeOffset = segments[i][3];
      if (segStartCode != segEndCode || idRangeOffset != 0) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_CMAP4_CHARS_PER_SEGMENT_,
            this.fontInfo.getWeight(), this.fontName +
            ' format4 has more than one char per segment');
        return;
      }
    }
  }

  if (this.fileInfo_.compact_gos.cmap12) {
    var segments = this.fileInfo_.compact_gos.cmap12.segments;
    for (var i = 0; i < segments.length; i++) {
      var length = segments[i][1];
      if (length != 1) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_CMAP12_CHARS_PER_SEGMENT_,
            this.fontInfo.getWeight(), this.fontName +
            ' format12 has more than one char per segment');
        return;
      }
    }
  }

  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger, this.fontName +
        ' has one char per segment');
  }

  this.hasOneCharPerSeg = true;
};


/**
 * Obfuscate small requests to make it harder for a TachyFont server to
 * determine the content on a page.
 * @param {!Array.<number>} codes The codepoints to add obusfuscation to.
 * @param {!Object} charlist The chars that have already been requested.
 * @return {!Array.<number>} The codepoints with obusfuscation.
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
      var new_char = tachyfont.utils.stringFromCodePoint(new_code);
      charlist[new_char] = 1;
    }
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger, goog.log.Level.FINER,
          Object.keys(code_map).length.toString());
    }
  }

  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'before obfuscation: codes.length = ' + codes.length);
    codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.logger, 'codes = ' + codes);
  }
  var combined_codes = [];
  var keys = Object.keys(code_map);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    combined_codes.push(code_map[key]);
  }
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'after obfuscation: combined_codes.length = ' + combined_codes.length);
    combined_codes.sort(function(a, b) { return a - b; });
    goog.log.fine(tachyfont.logger, 'combined_codes = ' +
        combined_codes);
  }
  return combined_codes;
};


/**
 * Load the data for needed chars.
 *
 * TODO(bstell): fix the return value.
 * @return {goog.Promise} Returns the true if characters loaded.
 */
tachyfont.IncrementalFont.obj_.prototype.loadChars = function() {
  if (goog.DEBUG) {
    goog.log.fine(tachyfont.logger, 'loadChars');
  }
  var that = this;
  var chars = '';
  var charlist;
  var neededCodes = [];
  var remaining = [];

  var msg;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        this.fontInfo.getName() +
        ' updateFonts: wait for preceding char data request');
    msg = this.fontInfo.getName() + ' loadChars';
  }
  var finishPrecedingCharsRequest =
      this.finishPrecedingCharsRequest_.getChainedPromise(msg);
  finishPrecedingCharsRequest.getPrecedingPromise().
      then(function() {
        // TODO(bstell): use charCmapInfo to only request chars in the font.
        var charArray = Object.keys(that.charsToLoad);
        if (tachyfont.reportNeededChars) {
          tachyfont.utils.reportCharList(that.fontInfo.getName() +
              ' chars on page', that.charsToLoad);
        }
        // Check if there are any new characters.
        // TODO(bstell): until the serializing is fixed this stops multiple
        // requests running on the same resolved promise.
        if (charArray.length == 0) {
          // Lock will be released below.
          return null;
        }
        var pendingResolveFn, pendingRejectFn;
        // TODO(bstell): use tachfont.promise here?
        return new goog.Promise(function(resolve, reject) {
          pendingResolveFn = resolve;
          pendingRejectFn = reject;

          return that.getCharList.
              then(function(charlist_) {
                charlist = charlist_;
                if (tachyfont.reportCharList) {
                  tachyfont.utils.reportCharList(that.fontInfo.getName() +
                  'loadChars charlist', charlist);
                }
                // Make a tmp copy in case we are chunking the requests.
                var tmp_charlist = {};
                for (var key in charlist) {
                  tmp_charlist[key] = charlist[key];
                }
                for (var i = 0; i < charArray.length; i++) {
                  var c = charArray[i];
                  if (!tmp_charlist[c]) {
                    // TODO(bstell): use cmapMapping_ to determine if the font
                    // supports that code. If not, then skip it.
                    neededCodes.push(tachyfont.charToCode(c));
                    tmp_charlist[c] = 1;
                  }
                }

                if (neededCodes.length) {
                  if (goog.DEBUG) {
                    // This is debug only: report the chars before obfuscation.
                    if (tachyfont.reportNeededChars) {
                      tachyfont.utils.reportCodes(that.fontInfo.getName() +
                      ' neededCodes', neededCodes);
                    }
                  }
                  neededCodes = tachyfont.possibly_obfuscate(neededCodes,
                  tmp_charlist);
                  if (goog.DEBUG) {
                    goog.log.info(tachyfont.logger, that.fontInfo.getName() +
                    ': load ' + neededCodes.length + ' codes:');
                    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
                    '' + neededCodes);
                  }
                  // Report the miss rate.
                  var weight = that.fontInfo.getWeight();
                  var missCnt = neededCodes.length;
                  tachyfont.reporter.addItem(
                      tachyfont.IncrementalFont.LOG_MISS_COUNT_ + weight,
                      missCnt);
                  var missRate = (neededCodes.length * 100) / charArray.length;
                  tachyfont.reporter.addItem(
                      tachyfont.IncrementalFont.LOG_MISS_RATE_ + weight,
                      missRate);
                } else {
                  if (goog.DEBUG) {
                    goog.log.fine(tachyfont.logger, 'no new characters');
                  }
                  pendingResolveFn(false);
                  return;
                }
                neededCodes.sort(function(a, b) { return a - b; });
                if (that.req_size) {
                  remaining = neededCodes.slice(that.req_size);
                  neededCodes = neededCodes.slice(0, that.req_size);
                }
                for (var i = 0; i < neededCodes.length; i++) {
                  var c = tachyfont.utils.stringFromCodePoint(neededCodes[i]);
                  charlist[c] = 1;
                  delete that.charsToLoad[c];
                }
                return that.backendService.requestCodepoints(that.fontInfo,
                neededCodes).
                then(function(bundleResponse) {
                  if (remaining.length) {
                    setTimeout(function() {
                      that.loadChars();
                    }, 1);
                  }
                  // if (goog.DEBUG) {
                  //   goog.log.info(tachyfont.logger,
                  //     'requested char data length = ' +chardata.byteLength);
                  // }
                  return bundleResponse;
                });
              }).
              then(function(bundleResponse) {
                return that.getBase.
                then(function(arr) {
                  var fileInfo = arr[0];
                  var fontData = arr[1];
                  var dataLength = 0;
                  if (bundleResponse != null) {
                    dataLength = bundleResponse.getDataLength();
                    if (dataLength != 0) {
                      that.needToSetFont = true;
                    }
                    if (goog.DEBUG) {
                      goog.log.info(tachyfont.logger,
                      that.fontName +
                      ' injectCharacters: glyph count / data length = ' +
                      bundleResponse.getGlyphCount() + ' / ' + dataLength);
                    }
                    var glyphToCodeMap = {};
                    for (var i = 0; i < neededCodes.length; i++) {
                      var code = neededCodes[i];
                      var charCmapInfo = that.cmapMapping_[code];
                      if (charCmapInfo) {
                        // Handle multipe codes sharing a glyphId.
                        if (glyphToCodeMap[charCmapInfo.glyphId] == undefined) {
                          glyphToCodeMap[charCmapInfo.glyphId] = [];
                        }
                        glyphToCodeMap[charCmapInfo.glyphId].push(code);
                      }
                    }
                    fontData = that.injectCharacters(fontData, bundleResponse,
                    glyphToCodeMap);
                    var msg;
                    if (remaining.length) {
                      msg = 'display ' + Object.keys(charlist).length +
                          ' chars';
                    } else {
                      msg = '';
                      tachyfont.timer1.end('load Tachyfont base+data for ' +
                      that.fontName);
                      tachyfont.timer1.done();
                    }
                    // Update the data promises.
                    that.getBase = goog.Promise.all(
                        [goog.Promise.resolve(fileInfo),
                      goog.Promise.resolve(fontData)]);
                    that.getCharList = goog.Promise.resolve(charlist);

                    // Persist the data.
                    that.persistDelayed_(tachyfont.IncrementalFont.BASE);
                    that.persistDelayed_(tachyfont.IncrementalFont.CHARLIST);
                  } else {
                    var msg = '';
                    tachyfont.timer1.end('load Tachyfont base+data for ' +
                    that.fontName);
                    tachyfont.timer1.done();
                  }
                  pendingResolveFn(true);
                  // }).
                  // thenCatch(function(e) {
                  //   tachyfont.IncrementalFont.reportError_(
                  //       tachyfont.IncrementalFont.ERROR_LOAD_CHARS_INJECT_CHARS_2_,
                  //       that.fontInfo.getWeight(), e);
                  //   pendingRejectFn(false);
                });
              });
        }).
            thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError_(
                  tachyfont.IncrementalFont.ERROR_LOAD_CHARS_INJECT_CHARS_,
                  that.fontInfo.getWeight(), e);
              pendingRejectFn(false);
            });
      }).
      then(function() {
        // All done getting the char data so release the lock.
        finishPrecedingCharsRequest.resolve();
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'finished loadChars for ' + that.fontName);
        }
      }).
      thenCatch(function(e) {
        // Failed to get the char data so release the lock.
        finishPrecedingCharsRequest.reject();
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_LOAD_CHARS_GET_LOCK_,
            that.fontInfo.getWeight(), e);
        return goog.Promise.resolve(false);
      });
  return finishPrecedingCharsRequest.getPromise();
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
  //   goog.log.fine(tachyfont.logger, 'persistDelayed ' + name);
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
  var msg;
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'updateFonts: wait for preceding persist');
    msg = this.fontInfo.getName() + ' persist_';
  }
  var finishedPersisting = this.finishPersistingData_.getChainedPromise(msg);
  finishedPersisting.getPrecedingPromise().
      then(function() {
        // Previous persists may have already saved the data so see if there is
        // anything still to persist.
        var base_dirty = that.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY];
        var charlist_dirty =
            that.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY];
        if (!base_dirty && !charlist_dirty) {
          // Nothing to persist so release the lock.
          finishedPersisting.resolve();
          return;
        }

        // What ever got in upto this point will get saved.
        that.persistInfo[tachyfont.IncrementalFont.BASE_DIRTY] = false;
        that.persistInfo[tachyfont.IncrementalFont.CHARLIST_DIRTY] = false;

        // Do the persisting.
        return goog.Promise.resolve().
            then(function() {
              if (base_dirty) {
                return that.getBase.
                then(function(arr) {
                  return goog.Promise.all([that.getIDB_,
                    goog.Promise.resolve(arr[0]),
                    goog.Promise.resolve(arr[1])]);
                }).
                then(function(arr) {
                  if (goog.DEBUG) {
                    goog.log.fine(tachyfont.logger, 'save base');
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
                    goog.log.fine(tachyfont.logger, 'save charlist');
                  }
                  return that.saveData_(arr[0],
                      tachyfont.IncrementalFont.CHARLIST, arr[1]);
                });
              }
            }).
            thenCatch(function(e) {
              tachyfont.IncrementalFont.reportError_(
                  tachyfont.IncrementalFont.ERROR_PERSIST_SAVE_DATA_,
                  that.fontInfo.getWeight(), e);
            }).
            then(function() {
              // Done persisting so release the lock.
              finishedPersisting.resolve();
              if (goog.DEBUG) {
                goog.log.fine(tachyfont.logger, 'persisted ' + name);
              }
            });
      }).thenCatch(function(e) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_PERSIST_GET_LOCK_,
            that.fontInfo.getWeight(), e);
        // Release the lock.
        finishedPersisting.reject();
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
            tachyfont.IncrementalFont.reportError_(
                tachyfont.IncrementalFont.ERROR_SAVE_DATA_,
                that.fontInfo.getWeight(), e);
            reject(null);
          };
          // }).
          //    thenCatch(function(e) {
          //      tachyfont.IncrementalFont.reportError_(
          //         tachyfont.IncrementalFont.ERROR_SAVE_DATA_2_,
          //          that.fontInfo.getWeight(), e);
           });
      }).thenCatch(function(e) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_SAVE_DATA_GET_IDB_,
            that.fontInfo.getWeight(), e);
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
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_OPEN_IDB_,
          that.fontInfo.getWeight(), '!!! IncrFontIDB.obj_ "' + db_name +
          '": ' + e.value);
      reject(e);
    };

    // Will get called when the version changes.
    dbOpen.onupgradeneeded = function(e) {
      var db = e.target.result;
      e.target.transaction.onerror = function(e) {
        tachyfont.IncrementalFont.reportError_(
            tachyfont.IncrementalFont.ERROR_IDB_ON_UPGRAGE_NEEDED_,
            that.fontInfo.getWeight(), 'onupgradeneeded error: ' + e.value);
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
      tachyfont.IncrementalFont.reportError_(
          tachyfont.IncrementalFont.ERROR_GET_DATA_,
          that.fontInfo.getWeight(), e);
      reject(e);
    };
  }).
      thenCatch(function(e) {
        // No data has been persisted.
        return goog.Promise.reject(e);
      });
  return getData;
};



/**
 * TachyFont - A namespace.
 * @param {!tachyfont.FontInfo} fontInfo The font info.
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
 * @param {!tachyfont.FontInfo} fontInfo Info about this font.
 * @param {string} format The \@font-face format.
 * @param {string} blobUrl The blobUrl to the font data.
 * @return {goog.Promise} The promise resolves when the glyphs are displaying.
 */
tachyfont.IncrementalFont.obj_.prototype.setFontNoFlash =
    function(fontInfo, format, blobUrl) {
  // The desired @font-face font-family.
  var fontFamily = fontInfo.getFamilyName();
  // The temporary @font-face font-family.
  var tmpFontFamily = 'tmp-' + fontFamily;
  var fontName = fontInfo.getName(); // The font name.
  var weight = fontInfo.getWeight();
  var sheet = tachyfont.IncrementalFontUtils.getStyleSheet();

  // Create a temporary @font-face rule to transfer the blobUrl data from
  // Javascript to the browser side.
  if (goog.DEBUG) {
    goog.log.log(tachyfont.logger, goog.log.Level.FINER,
        'setFont: ' + tmpFontFamily + '/' + weight);
  }
  tachyfont.IncrementalFontUtils.setCssFontRule(sheet, tmpFontFamily, weight,
      blobUrl, format);

  var setFontPromise = new goog.Promise(function(resolve, reject) {
    // Transfer the data.
    // TODO(bstell): Make this cross platform.
    var fontStr = weight + ' 20px ' + tmpFontFamily;
    if (goog.DEBUG) {
      goog.log.log(tachyfont.logger, goog.log.Level.FINER,
          'setFont: fontStr = ' + fontStr);
    }
    document.fonts.load(fontStr).
        then(function(value) {
          if (goog.DEBUG) {
            goog.log.fine(tachyfont.logger, 'loaded ' + tmpFontFamily + '/' +
                weight);
          }
          resolve();
        });
  }).
      then(function() {
        // Now that the font is ready switch the @font-face to the desired name.
        if (goog.DEBUG) {
          goog.log.log(tachyfont.logger, goog.log.Level.FINER,
              'switch to fontFamily');
        }
        // Delete the old @font-face.
        var ruleToDelete = tachyfont.IncrementalFontUtils.findFontFaceRule(
            sheet, fontFamily, weight);
        tachyfont.IncrementalFontUtils.deleteCssRule(ruleToDelete, sheet);
        // Switch the name to use the newly transfered blobUrl data.
        var rule_to_switch = tachyfont.IncrementalFontUtils.findFontFaceRule(
            sheet, tmpFontFamily, weight);
        var rules = sheet.cssRules || sheet.rules;
        if (rules && rule_to_switch != -1) {
          var this_rule = rules[rule_to_switch];
          var this_style = this_rule.style;
          if (goog.DEBUG) {
            goog.log.info(tachyfont.logger, '**** switched ' + weight +
                ' from ' + this_style.fontFamily + ' to ' + fontFamily +
                ' ****');
          }
          this_style.fontFamily = fontFamily;
        }
      });

  return setFontPromise;
};
