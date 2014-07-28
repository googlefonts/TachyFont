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
 * Incremental font loader utilities.
 */
var IncrementalFontUtils = {};

/**
 * Segment size in the loca table
 * @const {number}
 */
IncrementalFontUtils.LOCA_BLOCK_SIZE = 64;


/**
 * Parses base font header, set properties
 * @param {ArrayBuffer} baseFont Base font with header
 * @return {ArrayBuffer} Base font without header
 * @private
 */
IncrementalFontUtils.parseBaseHeader = function(obj, baseFont) {

    var binEd = new BinaryFontEditor(new DataView(baseFont), 0);
    var results = binEd.parseBaseHeader();
    if (results.headerInfo) {
      console.log('we should set a headerInfo member rather that randomly ' +
        'setting values on the object like this');
      obj.version = results.version;
      obj.headSize = results.headSize;
      for (var key in results.headerInfo) {
        obj[key] = results.headerInfo[key];
      }
      baseFont = baseFont.slice(results.headSize);
    }
    return baseFont;
};


/**
 * Request codepoints from server
 * @param {String} fontname The fontname.
 * @param {Array.<number>} chars Codepoints to be requested
 * @return {Promise} Promise to return ArrayBuffer for the response bundle
 * @private
 */
IncrementalFontUtils.requestCharacters = function(fontname, chars) {

  return IncrementalFontUtils.requestURL('/incremental_fonts/request', 'POST',
  JSON.stringify({
      'font': fontname,
      'arr': chars
  }), {
    'Content-Type': 'application/json'
  }, 'arraybuffer');
};




//var fetchCnt = 0;
/**
 * Async XMLHttpRequest to given url using given method, data and header
 * @param {string} url Destination url
 * @param {string} method Request method
 * @param {type} data Request data
 * @param {Object} headerParams Request headers
 * @param {string} responseType Response type
 * @return {Promise} Promise to return response
 */
IncrementalFontUtils.requestURL = function(url, method, data, headerParams, 
                                           responseType) {
  //var cnt = fetchCnt++;
  //timer.start('fetch ' + cnt + ' ' + url);
  return new Promise(function(resolve, reject) {
    var oReq = new XMLHttpRequest();
    oReq.open(method, url, true);
    for (var param in headerParams)
      oReq.setRequestHeader(param, headerParams[param]);
    oReq.responseType = responseType;
    oReq.onload = function(oEvent) {
      if (oReq.status == 200) {
        //timer.end('fetch ' + cnt + ' ' + url);
        resolve(oReq.response);
      } else
        reject(oReq.status + ' ' + oReq.statusText);
    };
    oReq.onerror = function() {
      reject(Error('Network Error'));
    };
    oReq.send(data);
  });
};


/**
 * Sanitize base font to pass OTS
 * @param {ArrayBuffer} baseFont Base font as ArrayBuffer
 * @return {ArrayBuffer} Sanitized base font
 */
IncrementalFontUtils.sanitizeBaseFont = function(obj, baseFont) {

  if (obj.isTTF) {
    obj.dirty = true;
    var binEd = new BinaryFontEditor(new DataView(baseFont), 0);
    var glyphOffset = obj.glyphOffset;
    var glyphCount = obj.numGlyphs;
    var glyphSize, thisOne, nextOne;
    for (var i = (IncrementalFontUtils.LOCA_BLOCK_SIZE - 1); i < glyphCount;
    i += IncrementalFontUtils.LOCA_BLOCK_SIZE) {
        thisOne = binEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, i);
        nextOne = binEd.getGlyphDataOffset(obj.glyphDataOffset,
        obj.offsetSize, i + 1);
      glyphSize = nextOne - thisOne;
      if (glyphSize) {
          binEd.seek(glyphOffset + thisOne);
          binEd.setInt16_(-1);
      }
    }
  }
  return baseFont;
};

/**
 * Add and load the font
 * @param {String} fontname The fontname
 * @param {string} font_src Data url of the font
 * @param {function()} callback Action to take when font is loaded
 */
IncrementalFontUtils.setTheFont = function(fontname, font_src, callback) {
  console.log(font_src);
  var font = new FontFace(fontname, 'url(' + font_src + ')', {});
  document.fonts.add(font);
  font.load().then(callback);
};


