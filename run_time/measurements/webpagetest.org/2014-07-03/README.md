Notes:

The packaging of the glyph data in the server was being done as 100+ small
disk reads. The data was then appended onto a bytearray. These 2 operations
were taking 500-700 ms in the server. Changed the code pre-allocate the
bytearray and do a single read of the whole file. The data was then copied
in memory. This reduced the time for these operation to under 1 ms.

As a note: the gzip compression of 451 characters takes around 9 ms.

The glyph data is requested in parallel with the base font.

DELAY BEFORE THE 2ND REQUEST STARTING:
======================================
Looking the upper waterfall in the image incr-font-2nd-bundle-delay.png
there is a long delay between the end of the first request (line 7) and the
start of the second request (line 8). A reasonable first guess is that the
start of the 2nd request is delayed by the first request (see line A). In
fact the second request waits for both the base font (line 6) and the first
request (line 7). However, having studied the timings, the start of the
second request appears to be delayed by the base font arriving and then being
processed (line B). The largest processing items is gunzip'ing the data,
followed by modifying it to pass OTS, followed by writing it to disk.

The lower waterfall shows the same page with the same shaped 3G bandwidth but
being processed by (what is assumed to be) a faster system. The download
times are similar but the delay between the base font being loaded and the
start of the second request is much shorter.

It is believed that most of the data still left in the 60K base font is the
loca table. Earlier experiments indicate that with the loca table removed the
base font would compress to 10K or less. Reducing the base font to 10K would
shorten its download time significantly and would also mean that gzip would
be much faster. Hence the second request would start sooner.

Possible Improvements:

1. Make downloading the base font faster by zeroing out the loca table. Likely
   to reduce the 1443 ms by half and should make the second request start
   sooner.
