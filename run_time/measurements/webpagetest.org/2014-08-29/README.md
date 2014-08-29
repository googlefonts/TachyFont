This is using the new simplified 'API' which is really all the Javascript code 
collected into a single file.

Moving all the Javascript files into a single file ends up with a much larger 
(13K compressed) single file. The bytes are the same and there are fewer round 
trip requests so it seems reasonable that the actuall time would be faster. 
However, WebPageTest.org show a much slower time. I suspect that the latency and
bandwidth controls do not really function like a real network.

Regardless of the reason for the slow down, minifying the file brings back the 
apparently fast downloading.

The pdfs are:

WebPagetest Test Details - Dulles _ green-p..._sans_kr_thin-01.pdf

* automatic fetching of the body chars in blocks of 200

WebPagetest Test Details - Dulles _ green-p..._sans_kr_thin-02.pdf

* minified tachyfon.js, automatic fetching of the body chars in a single block of 441

WebPagetest Test Details - Dulles _ green-p..._sans_kr_thin-03{ab}.pdf

* demo features enabled, automatic fetching of the body chars in blocks of 200

Notes:

This is incremental font using IndexedDB for Noto Sans KR Thin, a OTF font.
This is Chrome running on Nexus 5 with Shaped 3G.


