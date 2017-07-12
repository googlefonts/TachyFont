'use strict';

/**
 * @license
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

goog.provide('tachyfont.CompactCff');

goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Cff');
goog.require('tachyfont.CffDict');
goog.require('tachyfont.Cmap');
goog.require('tachyfont.Define');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Persist');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.Sfnt');
goog.require('tachyfont.SynchronousResolutionPromise');
goog.require('tachyfont.utils');



/**
 * This class manages Compact TachyFont operations.
 * @param {string} fontId A font identifier useful for error reports.
 * @param {!tachyfont.typedef.FontTableData} fontTableData The font table data.
 * @constructor @struct @final
 */
tachyfont.CompactCff = function(fontId, fontTableData) {
  /**
   * A font identifier useful for error reports.
   * @private @const {string}
   */
  this.fontId_ = fontId;

  /**
   * The font data tables.
   * @private {!tachyfont.typedef.FontTableData}
   */
  this.fontTableData_ = fontTableData;
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.CompactCff.Error = {
  FILE_ID: 'ECC',
  // 01 no longer used.
  POST_INJECT_SET_FONT: '02',
  INJECT_CHARS_GET_DB: '03',
  INJECT_CHARS_READ_TABLES: '04',
  INJECT_CHARS_WRITE_TABLES: '05',
  INJECT_TRANSACTION: '06',
  INJECT_GLYPH_BUNDLE: '07',
  GET_OFFSETS: '08',
  SET_CHARACTER_INFO: '09',
  INJECT_GLYPH_DATA: '10',
  REPLACE_TABLE: '11',
  UPDATE_FILE_INFO: '12',
  UINT8ARRAY_FROM: '13',
  END: '00'
};


/**
 * The error reporter for this file.
 * @param {string} errNum The error number;
 * @param {string} errId Identifies the error.
 * @param {*} errInfo The error object;
 */
tachyfont.CompactCff.reportError = function(errNum, errId, errInfo) {
  tachyfont.Reporter.reportError(
      tachyfont.CompactCff.Error.FILE_ID + errNum, errId, errInfo);
};


/**
 * Gets the Sfnt member.
 * @return {!tachyfont.Sfnt.Font}
 */
tachyfont.CompactCff.prototype.getSfnt = function() {
  return this.fontTableData_.sfnt;
};


/**
 * Gets the FileInfo member.
 * @return {!tachyfont.typedef.FileInfo}
 */
tachyfont.CompactCff.prototype.getFileInfo = function() {
  return this.fontTableData_.fileInfo;
};


/**
 * Gets the table data.
 * @return {!tachyfont.typedef.FontTableData}
 */
tachyfont.CompactCff.prototype.getTableData = function() {
  return this.fontTableData_;
};


/**
 * Gets an identifier for the font.
 * This is useful for error messages.
 * @return {string}
 */
tachyfont.CompactCff.prototype.getFontId = function() {
  return this.fontId_;
};


/**
 * Compacts a TachyFont.
 */
tachyfont.CompactCff.prototype.compact = function() {
  var sfnt = this.fontTableData_.sfnt;
  var origOffsets = sfnt.getCompactOffsets();
  var fontData = sfnt.getFontData();
  var cffTableOffset = sfnt.getTableOffset(tachyfont.Sfnt.CFF_TAG);
  var cffTableLength = sfnt.getTableLength(tachyfont.Sfnt.CFF_TAG);
  var cff = new tachyfont.Cff(cffTableOffset, fontData);

  var charStringsIndex = cff.getCharStringsIndex();
  var charStringsOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0));
  var charStringsLength = charStringsIndex.getIndexByteLength();
  var fdArrayOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0));

  // Calculate the offsets and length.
  var cffStart = cffTableOffset;
  var charStringsStart = cffStart + charStringsOffset;
  var gapAfterCharStrings =
      fdArrayOffset - (charStringsOffset + charStringsLength);
  var fdArrayStart = cffTableOffset + fdArrayOffset;
  var remainingLength = cffTableLength - fdArrayOffset;

  // Build up the CFF table but do not include the gap after the CharStrings
  // INDEX.
  var cffDataSegments = [];
  this.addDataSegment(cffDataSegments, fontData, cffStart, charStringsOffset);
  this.addDataSegment(
      cffDataSegments, fontData, charStringsStart, charStringsLength);
  // Adjust the CFF offsets for no gap after the CharStrings INDEX.
  cff.updateCharStringsSize(-gapAfterCharStrings);
  this.addDataSegment(cffDataSegments, fontData, fdArrayStart, remainingLength);

  sfnt.replaceTable(tachyfont.Sfnt.CFF_TAG, [cffDataSegments]);
  this.updateFileInfo(origOffsets);
  return;
};


