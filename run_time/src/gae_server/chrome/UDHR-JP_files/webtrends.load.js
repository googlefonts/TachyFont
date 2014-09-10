// WebTrends SmartSource Data Collector Tag v10.4.12
// Copyright (c) 2013 Webtrends Inc.  All rights reserved.
// Tag Builder Version: 4.1.2.7
// Created: 2013.10.18
// http://help.webtrends.com/en/jstag
window.webtrendsAsyncInit=function(){
	var dcs=new Webtrends.dcs().init({
		dcsid:"dcscgkq7w10000gs8ukttmrza_7t8c",	// DCSID of the Webtrends Data Source
		domain:"webstatsTagging.unicc.org",					// hostname of the webtrends SDC server
		timezone:1,
		cookieTypes: "all",
		FPCConfig: {  						// First Party Cookie Configuration
				   enabled: true,  
				   domain: ".www.ohchr.org",  
				   name: "WWW.OHCHR.ORG_WT_FPC",  
				   expires: 63113851500     // 0 seconds value will indicate Session only   cookie
		},		
		rightclick:true,		// rightclick=true means every right click on a download link (xls,doc,pdf,txt,csv,zip,docx,xlsx,rar,gzip) will be tracked using wt.dl=25, regardless the file is really downloaded or not, the right click will always track the download.
        download:true,			// download=true means every left click on a download link (xls,doc,pdf,txt,csv,zip,docx,xlsx,rar,gzip) will be tracked using wt.dl=20
		downloadtypes:"xls,doc,pdf,txt,csv,zip,docx,xlsx,rar,gzip,mp3,wav,mp4",
        offsite:true,			// offsite=true means Offsite links will be tracked. In case of an offsite download link it will be tracked twice, as a download and as a offsite link
		onsitedoms:"www.ohchr.org",
		i18n:true,				// internationalization on
        plugins:{
            //hm:{src:"//s.webtrends.com/js/webtrends.hm.js"}
				}
	}).track();
};
(function(){
	var s=document.createElement("script"); s.async=true; s.src="/WebtrendsAssets/webtrends.min.v10.js";    
	var s2=document.getElementsByTagName("script")[0]; s2.parentNode.insertBefore(s,s2);
}());






