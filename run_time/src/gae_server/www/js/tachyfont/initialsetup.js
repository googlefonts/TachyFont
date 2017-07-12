'use strict';

/**
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


(function() {

  // Declares the public namespace. This is used to make items publically
  // visible.
  var initialsetup = {};

  /** @type {boolean} Indicates a DOM mutation has occured. */
  initialsetup['DomMutationObserved'] = false;

  // Create a DOM mutation observer.
  var observer = new MutationObserver(function(mutations) {
    initialsetup['DomMutationObserved'] = true;
  });
  // Watch for these mutations.
  var config = /** @type {!MutationObserverInit} */ ({ 'childList': true,
    'subtree': true, 'characterData': true });
  observer.observe(document.documentElement, config);

  /** @type {boolean} Indicates the DOM content is fully loaded. */
  initialsetup['DomContentLoaded'] = false;

  // Check the DOM when it reports loading the page is done.
  document.addEventListener("DOMContentLoaded", function(event) {
    initialsetup['DOMContentLoaded'] = true;
  });


  /**
   * Do the Exports.
   */
  window['tachyfont_initialsetup'] = initialsetup;
})();
