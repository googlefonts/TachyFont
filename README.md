# TachyFont
### \[tac-ee-font\]

## Fast fonts (but not as fast as a [Tachyon](http://en.wikipedia.org/wiki/Tachyon)).

AKA:
* Lazily loaded web fonts
* Incremental Fonts

Overview
========
Incremental Fonts is a system for incrementally / lazily loading font.  It 
currently includes:

- Python build time code to preprocess fonts for faster serving.
- A Google App Engine python based server.
- Javascript to request/assemble the needed parts and tell the browser to use it.

In the future the server could be built in Java (perhaps using Apache Tomcat?)

Incremental Fonts is an open source project.

- Apache 2.0 license

Incremental fonts works for both OpenType/TrueType and OpenType/CFF fonts.

TachyFont is not an official Google project, and Google provides no support for it.

Status
=======

Overall status 2014-12-10:

Converting to Closure. 

* Only tachyfont_noto_sans_regular_subset.html currently works. Everything else
is broken.

Overall status 2014-08-27:

- TachyFont is at the proof of concept stage and suitable for giving a demo.
   * Korean fonts are typically 1-5 MB.
   * TachyFont can display the characters in a typical Korean web page in using about 90 KB.  
   * For example, "Noto Sans KR Thin" (OTF) has 22K+ glyphs and is 4.2 MB.
   * The [Korean version](http://www.ohchr.org/EN/UDHR/Pages/Language.aspx?LangID=kkn) of the [Universal Declaration of Human Rights](http://www.un.org/en/documents/udhr/) (UDHR) has 396 unique characters.
   * If the Korean UDHR used NotoSansKR-Thin:
      * The WOFF version would be about 3,200 KB.
      * The TachyFont version would be 74 KB:
         * 33 KB for a one-time font framework.
         * 41 KB of character data on this page.
         * That is 2.3% of the WOFF size.
         * Note: all sizes are the compressed sizes.

- There is a demo server at [http://green-pear.appspot.com/chrome/tachyfont_demos.html](http://green-pear.appspot.com/chrome/tachyfont_demos.html)
   * It is not guaranteed to always be working.

- the API is still evolving.
- the includes need to be cleaned up

Browser Support
===============
As of 2014-08-18:

The IndexedDB version has has a limited amount of testing on:

* Chrome
   * tested and working on
      * Android
      * Windows
      * Ubuntu

* FireFox
   * tested and working on
      * Ubuntu
      * Windows 7

* IE
    * tested
       * IE fails to display the font
       * might be that TachyFont is failing their version of [OTS](https://code.google.com/p/ots/)
          * IE10 and IE11 on Windows 7

* Safari 
   * Safari 7 tested - fast load but does not persist data (IndexedDB not supported)
   * Safari 8 It is expected the IndexedDB version will work allow persisting.

Build and Deployment
====================

Incremental Fonts is pre-alpha and notes for building / deploying 
have not yet been finalized or written.

# The TTX/fontTools library

This program uses an unreleased CFF 'flattening' feature in fontTools. Thus
the fontTools in this repository must be used when preprocessing CFF fonts; ie:
${PROJECT_LOC}/run_time/src/gae_server/third_party/fonttools-master/Lib/ needs
to be on the PYTHONPATH.

# Generating font data

# Basic Usage

- Every font and every revision **MUST** have a separate path/filename.
- It is highly recommended that a revision number be included in the path.

- You may need to install bitarray
   - pip install bitarray
   - Note: you may need to run this command as root or use sudo

- Put all of your fonts under 'src_font/v1' folder initially. If you use new 
version of same font put it under new 'src_font/v2' folder.

- Make sure you've added `fontTools` into `PYTHONPATH`; eg,
   - cd <topdir>
   - TOPDIR=${PWD}
   - PYTHONPATH=${TOPDIR}/run_time/src/gae_server/third_party/fonttools-master/Lib/:${PYTHONPATH}

- From an Ubuntu GUI, double click to `preprocess_all.py` Python 2.7 script and choose `Run in Terminal`.

- To preprocess via the command line: cd into the ${TOPDIR} and run

    `./preprocess_all.py`  (This can take a while)

- When you run the command it will report the identifier to use in your web page; eg,

    `Found <font-path>. Use following name in javascript: <font-identifier>`

- Pass this `<font-identifier>` into your javascript code when asked to specify font name. 

- Right now the command is a work-in-progress and leaves the results in the 
'cooked' dir. You will need to manually:

   - copy the 'base' file to ${TOPDIR}/run_time/src/gae_server/fonts/\<font-identifier\>
   - copy the c* and g* files to ${TOPDIR}/run_time/src/gae_server/data/\<font-identifier\>

# Advanced Usage

- Run `pyprepfnt` with the font file

```
usage: pyprepfnt [-h] [--changefont] [--changebase] [--hinting] [--output OUTPUT] fontfile

positional arguments:
  fontfile             Input font file

optional arguments:
  -h, --help            show this help message and exit
  --hinting  			Does not remove hintings from glyphs if present
  --changebase			Force regeneration of base font
  --changefont			Force to generate all things, overrides changebase option
  --output OUTPUT       Output folder, default is current folder
```
Example:

    ./pyprepfnt --changefont --hinting --output ~/MYFONTDATA ~/MYFONTS/a_font_name.otf

- Copy `base` and `base.gz` files into the `fonts/<font-name>/` folder
- Copy `closure_data`, `closure_idx`, `codepoints`, `gids`, `glyph_data` and `glyph_table` files
into the `data/<font-name>/` folder
- Use this `<font-name>` as `family-name` in styles, and pass this name to the javascript functions

    In our example copy `base` and `base.gz` from `a_font_name` folder into `gae_server/chrome/fonts/a_font_name/`. From `a_font_name` folder copy remaining font data into the `gae_server/chrome/data/a_font_name/`.

# To run unit tests:
- build_time/test/
  - run: py.test

- run_time/src/chrome_client_test
  - **TBD**

- run_time/src/gae_server_test
  - **TBD**

Feature Requests
================

TODO: Make a list of items/ideas to improve this project.

Bugs
====

* TBD.
