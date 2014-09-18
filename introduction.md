# TachyFont

### AKA: Incrementally Loaded Web Fonts

## Background
Web fonts provide an opportunity for web sites to have an individual look and/or use a branding font.
However, the download time (latency) for web fonts has limited their use. 
While web fonts are relatively small compared to videos, images, and music; the latency for fonts is far more sensitive because
* while waiting for the images, the user can read the text.
* the video/music can begin before all the data has arrived.
But the text is not readable until the web font arrives. This means that effectively the user cannot do anything until the web font arrives.


### Latin / Western Web Fonts
English uses about 100 characters. Accents for other western languages add around about 100 more. 
So fonts that just support western languages are often in the 50 - 150 KB range (compressed) and the download latency is in the 0.5 to 1.5 second range. 
A 0.5 delay is only annoying but if the page wants multiple versions (thin, regular, demi-bold, bold, thin italic, italic, italic bold) then the latency can add up into multiple seconds.


### Chinese / Japanese / Korean (CJK) Web Fonts
Chinese, Japanese, and Korean (CJK) fonts often have 20,000+ characters. CJK fonts range in size from 1.5-7 MB  (compressed) This makes the download latency in the 15-70 second range. Latencies in this range are so long that a user could easily give up or 'move on' before the font is downloaded. Latencies in these ranges are too long to be usable.

However, over 95% of CJK pages have less than 800 characters on a given page. So of the typical 20,000+ characters in a CJK font, only 5% of the font is needed on a given page. For example the [Korean version of the Universal Declaration of Human Rights](http://www.ohchr.org/EN/UDHR/Pages/Language.aspx?LangID=kkn) uses only 396 different characters.

## TachyFont - Incremental Loaded Web Fonts
### Initial download
TachyFont dramatically reduces the download time by automatically fetching only on the font data needed on the given page. For CJK pages this means that only around 5% of the font need be downloaded. 

For example, NotoSansKR has 22K+ characters and is 4.2 MB. Using TachyFont the [Korean UDHR](http://www.ohchr.org/EN/UDHR/Pages/Language.aspx?LangID=kkn) would only need to download 73 KB, which is 2.2% of the compressed font size.

### Subsequent downlads
Tachyfont also reduces future download time by automatically saving (persisting) the data locally and merging in any new data as needed. Over time the download requirement will continue to drop. 

Continuing the NotoSansKR example: after the initial download it is very likely that subsequent pages would need less than 35 KB, which is 1% of the compressed font size.

