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
 *
 * @param {type} filesystemReady
 * @param {type} assumeEmpty
 * @constructor
 */
function FilesystemHelper(filesystemReady, assumeEmpty) {
  this.filesystemReady = filesystemReady;
  this.assumeEmpty = assumeEmpty;
}
/**
 *
 * @type type
 */
FilesystemHelper.TYPES = {
    ARRAYBUFFER: 0,
    TEXT: 1,
    BINARYSTRING: 2,
    DATAURL: 3
};
/**
 *
 * @param {type} fileEntry
 * @return {Promise}
 */
FilesystemHelper.prototype._createFileWriter = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    fileEntry.createWriter(function(fw) {
      resolve(fw);
    }, reject);
  });
};
/**
 *
 * @param {type} filename
 * @param {type} toCreate
 * @return {FilesystemHelper.prototype@pro;filesystemReady@call;then}
 */
FilesystemHelper.prototype._getFileEntry = function(filename, toCreate) {
  return this.filesystemReady.then(function(fs) {
    return new Promise(function(resolve, reject) {
      fs.root.getFile(filename, {
        create: toCreate
      }, function(fileEntry) {
        resolve(fileEntry);
      }, reject);
    });
  });
};
/**
 *
 * @param {type} fileEntry
 * @return {Promise}
 */
FilesystemHelper.prototype._getFileObject = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    fileEntry.file(function(file) {
      resolve(file);
    }, reject);
  });
};
/**
 *
 * @param {type} filename
 * @return {FilesystemHelper.prototype@call;getFileEntry@call;then}
 */
FilesystemHelper.prototype._getFileWriter = function(filename) {
  return this._getFileEntry(filename, true).then(this._createFileWriter);
};

/**
 *
 * @param {type} filename
 * @return {FilesystemHelper.prototype@pro;filesystemReady@call;then}
 */
FilesystemHelper.prototype.checkIfFileExists = function(filename) {
  return this.filesystemReady.then(function(fs) {
    return new Promise(function(resolve, reject) {
      var exists = false;
      fs.root.createReader().readEntries(function(entries) {
        exists = entries.some(function(elem) {
          return elem.name == filename;
        });
      });
      resolve(exists && !this.assumeEmpty);

    });
  });
};
/**
 *
 * @param {type} filename
 * @param {type} content
 * @param {type} contentType
 * @return {FilesystemHelper.prototype@call;getFileWriter@call;then}
 */
FilesystemHelper.prototype.writeToTheFile = function(filename, content, 
  contentType) {
  return this._getFileWriter(filename).then(function(fileWriter) {
    return new Promise(function(resolve, reject) {
      fileWriter.onwriteend = function(e) {
        resolve(e);
      };
      fileWriter.onerror = function(e) {
        reject(e);
      };
      fileWriter.write(new Blob([
        content
      ], {
        type: contentType
      }));
    });
  });
};
/**
 *
 * @param {type} filename
 * @param {type} type
 * @return {FilesystemHelper.prototype@call;getFileEntry@call;then@call;then}
 */
FilesystemHelper.prototype.getFileAs = function(filename, type) {
  return this._getFileEntry(filename, true).then(this._getFileObject).then(
    function(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function(e) {
        resolve(e.target.result);
      };
      reader.onerror = reject;
      switch (type) {
        case FilesystemHelper.TYPES.ARRAYBUFFER:
          reader.readAsArrayBuffer(file);
          break;
        case FilesystemHelper.TYPES.TEXT:
          reader.readAsText(file);
          break;
        case FilesystemHelper.TYPES.BINARYSTRING:
          reader.readAsBinaryString(file);
          break;
        case FilesystemHelper.TYPES.DATAURL:
          reader.readAsDataURL(file);
          break;
        default:
          reject();
          break;
      }
    });
  });
};
/**
 *
 * @param {type} filename
 * @return {FilesystemHelper.prototype@call;getFileEntry@call;then}
 */
FilesystemHelper.prototype.getFileURL = function(filename) {
  return this._getFileEntry(filename, false).then(function(fe) {
    return fe.toURL();
  });
};
