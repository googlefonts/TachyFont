Lazily loaded web fonts.
Incremental Fonts
=========

Incremental Fonts is a system for incrementally / lazily loading font.  It includes:

- Python build time code to preprocess fonts for faster serving.
- A Google App Engine python based server.
- Javascript to request/assemble the needed parts and tell the browser to use it.

Status
======

Incremental Fonts is an unofficial project.  It is not an official Google project, and Google
provides no support for it.

Build and Deployment
====================

Incremental Fonts is, unfortunately, pre-alpha and notes for building / deploying 
have not yet been finalized or written.

# Generating font data

- Run `pyprepfnt` with the font file

```
usage: pyprepfnt [-h] [--hinting [HINTING]] [--output [OUTPUT]] fontfile

positional arguments:
  fontfile             Input font file

optional arguments:
  -h, --help           show this help message and exit
  --hinting [HINTING]  Enable hinting if True, default is False
  --output [OUTPUT]    Output folder, default is current folder
```
- Copy `base` and `base.gz` files into the `fonts/<font-name>/` folder
- Copy `closure_data`, `closure_idx`, `codepoints`, `gids`, `glyph_data` and `glyph_table` files
into the `data/<font-name>/` folder
- Use this `<font-name>` as `family-name` in styles, and pass this name to the javascript functions

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