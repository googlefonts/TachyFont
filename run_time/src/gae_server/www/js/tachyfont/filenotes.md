backendservice.js
=================
Builds the URL for the specific base/char-data server; eg,

   * the open source Google App Engine server
   * a company specific server

binaryfonteditor.js
===================
Routines to read/write binary data from/to a Javascript DataView

closure_deps.js
===============
Include this file to pull in all the goog.require(...) TachyFont Javascript 
files. Note: Cannot immediately call TachyFont in the &lt;head\> because 
Closure appends the Javascript files to the end of &lt;head>.

glyphbundleresponse.js
======================
Helps with the url fetched char data .

incrementalfont.js
==================
Code to retrieve and process an incremental font.

incrementalfontutils.js
=======================
Utility routines for retrieving/processing an incremental font. 
These routines are not associated with an object.

rledecoder.js
=============
Code to decode Run Length Encoded data.

tachyfont.js
============
Defines the namespace and exported routines.

tachyfontpromise.js
===================
Implements a container class that stores a promise and the resolve/reject 
functions. Implements a class the serializes multiple asychronous calls 
(similar to a mutex).

tachyfontset.js
===============
Pages may want to have multiple TachyFonts; eg, multiple weights.
Implements a class the handles a group (set) of TachyFonts.

webfonttailer.js
================
A class the gives a list of fonts given a font-family/language/style.



ONLY FOR DEMO/DEBUG
===================
* for_debug.js
* time-utils.js