/**
 * Updates the fileInfo offsets.
 * @param {!tachyfont.Sfnt.CompactOffsets} origOffsets The array to add the
 * Uint8Array to.
 */
tachyfont.CompactCff.prototype.updateFileInfo = function(origOffsets) {
  var fileInfo = this.fontTableData_.fileInfo;
  var newOffsets = this.fontTableData_.sfnt.getCompactOffsets();

  // Adjust the cmap offsets.
  var deltaCmapOffset =
      newOffsets.getCmapOffset() - origOffsets.getCmapOffset();
  fileInfo.cmap4.offset += deltaCmapOffset;
  fileInfo.cmap12.offset += deltaCmapOffset;

  // Adjust the Cff glyph data offsets.
  var deltaCffOffset = newOffsets.getCffOffset() - origOffsets.getCffOffset();
  fileInfo.glyphOffset += deltaCffOffset;
  fileInfo.glyphDataOffset += deltaCffOffset;

  // Adjust the Horizontal/Vertical Metrics offsets.
  fileInfo.hmtxOffset = newOffsets.getHmtxOffset();
  fileInfo.vmtxOffset = newOffsets.getVmtxOffset();
};


/**
 * Adds a data segment to an array of data segments.
 * @param {!Array.<!Uint8Array>} dataArray The array to add the Uint8Array to.
 * @param {!DataView} dataView The source data.
 * @param {number} offset
 * @param {number} length
 */
tachyfont.CompactCff.prototype.addDataSegment = function(
    dataArray, dataView, offset, length) {
  var dataViewOffset = dataView.byteOffset;
  var dataOffset = dataViewOffset + offset;
  var buffer = dataView.buffer;
  var newUint8Array = new Uint8Array(buffer, dataOffset, length);
  dataArray.push(newUint8Array);
};


/**
 * Inject fetched glyphBundle data.
 * @param {!tachyfont.FontInfo} fontInfo Info about the font.
 * @param {!Array<number>} neededCodes The codes to be injected.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @return {
 *     (!tachyfont.SynchronousResolutionPromise<!tachyfont.CompactCff,?>|
 *      !goog.Promise<!tachyfont.CompactCff,?>)}
 *    A promise for CompactCff.
 *
 */
tachyfont.CompactCff.injectChars = function(
    fontInfo, neededCodes, bundleResponse) {
  var transaction;
  var fontId = fontInfo.getFontId();
  /** @type {!tachyfont.CompactCff} */
  var compactCff;
  var db = null;
  // Get the db handle.
  return tachyfont.Persist.openIndexedDb(fontInfo.getDbName(), fontId)
      .thenCatch(function(event) {
        tachyfont.CompactCff.reportError(
            tachyfont.CompactCff.Error.INJECT_CHARS_GET_DB, fontId, event);
        return tachyfont.SynchronousResolutionPromise.reject(event);
      })
      .then(function(dbHandle) {
        db = dbHandle;
        // Create the transaction.
        // To keep the transaction from automatically closing IndexedDB requires
        // continous operations with no breaks. This means goog.Promise cannot
        // be used since it (at least occasionally) yields the event queue to
        // avoid excessive stack depth. Instead use
        // tachyfont.SynchronousResolutionPromise which never yields (but the
        // programmer must take care to avoid exceeding the stack depth.
        transaction =
            db.transaction(tachyfont.Define.compactStoreNames, 'readwrite');
        transaction.onerror = function(event) {
          tachyfont.CompactCff.reportError(
              tachyfont.CompactCff.Error.INJECT_TRANSACTION, fontId, event);
          return tachyfont.SynchronousResolutionPromise.reject(event);
        };
      })
      .then(function() {
        // Get the persisted data.
        return tachyfont.CompactCff
            .readDbTables(transaction)  //
            .thenCatch(function(event) {
              // TODO(bstell): remove this debug code
              tachyfont.CompactCff.reportError(
                  tachyfont.CompactCff.Error.INJECT_CHARS_READ_TABLES, fontId,
                  event);
              return tachyfont.SynchronousResolutionPromise.reject(event);
            });
      })
      // Inject the glyphs.
      .then(function(fontTableData) {
        compactCff = new tachyfont.CompactCff(fontId, fontTableData);
        var fileInfo = compactCff.getFileInfo();
        var glyphToCodeMap = tachyfont.IncrementalFontUtils.getGlyphToCodeMap(
            neededCodes, fileInfo.cmapMapping);
        try {
          compactCff.injectGlyphBundle(bundleResponse, glyphToCodeMap);
        } catch (event) {
          tachyfont.CompactCff.reportError(
              tachyfont.CompactCff.Error.INJECT_GLYPH_BUNDLE, fontId, event);
          return tachyfont.SynchronousResolutionPromise.reject(event);
        }
      })
      .then(function() {
        // Write the persisted data.
        return compactCff.writeDbTables(transaction)
            .thenCatch(function(
                event) {  // TODO(bstell): remove this debug code
              tachyfont.CompactCff.reportError(
                  tachyfont.CompactCff.Error.INJECT_CHARS_WRITE_TABLES, fontId,
                  event);
              return tachyfont.SynchronousResolutionPromise.reject(event);
            });
      })
      .then(function() {
        if (db) {
          db.close();
        }
        return compactCff;  //
      })
      .thenCatch(function(e) {
        if (db) {
          db.close();
        }
        return tachyfont.SynchronousResolutionPromise.reject(e);
      });
};


