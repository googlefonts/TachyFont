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

goog.require('goog.Promise');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Browser');
goog.require('tachyfont.Cff');
goog.require('tachyfont.CffDict');
goog.require('tachyfont.Cmap');
goog.require('tachyfont.Define');
goog.require('tachyfont.IncrementalFontUtils');
goog.require('tachyfont.Persist');
goog.require('tachyfont.Reporter');
goog.require('tachyfont.Sfnt');
goog.require('tachyfont.utils');



/**
 * This class manages Compact TachyFont operations.
 * @param {string} fontId A font identifier useful for error reports.
 * @constructor @struct @final
 */
tachyfont.CompactCff = function(fontId) {
  /**
   * A font identifier useful for error reports.
   * @private @const {string}
   */
  this.fontId_ = fontId;

  /**
   * The Sfnt font wrapper.
   * Contains the font data bytes.
   * @private {?tachyfont.Sfnt.Font}
   */
  this.sfnt_ = null;

  /**
   * Information about the font bytes.
   * @private {?tachyfont.typedef.FileInfo}
   */
  this.fileInfo_ = null;

  /**
   * A map of chars currently in the font.
   * @private {?Object<string, number>}
   */
  this.charList_ = null;

  /**
   * Metadata about the font; eg, last time accessed.
   * @private {?Object<string, *>}
   */
  this.metadata_ = null;
};


/**
 * Enum for error values.
 * @enum {string}
 */
tachyfont.CompactCff.Error = {
  FILE_ID: 'ECC',
  PRE_INJECT_SET_FONT: '01',
  POST_INJECT_SET_FONT: '02',
  INJECT_CHARS_GET_DB: '03',
  INJECT_CHARS_READ_TABLES: '04',
  INJECT_CHARS_WRITE_TABLES: '05',
  INJECT_TRANSACTION: '06',
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
  if (!this.sfnt_) {
    throw new Error('sfnt not set');
  }
  return this.sfnt_;
};


/**
 * Gets the FileInfo member.
 * @return {!tachyfont.typedef.FileInfo}
 */
tachyfont.CompactCff.prototype.getFileInfo = function() {
  if (!this.fileInfo_) {
    throw new Error('fileInfo not set');
  }
  return this.fileInfo_;
};


/**
 * Sets the table data.
 * @param {!DataView} fontData The font data bytes.
 * @param {!tachyfont.typedef.FileInfo} fileInfo Info about the font bytes.
 * @param {!Object<string, number>} charList A map of the supported chars.
 * @param {!Object<string, *>} metadata Metadata about the font.
 */
tachyfont.CompactCff.prototype.setTableData = function(
    fontData, fileInfo, charList, metadata) {
  this.sfnt_ = tachyfont.Sfnt.getFont(fontData);
  this.fileInfo_ = fileInfo;
  this.charList_ = charList;
  this.metadata_ = metadata;
};


/**
 * Gets the table data.
 * @return {!Array<?DataView|?Object<string,*>|?Object<string,number>>}
 */
tachyfont.CompactCff.prototype.getTableData = function() {
  return [
    this.sfnt_.getFontData(),  //
    this.fileInfo_,            //
    this.charList_,            //
    this.metadata_
  ];
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
  var origOffsets = this.sfnt_.getCompactOffsets();
  var fontData = this.sfnt_.getFontData();
  var cffTableOffset = this.sfnt_.getTableOffset(tachyfont.Sfnt.CFF_TAG);
  var cffTableLength = this.sfnt_.getTableLength(tachyfont.Sfnt.CFF_TAG);
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

  this.sfnt_.replaceTable(tachyfont.Sfnt.CFF_TAG, [cffDataSegments]);
  this.updateFileInfo(origOffsets);
  return;
};


/**
 * Updates the fileInfo offsets.
 * @param {!tachyfont.Sfnt.CompactOffsets} origOffsets The array to add the
 * Uint8Array to.
 */
