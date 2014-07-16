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
  this.fontname = fontname;
  this.isTTF = isTTF;

}

/**
 * Enum for flags in the coming glyph bundle
 * @enum {number}
 */
IncrementalFontLoader.FLAGS = {
    HAS_HMTX: 1,
    HAS_VMTX: 2,
    HAS_CFF: 4
};

/**
 * Segment size in the loca table
 * @const {number}
 */
IncrementalFontLoader.LOCA_BLOCK_SIZE = 64;

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
  return fs.getFileAs(idx_file, FilesystemHelper.TYPES.TEXT).
          then(function(idx_text) {
            if (idx_text) {
              return JSON.parse(idx_text);
            } else {
              return {0: 0};// always request .notdef
            }
          });
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
 * Request codepoints from server
 * @param {Array.<number>} chars Codepoints to be requested
 * @return {Promise} Promise to return ArrayBuffer for the response bundle
 * @private
 */
IncrementalFontLoader.prototype.requestCharacters_ = function(chars) {

  return requestURL('/incremental_fonts/request', 'POST', JSON.stringify({
      'font': this.fontname,
      'arr': chars
  }), {
    'Content-Type': 'application/json'
  }, 'arraybuffer');
};

/**
 * Add and load the font
 * @param {string} font_src Data url of the font
 * @param {function()} callback Action to take when font is loaded
 * @private
 */
IncrementalFontLoader.prototype.setTheFont_ = function(font_src, callback) {
  font_src += ('?t=' + Date.now());
  console.log(font_src);
  var font = new FontFace(this.fontname, 'url(' + font_src + ')', {});
  document.fonts.add(font);
  font.load().then(callback);
};

/**
 * Request base font from the server
 * @return {Promise} Promise to return ArrayBuffer for the base font
 * @private
 */
IncrementalFontLoader.prototype.requestBaseFont_ = function() {
  return requestURL('/fonts/' + this.fontname + '/base', 'GET', null, {},
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
    return Promise.resolve();
  } else {
    var that = this;
    return this.requestBaseFont_().
            then(RLEDecoder.rleDecode).
            then(that.sanitizeBaseFont_.bind(that)).
            then(function(sanitized_base) {
              return fs.writeToTheFile(filename, sanitized_base,
                'application/octet-stream');
            });
  }

};

/**
 * Sanitize base font to pass OTS
 * @param {ArrayBuffer} baseFont Base font as ArrayBuffer
 * @return {ArrayBuffer} Sanitized base font
 * @private
 */
IncrementalFontLoader.prototype.sanitizeBaseFont_ = function(baseFont) {

  if (this.isTTF) {

    // time_start('sanitize');
    var fontObj = parseFont(baseFont);
    var fontParser = new Parser(new DataView(baseFont), 0);
    var glyphOffset = fontObj.glyfOffset;
    var glyphCount = fontObj.numGlyphs;
    var glyphSize;
    for (var i = (IncrementalFontLoader.LOCA_BLOCK_SIZE - 1); i < glyphCount;
    i += IncrementalFontLoader.LOCA_BLOCK_SIZE) {
      glyphSize = fontObj.loca[i + 1] - fontObj.loca[i];
      if (glyphSize)
        fontParser.writeShortByOffset(glyphOffset + fontObj.loca[i], -1);
    }
    // time_end('sanitize');
  }
  return baseFont;
};

/**
 * Inject glyphs in the glyphData to the baseFont
 * @param {ArrayBuffer} baseFont Current base font
 * @param {ArrayBuffer} glyphData New glyph data
 * @return {ArrayBuffer} Updated base font
 * @private
 */
