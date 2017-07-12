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

goog.provide('tachyfont.MergedData');

goog.require('tachyfont.BinaryEditor');



/**
 * This class provides routines to access and expand data in a MergedData
 * object.
 * @param {?ArrayBuffer} mergedDataBytes The merged fontbases data.
 * @param {?Object} xdelta3_decoder The XDelta3 decoder
 * @constructor @struct @final \@extends {tachyfont.BinaryEditor}
 */
tachyfont.MergedData = function(mergedDataBytes, xdelta3_decoder) {
  var editor = null;
  if (mergedDataBytes) {
    var dataView = new DataView(mergedDataBytes);
    editor = new tachyfont.BinaryEditor(dataView, 0);
  }
  /** @type {?tachyfont.BinaryEditor} */
  this.binaryEditor = editor;

  /** @type {?Object} */
  this.xdelta3_decoder = xdelta3_decoder;

  /** @type {boolean} */
  this.canProduceFontbases = !!dataView && !!xdelta3_decoder;

  /** @type {?tachyfont.MergedData.Info} */
  this.info = null;

  /** @type {?ArrayBuffer} */
  this.sourceBytes = null;
};


/**
 * Internal file identifier (AKA magic number) used in header of the base font.
 * BS:Brian Stell TF:TachyFont
 * @type {string}
 */
tachyfont.MergedData.magicHead = 'BSMD';


/**
 * The major version of the merged data.
 * @type {number}
 */
tachyfont.MergedData.MAJOR_VERSION = 1;


/**
 * The minor version of the merged data.
 * @type {number}
 */
tachyfont.MergedData.MINOR_VERSION = 0;


/**
 * The type for primary (non-diff'd) data.
 * @type {string}
 */
tachyfont.MergedData.TYPE_PRIMARY = 'PRMY';


/**
 * The type for primary diff'd data.
 * @type {string}
 */
tachyfont.MergedData.TYPE_DIFF = 'DIFF';


/**
 * Gets the binary editor.
 * @return {?tachyfont.BinaryEditor}
 */
tachyfont.MergedData.prototype.getBinaryEditor = function() {
  return this.binaryEditor;
};


/**
 * @param {string} name The data identifier.
 * @return {?ArrayBuffer}
 */
tachyfont.MergedData.prototype.getData = function(name) {
  try {
    // Get the source bytes in case they are needed for a diff.
    var sourceBytes = this.sourceBytes;
    if (!sourceBytes) {
      sourceBytes = this.sourceBytes = this.getSourceBytes_();
    }
    if (!sourceBytes) {
      return null;
    }
    // If the request is for the source then return it.
    if (name == this.getInfo_().primaryName) {
      return sourceBytes;
    }

    // Get diff'd bytes.
    var data = this.getBytes_(name, sourceBytes);
    return data;
  } catch (e) {
    return null;
  }
};


/**
 * @param {string} name Name of the data.
 * @param {!ArrayBuffer=} opt_sourceBytes Source bytes for diffing. Optional.
 * @return {?ArrayBuffer}
 * @private
 */
tachyfont.MergedData.prototype.getBytes_ = function(name, opt_sourceBytes) {
  var record = this.getInfo_().getDeltaRecord(name);
  if (!record) {
    return null;
  }

  var mergedBytes = this.binaryEditor.getDataView().buffer;
  var delta = new Uint8Array(mergedBytes, record.offset, record.length);
  var sourceBytes;
  if (opt_sourceBytes) {
    sourceBytes = new Uint8Array(opt_sourceBytes);
  }

  try {
    return this.xdelta3_decoder.decode(delta, sourceBytes);
  } catch (e) {
    return null;
  }
};


/**
 * @return {?ArrayBuffer}
 * @private
 */
tachyfont.MergedData.prototype.getSourceBytes_ = function() {
  var sourceBytes = this.getBytes_(this.getInfo_().primaryName);
  return sourceBytes;
};


/**
 * @return {?tachyfont.MergedData.Info}
 * @private
 */
tachyfont.MergedData.prototype.getInfo_ = function() {
  if (!this.canProduceFontbases) {
    return null;
  }
  if (!this.info) {
    // Parse the mergedData.
    this.info = this.parseMergedData();
    if (!this.info) {
      this.canProduceFontbases = false;
    }
  }
  return this.info;
};



/**
 * Contains info about the merged data.
 * @param {string} familyName
 * @param {number} majorVersion
 * @param {number} minorVersion
 * @param {number} numberSubtables
 * @param {string} primaryName
 * @param {!Object<string, !tachyfont.MergedData.SubtableRecord>}
 *     subtableRecords
 * @constructor @struct
 */
tachyfont.MergedData.Info = function(
    familyName, majorVersion, minorVersion, numberSubtables, primaryName,
    subtableRecords) {
  /** @type {string} */
  this.familyName = familyName;

  /** @type {number} */
  this.majorVersion = majorVersion;

  /** @type {number} */
  this.minorVersion = minorVersion;

  /** @type {number} */
  this.numberSubtables = numberSubtables;

  /** @type {string} */
  this.primaryName = primaryName;

  /** @type {!Object<string, !tachyfont.MergedData.SubtableRecord>} */
  this.subtableRecords = subtableRecords;
};



/**
 * Contains info about a subtable in the merged data.
 * @param {string} name
 * @param {string} type
 * @param {number} offset
 * @param {number} length
 * @constructor @struct
 */
tachyfont.MergedData.SubtableRecord = function(name, type, offset, length) {
  /** @type {string} */
  this.name = name;

  /** @type {string} */
  this.type = type;

  /** @type {number} */
  this.offset = offset;

  /** @type {number} */
  this.length = length;
};


/**
 * Parses the header of the base font.
 * @return {?tachyfont.MergedData.Info}
 */
tachyfont.MergedData.prototype.parseMergedData = function() {
  var magic = this.binaryEditor.readString(4);
  if (magic != tachyfont.MergedData.magicHead) {
    return null;
  }
  var majorVersion = this.binaryEditor.getUint8();
  var minorVersion = this.binaryEditor.getUint8();
  if (!(majorVersion == tachyfont.MergedData.MAJOR_VERSION) ||
      !(minorVersion == tachyfont.MergedData.MINOR_VERSION)) {
    return null;
  }
  this.binaryEditor.skip(1);  // Unused.
  var numberSubtables = this.binaryEditor.getUint8();

  // Read the font family name.
  var familyNamelength = this.binaryEditor.getUint8();
  var familyName = this.binaryEditor.readString(familyNamelength);

  var subtableRecords = {};
  var primaryName = '';
  for (var i = 0; i < numberSubtables; i++) {
    var name = this.binaryEditor.readString(8).trim();
    var type = this.binaryEditor.readString(4).trim();
    this.binaryEditor.skip(4);
    var offset = this.binaryEditor.getUint32();
    var length = this.binaryEditor.getUint32();
    var record =
        new tachyfont.MergedData.SubtableRecord(name, type, offset, length);
    if (type == tachyfont.MergedData.TYPE_PRIMARY) {
      primaryName = name;
    }
    subtableRecords[name] = record;
  }

  var info = new tachyfont.MergedData.Info(
      familyName, majorVersion, minorVersion, numberSubtables, primaryName,
      subtableRecords);
  return info;
};


/**
 * Parses the header of the base font.
 * Set information as attributes in given loader object
 * @param {string} name The name of the data.
 * @return {?tachyfont.MergedData.SubtableRecord}
 */
tachyfont.MergedData.Info.prototype.getDeltaRecord = function(name) {
  var record = this.subtableRecords[name];
  return record || null;
};