/**
 * @param {!IDBTransaction} transaction The current IndexedDB transaction.
 * @return {!tachyfont.SynchronousResolutionPromise<
 *     !tachyfont.typedef.FontTableData,?>}
 */
tachyfont.CompactCff.readDbTables = function(transaction) {
  // Read the persisted data.
  return tachyfont.Persist
      .getStores(transaction, tachyfont.Define.compactStoreNames)
      .then(function(dbTables) {
        if (!dbTables[0] || !dbTables[1] || !dbTables[2] || !dbTables[3]) {
          return tachyfont.SynchronousResolutionPromise.reject(
              'missing: ' +                 //
              (!dbTables[0] ? 'D' : '_') +  // fontData
              (!dbTables[1] ? 'I' : '_') +  // fileInfo
              (!dbTables[2] ? 'C' : '_') +  // charList
              (!dbTables[3] ? 'M' : '_'));  // metadata
        }
        // TODO(bstell): update the metadata.
        var fontTableData = {
          sfnt: tachyfont.Sfnt.getFont(dbTables[0]),
          fileInfo: dbTables[1],
          charList: dbTables[2],
          metadata: dbTables[3]
        };
        return fontTableData;
      });
};


/**
 * @param {!IDBTransaction} transaction The current IndexedDB transaction.
 * @return {!tachyfont.SynchronousResolutionPromise<?,?>}
 */
tachyfont.CompactCff.prototype.writeDbTables = function(transaction) {
  // Read the persisted data.
  var tables = [
    this.fontTableData_.sfnt.getFontData(),  //
    this.fontTableData_.fileInfo,            //
    this.fontTableData_.charList,            //
    this.fontTableData_.metadata
  ];
  return tachyfont.Persist.putStores(
      transaction, tachyfont.Define.compactStoreNames, tables);
};


/**
 * Clears datastores.
 * @param {!Array<string>} storeNames The names of the stores to be cleared.
 * @param {!tachyfont.FontInfo} fontInfo Info about the font.
 * @param {boolean=} opt_rejectOnError If true return a promise reject on error.
 * @return {!Object}
 */
tachyfont.CompactCff.clearDataStores = function(
    storeNames, fontInfo, opt_rejectOnError) {
  if (storeNames.length == 0) {
    if (opt_rejectOnError) {
      return tachyfont.SynchronousResolutionPromise.reject();
    } else {
      return tachyfont.SynchronousResolutionPromise.resolve();
    }
  }
  return tachyfont.Persist
      .openIndexedDb(fontInfo.getDbName(), fontInfo.getFontId())
      .then(function(db) {
        return new tachyfont.SynchronousResolutionPromise(  //
            function(resolve, reject) {
              // Create the transaction.
              var transaction = db.transaction(storeNames, 'readwrite');
              transaction.oncomplete = function(event) {
                resolve();  //
              };
              transaction.onerror = function(event) {
                if (opt_rejectOnError) {
                  reject();  //
                } else {
                  resolve();  //
                }
              };
              // Clear each store.
              for (var i = 0; i < storeNames.length; i++) {
                transaction.objectStore(storeNames[i]).clear();
              }
            });
      });
};


/**
 * Inject glyphs in the compact font data expanding as necessary.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {!Object<number, !Array<number>>} glyphToCodeMap This is both an
 *     input and an output:
 *       Input: the glyph-Id to codepoint mapping;
 *       Output: the glyph Ids that were expected but not in the bundleResponse.
 */