IncrementalFontLoader.prototype.injectCharacters_ = function(baseFont,
  glyphData) {
  // time_start('inject')
  var glyphParser = new Parser(new DataView(glyphData), 0);
  var fontParser = new Parser(new DataView(baseFont), 0);
  var fontObj = parseFont(baseFont);
  var count = glyphParser.parseUShort();
  var flags = glyphParser.parseByte();

  var glyphOffset, locaOffset;
  if (flags & IncrementalFontLoader.FLAGS.HAS_CFF)
    glyphOffset = fontObj.cffOffset;
  else {
    glyphOffset = fontObj.glyfOffset;
    locaOffset = fontObj.locaOffset;
  }
  console.log('count ' + count);
  for (var i = 0; i < count; i += 1) {
    var id = glyphParser.parseUShort();
    var hmtx, vmtx;
    if (flags & IncrementalFontLoader.FLAGS.HAS_HMTX) {
      hmtx = glyphParser.parseUShort();
      fontObj.metrics[id][1] = hmtx;
    }
    if (flags & IncrementalFontLoader.FLAGS.HAS_VMTX) {
      vmtx = glyphParser.parseUShort();
    }
    var offset = glyphParser.parseULong();
    var length = glyphParser.parseUShort();

    if (!(flags & IncrementalFontLoader.FLAGS.HAS_CFF)) {
      fontObj.loca[id] = offset;
      var isChanged = (fontObj.loca[id + 1] != offset + length);
      fontObj.loca[id + 1] = offset + length;
      var prev_id = id - 1;
      while (prev_id >= 0 && fontObj.loca[prev_id] > offset) {
        fontObj.loca[prev_id] = offset;
        prev_id--;
      }
      /*
       * if value is changed and length is nonzero we should write -1
       */
      if (length > 0 && isChanged)
        fontParser.writeShortByOffset(glyphOffset + fontObj.loca[id + 1], -1);
    }

    var bytes = glyphParser.parseBytes(length);
    fontParser.setBytes(glyphOffset + offset, bytes);
  }
  if (!(flags & IncrementalFontLoader.FLAGS.HAS_CFF))
    fontParser.writeLoca(fontObj);
  if (flags & IncrementalFontLoader.FLAGS.HAS_HMTX)
    fontParser.writeHmtx(fontObj);
  // time_end('inject')

  return baseFont;
};

/**
 * Write the base font to the filesystem and load it
 * @param {FilesystemHelper} fs Filesystem to be written
 * @param {function()} callback Action to take after font load
 * @return {Promise} Promise to load base font
 */
IncrementalFontLoader.prototype.getBaseToFileSystem = function(fs, callback) {
  // time_start('getBaseToFileSystem');
  var filename = this.fontname + '.ttf';
  var that = this;
  var doesBaseExist = fs.checkIfFileExists(filename);
  var baseFontPersisted = doesBaseExist.then(function(doesExist) {
                                                return that.getBaseFont_(
                                                        doesExist, fs,
                                                filename);
                                            });

  var fileURLReady = baseFontPersisted.
                       then(function() {
                         return fs.getFileURL(filename);
                       });

  return fileURLReady.
          then(function(fileURL) {
            that.setTheFont_(fileURL, callback);
            // time_end('getBaseToFileSystem');
          });

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
  var doesIdxExist = fs.checkIfFileExists(INDEXFILENAME);

  var injectedChars = doesIdxExist.then(function(doesExist) {
                                        if (doesExist)
                                          return that.readPersistedCharacters_(
                                              INDEXFILENAME, fs);
                                        else
                                          return {};
                                        });

  var charsDetermined = injectedChars.then(function(chars) {
    return that.determineCharacters_(chars, text);
  });

  var indexUpdated = Promise.all([charsDetermined, injectedChars]).
                        then(function(results) {
                          if (results[0].length) {
                            return fs.writeToTheFile(INDEXFILENAME,
                              JSON.stringify(results[1]), 'text/plain');
                          }
                        });

  var bundleReady = Promise.all([charsDetermined, indexUpdated]).
                        then(function(arr) {
                          // time_end('request glyphs')
                          if (arr[0].length) {
                            return that.requestCharacters_(arr[0]);
                          } else {
                            return null;
                          }
                        });

  return bundleReady;
};

/**
 * Inject the bundle to the base font and load updated font
 * @param {FilesystemHelper} fs Filesystem to be written
 * @param {type} bundle New glyph data
 * @param {function()} callback Action to take after font load
 * @return {Promise} Promise to inject bundle and load the new font
 */
IncrementalFontLoader.prototype.injectBundle = function(fs, bundle, callback) {
  // time_start('inject bundle')
  var filename = this.fontname + '.ttf';
  var that = this;
  var charsInjected, fileUpdated;
  if (bundle != null) {
    charsInjected = fs.getFileAs(filename,
    FilesystemHelper.TYPES.ARRAYBUFFER).then(function(baseFont) {
                        return that.injectCharacters_(baseFont, bundle);
                      });

    fileUpdated = charsInjected.then(function(newBase) {
        return fs.writeToTheFile(filename, newBase, 'application/octet-stream');
    });
  } else {
    charsInjected = fileUpdated = Promise.resolve();
  }

  var fileURLReady = fileUpdated.then(function() {
      return fs.getFileURL(filename);
  });

  return fileURLReady.then(function(fileURL) {
      // time_end('inject bundle')
      that.setTheFont_(fileURL, callback);
  });

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
            that.injectBundle(fs, bundle, callback);
            // time_end('incrUpdate')
          });
};
