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
    ['tachyfont.BackendService'],
    ['goog.Promise', 'goog.events', 'goog.functions', 'goog.net.EventType',
     'goog.net.XhrIo', 'tachyfont.FontInfo', 'tachyfont.GlyphBundleResponse']);
goog.addDependency('../../../tachyfont/binaryfonteditor.js',
    ['tachyfont.BinaryFontEditor'],
    []);
goog.addDependency('../../../tachyfont/browser_chrome.js',
    ['tachyfont.Browser'],
    ['goog.Promise', 'goog.log', 'goog.log.Level',
     'tachyfont.IncrementalFontUtils', 'tachyfont.Logger']);
goog.addDependency('../../../tachyfont/charcmapinfo.js',
    ['tachyfont.CharCmapInfo'],
    []);
goog.addDependency('../../../tachyfont/cmap.js',
    ['tachyfont.Cmap'],
    ['goog.log', 'goog.log.Level', 'tachyfont.BinaryFontEditor',
     'tachyfont.Logger', 'tachyfont.Reporter', 'tachyfont.utils']);
goog.addDependency('../../../tachyfont/demobackendservice.js',
    ['tachyfont.DemoBackendService'],
    ['goog.events', 'goog.net.EventType', 'goog.net.XhrIo',
     'tachyfont.BackendService', 'tachyfont.FontInfo']);
goog.addDependency('../../../tachyfont/fontinfo.js',
    ['tachyfont.FontInfo'],
    []);
goog.addDependency('../../../tachyfont/fontsinfo.js',
    ['tachyfont.FontsInfo'],
    ['tachyfont.FontInfo']);
goog.addDependency('../../../tachyfont/glyphbundleresponse.js',
    ['tachyfont.GlyphBundleResponse'],
    ['goog.log', 'tachyfont.BinaryFontEditor']);
goog.addDependency('../../../tachyfont/googlebackendservice.js',
    ['tachyfont.GoogleBackendService'],
    ['goog.Promise', 'tachyfont.BackendService', 'tachyfont.FontInfo',
     'tachyfont.utils']);
goog.addDependency('../../../tachyfont/incrementalfont.js',
    ['tachyfont.IncrementalFont'],
    ['goog.Promise', 'goog.log', 'goog.log.Level', 'goog.math',
     'tachyfont.BinaryFontEditor', 'tachyfont.Browser', 'tachyfont.Cmap',
     'tachyfont.DemoBackendService', 'tachyfont.GoogleBackendService',
     'tachyfont.IncrementalFontUtils', 'tachyfont.Logger', 'tachyfont.Persist',
     'tachyfont.RLEDecoder', 'tachyfont.Reporter', 'tachyfont.chainedPromises',
     'tachyfont.promise', 'tachyfont.utils']);
goog.addDependency('../../../tachyfont/incrementalfontutils.js',
    ['tachyfont.IncrementalFontUtils'],
    ['goog.asserts', 'goog.log', 'goog.log.Level', 'tachyfont.BinaryFontEditor',
     'tachyfont.CharCmapInfo', 'tachyfont.FontInfo', 'tachyfont.Logger']);
goog.addDependency('../../../tachyfont/persist_idb.js',
    ['tachyfont.Persist'],
    ['goog.Promise', 'goog.log', 'tachyfont.Logger', 'tachyfont.Reporter']);
goog.addDependency('../../../tachyfont/rledecoder.js',
    ['tachyfont.RLEDecoder'],
    []);
goog.addDependency('../../../tachyfont/tachyfont.js',
    ['tachyfont', 'tachyfont.TachyFont'],
    ['goog.Promise', 'goog.Uri', 'goog.debug.Console', 'goog.debug.Logger',
     'goog.log', 'goog.log.Level', 'tachyfont.FontsInfo', 'tachyfont.FontsInfo',
     'tachyfont.IncrementalFont', 'tachyfont.IncrementalFontUtils',
     'tachyfont.Logger', 'tachyfont.Reporter', 'tachyfont.Reporter',
     'tachyfont.TachyFontSet', 'tachyfont.utils']);
goog.addDependency('../../../tachyfont/tachyfontlogger.js',
    [ 'tachyfont.Logger'],
    ['goog.log']);
goog.addDependency('../../../tachyfont/tachyfontpromise.js',
    [ 'tachyfont.chainedPromises', 'tachyfont.promise'],
    ['goog.Promise', 'goog.log', 'goog.log.Level', 'tachyfont.Logger',
    'tachyfont.Reporter']);
goog.addDependency('../../../tachyfont/tachyfontreporter.js',
    ['tachyfont.Reporter'],
    ['goog.log', 'tachyfont.Logger']);
goog.addDependency('../../../tachyfont/tachyfontset.js',
    ['tachyfont.TachyFontSet'],
    ['goog.Promise', 'goog.array', 'goog.log', 'goog.log.Level', 'goog.style',
     'tachyfont.IncrementalFontUtils', 'tachyfont.Logger', 'tachyfont.Reporter',
     'tachyfont.chainedPromises', 'tachyfont.utils']);
goog.addDependency('../../../tachyfont/tachyfontutils.js',
    ['tachyfont.utils', 'tachyfont.utils.IncrementalFontLoader',
    'tachyfont.utils.uint8'],
    []);
goog.addDependency('../../../tachyfont/webfonttailoralternate.js',
    ['webfonttailor.alternate'],
    ['tachyfont.FontInfo', 'tachyfont.FontsInfo']);
goog.addDependency('../../../tachyfont/webfonttailor.js',
    ['webfonttailor'],
    ['tachyfont.FontInfo', 'tachyfont.FontsInfo', 'webfonttailor.alternate']);
