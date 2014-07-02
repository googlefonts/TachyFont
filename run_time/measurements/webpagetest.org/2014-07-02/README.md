Notes:

Minor tweak to the "above the fold" part point. The glyph data is requested it 
in parallel with the base font. Currently it is not know why there is a delay
between the 1st glyph request ending and the 2nd request starting.

Possible Improvements:

1. Make downloading the base font faster by zeroing out the loca table. Likely
   to reduce the 1188 ms by half.
