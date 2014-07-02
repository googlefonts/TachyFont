Notes:

Send the "above the fold" part of the data first. Request it in parallel with
the base font. This makes the 'above the fold' time 4 sec compared to 6 seconds
before (but makes the final loading move to 8 seconds).

The incrmental font data is gzip compressed so now using NanumBrushScript.woff
to get a more valid comparison. If we start using lzma compression then we
should switch to comparing to woff2.

Possible Improvements:

1. Make downloading the base font faster by zeroing out the loca table. Likely
   to reduce the 1472 ms by half.
