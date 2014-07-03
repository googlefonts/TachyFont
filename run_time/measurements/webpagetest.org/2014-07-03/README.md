Notes:

The packaging of the glyph data in the server was being done as 100+ small
disk reads. The data was then appended onto a bytearray. These 2 operations
were taking 500-700 ms in the server. Changed the code pre-allocate the
bytearray and do a single read of the whole file. The data was then copied
in memory. This reduced the time for these operation to under 1 ms.

As a note: the gzip compression of 451 characters takes around 9 ms.

The glyph data is requested in parallel with the base font. Currently it is
not known why there is a delay between the 1st glyph request ending and the
2nd request starting.

Possible Improvements:

1. Make downloading the base font faster by zeroing out the loca table. Likely
   to reduce the 1443 ms by half.
