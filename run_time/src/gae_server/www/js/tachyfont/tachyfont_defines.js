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

goog.provide('tachyfont.Define');


/**
 * Defines if Compact TachyFont is enabled.
 * TODO(bstell): remove this once Compact TachyFont is fully operational.
 * @type {boolean}
 */
tachyfont.Define.compactTachyFont = false;


/**
 * The global IndexedDB version.
 * The global DB is only used to indicate if the IndexedDb has been stable for
 * at least one day; ie: the data is not being automatically erased. See
 * IDB_VERSION for the DB where font data is stored.
 * @const {number}
 */
tachyfont.Define.IDB_GLOBAL_VERSION = 1;


/**
 * The global database name.
 * @const {string}
 */
tachyfont.Define.IDB_GLOBAL_NAME = 'tachyfont';


/**
 * The per font IndexedDB version.
 * Increment this number every time there is a change in the schema.
 * @const {number}
 */
tachyfont.Define.IDB_VERSION = 4;


/**
 * The database name.
 * @type {string}
 */
tachyfont.Define.DB_NAME = 'incrfonts';


/**
 * The per font base store name.
 * The base contains the file info prepended to the font.
 * @const {string}
 */
tachyfont.Define.IDB_BASE = 'base';


/**
 * The compact font store name.
 * @const {string}
 */
tachyfont.Define.COMPACT_FONT = 'compact_font';


/**
 * The compact font file info store name.
 * This contains the original file info.
 * @const {string}
 */
tachyfont.Define.COMPACT_FILE_INFO = 'compact_file_info';


/**
 * The compact font metadata store name.
 * @const {string}
 */
tachyfont.Define.COMPACT_METADATA = 'compact_metadata';


/**
 * The compact font char list store name.
 * @const {string}
 */
tachyfont.Define.COMPACT_CHAR_LIST = 'compact_char_list';


/**
 * Defines the Compact TachyFont data store names.
 * @type {!Array<string>}
 */
tachyfont.Define.compactStoreNames = [
  tachyfont.Define.COMPACT_FONT,       //
  tachyfont.Define.COMPACT_FILE_INFO,  //
  tachyfont.Define.COMPACT_CHAR_LIST,  //
  tachyfont.Define.COMPACT_METADATA
];


/**
 * The base is dirty (needs to be persisted) key.
 * @const {string}
 */
tachyfont.Define.IDB_BASE_DIRTY = 'base_dirty';


/**
 * The per font char list store name.
 * @const {string}
 */
tachyfont.Define.IDB_CHARLIST = 'charlist';


/**
 * The charlist is dirty (needs to be persisted) key.
 * @const {string}
 */
tachyfont.Define.IDB_CHARLIST_DIRTY = 'charlist_dirty';


/**
 * The metadata store name.
 * Used for both the global and per font data.
 * @const {string}
 */
tachyfont.Define.METADATA = 'metadata';


/**
 * The database operation about-to-begin or just-finished.
 * @const {string}
 */
tachyfont.Define.ACTIVITY = 'activity';


/**
 * The time when the activity was reported.
 * The value is the goog.now() number;
 * @const {string}
 */
tachyfont.Define.ACTIVITY_TIME = 'activity_time';


/**
 * The last activity was: created metadata.
 * @const {string}
 */
tachyfont.Define.CREATED_METADATA = 'created_metadata';


/**
 * The time when the metadata was created.
 * The value is the goog.now() number;
 * @const {string}
 */
tachyfont.Define.CREATED_METADATA_TIME = 'created_metadata_time';


/**
 * About to begin a save operation.
 * @const {string}
 */
tachyfont.Define.BEGIN_SAVE = 'begin_save';


/**
 * Finished a save operation.
 * @const {string}
 */
tachyfont.Define.SAVE_DONE = 'save_done';


/**
 * A mapping from css weight names to weights.
 * @type {!Object<string, string>}
 */
tachyfont.Define.cssWeightToNumber = {
  'lighter': '300',
  'normal': '400',
  'bold': '700',
  'bolder': '800'
};


/**
 * A map of the codepoints that should be blank.
 * @type {!Object<number, number>}
 */
tachyfont.Define.BLANK_CHARS = {
  // White space characters.
  0x0009: 1, 0x000A: 1, 0x000B: 1, 0x000C: 1, 0x000D: 1, 0x0020: 1, 0x0085: 1,
  0x00A0: 1, 0x1680: 1, 0x2000: 1, 0x2001: 1, 0x2002: 1, 0x2003: 1, 0x2004: 1,
  0x2005: 1, 0x2006: 1, 0x2007: 1, 0x2008: 1, 0x2009: 1, 0x200A: 1, 0x2028: 1,
  0x2029: 1, 0x202F: 1, 0x205F: 1, 0x3000: 1,

  // Default ignorable character set Source:
  // http://www.unicode.org/L2/L2002/02368-default-ignorable.pdf
  // "Default-ignorable code points ... have no visible glyph"
  0x00AD: 1, 0x034F: 1, 0x061C: 1, 0x115F: 1, 0x1160: 1, 0x17B4: 1, 0x17B5: 1,
  0x3164: 1, 0x180B: 1, 0x180C: 1, 0x180D: 1, 0x180E: 1, 0x200B: 1, 0x200C: 1,
  0x200D: 1, 0x200E: 1, 0x200F: 1, 0x202A: 1, 0x202B: 1, 0x202C: 1, 0x202D: 1,
  0x202E: 1, 0x2060: 1, 0x2061: 1, 0x2062: 1, 0x2063: 1, 0x2064: 1, 0x2065: 1,
  0x2066: 1, 0x2067: 1, 0x2068: 1, 0x2069: 1, 0x206A: 1, 0x206B: 1, 0x206C: 1,
  0x206D: 1, 0x206E: 1, 0x206F: 1, 0xFE00: 1, 0xFE01: 1, 0xFE02: 1, 0xFE03: 1,
  0xFE04: 1, 0xFE05: 1, 0xFE06: 1, 0xFE07: 1, 0xFE08: 1, 0xFE09: 1, 0xFE0A: 1,
  0xFE0B: 1, 0xFE0C: 1, 0xFE0D: 1, 0xFE0E: 1, 0xFE0F: 1, 0xFEFF: 1, 0xFFA0: 1,
  0x1D173: 1, 0x1D174: 1, 0x1D175: 1, 0x1D176: 1, 0x1D177: 1, 0x1D178: 1,
  0x1D179: 1, 0x1D17A: 1
};


/**
 * If the number of characters in the request is less than this count then add
 * additional characters to obfuscate the actual request.
 * @type {number}
 */
tachyfont.Define.MINIMUM_NON_OBFUSCATION_LENGTH = 20;


/**
 * The range of characters to pick from.
 * @type {number}
 */
tachyfont.Define.OBFUSCATION_RANGE = 256;


