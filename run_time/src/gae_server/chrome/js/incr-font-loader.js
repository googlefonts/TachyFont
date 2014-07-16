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
 * @param {type} fontname
 * @param {type} isTTF
 * @constructor
 */
function IncrementalFontLoader(fontname, isTTF) {
  this.fontname = fontname;
  this.isTTF = isTTF;

}

/**
 * @type type
 */
IncrementalFontLoader.FLAGS = {
    HAS_HMTX: 1,
    HAS_VMTX: 2,
    HAS_CFF: 4
};

/**
 * @type Number
 */
IncrementalFontLoader.LOCA_BLOCK_SIZE = 64;

/**
 * @param {type} str
 * @param {type} codes
 * @return {IncrementalFontLoader.prototype.strToCodeArrayExceptCodes_.arr|Array}
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
 * @param {type} idx_file
 * @param {type} fs
 * @return {Object}
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
 * @param {type} codes
 * @param {type} text
 * @return {Promise}
 * @private
 */
IncrementalFontLoader.prototype.determineCharacters_ = function(codes, text) {
  var that = this;
  return new Promise(function(resolve) {
    resolve(that.strToCodeArrayExceptCodes_(text, codes));
  });
};

/**
 * @param {type} chars
 * @return {unresolved}
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
 * @param {type} font_src
 * @param {type} callback
 * @return {undefined}
 * @private
 */
IncrementalFontLoader.prototype.setTheFont_ = function(font_src, callback) {
  font_src += ('?t=' + Date.now());
  console.log(font_src);
  var font = new FontFace(this.fontname, 'url(' + font_src + ')', {});
  document.fonts.add(font);
  font.load().
        then(callback);
};

/**
 * @return {unresolved}
 * @private
 */
IncrementalFontLoader.prototype.requestBaseFont_ = function() {
  return requestURL('/fonts/' + this.fontname + '/base', 'GET', null, {},
    'arraybuffer');
};

/**
 * @param {type} inFS
 * @param {type} fs
 * @param {type} filename
 * @return {IncrementalFontLoader.prototype@call;requestBaseFont_@call;
 * then@call;then@call;then}
 * @private
 */
IncrementalFontLoader.prototype.getBaseFont_ = function(inFS, fs, filename) {
  if (inFS) {
    return Promise.resolve();
  } else {
    var that = this;
    return this.requestBaseFont_().
                  then(rleDecode).
                  then(that.sanitizeBaseFont_.bind(that)).
                  then(function(sanitized_base) {
                    return fs.writeToTheFile(filename, sanitized_base,
                      'application/octet-stream');
                  });
  }

};

/**
 * @param {type} baseFont
 * @return {unresolved}
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
 * @param {type} baseFont
 * @param {type} glyphData
 * @return {unresolved}
 * @private
 */
IncrementalFontLoader.prototype.injectCharacters_ = function(baseFont,
  glyphData) {
  // time_start('inject')
  var glyphParser = new Parser(new DataView(glyphData), 0);
  console.log('bundle size:' + glyphData.byteLength);
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
  console.log('injection is done!');
  // time_end('inject')

  return baseFont;
};

/**
 * @param {type} fs
 * @param {type} callback
 * @return {unresolved}
 */
IncrementalFontLoader.prototype.getBaseToFileSystem = function(fs, callback) {
  // time_start('getBaseToFileSystem');
  var filename = this.fontname + '.ttf';
  var that = this;
  var doesBaseExist = fs.checkIfFileExists(filename);
  var baseFontPersisted = doesBaseExist.
                            then(function(doesExist) {
                              return that.getBaseFont_(doesExist, fs, filename);
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
 * @param {type} fs
 * @param {type} text
 * @return {unresolved}
 */
IncrementalFontLoader.prototype.requestGlyphs = function(fs, text) {
  // time_start('request glyphs')

  var INDEXFILENAME = this.fontname + '.idx';
  var that = this;
  var doesIdxExist = fs.checkIfFileExists(INDEXFILENAME);

  var injectedChars = doesIdxExist.
                        then(function(doesExist) {
                          if (doesExist)
                            return that.readPersistedCharacters_(INDEXFILENAME,
                              fs);
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
 * @param {type} fs
 * @param {type} bundle
 * @param {type} callback
 * @return {unresolved}
 */
IncrementalFontLoader.prototype.injectBundle = function(fs, bundle, callback) {
  // time_start('inject bundle')
  var filename = this.fontname + '.ttf';
  var that = this;
  var charsInjected, fileUpdated;
  if (bundle != null) {
    charsInjected = fs.getFileAs(filename, FilesystemHelper.TYPES.ARRAYBUFFER).
                      then(function(baseFont) {
                        return that.injectCharacters_(baseFont, bundle);
                      });

    fileUpdated = charsInjected.
                    then(function(newBase) {
                      return fs.writeToTheFile(filename, newBase,
                        'application/octet-stream');
                      });
  } else {
    charsInjected = fileUpdated = Promise.resolve();
  }

  var fileURLReady = fileUpdated.
                      then(function() {
                        return fs.getFileURL(filename);
                      });

  return fileURLReady.
          then(function(fileURL) {
            // time_end('inject bundle')
            that.setTheFont_(fileURL, callback);
          });

};

/**
 * @param {type} fs
 * @param {type} text
 * @param {type} callback
 * @return {unresolved}
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
