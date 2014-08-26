# Tachyfon
### \[tak-i-fon\]

## Fast fonts (but not as fast as a [Tachyon](http://en.wikipedia.org/wiki/Tachyon)).

AKA:
* Lazily loaded web fonts
* Incremental Fonts

Overview
========
Incremental Fonts is a system for incrementally / lazily loading font.  It includes:

- Python build time code to preprocess fonts for faster serving.
- A Google App Engine python based server.
- Javascript to request/assemble the needed parts and tell the browser to use it.

Status
======

Incremental Fonts is an open source project.

The API is still evolving.

Incremental fonts works for both OpenType/TrueType and OpenType/CFF fonts.

It is not an official Google project, and Google provides no support for it.

Browser Support
===============
As of 2014-08-18:

The IndexedDB version has has a limited amount of testing on:

* Chrome
   * Android
   * Windows
   * Ubuntu

* FireFox
   * Windows

* IE
    * IE10 and IE11 on Windows 7

* Safari - currently untested. 
   * It is expected the IndexedDB version will work for Safari 8.
   * It is possible that for Safari 7 the fast loading will work but the data
     will not be persisted.

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

# Simple Usage

- Put all of your fonts under 'src_font/v1' folder initially. If you use new version of same font put it 
under new 'src_font/v2' folder.
- Make sure you've added fontTools into PYTHONPATH.
- Simply double click to `preprocess_all.py` Python 2.7 script and choose `Run in Terminal`.
- You will see

    `Found |font-path|. Use following name in javascript: |font-identifier|`

- Pass this |font-identifier| into your javascript code when asked to specify font name. 


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