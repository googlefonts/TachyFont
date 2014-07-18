Notes:

After a lot of measurements it turns out that the HTML5 FileSystem is
quite slow. For example a fs.root.getFile() (just gets a file handle not
any data) can easily take 185 ms. Doing several of these in the critical
path can easily add a full second.

So these are 'experimental' results with no FS calls but all the other
code. The font data is held in an array buffer and blob URLs are used for
the @font-face rule. The times measured in Javascript are displayed at
the top of web page. The "set font blob url" indicated with the @font-face
is set. The first one (without a number) is the base/empty font at 1.4
sec. The second one is the first block of glyphs at 1.6 sec (and so forth).
The data in this experiment is only held in memory.

Also added is the results for DroidSansFallback.ttf. The base load is 752
ms and the initial glyphs load is 835 ms. It looks like sub 1 second view
of the initial data.

