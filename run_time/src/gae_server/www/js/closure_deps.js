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
goog.addDependency('../../../tachyfont/backendservice.js',
    ['tachyfont.BackendService', 'tachyfont.GoogleBackendService'],
    ['goog.Promise', 'goog.events', 'goog.functions', 'goog.net.EventType',
     'goog.net.XhrIo', 'tachyfont.FontInfo']);
goog.addDependency('../../../tachyfont/binaryfonteditor.js',
  ['tachyfont.BinaryFontEditor'],
  []);
goog.addDependency('../../../tachyfont/charcmapinfo.js',
    ['tachyfont.CharCmapInfo'],
    []);
goog.addDependency('../../../tachyfont/demobackendservice.js',
    ['tachyfont.DemoBackendService'],
    ['goog.Promise', 'goog.events', 'goog.net.EventType', 'goog.net.XhrIo',
     'tachyfont.BackendService', 'tachyfont.FontInfo',
     'tachyfont.GlyphBundleResponse']);
goog.addDependency('../../../tachyfont/fontinfo.js',
  ['tachyfont.FontInfo'],
  []);
goog.addDependency('../../../tachyfont/fontsinfo.js',
  ['tachyfont.FontsInfo'],
  ['tachyfont.FontInfo']);
goog.addDependency('../../../tachyfont/googlebackendservice.js',
    ['tachyfont.GoogleBackendService'],
    ['goog.Promise', 'tachyfont.BackendService', 'tachyfont.FontInfo',
     'tachyfont.GlyphBundleResponse', 'tachyfont.utils']);
goog.addDependency('../../../tachyfont/glyphbundleresponse.js',
    ['tachyfont.GlyphBundleResponse'],
    ['goog.log', 'tachyfont.BinaryFontEditor']);
goog.addDependency('../../../tachyfont/incrementalfont.js',
    ['tachyfont.IncrementalFont', 'tachyfont.TachyFont'],
    ['goog.Promise', 'goog.log', 'goog.log.Level', 'goog.math',
     'tachyfont.BinaryFontEditor', 'tachyfont.CharCmapInfo',
     'tachyfont.DemoBackendService', 'tachyfont.FontInfo',
     'tachyfont.GoogleBackendService', 'tachyfont.IncrementalFontUtils',
     'tachyfont.RLEDecoder', 'tachyfont.chainedPromises', 'tachyfont.promise',
     'tachyfont.utils']);
goog.addDependency('../../../tachyfont/incrementalfontutils.js',
    ['tachyfont.IncrementalFontUtils'],
    ['goog.asserts', 'goog.log', 'tachyfont.BinaryFontEditor',
     'tachyfont.CharCmapInfo', 'tachyfont.FontInfo']);
goog.addDependency('../../../misc_utils.js',
    ['tachyfont_misc_utils'],
    []);
goog.addDependency('../../../tachyfont/rledecoder.js',
    ['tachyfont.RLEDecoder'],
    []);
goog.addDependency('../../../tachyfont/tachyfont.js',
  ['tachyfont', 'tachyfont.IncrementalFontLoader', 'tachyfont.uint8'],
  ['goog.Promise', 'goog.Uri', 'goog.debug.Console', 'goog.debug.Logger',
   'goog.log', 'goog.log.Level', 'tachyfont.BinaryFontEditor',
   'tachyfont.FontInfo', 'tachyfont.FontsInfo',
   'tachyfont.IncrementalFontUtils', 'tachyfont.TachyFont',
   'tachyfont.TachyFontSet', 'tachyfont.Reporter']);
goog.addDependency('../../../tachyfont/tachyfontpromise.js',
    ['tachyfont.promise', 'tachyfont.chainedPromises'],
    ['goog.Promise']);
goog.addDependency('../../../tachyfont/tachyfontreporter.js',
    ['tachyfont.Reporter'],
    ['goog.log']);
goog.addDependency('../../../tachyfont/tachyfontset.js',
    ['tachyfont.TachyFontSet'],
    ['goog.Promise', 'goog.array', 'goog.log', 'goog.style',
     'tachyfont.IncrementalFontUtils', 'tachyfont.chainedPromises']);
goog.addDependency('../../../tachyfont/tachyfontutils.js',
    ['tachyfont.utils'],
    ['goog.crypt.Md5']);
goog.addDependency('../../../tachyfont/webfonttailor.js',
    ['webfonttailor'],
    ['tachyfont.FontInfo', 'tachyfont.FontInfo', 'tachyfont.FontsInfo',
     'webfonttailor.alternate']);
goog.addDependency('../../../tachyfont/webfonttailoralternate.js',
    ['webfonttailor.alternate'],
    ['tachyfont.FontInfo', 'tachyfont.FontsInfo']);