tachyfont.CompactCff.prototype.updateFileInfo = function(origOffsets) {
  var newOffsets = this.sfnt_.getCompactOffsets();

  // Adjust the cmap offsets.
  var deltaCmapOffset =
      newOffsets.getCmapOffset() - origOffsets.getCmapOffset();
  this.fileInfo_.cmap4.offset += deltaCmapOffset;
  this.fileInfo_.cmap12.offset += deltaCmapOffset;

  // Adjust the Cff glyph data offsets.
  var deltaCffOffset = newOffsets.getCffOffset() - origOffsets.getCffOffset();
  this.fileInfo_.glyphOffset += deltaCffOffset;
  this.fileInfo_.glyphDataOffset += deltaCffOffset;

  // Adjust the Horizontal/Vertical Metrics offsets.
  this.fileInfo_.hmtxOffset = newOffsets.getHmtxOffset();
  this.fileInfo_.vmtxOffset = newOffsets.getVmtxOffset();
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
 * @param {!Object<number,!Array<number>>} glyphToCodeMap The map of glyph id to
 *     codepoints.
 * @param {!tachyfont.GlyphBundleResponse} bundleResponse New glyph data
 * @return {!goog.Promise<!tachyfont.CompactCff,?>} A promise for CompactCff.
 *
 */
tachyfont.CompactCff.injectChars = function(
    fontInfo, neededCodes, glyphToCodeMap, bundleResponse) {
  var transaction;
  var fontId = fontInfo.getFontId();
  var compactCff = new tachyfont.CompactCff(fontId);
  var db = null;
  var preInjectFontData;  // TODO(bstell): get rid of this.
  // Get the db handle.
  return tachyfont.Persist.openIndexedDB(fontInfo.getDbName(), fontId)
      .thenCatch(function(event) {  // TODO(bstell): remove this debug code
        tachyfont.CompactCff.reportError(
            tachyfont.CompactCff.Error.INJECT_CHARS_GET_DB, fontId, event);
        return goog.Promise.reject(event);
      })
      .then(function(dbHandle) {
        db = dbHandle;
        // Create the transaction.
        transaction =
            db.transaction(tachyfont.Define.compactStoreNames, 'readwrite');
        transaction.onerror = function(event) {
          tachyfont.CompactCff.reportError(
              tachyfont.CompactCff.Error.INJECT_TRANSACTION, fontId, event);
          return goog.Promise.reject(event);
        };
        // Get the persisted data.
        return compactCff
            .readDbTables(transaction)  //
            .thenCatch(function(event) {
              // TODO(bstell): remove this debug code
              tachyfont.CompactCff.reportError(
                  tachyfont.CompactCff.Error.INJECT_CHARS_READ_TABLES, fontId,
                  event);
              return goog.Promise.reject(event);
            });
      })
      .then(function() {
        // Save the pre-inject font data. Cannot run checkSetFont here as that
        // would prematurely end the IndexedDb transaction.
        var data = compactCff.sfnt_.getFontData();
        preInjectFontData = new DataView(data.buffer.slice(data.byteOffset));
        compactCff.injectGlyphBundle(bundleResponse, glyphToCodeMap);
        // Write the persisted data.
        return compactCff.writeDbTables(transaction)
            .thenCatch(function(
                event) {  // TODO(bstell): remove this debug code
              tachyfont.CompactCff.reportError(
                  tachyfont.CompactCff.Error.INJECT_CHARS_WRITE_TABLES, fontId,
                  event);
              return goog.Promise.reject(event);
            });
      })
      .then(function() {
        // TODO(bstell): remove this debug code.
        // checkSetFont the pre-inject font
        // The post-inject font data is checked in the caller.
        return tachyfont.Browser
            .checkSetFont(preInjectFontData, fontInfo, /* isTtf */ false, null)
            .then(function(passesOts) {
              if (!passesOts) {
                tachyfont.CompactCff.reportError(
                    tachyfont.CompactCff.Error.PRE_INJECT_SET_FONT, fontId, '');
                var event = {};
                event.target = {};
                event.target.error = {};
                event.target.error.name = 'setFont';
                return goog.Promise.reject(event);
              }
            });
      })
      .then(function() {
        return compactCff;  //
      })
      .thenAlways(function() {
        if (db) {
          db.close();
        }
      });
};


/**
 * @param {!IDBTransaction} transaction The current IndexedDB transaction.
 * @return {!goog.Promise<?,?>}
 */
tachyfont.CompactCff.prototype.readDbTables = function(transaction) {
  // Read the persisted data.
  return tachyfont.Persist
      .getStores(transaction, tachyfont.Define.compactStoreNames)
      .then(function(dbTables) {
        var fontData = dbTables[0];
        var fileInfo = dbTables[1];
        var charList = dbTables[2];
        var metadata = dbTables[3];
        if (!fontData || !fileInfo || !charList || !metadata) {
          return goog.Promise.reject(
              'missing: ' +              //
              (!fontData ? 'D' : '_') +  //
              (!fileInfo ? 'I' : '_') +  //
              (!charList ? 'C' : '_') +  //
              (!metadata ? 'M' : '_'));
        }
        // TODO(bstell): update the metadata.
        this.setTableData(fontData, fileInfo, charList, metadata);
      }.bind(this));
};


/**
 * @param {!IDBTransaction} transaction The current IndexedDB transaction.
 * @return {!goog.Promise<?,?>}
 */
tachyfont.CompactCff.prototype.writeDbTables = function(transaction) {
  // Read the persisted data.
  return tachyfont.Persist.putStores(
      transaction, tachyfont.Define.compactStoreNames, this.getTableData());
};


/**
 * Clears datastores.
 * @param {!Array<string>} storeNames The names of the stores to be cleared.
 * @param {!tachyfont.FontInfo} fontInfo Info about the font.
 * @param {boolean=} opt_rejectOnError If true return a promise reject on error.
 * @return {!goog.Promise<?,?>}
 */
tachyfont.CompactCff.clearDataStores = function(
    storeNames, fontInfo, opt_rejectOnError) {
  if (storeNames.length == 0) {
    if (opt_rejectOnError) {
      return goog.Promise.reject();
    } else {
      return goog.Promise.resolve();
    }
  }
  return tachyfont.Persist
      .openIndexedDB(fontInfo.getDbName(), fontInfo.getFontId())
      .then(function(db) {
        return new goog.Promise(function(resolve, reject) {
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
  var origOffsets = this.sfnt_.getCompactOffsets();
  this.setCharacterInfo(bundleResponse, glyphToCodeMap);
  var cffDataSegments = this.injectGlyphData(bundleResponse);
  this.sfnt_.replaceTable(tachyfont.Sfnt.CFF_TAG, [cffDataSegments]);
  this.updateFileInfo(origOffsets);
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

  var fontData = this.sfnt_.getFontData();
  this.fileInfo_.dirty = true;
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
        flags, glyphData, baseBinaryEditor, this.fileInfo_);
  }
  // Set the glyph Ids in the cmap format 12 subtable;
  tachyfont.Cmap.setFormat12GlyphIds(
      this.fileInfo_, fontData, glyphIds, glyphToCodeMap, this.fontId_);

  // Set the glyph Ids in the cmap format 4 subtable;
  tachyfont.Cmap.setFormat4GlyphIds(
      this.fileInfo_, fontData, glyphIds, glyphToCodeMap, this.fontId_);

  // Note the new characters that the font now supports.
  for (var i = 0; i < glyphIds.length; i++) {
    var codes = glyphToCodeMap[glyphIds[i]];
    if (codes) {
      for (var j = 0; j < codes.length; j++) {
        var aChar = tachyfont.utils.stringFromCodePoint(codes[j]);
        this.charList_[aChar] = 1;
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
