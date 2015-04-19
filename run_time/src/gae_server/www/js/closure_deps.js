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
    ['goog.Promise', 'goog.net.XhrIo', 'goog.events', 'goog.net.EventType']);
goog.addDependency('../../../tachyfont/charcmapinfo.js',
    ['tachyfont.CharCmapInfo'],
    []);
goog.addDependency('../../../tachyfont/demobackendservice.js',
    ['tachyfont.DemoBackendService'],
    ['goog.Promise', 'goog.net.XhrIo', 'goog.events', 'goog.net.EventType',
     'tachyfont.BackendService'
    ]);
goog.addDependency('../../../tachyfont/googlebackendservice.js',
    ['tachyfont.GoogleBackendService'],
    ['goog.Promise', 'tachyfont.BackendService']);
goog.addDependency('../../../tachyfont/binaryfonteditor.js',
    ['tachyfont.BinaryFontEditor'],
    []);
goog.addDependency('../../../tachyfont/glyphbundleresponse.js',
    ['tachyfont.GlyphBundleResponse'],
    []);
goog.addDependency('../../../tachyfont/fontinfo.js',
    ['tachyfont.FontInfo'],
    []);
goog.addDependency('../../../tachyfont/fontsinfo.js',
    ['tachyfont.FontsInfo'],
    ['tachyfont.FontInfo']);
goog.addDependency('../../../tachyfont/incrementalfont.js',
    ['tachyfont.IncrementalFont', 'tachyfont.TachyFont'],
    ['goog.Promise', 'goog.log', 'tachyfont.DemoBackendService',
     'tachyfont.GoogleBackendService', 'tachyfont.IncrementalFontUtils',
     'tachyfont.promise', 'tachyfont.RLEDecoder'
    ]);
goog.addDependency('../../../tachyfont/incrementalfontutils.js',
    ['tachyfont.IncrementalFontUtils'],
    ['goog.log', 'tachyfont.BinaryFontEditor']);
goog.addDependency('../../../misc_utils.js',
    ['tachyfont_misc_utils'],
    []);
goog.addDependency('../../../tachyfont/rledecoder.js',
    ['tachyfont.RLEDecoder'],
    []);
goog.addDependency('../../../tachyfont/tachyfontpromise.js',
    ['tachyfont.promise', 'tachyfont.chainedPromises'],
    ['goog.Promise']);
goog.addDependency('../../../tachyfont/tachyfontset.js',
    ['tachyfont.TachyFontSet'],
    ['goog.array', 'goog.Promise', 'goog.log', 'goog.style',
     'tachyfont.IncrementalFontUtils', 'tachyfont.chainedPromises'
    ]);
goog.addDependency('../../../tachyfont/webfonttailor.js',
    ['webfonttailor'],
    ['tachyfont.FontInfo',
     'tachyfont.FontsInfo'
    ]);
goog.addDependency('../../../tachyfont/webfonttailoralternate.js',
    ['webfonttailor.alternate'],
    ['tachyfont.FontInfo',
     'tachyfont.FontsInfo'
    ]);
