'use strict';

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

goog.provide('tachyfont.log');

goog.require('goog.debug.Logger');
goog.require('goog.log');
goog.require('goog.log.Level');


/**
 * @type {?goog.debug.Logger.Level}
 */
tachyfont.log.level = goog.debug.Logger.Level.INFO;


/**
 * @type {?goog.debug.Logger}
 */
tachyfont.log.logger = null;


/**
 * Gets the logging level.
 * @return {?goog.debug.Logger.Level} The current log level.
 */
tachyfont.log.getLogLevel = function() {
  return tachyfont.log.level;
};


/**
 * Sets the logging level.
 * @param {?goog.debug.Logger.Level} level The new log level.
 */
tachyfont.log.setLogLevel = function(level) {
  tachyfont.log.level = level;
  tachyfont.log.logger = goog.log.getLogger('tachyfont', level);
};


/**
 * Gets the logger.
 * @return {?goog.debug.Logger}
 */
tachyfont.log.getLogger = function() {
  if (!tachyfont.log.logger) {
    tachyfont.log.logger = goog.log.getLogger('tachyfont', tachyfont.log.level);
  }
  return tachyfont.log.logger;
};


/**
 * Sets the logger.
 * @param {?goog.debug.Logger} logger The new logger.
 */
tachyfont.log.setLogger = function(logger) {
  tachyfont.log.logger = logger;
};


/**
 * Sends a log message if the log level is info of lower.
 * @param {string} message The message to log.
 */
tachyfont.log.info = function(message) {
  var logger = tachyfont.log.getLogger();
  goog.log.log(logger, goog.log.Level.INFO, message);
};


/**
 * Sends a log message if the log level is warning of lower.
 * @param {string} message The message to log.
 */
tachyfont.log.warning = function(message) {
  var logger = tachyfont.log.getLogger();
  goog.log.log(logger, goog.log.Level.WARNING, message);
};


/**
 * Sends a log message if the log level is severe of lower.
 * @param {string} message The message to log.
 */
tachyfont.log.severe = function(message) {
  var logger = tachyfont.log.getLogger();
  goog.log.log(logger, goog.log.Level.SEVERE, message);
};
