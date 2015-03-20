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
goog.addDependency('../../../backendservice.js',
    ['tachyfont.BackendService', 'tachyfont.GoogleBackendService'],
    ['goog.Promise', 'goog.net.XhrIo', 'goog.events', 'goog.net.EventType']);
goog.addDependency('../../../binaryfonteditor.js',
    ['tachyfont.BinaryFontEditor'],
    []);
goog.addDependency('../../../incrementalfontutils.js',
    ['tachyfont.IncrementalFontUtils'],
    ['tachyfont.BinaryFontEditor']);
goog.addDependency('../../../rledecoder.js',
    ['tachyfont.RLEDecoder'],
    []);
goog.addDependency('../../../tachyfontset.js',
    ['tachyfont.TachyFontSet'],
    ['tachyfont.IncrementalFontUtils', 'tachyfont.chainedPromises']);
goog.addDependency('../../../tachyfontpromise.js',
    ['tachyfont.promise', 'tachyfont.chainedPromises'],
    ['goog.Promise']);
goog.addDependency('../../../webfonttailor.js',
    ['webfonttailor', 'webfonttailor.FontsInfo'],
    []);
