'use strict';

/*
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

/**
 * Incremental font loader object
 * @param {string} fontname Name of the font which will be used as id for font
 * @param {boolean} isTTF True if it is TrueType font, else should be False
 * @constructor
 */
function IncrementalFontLoader(fontname, isTTF) {
  console.log('isTTF should come out of the base header not be passed in ' +
    'by the web page');
  this.fontname = fontname;
  this.isTTF = isTTF;
  this.metaname = fontname.replace(/-/g, '_') + '_metadata';
  this.dirty = false;
  this.newChars = false;
  window.IncrementalFonts = window.IncrementalFonts || {};
  var fontmetaobj;
  try {
    fontmetaobj = eval(this.metaname);
  }catch (e) {
    if (e instanceof ReferenceError)
      fontmetaobj = {idxExist: false};
    else
      throw e;
  }
  window.IncrementalFonts[fontname] = fontmetaobj;
}

/**
 * Find new codepoints
 * @param {string} str Input text
 * @param {Object.<number, number>} codes Codepoints to exclude from the result
 * @return {Array.<number>} New codepoints in the given text
 * @private
 */
IncrementalFontLoader.prototype.strToCodeArrayExceptCodes_ = function(str, 
  codes) {
  var len = str.length;
  var arr = [];
  var code;
  for (var i = 0; i < len; i++) {
    code = str.charCodeAt(i);
    if (!codes.hasOwnProperty(code)) {
      arr.push(code);
      codes[code] = 0;
    }
  }
  return arr;
};

/**
 * Read previously requested codepoints from filesystem
 * @param {string} idx_file Filename of the index file of the font
 * @param {FilesystemHelper} fs Filesystem To write object
 * @return {Object.<number, number>} Codepoints from the file
 * @private
 */
IncrementalFontLoader.prototype.readPersistedCharacters_ = function(idx_file, 
  fs) {
  /*return fs.getFileAs(idx_file, FilesystemHelper.TYPES.TEXT).
          then(function(idx_text) {
            if (idx_text) {
              return JSON.parse(idx_text);
            } else {
              return {0: 0};// always request .notdef
            }
          });

    */
    return window.IncrementalFonts[this.fontname].chars;
};

/**
 * Determine new codepoints
 * @param {Object.<number, number>} codes Existing codepoints
 * @param {string} text New text
 * @return {Promise} Promise to return new codepoints array
 * @private
 */
IncrementalFontLoader.prototype.determineCharacters_ = function(codes, text) {
  var that = this;
  return new Promise(function(resolve) {
    resolve(that.strToCodeArrayExceptCodes_(text, codes));
  });
};


/**
 * Request base font from the server
 * @return {Promise} Promise to return ArrayBuffer for the base font
 * @private
 */
IncrementalFontLoader.prototype.requestBaseFont_ = function() {
  return IncrementalFontUtils.requestURL('/fonts/' + this.fontname + '/base',
  'GET', null, {},
    'arraybuffer');
};

/**
 * Write font to the filesystem
 * @param {boolean} inFS True if it is in filesystem
 * @param {FilesystemHelper} fs FilesystemHelper to write font
 * @param {string} filename Filename for the font while writing
 * @return {Promise} Promise to write font to the given filesystem
 * @private
 */
IncrementalFontLoader.prototype.getBaseFont_ = function(inFS, fs, filename) {
  if (inFS) {
    //need to return array-buffer in case of insertion of new chars
    return Promise.resolve();
  } else {
    var that = this;
    return this.requestBaseFont_().
    then(function(xfer_bytes) {
      return IncrementalFontUtils.parseBaseHeader(that, xfer_bytes);
    }).
    //then(function(data) {
    //  timer.start('rleDecode');
    //  return data;
    //}).
    then(RLEDecoder.rleDecode).
    //then(function(data) {
    //  timer.end('rleDecode');
    //  timer.start('sanitizeBase');
    //  return data;
    //}).
    then(function(raw_base_font) {
      return IncrementalFontUtils.sanitizeBaseFont(that, raw_base_font);
    }).
    then(function(sanitized_base) {
      //timer.end('sanitizeBase');
      return sanitized_base;
    });

  }

};


/**
 * Write the base font to the filesystem and load it
 * @param {FilesystemHelper} fs Filesystem to be written
 * @param {function()} callback Action to take after font load
 * @return {Promise} Promise to load base font
 */
