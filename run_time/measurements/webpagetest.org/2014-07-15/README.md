Notes:

Add CFF support/fonts.

Add sparse loca table.

Add RLE of the file before compressing.

Add Timing support and analysis.

Faster base font download faster:

* now 879 ms (was 1443 ms)

Setup a side-by-side demo page.

Suppress FOUT.

Get GAE to gzip the data.



DELAY BEFORE THE 2ND REQUEST STARTING:
======================================
We removed the gunzip time and made the base 5K smaller for a yet unmeasured RLE time.
Still seems too long.

