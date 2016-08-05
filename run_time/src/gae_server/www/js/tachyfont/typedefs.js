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

/**
 * @fileoverview This contains the typedefs used in TachyFont.
 */

goog.provide('tachyfont.typedef');
goog.provide('tachyfont.typedef.CMap12');
goog.provide('tachyfont.typedef.CMap4');
goog.provide('tachyfont.typedef.CmapMapping');
goog.provide('tachyfont.typedef.CompactFontWorkingData');
goog.provide('tachyfont.typedef.FileInfo');
goog.provide('tachyfont.typedef.uint8');


/** @typedef {{offset: number, nGroups: number}} */
tachyfont.typedef.CMap12;


/** @typedef {{offset: number, length: number}} */
tachyfont.typedef.CMap4;


/** @typedef {!Object<number, !tachyfont.CharCmapInfo>} */
tachyfont.typedef.CmapMapping;


/**
 * @typedef {{
 *     data: !DataView,
 *     charList: !Object<number, number>,
 *     fileInfo: !tachyfont.typedef.FileInfo
 * }}
 */
tachyfont.typedef.CompactFontWorkingData;


/**
 * @typedef {{
 *     headSize: number,
 *     version: number,
 *     glyphOffset: number,
 *     numGlyphs: number,
 *     glyphDataOffset: number,
 *     offsetSize: number,
 *     hmtxOffset: number,
 *     vmtxOffset: number,
 *     hmetricCount: number,
 *     vmetricCount: number,
 *     isTtf: boolean,
 *     cmap12: !tachyfont.typedef.CMap12,
 *     cmap4: !tachyfont.typedef.CMap4,
 *     compact_gos: !tachyfont.typedef.compact_gos,
 *     cmapMapping: !tachyfont.typedef.CmapMapping,
 *     charset_fmt: !tachyfont.typedef.charset,
 *     sha1_fingerprint: string
 * }}
 */
tachyfont.typedef.FileInfo;


// TODO(bstell): Replace the 'Object' with specific typedefs.
/** @typedef {{offset: number, gos: !Object}} */
tachyfont.typedef.charset;


// TODO(bstell): Replace the 'Object' with specific typedefs.
/** @typedef {{
 *     cmap4: !Object,
 *     cmap12: !Object
 *  }}
 */
tachyfont.typedef.compact_gos;


/** @typedef {number} */
tachyfont.typedef.uint8;