IncrementalFontLoader.prototype.getBaseToFileSystem = function(fs, callback) {
  var filename = this.fontname + '.ttf';
  var that = this;
  var doesBaseExist = window.IncrementalFonts[this.fontname].idxExist;

      return that.getBaseFont_(doesBaseExist, fs, filename).
      //then(function(sanitized_base) {
      //  // Create a blob and blob URL and set the font.
      //  return sanitized_base;
      //}).
      then(function(sanitized_base) {
        //timer.start('write base to filesystem');
        if (!doesBaseExist) {
          that.baseFont = sanitized_base;
          var fileURL = URL.createObjectURL(new Blob([sanitized_base],
            {type: 'application/font-sfnt'}));
          IncrementalFontUtils.setTheFont(that.fontname, fileURL, callback);
        }else {
          var fileURL = 'filesystem:' + window.location.protocol + '//' +
                  window.location.host + '/temporary/' + filename + '?t=' +
                  Date.now();
          IncrementalFontUtils.setTheFont(that.fontname, fileURL, callback);
        }

        //return fs.writeToTheFile(filename, sanitized_base,
        //  'application/octet-stream');
      });/*.
      then(function(data) {
        //timer.end('write base to filesystem');
        return data;
      })*/



  /*var fileURLReady = baseFontPersisted.
                       then(function() {
                         return fs.getFileURL(filename);
                       });

  return fileURLReady.
          then(function(fileURL) {
            IncrementalFontUtils.setTheFont(that.fontname, fileURL, callback);
          });*/
};

/**
 * Request glyph data for this text and write to the filesystem
 * @param {FilesystemHelper} fs Filesystem to be written
 * @param {string} text New text
 * @return {Promise} Promise to get glyph data
 */
IncrementalFontLoader.prototype.requestGlyphs = function(fs, text) {
  // time_start('request glyphs')

  var INDEXFILENAME = this.fontname + '.idx';
  var that = this;
  var doesIdxExist = window.IncrementalFonts[this.fontname].idxExist;

  var injectedChars;
  if (doesIdxExist)
    injectedChars = that.readPersistedCharacters_(INDEXFILENAME, fs);
  else
    injectedChars = {};


  var charsDetermined = that.determineCharacters_(injectedChars, text);


  var indexUpdated = charsDetermined.
                        then(function(results) {
                          if (results.length) {
                            that.newChars = true;
                            window.IncrementalFonts[that.fontname].chars =
                                    injectedChars;
                            window.IncrementalFonts[that.fontname].idxExist =
                                    true;
                          }else {
                            that.newChars = false;
                          }
                        });

  var bundleReady = Promise.all([charsDetermined, indexUpdated]).
                        then(function(arr) {
                          // time_end('request glyphs')
                          if (arr[0].length) {
                            return IncrementalFontUtils.requestCodepoints(that.fontname, arr[0]);
                          } else {
                            return null;
                          }
                        });

  return bundleReady;
};

/**
 * Inject the bundle to the base font and load updated font
 * @param {type} bundle New glyph data
 * @param {function()} callback Action to take after font load
 * @return {Promise} Promise to inject bundle and load the new font
 */
IncrementalFontLoader.prototype.injectBundle = function(bundle, callback) {
  // time_start('inject bundle')
  var that = this;
  if (bundle != null) {
    var charsInjected = IncrementalFontUtils.injectCharacters(that, that.baseFont, bundle);
    var fileURL = URL.createObjectURL(new Blob([charsInjected],
        {type: 'application/font-sfnt'}));
    IncrementalFontUtils.setTheFont(that.fontname, fileURL, callback);
  }

  return Promise.resolve();
};

/**
 * Update the base font using new glyphs in the text
 * @param {FilesystemHelper} fs Filesystem to be written
 * @param {string} text New text
 * @param {function()} callback Action to take after font load
 * @return {Promise} Promise to update base font using new text and load it
 */
IncrementalFontLoader.prototype.incrUpdate = function(fs, text, callback) {

  // time_start('incrUpdate')
  var FILENAME = this.fontname + '.ttf';
  var that = this;
  var bundleReady = that.requestGlyphs(fs, text);

  return bundleReady.
          then(function(bundle) {
            that.injectBundle(bundle, callback);
            // time_end('incrUpdate')
          });
};

/**
 * Persist the current base font and metadata about to filesystem
 * @param {Promise} ready Promise to indicate it is ready to persist
 * @param {FilesystemHelper} fs Filesystem to be written
 * @return {Promise} Promise to persist state if changed
 */
IncrementalFontLoader.prototype.persistState = function(ready, fs) {

   var that = this;

    var metaUpdated = ready.then(function() {
      if (that.newChars)
        fs.writeToTheFile(that.metaname + '.js', 'var ' + that.metaname +
            ' = ' + JSON.stringify(window.IncrementalFonts[that.fontname]) +
            ';', 'text/plain');
    });

    var baseUpdated = ready.then(function() {
      if (that.dirty)
      fs.writeToTheFile(that.fontname + '.ttf', that.baseFont,
        'application/font-sfnt');
    });

    return Promise.all([metaUpdated, baseUpdated]);
};
