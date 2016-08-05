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

goog.provide('tachyfont.Logger');

goog.require('goog.log');

if (goog.DEBUG) {
  /**
   * A class variable to limit initialization to a single time.
   *
   * @private {boolean}
   */
  tachyfont.Logger.hasInitialized_ = false;

  /**
   * For test allow reinitializing the logger.
   * @param {boolean} hasInitialized
   */
  tachyfont.Logger.setHasInitialized = function(hasInitialized) {
    tachyfont.Logger.hasInitialized_ = hasInitialized;
  };

  /**
   * Initialize the logger.
   * @param {?goog.debug.Logger.Level} debugLevel The desired debug level.
   */
  tachyfont.Logger.init = function(debugLevel) {
    if (tachyfont.Logger.hasInitialized_) {
      throw new Error('logger already initialized');
    }

    tachyfont.Logger.hasInitialized_ = true;

    /**
     * @type {?goog.debug.Logger}
     */
    tachyfont.Logger.logger = goog.log.getLogger('tachyfont', debugLevel);
  };
}

