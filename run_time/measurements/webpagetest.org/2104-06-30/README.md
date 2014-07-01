Notes:

The web font is NanumBrushScript­Regular.ttf and we should be comparing to the
woff version. Likely to be half as big.

Possible Improvements:

1. Make downloading the base font faster by zeroing out the loca table. Likely
   to reduce the 1150 ms by half.
2. Compress the request data. Likely to reduce the 4096 ms by 40%.
3. Send the "above the fold" part of the data first. Likely to reduce the
   initial request size by 75%.