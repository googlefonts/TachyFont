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
 * FilesystemHelper class to call filesystem API in much more convenient way
 * @param {Promise} filesystemReady Promise to get filesystem from system
 * @param {boolean} assumeEmpty Flag to ignore contents of the filesystem
 * @constructor
 */
function FilesystemHelper(filesystemReady, assumeEmpty) {
  this.filesystemReady = filesystemReady;
  this.assumeEmpty = assumeEmpty;
}

/**
 * Enum for types used in file reader
 * @enum {number}
 */
FilesystemHelper.TYPES = {
    ARRAYBUFFER: 0,
    TEXT: 1,
    BINARYSTRING: 2,
    DATAURL: 3
};

/**
 * Request temporary filesystem
 * @param {number} requestedSize Size requested in bytes
 * @returns {Promise} Promise to return filesystem
 */
FilesystemHelper.requestTemporaryFileSystem = function(requestedSize) {
  window.requestFileSystem = window.requestFileSystem || 
          window.webkitRequestFileSystem;
  return new Promise(function(resolve, reject) {
    window.requestFileSystem(window.TEMPORARY, requestedSize, resolve, reject);
  });
};

/**
 * Creates file writer for this file entry
 * @param {FileEntry} fileEntry
 * @return {Promise} Promise to return file writer
 * @private
 */
FilesystemHelper.prototype.createFileWriter_ = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    fileEntry.createWriter(function(fw) {
      resolve(fw);
    }, reject);
  });
};

/**
 * Gets file entry for the given filename
 * @param {string} filename
 * @param {boolean} toCreate If false, gives error if file does not exits, else
 * creates the file
 * @return {Promise} Promise to return file entry
 * @private
 */
FilesystemHelper.prototype.getFileEntry_ = function(filename, toCreate) {
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
 * Get file object from file entry
 * @param {FileEntry} fileEntry
 * @return {Promise} Promise to return file object
 * @private
 */
FilesystemHelper.prototype.getFileObject_ = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    fileEntry.file(function(file) {
      resolve(file);
    }, reject);
  });
};

/**
 * Get file writer for given filename, if not exist create the file
 * @param {string} filename
 * @return {Promise} Promise to return file writer
 * @private
 */
FilesystemHelper.prototype.getFileWriter_ = function(filename) {
  return this.getFileEntry_(filename, true).then(this.createFileWriter_);
};

/**
 * Checks if file exists in the filesystem
 * @param {string} filename
 * @return {Promise} Promise to return existence of the file
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
 * Write given content to file which is found by filename
 * @param {string} filename
 * @param {type} content
 * @param {string} contentType
 * @return {Promise} Promise to write content to the file
 */
FilesystemHelper.prototype.writeToTheFile = function(filename, content, 
  contentType) {
  return this.getFileWriter_(filename).then(function(fileWriter) {
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
 * Read content of the file as specified
 * @param {string} filename
 * @param {FilesystemHelper.TYPES} type Reader type
 * @return {Promise} Promise to return content
 */
FilesystemHelper.prototype.getFileAs = function(filename, type) {
  return this.getFileEntry_(filename, true).then(this.getFileObject_).then(
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
 * Return file url for the given filename
 * @param {string} filename
 * @return {Promise} Promise to return file url
 */
FilesystemHelper.prototype.getFileURL = function(filename) {
  return this.getFileEntry_(filename, false).then(function(fe) {
    return fe.toURL();
  });
};