tachyfont.CompactCff.prototype.injectGlyphBundle = function(
    bundleResponse, glyphToCodeMap) {
  var sfnt = this.fontTableData_.sfnt;
  var origOffsets;
  var cffDataSegments;
  try {
    origOffsets = sfnt.getCompactOffsets();
  } catch (e) {
    tachyfont.CompactCff.reportError(
        tachyfont.CompactCff.Error.GET_OFFSETS, this.fontId_, e);
    throw new Error('getCompactOffsets');
  }
  try {
    this.setCharacterInfo(bundleResponse, glyphToCodeMap);
  } catch (e) {
    tachyfont.CompactCff.reportError(
        tachyfont.CompactCff.Error.SET_CHARACTER_INFO, this.fontId_, e);
    throw new Error('setCharacterInfo');
  }
  try {
    cffDataSegments = this.injectGlyphData(bundleResponse);
  } catch (e) {
    tachyfont.CompactCff.reportError(
        tachyfont.CompactCff.Error.INJECT_GLYPH_DATA, this.fontId_, e);
    throw new Error('injectGlyphData');
  }
  try {
    sfnt.replaceTable(tachyfont.Sfnt.CFF_TAG, [cffDataSegments]);
  } catch (e) {
    tachyfont.CompactCff.reportError(
        tachyfont.CompactCff.Error.REPLACE_TABLE, this.fontId_, e);
    throw new Error('replaceTable');
  }
  try {
    this.updateFileInfo(origOffsets);
  } catch (e) {
    tachyfont.CompactCff.reportError(
        tachyfont.CompactCff.Error.UPDATE_FILE_INFO, this.fontId_, e);
    throw new Error('updateFileInfo');
  }
};


/**
 * Inject glyphs in the compact font data expanding as necessary.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @param {!Object<number, !Array<number>>} glyphToCodeMap Map from glyph id to
 *     codepoints.
 * @return {!DataView} Updated base font
 */
tachyfont.CompactCff.prototype.setCharacterInfo = function(
    bundleResponse, glyphToCodeMap) {
  var fontTableData = this.fontTableData_;
  var fontData = fontTableData.sfnt.getFontData();
  var baseBinaryEditor = new tachyfont.BinaryFontEditor(fontData, 0);

  var count = bundleResponse.getGlyphCount();
  var flags = bundleResponse.getFlags();
  var glyphDataArray = bundleResponse.getGlyphDataArray();

  var glyphIds = [];
  for (var i = 0; i < count; i += 1) {
    var glyphData = glyphDataArray[i];
    var id = glyphData.getId();
    glyphIds.push(id);
    tachyfont.IncrementalFontUtils.setMtx(
        flags, glyphData, baseBinaryEditor, fontTableData.fileInfo);
  }
  // Set the glyph Ids in the cmap format 12 subtable;
  tachyfont.Cmap.setFormat12GlyphIds(
      fontTableData.fileInfo, fontData, glyphIds, glyphToCodeMap, this.fontId_);

  // Set the glyph Ids in the cmap format 4 subtable;
  tachyfont.Cmap.setFormat4GlyphIds(
      fontTableData.fileInfo, fontData, glyphIds, glyphToCodeMap, this.fontId_);

  // Note the new characters that the font now supports.
  for (var i = 0; i < glyphIds.length; i++) {
    var codes = glyphToCodeMap[glyphIds[i]];
    if (codes) {
      for (var j = 0; j < codes.length; j++) {
        var aChar = tachyfont.utils.stringFromCodePoint(codes[j]);
        fontTableData.charList[aChar] = 1;
      }
    }
  }

  return fontData;
};


/**
 * @param {!tachyfont.GlyphBundleResponse} glyphBundle
 * @return {!Array.<!Uint8Array>}
 */
tachyfont.CompactCff.prototype.injectGlyphData = function(glyphBundle) {
  // var glyphDataArray = glyphBundle.getGlyphDataArray();

  var sfnt = this.getSfnt();
  var segments = [];
  var cffTableOffset = sfnt.getTableOffset(tachyfont.Sfnt.CFF_TAG);
  var fontData = sfnt.getFontData();
  var cff = new tachyfont.Cff(cffTableOffset, fontData);
  var charStringsIndex = cff.getCharStringsIndex();
  var charStringsOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.CHAR_STRINGS, 0));
  var fdArrayOffset = /** @type {number} */ (
      cff.getTopDictOperand(tachyfont.CffDict.Operator.FD_ARRAY, 0));
  var cffStart = cffTableOffset;
  var fdArrayStart = cffTableOffset + fdArrayOffset;

  // Add the pre-CharStrings data.
  tachyfont.CompactCff.addDataSegment(
      segments, fontData, cffStart, charStringsOffset);
  var charStringsStart = cffStart + charStringsOffset;
  var charStringsPosition = charStringsStart;

  // Add the CharStrings header.
  var headerLength = 3;
  tachyfont.CompactCff.addDataSegment(
      segments, fontData, charStringsPosition, headerLength);
  charStringsPosition += headerLength;

  // Add the CharStrings offset array.
  var nGlyphs = charStringsIndex.getNumberOfElements();
  var offsetsLength = (nGlyphs + 1) * charStringsIndex.getOffsetSize();
  tachyfont.CompactCff.addDataSegment(
      segments, fontData, charStringsPosition, offsetsLength);
  var offsetBinEd =
      new tachyfont.BinaryFontEditor(fontData, charStringsPosition);
  charStringsPosition += offsetsLength;

  var offsets = charStringsIndex.getOffsets();
  var offSize = charStringsIndex.getOffsetSize();
  var glyphDataArray = glyphBundle.getGlyphDataArray();
  var newGlyphCount = glyphDataArray.length;
  var currentOffsetsIndex = 0;
  var deltaOffset = 0;
  for (var i = 0; i < newGlyphCount; i++) {
    var glyphData = glyphDataArray[i];
    var id = glyphData.getId();
    // Add the data segment for currentOffsetsIndex to id start.
    var previousDataLength = offsets[id] - offsets[currentOffsetsIndex];
    if (previousDataLength) {
      tachyfont.CompactCff.addDataSegment(
          segments, fontData, charStringsPosition, previousDataLength);
      charStringsPosition += previousDataLength;
    }
    // Update offsets before this.
    var updateCount = id - currentOffsetsIndex + 1;
    if (deltaOffset) {
      // needs to be checked
      for (var j = 0; j < updateCount; j++) {
        var newOffset = offsets[currentOffsetsIndex] + deltaOffset;
        currentOffsetsIndex++;
        offsetBinEd.setOffset(offSize, newOffset);
      }
    } else {
      offsetBinEd.skip(updateCount * offSize);
      currentOffsetsIndex += updateCount;
    }

    // Add a segment with the new char bytes.
    var glyphBytes = glyphData.getBytes();
    // TODO(bstell): Remove this debug code.
    if (typeof Uint8Array.from != 'function') {
      tachyfont.CompactCff.reportError(
          tachyfont.CompactCff.Error.UINT8ARRAY_FROM, this.fontId_, '');
    }
    var glyphSegment = Uint8Array.from(glyphBytes);
    segments.push(glyphSegment);
    var oldGlyphLength = offsets[id + 1] - offsets[id];
    deltaOffset += glyphBytes.length - oldGlyphLength;
    charStringsPosition += oldGlyphLength;
  }

  // Add the data segment for remaining existing glyph data.
  var remainingCharStringsLength = fdArrayStart - charStringsPosition;
  tachyfont.CompactCff.addDataSegment(
      segments, fontData, charStringsPosition, remainingCharStringsLength);
  charStringsPosition += remainingCharStringsLength;

  // Write the remaining offsets.
  for (var j = currentOffsetsIndex; j <= nGlyphs; j++) {
    var newOffset = offsets[j] + deltaOffset;
    offsetBinEd.setOffset(offSize, newOffset);
    currentOffsetsIndex++;
  }

  // Add the remaining CFF data.
  cff.updateCharStringsSize(deltaOffset);
  var cffTableLength = sfnt.getTableLength(tachyfont.Sfnt.CFF_TAG);
  var remainingLength = cffTableLength - fdArrayOffset;
  tachyfont.CompactCff.addDataSegment(
      segments, fontData, fdArrayStart, remainingLength);
  return segments;
};


/**
 * Creates a copy of a data segment and appends it to an array.
 * @param {!Array.<!Uint8Array>} dataArray The array to add the Uint8Array to.
 * @param {!DataView} dataView The source data.
 * @param {number} offset
 * @param {number} length
 */
tachyfont.CompactCff.addDataSegment = function(
    dataArray, dataView, offset, length) {
  var dataViewOffset = dataView.byteOffset;
  var dataOffset = dataViewOffset + offset;
  var buffer = dataView.buffer;
  var newUint8Array = new Uint8Array(buffer, dataOffset, length);
  dataArray.push(newUint8Array);
};
