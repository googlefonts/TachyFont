var IsMenuShown=false;
var itemTableDeferred=null;
var itemTable=null;
var imageCell=null;
var onKeyPress=false;
var downArrowText=null;
var currentCtx=null;
var currentEditMenu=null;
var currentItemID=null;
var currentItemAppName=null;
var currentItemProgId=null;
var currentItemIcon=null;
var currentItemOpenControl=null;
var currentItemFileUrl=null;
var currentItemFSObjType=null;
var currentItemCheckedOutUserId=null;
var currentItemCheckoutExpires=null;
var currentItemModerationStatus=null;
var currentItemUIString=null;
var currentItemCheckedoutToLocal=null;
var bIsCheckout=0;
var currentItemCanModify=null;
var currentItemPermMaskH=null;
var currentItemPermMaskL=null;
var currentItemIsEventsExcp=null;
var currentItemIsEventsDeletedExcp=null;
var UTF8_1ST_OF_2=0xc0   ;
var UTF8_1ST_OF_3=0xe0   ;
var UTF8_1ST_OF_4=0xf0   ;
var UTF8_TRAIL=0x80   ;
var HIGH_SURROGATE_BITS=0xD800 ;
var LOW_SURROGATE_BITS=0xDC00 ;
var SURROGATE_6_BIT=0xFC00 ;
var SURROGATE_ID_BITS=0xF800 ;
var SURROGATE_OFFSET=0x10000;
function escapeProperlyCoreCore(str, bAsUrl, bForFilterQuery, bForCallback)
{
	var strOut="";
	var strByte="";
	var ix=0;
	var strEscaped=" \"%<>\'&";
	if (typeof(str)=="undefined")
		return "";
	for (ix=0; ix < str.length; ix++)
	{
		var charCode=str.charCodeAt(ix);
		var curChar=str.charAt(ix);
		if(bAsUrl && (curChar=='#' || curChar=='?') )
		{
			strOut+=str.substr(ix);
			break;
		}
		if (bForFilterQuery && curChar=='&')
		{
			strOut+=curChar;
			continue;
		}
		if (charCode <=0x7f)
		{
			if (bForCallback)
			{
				strOut+=curChar;
			}
			else
			{
				if ( (charCode >=97 && charCode <=122) ||
					 (charCode >=65 && charCode <=90) ||
					 (charCode >=48 && charCode <=57) ||
					 (bAsUrl && (charCode >=32 && charCode <=95) && strEscaped.indexOf(curChar) < 0))
				{
					strOut+=curChar;
				}
				else if (charCode <=0x0f)
				{
					strOut+="%0"+charCode.toString(16).toUpperCase();
				}
				else if (charCode <=0x7f)
				{
					strOut+="%"+charCode.toString(16).toUpperCase();
				}
			}
		}
		else if (charCode <=0x07ff)
		{
			strByte=UTF8_1ST_OF_2 | (charCode >> 6);
			strOut+="%"+strByte.toString(16).toUpperCase() ;
			strByte=UTF8_TRAIL | (charCode & 0x003f);
			strOut+="%"+strByte.toString(16).toUpperCase();
		}
		else if ((charCode & SURROGATE_6_BIT) !=HIGH_SURROGATE_BITS)
		{
			strByte=UTF8_1ST_OF_3 | (charCode >> 12);
			strOut+="%"+strByte.toString(16).toUpperCase();
			strByte=UTF8_TRAIL | ((charCode & 0x0fc0) >> 6);
			strOut+="%"+strByte.toString(16).toUpperCase();
			strByte=UTF8_TRAIL | (charCode & 0x003f);
			strOut+="%"+strByte.toString(16).toUpperCase();
		}
		else if (ix < str.length - 1)
		{
			var charCode=(charCode & 0x03FF) << 10;
			ix++;
			var nextCharCode=str.charCodeAt(ix);
			charCode |=nextCharCode & 0x03FF;
			charCode+=SURROGATE_OFFSET;
			strByte=UTF8_1ST_OF_4 | (charCode >> 18);
			strOut+="%"+strByte.toString(16).toUpperCase();
			strByte=UTF8_TRAIL | ((charCode & 0x3f000) >> 12);
			strOut+="%"+strByte.toString(16).toUpperCase();
			strByte=UTF8_TRAIL | ((charCode & 0x0fc0) >> 6);
			strOut+="%"+strByte.toString(16).toUpperCase();
			strByte=UTF8_TRAIL | (charCode & 0x003f);
			strOut+="%"+strByte.toString(16).toUpperCase();
		}
	}
	return strOut;
}
function escapeProperly(str)
{
	return escapeProperlyCoreCore(str, false, false, false);
}
function escapeProperlyCore(str, bAsUrl)
{
	return escapeProperlyCoreCore(str, bAsUrl, false, false);
}
function escapeUrlForCallback(str)
{
	var iPound=str.indexOf("#");
	var iQues=str.indexOf("?");
	if ((iPound > 0) && ((iQues==-1) || (iPound < iQues)))
	{
		var strNew=str.substr(0, iPound);
		if (iQues > 0)
		{
			strNew+=str.substr(iQues);
		}
		str=strNew;
	}
	return escapeProperlyCoreCore(str, true, false, true);
}
function PageUrlValidation(url)
{
	if (url.substr(0, 4) !="http" && url.substr(0,1) !="/")
	{
		var L_InvalidPageUrl_Text="Invalid page URL: ";
		alert(L_InvalidPageUrl_Text);
		return "";
	}
	else
		return url;
}
var g_ExpGroupWPState=new LRUCache();
function makeAbsUrl(strUrl)
{
	if (strUrl.length > 0 && "/"==strUrl.substr(0, 1))
	{
		strUrl=window.location.protocol+"//"+window.location.host+strUrl;
	}
	return strUrl;
}
function FilterNoteField(view, fieldName, fieldValue, keyCode)
{
	if (keyCode !=13) return;
	event.returnValue=false;
	var strDocUrl=window.location.href;
	pagedPart=/&Paged=TRUE&p_[^&]*&PageFirstRow=[^&]*/gi;
	strDocUrl=strDocUrl.replace(pagedPart, "");
	viewGuid=GetUrlKeyValue("View", true);
	if (viewGuid=="")
	{
		strDocUrl=StURLSetVar2(strDocUrl, "View", view);
		viewGuid=view;
	}
	if (view.toUpperCase() !=viewGuid.toUpperCase())
	{
		var encodedView=escapeProperly(view);
		if (encodedView.toUpperCase() !=viewGuid.toUpperCase())
		{
			var pattern=/\?[^?]*/i;
			var idxQuery=strDocUrl.indexOf("?");
			if (idxQuery !=-1)
			   strDocUrl=strDocUrl.replace(pattern,"?View="+view);
			else
			   strDocUrl=strDocUrl+"?View="+view;
		}
	}
	var arrayField=strDocUrl.match("FilterField([0-9]+)="+fieldName);
	if (!arrayField)
	{
		var idxQuery=strDocUrl.indexOf("?");
		if (idxQuery !=-1)
			strDocUrl=strDocUrl+"&";
		else
			strDocUrl=strDocUrl+"?";
		i=0;
		do
		{
			i++;
			FilterArray=strDocUrl.match("FilterField"+							i+"=[^&]*"+"&FilterValue"+							i+"=[^&]*");
		} while (FilterArray);
		strDocUrl=strDocUrl+"FilterField"+i+							"="+fieldName+"&FilterValue"+							i+"="+escapeProperly(fieldValue);
		strDocUrl=strDocUrl.replace("Filter=1&", "");
	}
	else
	{
		filterNo=parseInt(arrayField[1]);
		var arrayValue=strDocUrl.match("&FilterValue"+							filterNo+"=[^&]*");
		strTemp="&"+arrayField[0]+arrayValue[0];
		strNewFilter="&FilterField"+arrayField[1]+							"="+fieldName+"&FilterValue"+							arrayField[1]+"="+escapeProperly(fieldValue);
		strDocUrl=strDocUrl.replace(strTemp, strNewFilter);
		strDocUrl=strDocUrl.replace("Filter=1&", "");
	}
	window.location.href=STSPageUrlValidation(strDocUrl);
}
function SelectField(view, selectID)
{
	var strDocUrl=window.location.href;
	var strHash=window.location.hash;
	var fViewReplaced=false;
	var pattern=/\#.*/i;
	strDocUrl=strDocUrl.replace(pattern, "");
	viewGuid=GetUrlKeyValue("View", true);
	pageView=GetUrlKeyValue("PageView", true);
	if (view.toUpperCase() !=viewGuid.toUpperCase())
	{
		var encodedView=escapeProperly(view);
		if (encodedView.toUpperCase() !=viewGuid.toUpperCase())
		{
			var pattern=/\?[^?]*/i;
			var idxQuery=strDocUrl.indexOf("?");
			if (idxQuery !=-1)
				strDocUrl=strDocUrl.replace(pattern,"?View="+view);
			else
				strDocUrl=strDocUrl+"?View="+view;
			fViewReplaced=true;
		}
	}
	if (!fViewReplaced && (GetUrlKeyValue("SelectedID") !=""))
	{
		var selectIDOld=/&SelectedID=[^&]*/gi;
		strDocUrl=strDocUrl.replace(selectIDOld, "");
		selectIDOld=/\?SelectedID=[^&]*&?/;
		strDocUrl=strDocUrl.replace(selectIDOld, "?");
	}
	strDocUrl=strDocUrl+"&SelectedID=";
	strDocUrl=strDocUrl+selectID;
	if (fViewReplaced && (pageView !=""))
	{
		strDocUrl=strDocUrl+"&PageView="+pageView;
	}
	if (strHash !="")
	{
	strDocUrl=strDocUrl+strHash;
	}
	SubmitFormPost(strDocUrl);
}
function FilterField(view, fieldName, fieldValue, selOption)
{
	return FilterFieldV3(view, fieldName, fieldValue, selOption, false);
}
function FilterFieldV3(view, fieldName, fieldValue, selOption, bReturnUrl)
{
	var strDocUrl=CanonicalizeUrlEncodingCase(window.location.href);
	var arrayField=strDocUrl.match("[&\?]Paged=TRUE[^&]*");
	if (arrayField)
	{
		var pagedPart=/&p_[^&]*/gi;
		strDocUrl=strDocUrl.replace(pagedPart, "");
		pagedPart=/&PageFirstRow=[^&]*/gi;
		strDocUrl=strDocUrl.replace(pagedPart, "");
		pagedPart=/&PageLastRow=[^&]*/gi;
		strDocUrl=strDocUrl.replace(pagedPart, "");
		pagedPart=/&PagedPrev=TRUE[^&]*/i;
		strDocUrl=strDocUrl.replace(pagedPart, "");
		arrayField=strDocUrl.match("[\?]Paged=TRUE[^&]*");
		if (arrayField)
		{
			var idxQuery=strDocUrl.substr(arrayField["index"]).indexOf("&");
			if (idxQuery !=-1)
			{
				strDocUrl=strDocUrl.substr(0, arrayField["index"]+1)+					strDocUrl.substr(idxQuery+arrayField["index"]+1);
			}
			else
			{
				strDocUrl=strDocUrl.substr(0, arrayField["index"]);
			}
		}
		else
		{
			pagedPart=/&Paged=TRUE[^&]*/i;
			strDocUrl=strDocUrl.replace(pagedPart, "");
		}
	}
	viewGuid=GetUrlKeyValue("View", true);
	if (viewGuid=="")
	{
		strDocUrl=StURLSetVar2(strDocUrl, "View", view);
		viewGuid=view;
	}
	if (view.toUpperCase() !=viewGuid.toUpperCase())
	{
		var encodedView=escapeProperly(view);
		if (encodedView.toUpperCase() !=viewGuid.toUpperCase())
		{
			var pattern=/\?[^?]*/i;
			var idxQuery=strDocUrl.indexOf("?");
			if (idxQuery !=-1)
			   strDocUrl=strDocUrl.replace(pattern,"?View="+view);
			else
			   strDocUrl=strDocUrl+"?View="+view;
		}
	}
	arrayField=strDocUrl.match("FilterField([0-9]+)="+fieldName+"&");
	if (!arrayField)
	{
		if (0==selOption)
		{
			strDocUrl=strDocUrl.replace("Filter=1&", "");
			strDocUrl=strDocUrl.replace("?Filter=1", "");
		}
		else
		{
			var idxQuery=strDocUrl.indexOf("?");
			if (idxQuery !=-1)
				strDocUrl=strDocUrl+"&";
			else
				strDocUrl=strDocUrl+"?";
			i=0;
			do
			{
				i++;
				FilterArray=strDocUrl.match("FilterField"+i+"=[^&]*"+												  "&FilterValue"+i+"=[^&]*");
			} while (FilterArray);
			strDocUrl=strDocUrl+"FilterField"+i+"="+fieldName+									"&FilterValue"+i+"="+escapeProperly(fieldValue);
			strDocUrl=strDocUrl.replace("Filter=1&", "");
		}
	}
	else
	{
		filterNo=parseInt(arrayField[1]);
		var arrayValue=strDocUrl.match("FilterValue"+filterNo+"=[^&]*");
		var strTemp="&"+arrayField[0]+arrayValue[0];
		if (0==selOption)
		{
			if (strDocUrl.indexOf(strTemp)==-1)
			{
				strTemp=arrayField[0]+arrayValue[0]+"&";
			}
			strDocUrl=strDocUrl.replace(strTemp, "");
			j=filterNo+1;
			FilterArray=strDocUrl.match("FilterField"+							j+"=[^&]*"+"&FilterValue"+							j+"=[^&]*");
			for ( i=filterNo ; FilterArray; i++)
			{
				strNew="FilterField"+i;
				strOld="FilterField"+j;
				strDocUrl=strDocUrl.replace(strOld, strNew);
				strNew="FilterValue"+i;
				strOld="FilterValue"+j;
				strDocUrl=strDocUrl.replace(strOld, strNew);
				j++;
				FilterArray=strDocUrl.match("FilterField"+								j+"=[^&]*"+"&FilterValue"+								j+"=[^&]*");
			}
			strDocUrl=strDocUrl.replace("Filter=1&", "");
			strDocUrl=strDocUrl.replace("?Filter=1", "");
		}
		else
		{
			var strFirstChar;
			if (strDocUrl.indexOf(strTemp)==-1)
			{
				strTemp="?"+arrayField[0]+arrayValue[0]
				strFirstChar="?";
			}
			else
			{
				strFirstChar="&";
			}
			var strNewFilter=strFirstChar+"FilterField"+arrayField[1]+							"="+fieldName+"&FilterValue"+							arrayField[1]+"="+escapeProperly(fieldValue);
			strDocUrl=strDocUrl.replace(strTemp, strNewFilter);
			strDocUrl=strDocUrl.replace("Filter=1&", "");
		}
	}
	arrayField=strDocUrl.match("FilterField([0-9]+)=");
	if (!arrayField)
		strDocUrl=strDocUrl+"&FilterClear=1";
	else
		strDocUrl=strDocUrl.replace("&FilterClear=1", "");
	if (bReturnUrl)
		return strDocUrl;
	else
		SubmitFormPost(strDocUrl);
}
function CanonicalizeUrlEncodingCase(str)
{
	var strOut="";
	var ix;
	for (ix=0; ix < str.length; ix++)
	{
		var curChar=str.charAt(ix);
		if (curChar=='%' && (ix+2) < str.length)
		{
			strOut+=curChar;
			ix++;
			strOut+=str.charAt(ix).toString().toUpperCase();
			ix++;
			strOut+=str.charAt(ix).toString().toUpperCase();
		}
		else
		{
			strOut+=curChar;
		}
	}
	return strOut;
}
function SetControlValue(controlId, value)
{
	var control=document.getElementById(controlId);
	if (control !=null)
		 control.value=value;
}
var bValidSearchTerm=false;
function SetSearchView()
{
	if (typeof(bValidSearchTerm) !="undefined")
		bValidSearchTerm=true;
}
function SubmitFormPost(url, bForceSubmit)
{
	if (typeof(MSOWebPartPageFormName) !="undefined")
	{
		var form=document.forms[MSOWebPartPageFormName];
		if (null !=form)
		{
			if ((bForceSubmit !=undefined && bForceSubmit==true)
				|| !form.onsubmit || (form.onsubmit() !=false))
			{
				form.action=STSPageUrlValidation(url);
				form.method="POST";
				if (isPortalTemplatePage(url))
					form.target="_top";
				if (!bValidSearchTerm)
					ClearSearchTerm("");
				form.submit();
			}
		}
	}
}
var g_varSkipRefreshOnFocus=0;
function RefreshOnFocus()
{
	if (typeof(g_varSkipRefreshOnFocus)=="undefined" ||
		!g_varSkipRefreshOnFocus)
	{
		var url=window.location.href;
		var iPosition=url.indexOf("#")
		if (iPosition==-1)
			window.location.href=url;
		else
			window.location.href=url.substring(0, iPosition);
	}
}
function DisableRefreshOnFocus()
{
	g_varSkipRefreshOnFocus=1;
}
function SetWindowRefreshOnFocus()
{
	window.onbeforeunload=DisableRefreshOnFocus;
	window.onfocus=RefreshOnFocus;
}
function RemoveParametersFromUrl(url)
{
	var paramsBeginPos=url.indexOf('?');
	if (paramsBeginPos==-1)
		return url;
	else
		return url.substr(0, paramsBeginPos);
}
function GoToPageRelative(url)
{
	if (url.substr(0, 4) !="http" && url.substr(0,1) !="/")
	{
		var currentPage=RemoveParametersFromUrl(window.location.href);
		var pos=currentPage.lastIndexOf("/");
		if (pos > 0)
			url=currentPage.substring(0, pos+1)+url;
	}
	GoToPage(url);
}
function EnterFolder(url)
{
	var currentPage=RemoveParametersFromUrl(window.location.href);
	var newPage=RemoveParametersFromUrl(url);
	if (newPage.toLowerCase() !=currentPage.toLowerCase())
		STSNavigate(url);
	else
		SubmitFormPost(url);
}
function GoToDiscussion(url)
{
	var ch=url.indexOf("?") >=0 ? "&" : "?";
	var srcUrl=GetSource();
	if (srcUrl !=null && srcUrl !="")
		url+=ch+"TopicsView="+srcUrl;
	STSNavigate(url);
}
function STSNavigateWithCheckoutAlert(Url, bCheckout, bIsCheckedOutToLocal, strDocument, strhttpRoot,
			strCurrentUser, strCheckoutUser)
{
	if (typeof(strCurrentUser)=="undefined" || strCurrentUser==null || strCurrentUser=="")
		strCurrentUser=currentItemCheckedOutUserId;
	if ((typeof(strCheckoutUser)=="undefined" || strCheckoutUser==null || strCheckoutUser=="")
		  && typeof(ctx) !="undefined")
	{
		strCheckoutUser=ctx.CurrentUserId;
	}
	if (bIsCheckedOutToLocal=="1")
	{
		alert(L_CannotEditPropertyForLocalCopy_Text);
		return;
	}
	if (strCurrentUser !=null &&
		strCurrentUser !="" &&
		strCheckoutUser !=null &&
		strCurrentUser !=strCheckoutUser)
	{
		alert(L_CannotEditPropertyCheckout_Text);
		return;
	}
	if (bCheckout=="1" && browseris.ie)
	{
		if (confirm(L_ConfirmCheckout_Text))
		{
			if (strDocument.charAt(0)=="/" || strDocument.substr(0,3).toLowerCase()=="%2f")
				strDocument=document.location.protocol+"//"+document.location.host+strDocument;
			CheckoutviaXmlhttp(strhttpRoot,strDocument);
		 }
		else
			return;
	}
	STSNavigate(Url);
}
function CheckoutviaXmlhttp(strhttpRoot, strDocument)
{
	var xh=new ActiveXObject("Microsoft.XMLHTTP");
	if (xh==null)
		return false;
	xh.Open("POST", strhttpRoot+"/_vti_bin/lists.asmx", false);
	xh.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
	xh.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/sharepoint/soap/CheckOutFile");
	var soapData='<?xml version="1.0" encoding="utf-8"?>'+		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" '+		'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+		'<soap:Body>'+		'<CheckOutFile xmlns="http://schemas.microsoft.com/sharepoint/soap/"><pageUrl>'+		strDocument+'</pageUrl></CheckOutFile></soap:Body></soap:Envelope>'
	xh.Send(soapData);
	if (xh.status==200 &&  xh.ResponseText.indexOf("true") !=0)
	{
		return true;
	}
	else
		return false;
}
var g_ExtensionNotSupportCheckoutToLocal=new Array("ascx","asp", "aspx", "htm", "html","master","odc", "exe", "bat","com", "cmd", "onetoc2");
var g_ExtensionDefaultForRead=new Array("jpg", "jpeg","bmp", "png", "gif","onetoc2", "one", "odc");
function FSupportCheckoutToLocal(strExtension)
{
	var fRet=true;
	if (strExtension==null || strExtension=="")
		return false;
	strExtension=strExtension.toLowerCase();
	var ix=0;
	for (ix=0; ix < g_ExtensionNotSupportCheckoutToLocal.length; ix++)
	{
		if (strExtension==g_ExtensionNotSupportCheckoutToLocal[ix])
			return false;
	}
	return true;
}
function FDefaultOpenForReadOnly(strExtension)
{
	var fRet=false;
	if (strExtension==null || strExtension=="")
		return true;
	strExtension=strExtension.toLowerCase();
	var ix=0;
	for (ix=0; ix < g_ExtensionDefaultForRead.length; ix++)
	{
		if (strExtension==g_ExtensionDefaultForRead[ix])
			return true;
	}
	return false;
}
function CheckoutDocument(strhttpRoot, strDocument, strOpenControl)
{
	var stsOpen=null;
	var fRet=true;
	var fClientCheckout=false;
	if (strDocument.charAt(0)=="/" || strDocument.substr(0,3).toLowerCase()=="%2f")
		strDocument=document.location.protocol+"//"+document.location.host+strDocument;
	var strextension=SzExtension(unescapeProperly(strDocument));
	if (FSupportCheckoutToLocal(strextension) &&
		strOpenControl=="SharePoint.OpenDocuments.3")
	{
		stsOpen=StsOpenEnsureEx(strOpenControl);
	}
	if (stsOpen !=null)
	{
		try
		{
			fRet=stsOpen.CheckoutDocumentPrompt(unescapeProperly(strDocument), false, "");
			SetWindowRefreshOnFocus();
			fClientCheckout=true;
			return;
		}
		catch (e)
		{
		}
	}
	 if (!fClientCheckout)
		NavigateToCheckinAspx(strhttpRoot, "FileName="+escapeProperly(unescapeProperly(strDocument))+"&Checkout=true");
}
function NewItem(url)
{
	GoToPage(url);
}
function EditItem(url)
{
	GoToPage(url);
}
function GoToHistoryLink(elm, strVersion)
{
	if (elm.href==null)
		return;
	var targetUrl=elm.href;
	var ch=elm.href.indexOf("?") >=0 ? "&" : "?";
	var srcUrl=ch+"VersionNo="+strVersion;
	var srcSourceUrl=GetSource();
	if (srcSourceUrl !=null && srcSourceUrl !="")
		srcSourceUrl="&"+"Source="+srcSourceUrl;
	var targetUrl=elm.href+srcUrl+srcSourceUrl;
	if (isPortalTemplatePage(targetUrl))
		window.top.location=STSPageUrlValidation(targetUrl);
	else
		window.location=STSPageUrlValidation(targetUrl);
}
function GoToLink(elm)
{
	if (elm.href==null)
		return;
	var ch=elm.href.indexOf("?") >=0 ? "&" : "?";
	var srcUrl=GetSource();
	if (srcUrl !=null && srcUrl !="")
		srcUrl=ch+"Source="+srcUrl;
	var targetUrl=elm.href+srcUrl;
	if (isPortalTemplatePage(targetUrl))
		window.top.location=STSPageUrlValidation(targetUrl);
	else
		window.location=STSPageUrlValidation(targetUrl);
}
function GoBack(defViewUrl)
{
	window.location.href=unescapeProperly(GetSource(defViewUrl));
}
function ReplyItem(url, threading, guid, subject)
{
	if(threading.length>=504)
	{
		var L_ReplyLimitMsg_Text="Cannot reply to this thread. The reply limit has been reached.";
		alert(L_ReplyLimitMsg_Text);
	} else
	{
		url+="?Threading="+threading;
		url+="&Guid="+guid;
		url+="&Subject="+subject;
		GoToPage(url);
	}
}
function GoBacktoCurrentIssue(url, issueid)
{
	url+='?ID='+issueid;
	GoToPage(url);
}
function CatchCreateError(strIgnore1, strIgnore2, strIgnore3)
{
	return true;
}
function ExportToDatabase(strSiteUrl, strListID, strViewID, fUseExistingDB)
{
	var L_NoWSSClient_Text="To export a list, you must have a Windows SharePoint Services-compatible application and Microsoft Internet Explorer 6.0 or greater.";
	var L_ExportDBFail_Text="Export to database failed. To export a list, you must have a Windows SharePoint Services-compatible application.";
	if (browseris.ie5up && browseris.win32)
	{
		try
		{
			var ExpDatabase;
			ExpDatabase=new ActiveXObject("SharePoint.ExportDatabase");
			if (!ExpDatabase)
			{
				alert(L_NoWSSClient_Text);
				return;
			}
			ExpDatabase.SiteUrl=makeAbsUrl(strSiteUrl);
			ExpDatabase.ListID=strListID;
			ExpDatabase.ViewID=strViewID;
			ExpDatabase.DoExport(fUseExistingDB);
			ExpDatabase=null;
		}
		catch(e)
		{
			alert(L_ExportDBFail_Text);
			return;
		}
	}
	else
	{
		alert(L_NoWSSClient_Text);
	}
}
function ExportList(using)
{
	var L_ExportListSpreadsheet_Text="To export a list, you must have a Windows SharePoint Services-compatible application.";
	if ((fSSImporter && SSImporterObj.IqyImportEnabled()) ||
		confirm(L_ExportListSpreadsheet_Text))
	{
		window.location.href=STSPageUrlValidation(makeAbsUrl(using));
	}
}
function ExportDiagram(weburl,listguid, listid, listname, viewname, viewguid)
{
	try
	{
		objDiagramLaunch=new ActiveXObject("DiagramLaunch.DiagramLauncher");
		var bstrTemplate="";
		var bstrURI=weburl;
		var bstrViewGUID=viewguid;
		var bstrListGUID=listguid;
		var iListID=listid;
		objDiagramLaunch.CreateDiagram(bstrTemplate, bstrURI, bstrViewGUID, bstrListGUID, listname, viewname, iListID);
	}
	catch(e)
	{
		var L_DiagramLaunchFail_Text="Unable to create diagram.";
		alert (L_DiagramLaunchFail_Text);
	}
	delete objDiagramLaunch;
}
var ListCtrlObj;
var fListControl=false;
var fListErrorShown=false;
var L_EditInGrid_Text="The list cannot be displayed in Datasheet view for one or more of the following reasons: \n\n- A datasheet component compatible with Windows SharePoint Services is not installed.\n- Your Web browser does not support ActiveX controls. \n- Support for ActiveX controls is disabled.";
function CatchListCreateError(strIgnore1, strIgnore2, strIgnore3)
{
	alert(L_EditInGrid_Text);
	fListErrorShown=true;
	return false;
}
function EnsureListControl()
{
	if (!fListControl)
	{
		fListErrorShown=false;
		if (browseris.ie5up && browseris.win32)
		{
			var functionBody=				"try"
+"{"
+"    ListCtrlObj=new ActiveXObject(\"ListNet.ListNet\");"
+"    if (ListCtrlObj)"
+"        fListControl=true;"
+"} catch (e)"
+"{"
+"    fListControl=false;"
+"};";
			var EnsureListControlInner=new Function(functionBody);
			EnsureListControlInner();
		}
		else
		{
			window.onerror=CatchListCreateError;
			ListCtrlObj=new ActiveXObject("ListNet.ListNet");
			if (ListCtrlObj)
				fListControl=true;
		}
	}
	ListCtrlObj=null;
	return fListControl;
}
var L_NoQuestion_Text="The survey contains no questions.";
var L_NoVoteAllowed_Text="You are not allowed to respond again to this survey.";
function IsVoteOK(notAllowed)
{
	if (1==notAllowed)
		alert(L_NoQuestion_Text);
	else if (2==notAllowed)
		alert(L_NoVoteAllowed_Text);
	else
		return true;
}
function hasHighChar(str)
{
	var ix=0;
	for (ix=0; ix < str.length; ix++)
	{
		if (str.charCodeAt(ix)>127)
		return true;
	}
	return false;
}
function RemovePagingArgs(strUrl)
{
	var rePagedFlag=/&*Paged=TRUE/gi;
	strUrl=strUrl.replace(rePagedFlag, "");
	var rePagedPrevFlag=/&*PagedPrev=TRUE/gi;
	strUrl=strUrl.replace(rePagedPrevFlag, "");
	var rePagedArgs=/&p_[^&]*/gi;
	strUrl=strUrl.replace(rePagedArgs, "");
	var rePagedRow=/&PageFirstRow=[^&]*/gi;
	strUrl=strUrl.replace(rePagedRow, "");
	var rePagedLastRow=/&PageLastRow=[^&]*/gi;
	strUrl=strUrl.replace(rePagedLastRow, "");
	var reFilter1=/\?Filter=1&*/gi;
	strUrl=strUrl.replace(reFilter1, "?");
	var reFilter2=/&Filter=1/gi;
	strUrl=strUrl.replace(reFilter2, "");
	var reOrphanedQMark=/\?$/;
	strUrl=strUrl.replace(reOrphanedQMark, "");
	return strUrl;
}
function ClearSearchTerm(guidView)
{
	if (typeof(MSOWebPartPageFormName) !="undefined")
	{
		var form=document.forms[MSOWebPartPageFormName];
		if (null !=form)
		{
			if (guidView !=null)
			{
				var frmElem=form["SearchString"+guidView];
				if (frmElem !=null)
					frmElem.value="";
			}
		}
	}
	bValidSearchTerm=true;
}
function SubmitSearchRedirect(strUrl)
{
	var frm=document.forms["frmSiteSearch"];
	if (frm==null)
	{
		if (typeof(MSOWebPartPageFormName) !="undefined")
			frm=document.forms[MSOWebPartPageFormName];
	}
	if (frm !=null)
	{
		var searchText=frm.elements["SearchString"].value;
		strUrl=strUrl+"?k="+escapeProperly(searchText);
		var searchScope=frm.elements["SearchScope"];
		if (searchScope !=null)
		{
			var searchScopeUrl=searchScope.value;
			if (searchScopeUrl)
			{
				strUrl=strUrl+"&u="+escapeProperly(searchScopeUrl);
			}
		}
		frm.action=strUrl;
		frm.submit();
	}
}
function ShowGridUrlInHTML(strUrl)
{
	if (strUrl.indexOf("?") > 0)
		strUrl=strUrl+"&";
	else
		strUrl=strUrl+"?";
	strUrl=strUrl+"ShowInGrid=HTML";
	return strUrl;
}
function SubmitSearch()
{
	SubmitSearchForView("");
}
function SubmitSearchForView(ViewGuid)
{
	var frm=document.forms[0];
	var srchCtlName="SearchString"+ViewGuid;
	var searchText=frm.elements[srchCtlName].value;
	if (""==searchText)
	{
		var L_Enter_Text="Please enter one or more search words.";
		alert(L_Enter_Text);
		frm.elements[srchCtlName].focus();
	}
	else
	{
		var strDocUrl;
		strDocUrl=RemovePagingArgs(frm.action);
		if (typeof(bGridViewPresent) !="undefined" && bGridViewPresent)
			strDocUrl=ShowGridUrlInHTML(strDocUrl);
		frm.action=strDocUrl;
		frm.submit();
	}
}
function IsKeyDownSubmit(event)
{
	if (event !=null)
	{
		var charCode;
		var bKeyModifiers;
		if (browseris.ie)
		{
			charCode=event.keyCode;
			bKeyModifiers=event.altKey || event.ctrlKey;
		}
		else
		{
			charCode=event.which;
			bKeyModifiers=event.modifers &
						   (event.ALT_MASK | event.CONTROL_MASK);
		}
		if ((charCode==13) && !bKeyModifiers)
			return true;
	}
	return false;
}
function SearchViewKeyDown(guidView)
{
	if (IsKeyDownSubmit(event))
		SubmitSearchForView(guidView);
}
function SearchKeyDown(event, strUrl)
{
	if (IsKeyDownSubmit(event))
	{
		SubmitSearchRedirect(strUrl);
		return false;
	}
	return true;
}
function AlertAndSetFocus(msg, fieldName)
{
	fieldName.focus();
	fieldName.select();
	window.alert(msg);
}
function AlertAndSetFocusForDropdown(msg, fieldName)
{
	fieldName.focus();
	window.alert(msg);
}
function setElementValue(elemName, elemValue)
{
	var elem=document.getElementsByName(elemName).item(0);
	if (elem==null)
		return false;
	elem.value=elemValue;
	return true;
}
function GetMultipleSelectedText(frmElem) {
	if (frmElem) {
		var strret;
		strret="";
		for(var i=0; i < frmElem.options.length; i++)
			{
			if (frmElem.options[i].selected)
				strret+=","+frmElem.options[i].text;
			}
		if (strret.length > 0)
			strret=strret.substring(1);
		return strret;
	}
	else
		return "";
}
function GetCBSelectedValues(frm) {
	if (frm==null)
		return;
	var value=new Object();
	value.strList="";
	value.fAllChecked=true;
	for (var i=0;i<frm.elements.length;i++)
		{
		var e=frm.elements[i];
		if (e.type=="checkbox" && !e.disabled )
			{
			if (e.checked)
				{
				if (value.strList !="")
					value.strList+=",";
				value.strList+=e.value;
				}
			else
				value.fAllChecked=false;
			}
		}
	return value;
}
var fNewDoc=false;
var fNewDoc2=false;
var fNewDoc3=false;
var L_EditDocumentProgIDError_Text="'Edit Document' requires a Windows SharePoint Services-compatible application and Microsoft Internet Explorer 6.0 or greater.";
var L_EditDocumentRuntimeError_Text="The document could not be opened for editing.  A Windows SharePoint Services compatible application could not be found to edit the document.";
function editDocumentWithProgID(strDocument, varProgID)
{
	if (fNewDoc)
	{
		if (strDocument.charAt(0)=="/" || strDocument.substr(0,3).toLowerCase()=="%2f")
			strDocument=document.location.protocol+"//"+document.location.host+strDocument;
		if ((!fNewDoc2) && (!fNewDoc3))
		{
			if(!EditDocumentButton.EditDocument(strDocument, varProgID))
				alert(L_EditDocumentRuntimeError_Text);
		}
		else
		{
			if(!EditDocumentButton.EditDocument2(window, strDocument, varProgID))
				alert(L_EditDocumentRuntimeError_Text);
		}
	}
	else
	{
		alert(L_EditDocumentProgIDError_Text);
	}
}
function editDocumentWithProgID2(strDocument, varProgID, varEditor, bCheckout,strhttpRoot, strCheckouttolocal)
{
	var errorCode=editDocumentWithProgIDNoUI(strDocument, varProgID, varEditor, bCheckout,strhttpRoot, strCheckouttolocal);
	if (errorCode==1)
	{
		alert(L_EditDocumentRuntimeError_Text);
		window.onfocus=RefreshOnNextFocus;
	}
	else if (errorCode==2)
		alert(L_EditDocumentProgIDError_Text);
}
function editDocumentWithProgIDNoUI(strDocument, varProgID, varEditor, bCheckout,strhttpRoot, strCheckouttolocal)
{
	var objEditor;
	var fRet;
	var fUseLocalCopy=false;
	varEditor=varEditor.replace(/(?:\.\d+)$/, '');
	if (strDocument.charAt(0)=="/" || strDocument.substr(0,3).toLowerCase()=="%2f")
		strDocument=document.location.protocol+"//"+document.location.host+strDocument;
	var strextension=SzExtension(unescapeProperly(strDocument));
	if (FSupportCheckoutToLocal(strextension))
	{
		try
		{
			objEditor=new ActiveXObject(varEditor+".3");
			if (objEditor !=null )
			{
				if (bCheckout=="1")
				{
					if (!objEditor.CheckoutDocumentPrompt(strDocument, true, varProgID))
					return 1;
				}
				else
				{
					if (strCheckouttolocal=="1")
					fUseLocalCopy=true;
					if (!objEditor.EditDocument3(window, strDocument, fUseLocalCopy, varProgID))
					return 1;
				}
				var  fRefreshOnNextFocus=false;
				fRefreshOnNextFocus=objEditor.PromptedOnLastOpen();
				if (fRefreshOnNextFocus)
				{
					window.onfocus=RefreshOnNextFocus;
				}
				else
				{
					SetWindowRefreshOnFocus();
				}
				return;
			}
		}
		catch(e)
		{
		}
	}
	if (bCheckout=="1")
	{
		if (confirm(L_ConfirmCheckout_Text))
			NavigateToCheckinAspx(strhttpRoot,"FileName="+escapeProperly(unescapeProperly(strDocument))+"&Checkout=true");
		else
			return;
	}
	try
	{
		objEditor=new ActiveXObject(varEditor+".2");
		if (!objEditor.EditDocument2(window, strDocument, varProgID))
			return 1;
		if(varEditor=="SharePoint.OpenXMLDocuments")
		{
			SetWindowRefreshOnFocus();
		}
		else
		{
			window.onfocus=RefreshOnNextFocus;
		}
		return;
	}
	catch (e)
	{
	}
	try
	{
		objEditor=new ActiveXObject(varEditor+".1");
		window.onfocus=null;
		if (SzExtension(strDocument)=="ppt" && varProgID=="")
			varProgID="PowerPoint.Slide";
		if (!objEditor.EditDocument(strDocument, varProgID))
			return 1;
		SetWindowRefreshOnFocus();
		return;
	}
	catch (e)
	{
		return 2;
	}
}
function RefreshOnNextFocus()
{
	SetWindowRefreshOnFocus();
}
function createNewDocumentWithProgID2(strTemplate, strSaveLocation, strProgID, strProgID2, bXMLForm)
{
	if (!createNewDocumentWithProgIDCore(strTemplate, strSaveLocation, strProgID, bXMLForm, false))
	{
		createNewDocumentWithProgIDCore(strTemplate, strSaveLocation, strProgID2, bXMLForm, true);
	}
}
function createNewDocumentWithProgID(strTemplate, strSaveLocation, strProgID, bXMLForm)
{
	createNewDocumentWithProgIDCore(strTemplate, strSaveLocation, strProgID, bXMLForm, true);
}
function createNewDocumentWithProgIDCore(strTemplate, strSaveLocation, strProgID, bXMLForm, bWarning)
{
	var objEditor;
	var L_NewDocumentRuntimeError_Text;
	var L_NewDocumentError_Text;
	var fRefreshOnNextFocus=false;
	if (bXMLForm)
	{
		var L_NewDocumentRuntimeError_Text=L_NewFormLibTb1_Text;
		var L_NewDocumentError_Text=L_NewFormLibTb2_Text;
	}
	else
	{
		var L_NewDocumentRuntimeError_Text=L_NewDocLibTb1_Text;
		var L_NewDocumentError_Text=L_NewDocLibTb2_Text;
	}
	try
	{
		objEditor=new ActiveXObject(strProgID+".2");
		if (!objEditor.CreateNewDocument2(window, strTemplate, strSaveLocation))
			alert(L_NewDocumentRuntimeError_Text);
		fRefreshOnNextFocus=objEditor.PromptedOnLastOpen();
		if (fRefreshOnNextFocus)
		{
			window.onfocus=RefreshOnNextFocus;
		}
		else
		{
			SetWindowRefreshOnFocus();
		}
		return true;
	}
	catch (e)
	{
	}
	try
	{
		objEditor=new ActiveXObject(strProgID+".1");
		window.onfocus=null;
		if (!objEditor.CreateNewDocument(strTemplate, strSaveLocation))
			alert(L_NewDocumentRuntimeError_Text);
		SetWindowRefreshOnFocus();
		return true;
	}
	catch (e)
	{
		if (bWarning)
			alert(L_NewDocumentError_Text);
	}
}
function createNewDocumentWithRedirect(strTemplate, strSaveLocation, strProgID, bXMLForm, strRedirectUrl, defaultItemOpen)
{
	if (IsClientAppInstalled(strProgID) && defaultItemOpen !=1)
	{
		var strIndependentProgId=strProgID.replace(/(?:\.\d+)$/, '');
		createNewDocumentWithProgID(strTemplate, strSaveLocation, strIndependentProgId, bXMLForm);
	}
	else
	{
		STSNavigate(strRedirectUrl+			"&SaveLocation="+makeAbsUrl(escapeProperly(strSaveLocation))+			"&Source="+GetSource()+			"&DefaultItemOpen="+defaultItemOpen);
	}
}
if (typeof(ExpandBody)=="undefined")
{
	function ExpandBody(guid, anchor)
	{
		var frm=document.forms[MSOWebPartPageFormName];
		frm.CAML_Expand.value=frm.CAML_Expand.value.concat(guid);
		frm.action=frm.action.concat("#"+anchor);
		frm.submit();
		return false;
	}
}
if (typeof(CollapseBody)=="undefined")
{
	function CollapseBody(guid, anchor)
	{
		var frm=document.forms[MSOWebPartPageFormName];
		var reg=new RegExp("\{", "g");
		guid=guid.replace(reg, "\\\{");
		reg=new RegExp("\}", "g");
		guid=guid.replace(reg, "\\\}");
		reg=new RegExp(guid, "g");
		frm.CAML_Expand.value=frm.CAML_Expand.value.replace(reg, "");
		frm.CAML_ShowOriginalEmailBody.value=			frm.CAML_ShowOriginalEmailBody.value.replace(reg, "");
		frm.action=frm.action.concat("#"+anchor);
		frm.submit();
		return false;
	}
}
if (typeof(ShowQuotedText)=="undefined")
{
	function ShowQuotedText(guid, anchor)
	{
		var frm=document.forms[MSOWebPartPageFormName];
		frm.CAML_ShowOriginalEmailBody.value=			frm.CAML_ShowOriginalEmailBody.value.concat(guid);
		if (frm.action.indexOf("#") > 0)
		{
			frm.action=frm.action.substr(0, frm.action.indexOf("#"));
		}
		frm.action=frm.action.concat("#"+anchor);
		frm.submit();
		return false;
	}
}
if (typeof(HideQuotedText)=="undefined")
{
	function HideQuotedText(guid, anchor)
	{
		var frm=document.forms[MSOWebPartPageFormName];
		var reg=new RegExp("\{", "g");
		guid=guid.replace(reg, "\\\{");
		reg=new RegExp("\}", "g");
		guid=guid.replace(reg, "\\\}");
		reg=new RegExp(guid, "g");
		frm.CAML_ShowOriginalEmailBody.value=			frm.CAML_ShowOriginalEmailBody.value.replace(reg, "");
		if (frm.action.indexOf("#") > 0)
		{
			frm.action=frm.action.substr(0, frm.action.indexOf("#"));
		}
		frm.action=frm.action.concat("#"+anchor);
		frm.submit();
		return false;
	}
}
function LRUCache()
{
	this.state=new Array();
	this.ageStack=new Array();
	this.count=0;
}
function LRUCache_Add(cache, itemName)
{
	if (!cache)
	{
		return;
	}
	oldAge=cache.state[itemName];
	if (oldAge !=null)
	{
		cache.ageStack[oldAge]=null;
	}
	else
	{
		cache.count++;
	}
	age=cache.ageStack.length;
	cache.state[itemName]=age;
	cache.ageStack.push(itemName);
}
function LRUCache_Remove(cache, itemName)
{
	if (!cache)
		return;
	age=cache.state[itemName];
	if (age !=null)
	{
		cache.ageStack[age]=null;
		cache.state[itemName]=null;
		cache.count--;
	}
	else
	{
	}
}
function AddGroupToCookie(groupName)
{
	var webPartID=ExpGroupFetchWebPartID(groupName);
	if (webPartID==null)
		return;
	LRUCache_Add(g_ExpGroupWPState, webPartID);
	if (g_ExpGroupTable[webPartID]==null)
	{
		g_ExpGroupTable[webPartID]=new LRUCache();
	}
	var groupString=ExpGroupFetchGroupString(groupName);
	if (groupString==null)
		return;
	LRUCache_Add(g_ExpGroupTable[webPartID], groupString);
	ExpGroupRenderCookie();
}
function RemoveGroupFromCookie(groupName)
{
	var webPartID=ExpGroupFetchWebPartID(groupName);
	if (webPartID==null)
		return;
	if (g_ExpGroupTable[webPartID]==null)
		return;
	LRUCache_Add(g_ExpGroupWPState, webPartID);
	var groupString=ExpGroupFetchGroupString(groupName);
	if (groupString==null)
		return;
	var aGroupString;
	for (aGroupString in g_ExpGroupTable[webPartID].state)
	{
		if (g_ExpGroupTable[webPartID].state[aGroupString] !=null &&
			aGroupString.substring(0,groupString.length)==groupString)
		{
			LRUCache_Remove(g_ExpGroupTable[webPartID], aGroupString);
		}
	}
	ExpGroupRenderCookie();
}
function ExpGroupRenderCookie()
{
	if (!g_ExpGroupWPState)
		return;
	var newWPString=ExpGroupWPListName+"=";
	var numWPRendered=0;
	var ix;
	for (ix=g_ExpGroupWPState.ageStack.length - 1; ix >=0; ix--)
	{
		if (g_ExpGroupWPState.ageStack[ix] !=null)
		{
			var webPartID=g_ExpGroupWPState.ageStack[ix];
			if (numWPRendered==ExpGroupMaxWP)
			{
				DeleteCookie(ExpGroupCookiePrefix+webPartID);
				break;
			}
			else if (g_ExpGroupTable[webPartID]==null)
			{
				numWPRendered++;
				if (numWPRendered > 1)
					newWPString+=escape(ExpGroupCookieDelimiter);
				newWPString+=escape(webPartID);
			}
			else if (g_ExpGroupTable[webPartID].count==0)
			{
				DeleteCookie(ExpGroupCookiePrefix+webPartID);
			}
			else if (numWPRendered < ExpGroupMaxWP)
			{
				numWPRendered++;
				ExpGroupRenderCookieForWebPart(webPartID);
				if (numWPRendered > 1)
					newWPString+=escape(ExpGroupCookieDelimiter);
				newWPString+=escape(webPartID);
			}
		}
	}
	if (numWPRendered==0)
	{
		DeleteCookie(ExpGroupWPListName);
	}
	else
	{
		document.cookie=newWPString;
	}
}
function ExpGroupRenderCookieForWebPart(webPartID)
{
	if (!g_ExpGroupTable[webPartID].ageStack)
		return;
	var newCookieString=ExpGroupCookiePrefix+webPartID+"=";
	var bFirst=true;
	var ix;
	for (ix=g_ExpGroupTable[webPartID].ageStack.length - 1; ix >=0; ix--)
	{
		if (g_ExpGroupTable[webPartID].ageStack[ix] !=null)
		{
			var groupString=g_ExpGroupTable[webPartID].ageStack[ix];
			var newPortion="";
			if (!bFirst)
				newPortion+=escape(ExpGroupCookieDelimiter);
			newPortion+=escape(groupString);
			if (newCookieString.length+newPortion.length <=ExpGroupMaxCookieLength)
			{
				newCookieString+=newPortion;
				bFirst=false;
			}
		}
	}
	document.cookie=newCookieString+";";
}
function ExpGroupOnPageLoad()
{
	flag=document.getElementById("GroupByColFlag");
	if (flag !=null)
	{
		g_ExpGroupNeedsState=true;
		ExpGroupParseCookie();
	}
}
function ExpGroupParseCookie()
{
	var webPartListString=GetCookie(ExpGroupWPListName);
	if (webPartListString==null)
		return;
	g_ExpGroupParseStage=true;
	var webPartList=webPartListString.split(ExpGroupCookieDelimiter);
	var ix;
	for (ix=webPartList.length - 1; ix >=0; ix--)
	{
		var webPartID=webPartList[ix];
		LRUCache_Add(g_ExpGroupWPState, webPartID);
		if (g_ExpGroupTable[webPartID]==null)
		{
			if (document.getElementById("GroupByCol"+webPartID) !=null)
				ExpGroupParseCookieForWebPart(webPartID);
		}
	}
	g_ExpGroupParseStage=false;
	if (g_ExpGroupQueue.length > 0)
	{
		ExpGroupFetchData(g_ExpGroupQueue.shift());
	}
}
function ExpGroupParseCookieForWebPart(webPartID)
{
	var groupListString=GetCookie(ExpGroupCookiePrefix+webPartID);
	if (groupListString==null)
		return;
	var groupList=groupListString.split(ExpGroupCookieDelimiter);
	var ix;
	g_ExpGroupTable[webPartID]=new LRUCache();
	for (ix=groupList.length - 1; ix >=0; ix--)
	{
		var groupString=groupList[ix];
		LRUCache_Add(g_ExpGroupTable[webPartID], groupString);
	}
	var loadedGroups=new Array();
	var viewTable=document.getElementById("GroupByCol"+webPartID).parentNode;
	tbodyTags=viewTable.getElementsByTagName("TBODY");
	for (ix=0; ix < tbodyTags.length; ix++)
	{
		var groupString=tbodyTags[ix].getAttribute("groupString");
		if (groupString !=null)
		{
			var tbodyId=tbodyTags[ix].id;
			if (tbodyId==null)
				continue;
			var groupName=tbodyId.substring(4, tbodyId.length);
			if (g_ExpGroupTable[webPartID].state[groupString] !=null &&
				loadedGroups[groupName]==null)
			{
				ExpCollGroup(groupName, "img_"+groupName);
				loadedGroups[groupName]=true;
				tbody=document.getElementById("tbod"+groupName+"_");
				if (tbody !=null)
				{
					isLoaded=tbody.getAttribute("isLoaded");
					if (isLoaded=="false")
						g_ExpGroupQueue.push(groupName);
				}
			}
		}
	}
	var aGroupName;
	for (aGroupName in loadedGroups)
	{
		var index=aGroupName.indexOf("_");
		if (index !=aGroupName.length - 1 && index !=-1)
		{
			var parentName=aGroupName.substring(0, index+1);
			if (loadedGroups[parentName]==null)
			{
				var parentString=ExpGroupFetchGroupString(parentName);
				if (parentString !=null)
				{
					LRUCache_Add(g_ExpGroupWPState, parentString);
					ExpCollGroup(parentName, "img_"+parentName);
					loadedGroups[parentString]=true;
				}
				else
				{
				}
			}
		}
	}
}
function ExpGroupBy(formObj)
{
	if ((browseris.w3c) && (!browseris.ie)) {
		document.all=document.getElementsByTagName("*");
	}
	docElts=document.all;
	numElts=docElts.length;
	images=formObj.getElementsByTagName("IMG");
	img=images[0];
	srcPath=img.src;
	index=srcPath.lastIndexOf("/");
	imgName=srcPath.slice(index+1);
	var displayStr="auto";
	if (imgName=='plus.gif')
	{
		displayStr="";
		img.src='/_layouts/images/minus.gif';
	}
	else
	{
		displayStr="none";
		img.src='/_layouts/images/plus.gif';
	}
	oldName=img.name;
	img.name=img.alt;
	img.alt=oldName;
	spanNode=img;
	while(spanNode !=null)
	{
		spanNode=spanNode.parentNode;
		if (spanNode !=null &&
			spanNode.id !=null &&
			spanNode.id.length > 5 &&
			spanNode.id.substr(0, 5)=="group")
			break;
	}
	parentNode=spanNode;
	while(parentNode !=null)
	{
		parentNode=parentNode.parentNode;
		if (parentNode !=null &&
			parentNode.tagName=="TABLE")
			break;
	}
	lastNode=null;
	if (parentNode !=null)
	{
		lastNode=parentNode.lastChild;
		if (lastNode !=null && lastNode.tagName=="TBODY")
			lastNode=lastNode.lastChild;
		if (lastNode !=null && lastNode.tagName=="TR" && lastNode.lastChild !=null)
			lastNode=lastNode.lastChild;
	}
	for(var i=0;i<numElts;i++)
	{
		var childObj=docElts.item(i);
		if (childObj==spanNode)
			break;
	}
	ID=spanNode.id.slice(5);
	displayStyle=displayStr;
	for(var j=i+1; j<numElts; j++)
	{
		var childObj=docElts.item(j);
		if (childObj.id.length > 5 &&
			childObj.id.substr(0, 5)=="group")
		{
			curID=childObj.id.slice(5);
			if (curID <=ID)
				return;
		}
		parentNode=childObj;
		while(parentNode !=null)
		{
			parentNode=parentNode.parentNode;
			if (parentNode==spanNode)
				break;
		}
		if (parentNode==spanNode)
			continue;
		if (childObj.id !=null && childObj.id.substring(0, 5)=="group")
			displayStr=displayStyle;
		if (childObj.id !=null && childObj.id.substring(0, 8)=="footer"+ID)
			displayStr=displayStyle;
		if (displayStyle !="none" &&
			childObj !=img &&
			childObj.tagName=="IMG" &&
			childObj.src !=null)
		{
			if (childObj.src.slice(childObj.src.length - 25)=='/_layouts/images/plus.gif')
			{
				displayStr="none";
			}
			else if (childObj.src.slice(childObj.src.length - 26)=='/_layouts/images/minus.gif')
			{
				displayStr="";
			}
		}
		if (childObj.tagName==spanNode.tagName &&
			childObj.id !="footer")
		{
			childObj.style.display=displayStr;
		}
		if ((childObj.tagName=="TABLE" && lastNode==null) || childObj==lastNode)
			break;
	}
}
function SzExtension(szHref)
{
	var sz=new String(szHref);
	var re=/^.*\.([^\.]*)$/;
	return sz.replace(re, "$1").toLowerCase();
}
function SzServer(szHref)
{
	var sz=new String(szHref);
	var re=/^([^:]*):\/\/([^\/]*).*$/;
	return sz.replace(re, "$1://$2");
}
var v_stsOpenDoc=null;
var v_strStsOpenDoc=null;
function StsOpenEnsureEx(szProgId)
{
	if (v_stsOpenDoc==null || v_strStsOpenDoc !=szProgId)
	{
//@cc_on
//@if (@_jscript_version >=5)
//@            try
//@            {
//@                v_stsOpenDoc=new ActiveXObject(szProgId);
//@                v_strStsOpenDoc=szProgId;
//@            } catch(e)
//@            {
//@                v_stsOpenDoc=null;
//@                v_strStsOpenDoc=null;
//@            };
//@else
//@end
	}
	return v_stsOpenDoc;
}
function DispDocItem(ele,strProgId)
{
	return DispDocItemEx(ele,'FALSE','FALSE','FALSE',strProgId);
}
var L_OpenDocumentLocalError_Text="This document was being edited offline, but there is no application configured to open the document from SharePoint.  The document can only be opened for reading.";
function DispDocItemEx(ele, fTransformServiceOn, fShouldTransformExtension, fTransformHandleUrl, strProgId)
{
	itemTable=FindSTSMenuTable(ele, "CTXName");
	if (!browseris.ie || !browseris.win32)
	{
		if (browseris.ie)
			event.cancelBubble=false;
		return true;
	}
	var stsOpen;
	var szHref;
	var szExt;
	var fRet=true;
	var szFileType=itemTable !=null ? GetAttributeFromItemTable(itemTable, "Ext", "FileType") : "";
	var szAppId="";
	var tblFileDlg=document.getElementById("FileDialogViewTable");
	if (tblFileDlg !=null)
	{
		if (browseris.ie)
		{
			event.cancelBubble=false;
			event.returnValue=false;
		}
		return true;
	}
	szHref=itemTable !=null ? GetAttributeFromItemTable(itemTable, "Url", "ServerUrl") : "";
	if (szHref==null || szHref=="")
		szHref=ele.href;
	else
		szHref=SzServer(ele.href)+szHref;
	szExt=SzExtension(szHref);
	if ((currentItemProgId==null) && (itemTable!=null))
		currentItemProgId=itemTable.getAttribute("HTMLType");
	if (currentItemProgId !=null)
		szAppId=currentItemProgId;
	if (FDefaultOpenForReadOnly(szExt))
	{
	   if (strProgId.indexOf("SharePoint.OpenDocuments") >=0)
			strProgId="SharePoint.OpenDocuments.3";
	}
	else if (!FSupportCheckoutToLocal(szExt))
	{
		strProgId="";
	}
	if ((currentItemCheckedOutUserId==null) && (itemTable!=null))
		currentItemCheckedOutUserId=itemTable.COUId;
	if ((currentItemCheckedoutToLocal==null) && (itemTable!=null))
		currentItemCheckedoutToLocal=GetAttributeFromItemTable(itemTable, "COut", "IsCheckedoutToLocal ");
	if( ((currentItemCheckedOutUserId !=null) &&
		(currentItemCheckedOutUserId !="") &&
		(currentItemCheckedOutUserId==ctx.CurrentUserId ) &&
		(strProgId==""  || ((strProgId.indexOf("SharePoint.OpenDocuments")) >=0)) &&
		FSupportCheckoutToLocal(szExt))||
		(strProgId=="SharePoint.OpenDocuments"))
	{
		strProgId="SharePoint.OpenDocuments.3";
	}
	var stsopenVersion=2;
	if(strProgId !='' && HasRights(0x10, 0x0))
	{
		if ((strProgId.indexOf(".3")) >=0)
			stsopenVersion=3;
		stsOpen=StsOpenEnsureEx(strProgId);
		if (stsOpen==null && stsopenVersion==3)
		{
			strProgId=strProgId.replace(".3",".2");
			stsOpen=StsOpenEnsureEx(strProgId);
			stsopenVersion=2;
		}
	}
	if (stsOpen !=null)
	{
		if (stsopenVersion==2 ||
			((itemTable==null) && (currentItemCheckedOutUserId==null))||
			(ctx.isVersions==1 && (itemTable==null || itemTable.isMostCur=="0")))
		{
			try
			{
				if ((currentItemCheckedOutUserId !=null) &&
					(currentItemCheckedOutUserId !="") &&
					(currentItemCheckedOutUserId==ctx.CurrentUserId ||
					ctx.CurrentUserId==null ))
				{
					if (currentItemCheckedoutToLocal=='1')
					{
						 alert(L_OpenDocumentLocalError_Text);
						 fRet=false;
					}
					else
						fRet=stsOpen.EditDocument2(window, szHref, szAppId);
				}
				else
				{
					fRet=stsOpen.ViewDocument2(window, szHref, szAppId);
				}
			}
			catch(e)
			{
				fRet=false;
			}
			if (fRet)
				window.onfocus=RefreshOnNextFocus;
		}
		else
		{
			var iOpenFlag=0;
			if (currentItemCheckedOutUserId !="")
			{
				if ((currentItemCheckedOutUserId !=ctx.CurrentUserId) && ( ctx.CurrentUserId !=null))
					iOpenFlag=1;
				else if (currentItemCheckedoutToLocal==null ||
					currentItemCheckedoutToLocal !='1')
					iOpenFlag=2;
				else
					iOpenFlag=4;
			}
			else if (!HasRights(0x0, 0x4) || FDefaultOpenForReadOnly(szExt))
				iOpenFlag=1;
			else if (ctx.isForceCheckout==true)
				iOpenFlag=3;
			try
			{
				fRet=stsOpen.ViewDocument3(window, szHref,iOpenFlag, szAppId);
			}
			catch(e)
			{
				fRet=false;
			}
			if (fRet)
			{
				var fRefreshOnNextFocus=stsOpen.PromptedOnLastOpen();
				if (fRefreshOnNextFocus)
					window.onfocus=RefreshOnNextFocus;
				else
					SetWindowRefreshOnFocus();
			}
		}
	}
	else if (currentItemCheckedoutToLocal=='1')
	{
		 alert(L_OpenDocumentLocalError_Text);
	}
	if (stsOpen==null || !fRet)
	{
		if (fTransformServiceOn=='TRUE' &&
			fShouldTransformExtension=='TRUE' &&
			fTransformHandleUrl=='TRUE')
		{
			if (itemTable==null)
				return fRet;
			if (browseris.ie)
			{
				event.cancelBubble=true;
				event.returnValue=false;
			}
			var getHttpRoot=new Function("return "+itemTable.getAttribute("CTXName")+".HttpRoot;");
			GoToPage(getHttpRoot()+"/_layouts"+				"/htmltrverify.aspx?doc="+escapeProperly(szHref));
		}
		return;
	}
	stsOpen=null;
	if (browseris.ie)
	{
		event.cancelBubble=true;
		event.returnValue=false;
	}
	return fRet;
}
function DispDocItemEx2(ele, objEvent, fTransformServiceOn, fShouldTransformExtension,
	fTransformHandleUrl, strHtmlTrProgId, iDefaultItemOpen, strProgId, strServerFileRedirect)
{
	var fRedirect=false;
	var fIsServerFile=strServerFileRedirect !=null && strServerFileRedirect !="";
	var fIsClientAppInstalled=IsClientAppInstalled(strProgId) && HasRights(0x10, 0x0);
	if (fIsServerFile)
	{
		if (iDefaultItemOpen==1 || !fIsClientAppInstalled)
		{
			STSNavigate(strServerFileRedirect+"&Source="+GetSource()+"&DefaultItemOpen="+iDefaultItemOpen);
			objEvent.cancelBubble=true;
			objEvent.returnValue=false;
			return false;
		}
		else if (fIsClientAppInstalled)
		{
			if (strProgId=="" || strProgId.indexOf("SharePoint.OpenDocuments") >=0)
			{
				return DispDocItemEx(ele, fTransformServiceOn, fShouldTransformExtension, fTransformHandleUrl, strHtmlTrProgId);
			}
			else
			{
				if (!ViewDoc(ele.href, strProgId))
				{
					var errorCode=editDocumentWithProgIDNoUI(ele.href, currentItemProgId, strProgId, false, ctx.HttpRoot, "0");
					if ((errorCode==1) || (errorCode==2))
					{
						STSNavigate(strServerFileRedirect+"&Source="+GetSource());
					}
				}
				objEvent.cancelBubble=true;
				objEvent.returnValue=false;
				return false;
			}
		}
	}
	return DispDocItemEx(ele, fTransformServiceOn, fShouldTransformExtension, fTransformHandleUrl, strProgId);
}
function DispDocItemExWithOutContext(ele, objEvent, fTransformServiceOn, fShouldTransformExtension,
	fTransformHandleUrl, strHtmlTrProgId, iDefaultItemOpen, strProgId, strHtmlType, strServerFileRedirect,
	strCheckoutUser, strCurrentUser, strRequireCheckout, strCheckedoutTolocal, strPermmask)
{
	DispEx(ele, objEvent, fTransformServiceOn, fShouldTransformExtension,
			fTransformHandleUrl, strHtmlTrProgId, iDefaultItemOpen, strProgId, strHtmlType, strServerFileRedirect,
			strCheckoutUser, strCurrentUser, strRequireCheckout, strCheckedoutTolocal, strPermmask);
}
function DispEx(ele, objEvent, fTransformServiceOn, fShouldTransformExtension,
	fTransformHandleUrl, strHtmlTrProgId, iDefaultItemOpen, strProgId, strHtmlType, strServerFileRedirect,
	strCheckoutUser, strCurrentUser, strRequireCheckout, strCheckedoutTolocal, strPermmask)
{
	var tblFileDlg=document.getElementById("FileDialogViewTable");
	if (tblFileDlg !=null)
	{
		objEvent.cancelBubble=false;
		objEvent.returnValue=false;
		return true;
	}
	if (typeof(ctx)=="undefined" || ctx==null)
		ctx=new ContextInfo();
	ctx.CurrentUserId=strCurrentUser;
	if (strRequireCheckout=='1')
		ctx.isForceCheckout=true;
	else
		ctx.isForceCheckout=false;
	currentItemCheckedOutUserId=strCheckoutUser;
	currentItemCheckedoutToLocal=strCheckedoutTolocal;
	currentItemProgId=strHtmlType;
	if (strPermmask !=null && strPermmask !='')
		SetCurrentPermMaskFromString(strPermmask, null)
	objEvent.cancelBubble=true;
	if (strServerFileRedirect !=null && strServerFileRedirect !='')
		strServerFileRedirect=strServerFileRedirect.substring(1);
	return  DispDocItemEx2(ele, objEvent, fTransformServiceOn, fShouldTransformExtension,
		fTransformHandleUrl, strHtmlTrProgId, iDefaultItemOpen, strProgId, strServerFileRedirect);
}
function IsClientAppInstalled(strProgId)
{
	var stsOpen=null;
	if(strProgId !='')
	{
		stsOpen=StsOpenEnsureEx(strProgId);
	}
	return stsOpen !=null;
}
function ViewDoc(url,strProgId)
{
	var stsOpen=StsOpenEnsureEx(strProgId);
	var fRet=false;
	if (stsOpen !=null)
	{
		try
		{
			fRet=stsOpen.ViewDocument2(window, url);
		}
		catch(e)
		{
			fRet=false;
		}
	}
	return fRet;
}
function PortalPinToMyPage(eForm, portalUrl, instanceID)
{
	eForm.action=portalUrl+'_vti_bin/portalapi.aspx?Cmd=PinToMyPage';
	eForm.ReturnUrl.value=window.location.href;
	eForm.ListViewUrl.value=MakeMtgInstanceUrl(eForm.ListViewUrl.value, instanceID);
	eForm.submit();
}
function PortalPinToMyPage(eForm, portalUrl, instanceId, listTitle, listDescription, listViewUrl, baseType, serverTemplate)
{
	eForm.action=portalUrl+'_vti_bin/portalapi.aspx?Cmd=PinToMyPage';
	SetFieldValue(eForm,"ReturnUrl",window.location.href);
	SetFieldValue(eForm,"ListViewUrl",MakeMtgInstanceUrl(listViewUrl, instanceId));
	SetFieldValue(eForm,"ListTitle",listTitle);
	SetFieldValue(eForm,"ListDescription",listDescription);
	SetFieldValue(eForm,"BaseType",baseType);
	SetFieldValue(eForm,"ServerTemplate",serverTemplate);
	eForm.submit();
}
function SetFieldValue(eForm, fieldName, value)
{
	var field=eForm[fieldName];
	if (field==null)
	{
	field=document.createElement("INPUT");
	field.setAttribute("type","hidden");
		field.setAttribute("name",fieldName);
		eForm.appendChild(field);
	}
	field.value=value;
}
function StURLSetVar2(stURL, stVar, stValue)
{
	var stNewSet=stVar+"="+stValue;
	var ichHash=stURL.indexOf("#");
	var hashParam;
	if (ichHash !=-1)
	{
		hashParam=stURL.substring(ichHash, stURL.length);
		stURL=stURL.substring(0, ichHash);
	}
	var ichQ=stURL.indexOf("?");
	if (ichQ !=-1)
	{
		var ich=stURL.indexOf("?"+stVar+"=", ichQ);
		if (ich==-1)
		{
			ich=stURL.indexOf("&"+stVar+"=", ichQ);
			if (ich !=-1)
				stNewSet="&"+stNewSet;
		}
		else
		{
			stNewSet="?"+stNewSet;
		}
		if (ich !=-1)
		{
			var re=new RegExp("[&?]"+stVar+"=[^&]*", "");
			stURL=stURL.replace(re, stNewSet);
		}
		else
		{
			stURL=stURL+"&"+stNewSet;
		}
	}
	else
	{
		stURL=stURL+"?"+stNewSet;
	}
	if (hashParam !=null && hashParam.length > 0)
		stURL=stURL+hashParam;
	return stURL;
}
function RemoveQueryParameterFromUrl(stURL, stParameterName)
{
	var re=new RegExp("[&?]"+stParameterName+"=[^&]*", "");
	stURL=stURL.replace(re, "");
	if (stURL.indexOf("?")==-1)
	{
		var ich=stURL.indexOf("&");
		if (ich !=-1)
			stURL=stURL.substring(0, ich)+"?"+stURL.substring(ich+1);
	}
	return stURL;
}
function MoveToViewDate(strdate, view_type)
{
	var wUrl=window.location.href;
	if (strdate !=null)
		wUrl=StURLSetVar2(wUrl,"CalendarDate",escapeProperly(strdate));
	if (view_type !=null)
		wUrl=StURLSetVar2(wUrl,"CalendarPeriod",view_type);
	SubmitFormPost(wUrl, true);
}
function MoveToDate(strdate)
{
	MoveToViewDate(strdate, null);
}
function MoveToToday()
{
	MoveToViewDate("", null);
}
function MoveView(viewtype)
{
	MoveToViewDate(null , viewtype);
}
function ClickDay(date)
{
	MoveToViewDate(date, null);
}
function GetMonthView(str)
{
	var wUrl=window.location.href;
	var ExpWeek=document.getElementById("ExpandedWeeksId");
	if(ExpWeek!=null)
		ExpWeek.value=str;
	else
		return ;
	SubmitFormPost(wUrl, true);
}
function NewItemDT(url,day, time)
{
	if (url==null)
		return ;
	if (time !=null)
	  url=StURLSetVar2(url,"CalendarTime",time);
	if (day !=null)
	  url=StURLSetVar2(url,"CalendarDate",day);
	NewItem(url, false);
}
function ClickTime(url, time)
{
  NewItemDT(url, null, time);
}
function NewItemDay(url, day)
{
  NewItemDT(url, day, null);
}
function HasValidUrlPrefix(url)
{
	var urlLower=url.toLowerCase();
	if (-1==urlLower.search("^http://") &&
		-1==urlLower.search("^https://"))
		return false;
	return true;
}
function ScrollToAnchorInInnerScrollPane(formName, hiddenFieldName, textInHref)
{
	if (!browseris.ie4up) return;
	try
	{
		var form=document.getElementById(formName);
		var anchor=document.getElementById(form[hiddenFieldName].value);
		if (typeof(anchor)=="undefined" || anchor==null)
			throw "";
	}
	catch(e)
	{
		var tempAnchor=null;
		for (var i=0; i < document.anchors.length; i++)
		{
			tempAnchor=document.anchors[i];
			var href=tempAnchor.href;
			if (href.search(textInHref) !=-1)
			{
				anchor=tempAnchor;
				break;
			}
		}
	}
	if (typeof(anchor) !="undefined" && anchor !=null)
	{
		var scrollTopOld=document.body.scrollTop;
		var scrollLeftOld=document.body.scrollLeft;
		anchor.scrollIntoView(false);
		document.body.scrollTop=scrollTopOld;
		document.body.scrollLeft=scrollLeftOld;
	}
}
function FilterChoice(opt, ctrl, strVal, filterVal)
{
	var i;
	var cOpt=0;
	var bSelected=false;
	var strHtml="";
	var strId=opt.id;
	var strName=opt.name;
	var strMatch="";
	var strMatchVal="";
	var strOpts=ctrl.choices;
	var rgopt=strOpts.split("|");
	var x=AbsLeft(ctrl);
	var y=AbsTop(ctrl)+ctrl.offsetHeight;
	var strHidden=ctrl.optHid;
	var iMac=rgopt.length - 1;
	var iMatch=-1;
	var unlimitedLength=false;
	var strSelectedLower="";
	if (opt !=null && opt.selectedIndex >=0)
	{
		bSelected=true;
		strSelectedLower=opt.options[opt.selectedIndex].innerText;
	}
	for (i=0; i < rgopt.length; i=i+2)
	{
		var strOpt=rgopt[i];
		while (i < iMac - 1 && rgopt[i+1].length==0)
		{
			strOpt=strOpt+"|";
			i++;
			if (i < iMac - 1)
			{
				strOpt=strOpt+rgopt[i+1];
			}
			i++;
		}
		var strValue=rgopt[i+1];
		var strLowerOpt=strOpt.toLocaleLowerCase();
		var strLowerVal=strVal.toLocaleLowerCase();
		if (filterVal.length !=0)
			bSelected=true;
		if (strLowerOpt.indexOf(strLowerVal)==0)
		{
			var strLowerFilterVal=filterVal.toLocaleLowerCase();
			if ((strLowerFilterVal.length !=0) && (strLowerOpt.indexOf(strLowerFilterVal)==0) && (strMatch.length==0))
				bSelected=false;
			if (strLowerOpt.length > 20)
			{
				unlimitedLength=true;
			}
			if (!bSelected || strLowerOpt==strSelectedLower)
			{
				strHtml+="<option selected value=\""+strValue+"\">"+STSHtmlEncode(strOpt)+"</option>";
				bSelected=true;
				strMatch=strOpt;
				strMatchVal=strValue;
				iMatch=i;
			}			
			else
			{
				strHtml+="<option value=\""+strValue+"\">"+STSHtmlEncode(strOpt)+"</option>";
			}
			cOpt++;
		}
	}
	var strHandler=" ondblclick=\"HandleOptDblClick()\" onkeydown=\"HandleOptKeyDown()\"";
	var strOptHtml="";
	if (unlimitedLength)
	{
		strOptHtml="<select tabIndex=\"-1\" ctrl=\""+ctrl.id+"\" name=\""+strName+"\" id=\""+strId+"\""+strHandler;
	}
	else
	{
		strOptHtml="<select class=\"ms-lookuptypeindropdown\" tabIndex=\"-1\" ctrl=\""+ctrl.id+"\" name=\""+strName+"\" id=\""+strId+"\""+strHandler;
	}
	if (cOpt==0)
	{
		strOptHtml+=" style=\"display:none;position:absolute;z-index:2;left:"+x+			"px;top:"+y+			"px\" onfocusout=\"OptLoseFocus(this)\"></select>";
	}
	else
	{
		strOptHtml+=" style=\"position:absolute;z-index:2;left:"+x+			"px;top:"+y+			"px\""+			" size=\""+(cOpt <=8 ? cOpt : 8)+"\""+			(cOpt==1 ? "multiple=\"true\"" : "")+			" onfocusout=\"OptLoseFocus(this)\">"+			strHtml+			"</select>";
	}
	opt.outerHTML=strOptHtml;
	var hid=document.getElementById(strHidden);
	if (iMatch !=0 || rgopt[1] !="0" )
		hid.value=strMatchVal;
	else
		hid.value="0";
	if (iMatch !=0 || rgopt[1] !="0" )
		return strMatch;
	else return "";
}
function OptLoseFocus(opt)
{
	var ctrl=document.getElementById(opt.ctrl);
	if (opt.selectedIndex >=0)
		SetCtrlFromOpt(ctrl, opt);
	opt.style.display="none";
}
function SetCtrlMatch(ctrl, opt)
{
	var hid=document.getElementById(ctrl.optHid);
	hid.value=opt.options[opt.selectedIndex].value;
	if (hid.value !=0)		
		ctrl.match=opt.options[opt.selectedIndex].innerText;
	else
		ctrl.match="";
}
function AbsLeft(obj)
{
	var x=obj.offsetLeft;
	var parent=obj.offsetParent;
	while (parent.tagName !="BODY")
	{
		x+=parent.offsetLeft;
		parent=parent.offsetParent;
	}
	x+=parent.offsetLeft;
	return x;
}
function AbsTop(obj)
{
	var y=obj.offsetTop;
	var parent=obj.offsetParent;
	while (parent.tagName !="BODY")
	{
		y+=parent.offsetTop;
		parent=parent.offsetParent;
	}
	y+=parent.offsetTop;
	return y;
}
function SetCtrlFromOpt(ctrl, opt)
{
	var hid=document.getElementById(ctrl.optHid);
	hid.value=opt.options[opt.selectedIndex].value;
	if (opt.options[opt.selectedIndex].value==0)
	{
		ctrl.value="";
		ctrl.match="";
	}
	else
	{
		ctrl.value=opt.options[opt.selectedIndex].innerText;
		ctrl.match=ctrl.value;		
	}	
}
function HandleOptDblClick()
{
	var opt=event.srcElement;
	var ctrl=document.getElementById(opt.ctrl);
	SetCtrlFromOpt(ctrl, opt);
	SetCtrlMatch(ctrl, opt);
	opt.style.display="none";
}
function HandleOptKeyDown()
{
	var opt=event.srcElement;
	var ctrl=document.getElementById(opt.ctrl);
	var key=event.keyCode;
	switch (key)
	{
	case 13:
	case 9:
		SetCtrlFromOpt(ctrl, opt)
		event.returnValue=false;
		opt.style.display="none";
		return;
	default:
		break;
	}
	return;
}
function EnsureSelectElement(ctrl, strId)
{
	var select=document.getElementById(strId);
	if (select==null)
	{
		select=document.createElement("SELECT");
		ctrl.parentNode.appendChild(select);
		select.outerHTML="<select id=\""+strId+"\" ctrl=\""+ctrl.id+"\" class=\"ms-lookuptypeindropdown\" name=\""+strId+"\" style=\"display:none\" onfocusout=\"OptLoseFocus(this)\"></select>";
		FilterChoice(select, ctrl, ctrl.value, "");
	}
	return document.getElementById(strId);;
}
function HandleKey()
{
	var key=event.keyCode;
	var ctrl=event.srcElement;
	var str=ctrl.value;
	var opt=EnsureSelectElement(ctrl, ctrl.opt);
	var bNeedMatch=false;
	var strLower;
	var strMatchLower;
	switch (key)
	{
	case 8:
		if (str.length > 0)
		{
			str=str.substr(0, str.length - 1);
		}
		bNeedMatch=true;
		break;
	case 16:
	case 17:
	case 18:
		return;
	case 9:
	case 16:
	case 17:
	case 18:
		return;
	case 13:
		strLower=ctrl.value.toLocaleLowerCase();
		strMatchLower=ctrl.match.toLocaleLowerCase();
		if (strMatchLower.indexOf(strLower) !=0)
			ctrl.match=FilterChoice(opt, ctrl, ctrl.value, "");
		if (opt.style.display !="none")
		{
			ctrl.value=ctrl.match;
			opt.style.display="none";
			event.returnValue=false;
		}
		return;
	case 27:
		opt.style.display="none";
		event.returnValue=false;
		return;
	case 38:
		if (opt.style.display !="none")
		{
			if (opt.selectedIndex > 0)
				opt.selectedIndex=opt.selectedIndex - 1;
			else
				opt.selectedIndex=opt.options.length - 1;
			SetCtrlMatch(ctrl, opt);
			event.returnValue=false;
		}
		return;		
	case 40:
		if (opt.style.display !="none" && opt.selectedIndex < opt.options.length - 1)
		{
			opt.selectedIndex=opt.selectedIndex+1;
			SetCtrlMatch(ctrl, opt);
			event.returnValue=false;
			return;
		}
		bNeedMatch=true;
		break;
	case 46:
		break;
	default:
		break;
	}
	if (bNeedMatch);
		ctrl.match=FilterChoice(opt, ctrl, str, "");
}
function ShowDropdown(textboxId)
{
	var ctrl=document.getElementById(textboxId);
	var str=ctrl.value;
	var opt=EnsureSelectElement(ctrl, ctrl.opt);
	ctrl.match=FilterChoice(opt, ctrl, "", ctrl.value);
	ctrl.focus();
}
function HandleChar()
{
	var ctrl=event.srcElement;
	var str=ctrl.value;
	var opt=document.getElementById(ctrl.opt);
	var key=event.keyCode;
	if (key==13)
		return;
	str=str+String.fromCharCode(key).toLocaleLowerCase();
	ctrl.match=FilterChoice(opt, ctrl, str, "");
}
function HandleLoseFocus()
{
	var ctrl=event.srcElement;
	var opt=document.getElementById(ctrl.opt);
	if (opt !=null && opt.style.display !="none" && document.activeElement !=opt)
		OptLoseFocus(opt);
}
function HandleChange()
{
	var ctrl=event.srcElement;
	var str=ctrl.value;
	var opt=document.getElementById(ctrl.opt);
	ctrl.match=FilterChoice(opt, ctrl, str, "");
}
function IsSafeHref(
	href)
{
	return (href.match(new RegExp("^http://", "i")) ||
			href.match(new RegExp("^https://", "i")) ||
			href.match(new RegExp("^ftp://", "i")) ||
			href.match(new RegExp("^file://", "i")) ||
			href.match(new RegExp("^mailto:", "i")) ||
			href.match(new RegExp("^news:", "i")) ||
			href.match(new RegExp("^/", "i")) ||
			href.match(new RegExp("^\\\\\\\\", "i")));
}
var L_RelativeUrlError_Text="Addresses that start from the current page might not display correctly. You must enter the complete URL or an address that starts from the current server.";
var L_UnknownProtocolUrlError_Text="Hyperlinks must begin with http://, https://, mailto:, news:, ftp://, file://, or \\\\. Check the address and try again.";
var L_UrlTooLongError_Text="The URL for the location must be no longer than 256 characters without the query parameters. The query parameters start at the question mark (?)."
function IsSafeHrefAlert(
	href,
	fAllowRelativeLinks)
{
	if (href.match("^[^?]{257}"))
	{
		alert(L_UrlTooLongError_Text);
		return false;
	}
	else if (IsSafeHref(href))
	{
		return true;
	}
	else
	{
		if (href.match("^[a-zA-Z]*:"))
		{
			alert(L_UnknownProtocolUrlError_Text);
			return false;
		}
		else if (true==fAllowRelativeLinks)
		{
			return true;
		}
		else
		{
			alert(L_RelativeUrlError_Text);
			return false;
		}
	}
}
function PositionMiniConsole() {
	var mc=document.getElementById("miniconsole");
	if (browseris.ie55up && browseris.win32)
		if (document.getElementById("siteactiontd")){
			mc.style.top="1";
		}
		else {
			mc.style.top="8";
		}
	else {
		mc.style.top="0";
	}
}
var deleteInstance=0;
function DeleteItemConfirmation()
{
	var message="";
	if (typeof(ItemIsCopy) !="undefined")
		if (ItemIsCopy)
			message=L_NotifyThisIsCopy_Text;
	if (recycleBinEnabled==1 &&
	deleteInstance !=1 )
		message+=L_STSRecycleConfirm_Text;
	else
		message+=L_STSDelConfirm_Text;
	return confirm(message);
}
function DeleteInstanceConfirmation()
{
	deleteInstance=1;
	return DeleteItemConfirmation()
}
function CancelMultiPageConfirmation(redirectUrl)
{
	var L_DeletePartialResponse1_text="A partial survey response has been saved.  Click OK to delete the partial survey response. If you want to continue this survey later click Cancel.  Your partial response can be found in the All Responses survey view.\n\nDo you want to send this partial response to the site Recycle Bin?";
	var L_DeletePartialResponse2_text="A partial survey response has been saved.  Click OK to delete the partial survey response. If you want to continue this survey later click Cancel.  Your partial response can be found in the All Responses survey view.\n\nDo you want to delete the partial response?";
	var message="";
	if (recycleBinEnabled==1)
		message=L_DeletePartialResponse1_text;
	else
		message=L_DeletePartialResponse2_text;
	if (confirm(message)==true)
		return true;
	else
		STSNavigate(redirectUrl);
	return false;
}
function RestoreItemVersionConfirmation()
{
	var L_Version_Restore_Confirm_Text="You are about to replace the current version with the selected version.";
	var message=L_Version_Restore_Confirm_Text;
	return confirm(message);
}
function DeleteItemVersionConfirmation(bRecycleBinEnabled)
{
	var L_Version_Delete_Confirm_Text="Are you sure you want to delete this version?";
	var L_Version_Recycle_Confirm_Text="Are you sure you want to send this version to the site Recycle Bin?";
	if (bRecycleBinEnabled)
		return confirm(L_Version_Recycle_Confirm_Text);
	else
		return confirm(L_Version_Delete_Confirm_Text);
}
function DeleteUserInfoItemConfirmation()
{
	var L_User_Delete_Confirm_Text="You are about to delete this user.";
	var message=L_User_Delete_Confirm_Text;
	return confirm(message);
}
function UnlinkCopyConfirmation(strItemUrl)
{
	return confirm(L_ConfirmUnlinkCopy_Text);
}
function Discuss(strUrl)
{
	var L_IE5upRequired_Text="'Discuss' requires a Windows SharePoint Services-compatible application and Microsoft Internet Explorer 6.0 or greater.";
	if (browseris.ie5up && browseris.win32)
		window.parent.location.href=strUrl;
	else
		alert(L_IE5upRequired_Text);
}
function ProcessDefaultNavigateHierarchy(nodeDiv, dataSourceId, dataPath, url, listInContext, type, form, qsCore, submitPath)
{
	if (typeof(_spCustomNavigateHierarchy)=="function")
	{
		_spCustomNavigateHierarchy(nodeDiv,dataSourceId,dataPath,url,listInContext,type);
	}
	else
	{
		if (listInContext==false)
		{
			top.location=url;
		}
		else
		{
			var par=document.createElement('INPUT');
			par.type='hidden';
			par.name='_spTreeNodeClicked';
			par.value=dataPath;
			form.appendChild(par);
			var qs="?RootFolder="+escapeProperly(url)+qsCore;
			SubmitFormPost(submitPath+qs);
			return false;
		}
	}
}
function ParseMultiColumnValue(fieldValue, delimiter)
{
	var subColumnValues=new Array();
	if (delimiter==null)
		delimiter=';#';
	var lead=delimiter.charCodeAt(0);
	var trail=delimiter.charCodeAt(1);
	if (fieldValue==null || fieldValue.length==0)
		return subColumnValues;
	var strLead=delimiter.charAt(0);
	var strLeadLead=strLead+strLead;
	var escape=new RegExp(strLeadLead, "g");
	var unescape=delimiter.charAt(0);
	var start=0;
	if (fieldValue.substr(0, 2)==delimiter)
		start=2;
	var end=start;
	var bContainEscapedCharacters=false;
	var totalLength=fieldValue.length;
	while (end < totalLength)
	{
		var index=fieldValue.indexOf(strLead, end);
		if (index >=0)
		{
			end=index;
			end++;
			if (fieldValue.charCodeAt(end)==trail)
			{
				if (end - 1 > start)
				{
					var strSubColumn=fieldValue.substr(start, end - start - 1);
					if (bContainEscapedCharacters)
						strSubColumn=strSubColumn.replace(escape, unescape);
					subColumnValues.push(strSubColumn);
					bContainEscapedCharacters=false;
				}
				else
				{
					subColumnValues.push('');
				}
				end++;
				start=end;
				continue;
			}
			else if (fieldValue.charCodeAt(end)==lead)
			{
				end++;
				bContainEscapedCharacters=true;
				continue;
			}
			else
			{
				throw "ArgumentException";
			}
		}
		else
		{
			end=totalLength;
		}
	}
	if (end > start)
	{
		var strSubColumn=fieldValue.substr(start, end - start);
		if (bContainEscapedCharacters)
			strSubColumn=strSubColumn.replace(escape, unescape);
		subColumnValues.push(strSubColumn);
	}
	return subColumnValues;
}
function ConvertMultiColumnValueToString(
	subColumnValues,
	delimiter,
	bAddLeadingTailingDelimiter)
{
	if (delimiter==null)
		delimiter=";#";
	if (bAddLeadingTailingDelimiter==null)
		bAddLeadingTailingDelimiter=true;
	var strLead=delimiter.charAt(0);
	var strLeadLead=strLead+strLead;
	var escape=new RegExp(delimiter.charAt(0), "g");
	var bHasValue=false;
	var sb='';
	for (var i=0; i < subColumnValues.length; i++)
	{
		var strSubColumn=subColumnValues[i];
		if (strSubColumn !=null && strSubColumn.length > 0)
			strSubColumn=strSubColumn.replace(escape, strLeadLead);
		if (strSubColumn !=null && strSubColumn.length > 0)
			bHasValue=true;
		if (bAddLeadingTailingDelimiter || i !=0)
			sb+=delimiter;
		sb+=strSubColumn;
	}
	if (bHasValue)
	{
		if (bAddLeadingTailingDelimiter)
		{
			sb+=delimiter;
		}
		return sb;
	}
	else
		return '';
}
var httpFolderTarget=null;
var httpFolderSource=null;
var httpFolderDiv=null;
function NavigateHttpFolderCore()
{
	if (httpFolderDiv==null)
	{
		httpFolderDiv=document.createElement('DIV');
		document.body.appendChild(httpFolderDiv);
		httpFolderDiv.onreadystatechange=NavigateHttpFolderCore;
		httpFolderDiv.addBehavior('#default#httpFolder');
	}
	if (httpFolderDiv.readyState=="complete")
	{
		httpFolderDiv.onreadystatechange=null;
		try
		{
			var targetFrame=document.frames.item(httpFolderTarget);
			if (targetFrame !=null)
			{
				targetFrame.document.body.innerText=					L_WebFoldersRequired_Text;
			}
		}
		catch (e) {}
		var isOk=false;
		try
		{
			var ret="";
			ret=httpFolderDiv.navigateFrame(httpFolderSource,
				httpFolderTarget);
			if (ret=="OK")
				isOk=true;
		}
		catch (e) { }
		if (!isOk &&
			0==httpFolderSource.search("http://[a-zA-Z0-9\-\.]+(:80)?/"))
		{
			var sUrl=httpFolderSource
				.replace(/http:\/\/([a-zA-Z0-9\-\.]+)(:80)?[\/]/, "//$1/")
				.replace(/[\/]/g, "\\");
			var targetFrame=document.frames.item(httpFolderTarget);
			if (targetFrame !=null)
			{
				try
				{
						targetFrame.onload=null;
						targetFrame.document.location.href=sUrl;
						isOk=true;
				}
				catch (e) { }
			}
		}
		if (!isOk)
		{
			alert(L_WebFoldersError_Text);
		}
	}
}
function NavigateHttpFolder(urlSrc, frameTarget)
{
	if ('/'==urlSrc.charAt(0))
	{
		urlSrc=document.location.protocol+"//"+document.location.host+			urlSrc;
	}
	httpFolderSource=urlSrc;
	httpFolderTarget=frameTarget;
	NavigateHttpFolderCore();
}
function NavigateHttpFolderIfSupported(urlSrc, frameTarget)
{
	if (SupportsNavigateHttpFolder())
	{
		NavigateHttpFolder(urlSrc, frameTarget);
	}
	else
	{
		alert(L_WebFoldersError_Text);
		window.history.back();
	}
}
function SupportsNavigateHttpFolder()
{
	return (browseris.ie5up && browseris.win32);
}
cGCMinimumWidth=400;
cGCMinimumHeight=200;
cGCMaxGCResizeCount=10;
var glGCObjectHeight=0;
var glGCObjectWidth=0;
glGCResizeCounter=0;
function TestGCObject( GCObject )
{
	if (((browseris.ie55up) && (typeof(GCObject)=="undefined")) || (GCObject==null) || (GCObject.object==null))
		return false;
	return true;
}
function GCComputeSizing(GCObject)
{
	if (TestGCObject(GCObject))
	{
		var fBIDI=(document.documentElement.currentStyle.direction=="rtl");
		var lGCWindowWidth=document.documentElement.scrollWidth;
		var lGCWindowHeight=document.documentElement.scrollHeight;
		var lGCObjectOffsetLeft=0;
		var lGCObjectOffsetTop=0;
		if (fBIDI)
			{
			lGCObjectOffsetLeft=-180;
			lGCObjectOffsetTop=120;
			}
		else
			{
			lGCObjectOffsetLeft=32;
			lGCObjectOffsetTop=-2;
			}
		var lGCObjectWalker=GCObject.parentElement;
		while (lGCObjectWalker !=document.body)
		{
			lGCObjectOffsetLeft+=lGCObjectWalker.offsetLeft;
			lGCObjectOffsetTop+=lGCObjectWalker.offsetTop;
			lGCObjectWalker=lGCObjectWalker.offsetParent;
			if (fBIDI)
				if (lGCObjectWalker.offsetLeft > 0)
					break;
		}
		lGCObjectOffsetLeft+=GCObject.parentElement.offsetLeft;
		lGCObjectOffsetTop+=GCObject.parentElement.offsetTop;
		glGCObjectHeight=lGCWindowHeight - lGCObjectOffsetTop;
		if (glGCObjectHeight > lGCWindowHeight)
			glGCObjectHeight=lGCWindowHeight
		if (glGCObjectHeight < cGCMinimumHeight)
			glGCObjectHeight=cGCMinimumHeight;
		if (fBIDI)
			{
			glGCObjectWidth=lGCWindowWidth+lGCObjectOffsetLeft;
			}
		else
			glGCObjectWidth=lGCWindowWidth - lGCObjectOffsetLeft;
		if (glGCObjectWidth > lGCWindowWidth)
				glGCObjectWidth=lGCWindowWidth;
		if (glGCObjectWidth < cGCMinimumWidth)
			glGCObjectWidth=cGCMinimumWidth;
	}
}
function GCResizeGridControl(GCObject)
{
	if (TestGCObject(GCObject))
	{
		var lGCOldObjectHeight=glGCObjectHeight;
		var lGCOldglGCObjectWidth=glGCObjectWidth;
		GCComputeSizing(GCObject);
		if (lGCOldObjectHeight !=glGCObjectHeight)
			GCObject.height=glGCObjectHeight;
		if (lGCOldglGCObjectWidth !=glGCObjectWidth)
			GCObject.width=glGCObjectWidth;
	}
}
var win_resize_counter=0;
var obj_resize_counter=0;
function GCWindowResize(GCObject)
{
	win_resize_counter++;
	if(win_resize_counter < 3)
	{
		if (TestGCObject(GCObject))
		{
			glGCResizeCounter=0;
			GCResizeGridControl(GCObject);
		}
	}
	else
		win_resize_counter=0;
}
function GCOnResizeGridControl(GCObject)
{
	obj_resize_counter++;
	if(obj_resize_counter < 2)
	{
		if (TestGCObject(GCObject))
		{
			if (glGCResizeCounter < cGCMaxGCResizeCount)
			{
				glGCResizeCounter++;
				GCResizeGridControl(GCObject);
			}
		}
	}
	else
	  obj_resize_counter=0;
}
function GCActivateAndFocus(GCObject)
{
	if (TestGCObject(GCObject))
	{
		GCObject.SetActive;
		GCObject.Focus;
 	}
}
function GCNavigateToNonGridPage()
{
	var strDocUrl=window.location.href;
	gridPart=strDocUrl.match("ShowInGrid=");
	if (gridPart)
	{
		gridSet=/ShowInGrid=\w*/;
		strDocUrl=strDocUrl.replace(gridSet, "");	
	}
   	var idxQuery=strDocUrl.indexOf("?");
	if (idxQuery !=-1)
		{
		var idxQry2=strDocUrl.indexOf("?", idxQuery+1);
		if (idxQry2 !=-1)
			strDocUrl=strDocUrl.slice(0, idxQry2);
		strDocUrl=strDocUrl+"&";
		}
	else
		strDocUrl=strDocUrl+"?";
	strDocUrl=strDocUrl+"ShowInGrid=False";
	document.location.replace(STSPageUrlValidation(strDocUrl));
}
function GCAddNewColumn(GCObject,path)
{
	if (TestGCObject(GCObject))
	{
	  var source=window.location.href;
	  var listName=GCObject.Name;
	  var colName=GCObject.SelectedColumnUniqueName;
	  var ltr=GCObject.RightToLeft;
	  var viewGUID=GCObject.ViewGUID;
	  var page="FldNew.aspx";
	  var listServerTemplate=GCObject.ServerTemplate;
	  if (listServerTemplate=="102" )
	  {
	    page="QstNew.aspx";
	  }
	  path=path+"/_layouts/"+page+"?List="+listName+"&View="+viewGUID+"&Source="+source+"&RelativeToField="+colName+"&LTR="+ltr;
	  window.location=path
	}
}
function GCEditDeleteColumn(GCObject,path)
{
	if (TestGCObject(GCObject))
	{
		  var source=window.location.href;
		  var colName=GCObject.SelectedColumnUniqueName;
		  var listName=GCObject.Name;
		  var page="FldEdit.aspx";
		  var listServerTemplate=GCObject.ServerTemplate;
		  if (listServerTemplate=="102" )
		  {
		    page="QstEdit.aspx";
		  }
		  path=path+"/_layouts/"+page+"?List="+listName+"&Field="+colName+"&Source="+source;
		  window.location=path
	}
}
function GCShowHideTaskPane(GCObject)
{
	if (TestGCObject(GCObject))
	{
		var state=GCObject.DisplayTaskPane;
		GCObject.DisplayTaskPane=!state;
	}
}
function GCShowHideTotalsRow(GCObject)
{
	if (TestGCObject(GCObject))
	{
		var state=GCObject.DisplaySheetTotals;
		GCObject.DisplaySheetTotals=!state;
	}
}
function GCGridNewRow(GCObject)
{
	if (TestGCObject(GCObject))
	{
		GCObject.SelectNewRow();
	}
}
function GCRefresh(GCObject)
{
	if (TestGCObject(GCObject))
	{
		GCObject.Refresh();
	}
}
function GCNewFolder(GCObject)
{
	if (TestGCObject(GCObject))
	{
		GCObject.NewFolder();
	}
}
var L_Edit_Text="Edit";
var L_ViewItem_Text="View Item";
var L_EditItem_Text="Edit Item";
var L_EditSeriesItem_Text="Edit Series";
var L_DeleteItem_Text="Delete Item";
var L_DeleteDocItem_Text="Delete";
var L_ViewProperties_Text="View Properties";
var L_EditProperties_Text="Edit Properties";
var L_ViewResponse_Text="View Response";
var L_EditResponse_Text="Edit Response";
var L_DeleteResponse_Text="Delete Response";
var L_Subscribe_Text="Alert Me";
var L_CustomizeNewButton_Text="Change New Button Order";
var L_Review_Text="Send for Review";
var L_EditIn_Text="Edit in ^1";
var L_EditInApplication_Text="Edit Document"
var L_Checkin_Text="Check In";
var L_Checkout_Text="Check Out";
var L_DiscardCheckou_Text="Discard Check Out";
var L_CreateDWS_Text="Create Document Workspace";
var L_PublishBack_Text="Publish to Source Location";
var L_Versions_Text="Version History";
var L_WorkOffline_Text="Connect to Client";
var L_Reply_Text="Reply";
var L_ExportContact_Text="Export Contact";
var L_ExportEvent_Text="Export Event";
var L_Reschedule_Text="Rescheduling Options";
var L_Move_Text="Move";
var L_Keep_Text="Keep";
var L_Delete_Text="Delete";
var L_Open_Text="Open";
var L_SiteSettings_Text="Change Site Settings";
var L_ManageUsers_Text="Manage Users";
var L_DeleteSite_Text="Delete Site";
var L_SiteStorage_Text="Manage Site Storage";
var L_MngPerms_Text="Manage Permissions";
var L_Settings_Text="Settings";
var L_Remove_Text="Remove from this list";
var L_ModerateItem_Text="Approve/reject";
var L_PublishItem_Text="Publish a Major Version";
var L_CancelPublish_Text="Cancel Approval";
var L_UnPublishItem_Text="Unpublish this version";
var L_DownloadOriginal_Text="Download Picture";
var L_EditVersion_Text="Edit";
var L_EditInOIS_Text="Edit Picture";
var L_Workflows_Text="Workflows";
var L_Send_Text="Send To";
var L_ExistingCopies_Text="Existing Copies";
var L_OtherLocation_Text="Other Location";
var L_GoToSourceItem_Text="Go to Source Item";
var L_NotifyThisIsCopy_Text="This item was copied from another location and may be receiving updates from there.  You should make sure that the source stops sending updates or this item may get recreated.\n\n";
var L_SendToEmail_Text="E-mail a Link";
var L_DownloadACopy_Text="Download a Copy";
var L_DocTran_Text="Convert Document";
var L_AddToMyLinks_Text="Add to My Links";
var L_AddToCategory_Text="Submit to Portal Area";
var L_VS_DownArrow_Text="Select a View";
var L_ModifyView="Modify this view";
var L_CreateView="Create a new view";
function resetExecutionState()
{
	IsMenuShown=false;
	itemTable=null;
	EndDeferItem();
	imageCell=null;
	onKeyPress=false;
	currentCtx=null;
	currentEditMenu=null;
	currentItemID=null;
	downArrowText=null;
	currentItemAppName=null;
	currentItemProgId=null;
	currentItemIcon=null;
	currentItemOpenControl=null;
	currentItemModerationStatus=null;
	currentItemUIString=null;
	currentItemCheckedoutToLocal=null;
	currentItemCanModify=null;
	currentItemFileUrl=null;
	currentItemFSObjType=null;
	currentItemCheckedOutUserId=null;
	currentItemCheckoutExpires=null;
	currentItemPermMaskH=null;
	currentItemPermMaskL=null;
	currentItemIsEventsExcp=null;
	currentItemIsEventsDeletedExcp=null;
}
function IsMenuEnabled()
{
	return (browseris.ie55up || browseris.nav6up || browseris.safari125up);
}
function GetSelectedElement(elem, tagName)
{
	while(elem !=null && elem.tagName !=tagName)
		elem=elem.parentNode;
	return elem;
}
function setupMenuContext(ctx)
{
	currentCtx=ctx;
}
function FindSTSMenuTable(elm, strSearch)
{
	var str=elm.getAttribute(strSearch);
	while (elm !=null && (str==null ||str==""))
	{
		elm=GetSelectedElement(elm.parentNode, "TABLE");
		if (elm !=null)
			str=elm.getAttribute(strSearch);
	}
	return elm;
}
function OnLinkDeferCall(elm)
{
	if (!IsMenuEnabled())
		return false;
	elm.onblur=OutItem;
	elm.onkeydown=PopMenu;
	var elmTmp=FindSTSMenuTable(elm, "CTXName");
	if (elmTmp==null)
		return false;
	OnItem(elmTmp);
	return false;
}
function StartDeferItem(elm)
{
	if (elm !=itemTable)
	{
		itemTableDeferred=elm;
		elm.onmouseout=EndDeferItem;
		elm.onclick=DeferredOnItem;
		elm.oncontextmenu=DeferredOnItem;
	}
}
function DeferredOnItem(e)
{
	var elm=itemTableDeferred;
	if (elm !=null)
	{
		MenuHtc_hide();
		OnItem(elm);
		CreateMenu(e);
		return false;
	}
}
function EndDeferItem()
{
	var elm=itemTableDeferred;
	if (elm !=null)
	{
		itemTableDeferred=null;
		elm.onmouseout=null;
		elm.onclick=null;
		elm.oncontextmenu=null;
	}
}
function GetFirstChildElement(e)
{
	for (var i=0; i < e.childNodes.length; i++)
	{
		if (e.childNodes[i].nodeType==1)
			return e.childNodes[i];
	}
	return null;
}
function GetLastChildElement(e)
{
	for (var i=e.childNodes.length-1; i >=0; i--)
	{
		if (e.childNodes[i].nodeType==1)
			return e.childNodes[i];
	}
	return null;
}
function OnItemDeferCall(elm)
{
	if (!IsMenuEnabled())
		return false;
	if (IsMenuOn())
	{
		StartDeferItem(elm);
		return false;
	}
	if (itemTable !=null)
		OutItem();
	itemTable=elm;
	currentItemID=GetAttributeFromItemTable(itemTable, "ItemId", "Id");
	var createCtx=new Function("setupMenuContext("+itemTable.getAttribute("CTXName")+");");
	createCtx();
	var ctx=currentCtx;
	if (browseris.nav6up)
		itemTable.className="ms-selectedtitlealternative";
	else
		itemTable.className="ms-selectedtitle";
	if (browseris.ie5up && !browseris.ie55up)
	{
		itemTable.onclick=EditMenuDefaultForOnclick;
		itemTable.oncontextmenu=EditMenuDefaultForOnclick;
	}
	else
	{
		itemTable.onclick=CreateMenu;
		itemTable.oncontextmenu=CreateMenu;
	}
	itemTable.onmouseout=OutItem;
	var titleRow;
	titleRow=GetFirstChildElement(GetFirstChildElement(itemTable));
	if (titleRow !=null)
	{
		imageCell=GetLastChildElement(titleRow);
	}
	if (ctx.listTemplate==200)
	{
		if (itemTable.getAttribute("menuType")=="Orphaned")
			downArrowText=L_Reschedule_Text;
	}
	else
		downArrowText=L_Edit_Text;
	var imageTag=GetFirstChildElement(imageCell);
	imageTag.src=ctx.imagesPath+"menudark.gif";
	imageTag.alt=downArrowText;
	imageTag.style.visibility="visible";
	imageCell.className="ms-menuimagecell";
	return false;
}
function OutItem()
{
	if (!IsMenuOn() && itemTable !=null)
	{
		itemTable.className="ms-unselectedtitle";
		itemTable.onclick=null;
		itemTable.oncontextmenu=null;
		itemTable.onmouseout=null;
		if (imageCell !=null)
		{
			GetFirstChildElement(imageCell).style.visibility="hidden";
			imageCell.className="";
		}
		resetExecutionState();
	}
}
function IsMenuOn()
{
	if (!IsMenuShown)
		return false;
	var fIsOpen=false;
	fIsOpen=MenuHtc_isOpen(currentEditMenu);
	if (!fIsOpen)
		IsMenuShown=false;
	return fIsOpen;
}
function PopMenu(e)
{
	if (!IsMenuEnabled())
		return true;
	if (e==null)
		e=window.event;
	var nKeyCode;
	if (browseris.nav6up)
		nKeyCode=e.which;
	else
		nKeyCode=e.keyCode;
	if (!IsMenuOn() && ((e.shiftKey && nKeyCode==13) || (e.altKey && nKeyCode==40)))
	{
		onKeyPress=true;
		CreateMenu(e);
		onKeyPress=false;
		return false;
	}
	else
		return true;
}
function CreateMenuEx(ctx, container, e)
{
	if (container==null)
		return;
	IsMenuShown=true;
	document.body.onclick="";
	var m;
	m=CMenu(currentItemID+"_menu");
	if (!m)
		return;
	else if (ctx.isVersions)
		AddVersionMenuItems(m, ctx);
	else if (ctx.listBaseType==1)
		AddDocLibMenuItems(m, ctx);
	else if (ctx.listTemplate==200)
		AddMeetingMenuItems(m, ctx);
	else
		AddListMenuItems(m, ctx);
	InsertFeatureMenuItems(m, ctx);
	currentEditMenu=m;
	container.onmouseout=null;
	OMenu(m, container, null, null, -1);
	itemTable=GetSelectedElement(container, "TABLE");
	m._onDestroy=OutItem;
	e.cancelBubble=true;
	return false;
}
function CreateMenu(e)
{
	if (!IsContextSet())
		return;
	var ctx=currentCtx;
	if (e==null)
		e=window.event;
	var srcElement=e.srcElement ? e.srcElement : e.target;
	if (itemTable==null || imageCell==null ||
		(onKeyPress==false &&
		 (srcElement.tagName=="A" ||
		  srcElement.parentNode.tagName=="A")))
		return;
	return CreateMenuEx(ctx, itemTable, e);
}
function AddSendSubMenu(m,ctx)
{
	strDisplayText=L_Send_Text;
	var currentItemUrl=GetAttributeFromItemTable(itemTable, "Url", "ServerUrl");
	var currentItemEscapedFileUrl;
	var currentItenUnescapedUrl;
	var strExtension;
	if (currentItemFileUrl !=null)
   {
	currentItenUnescapedUrl=unescapeProperly(currentItemFileUrl);
	currentItemEscapedFileUrl=escapeProperly(currentItenUnescapedUrl);
	strExtension=SzExtension(currentItenUnescapedUrl);
	if (strExtension !=null && strExtension !="")
   		strExtension=strExtension.toLowerCase();
	}
	var sm=CASubM(m,strDisplayText,"","",400);
	sm.id="ID_Send";
	var menuOption;
	var serverFileRedirect=itemTable.getAttribute("SRed");
	if (currentItemProgId !="SharePoint.WebPartPage.Document" &&
		(serverFileRedirect==null || serverFileRedirect=="" || HasRights(0x0, 0x20)) && strExtension !="aspx")
	{
		if (typeof(ctx.SendToLocationName) !="undefined" &&
			ctx.SendToLocationName !=null &&
			ctx.SendToLocationName !="" &&
			typeof(ctx.SendToLocationUrl) !="undefined" &&
			ctx.SendToLocationUrl !=null &&
			ctx.SendToLocationUrl !="")
		{
			strAction="STSNavigate('"+				ctx.HttpRoot+				"/_layouts/copy.aspx?"+				"SourceUrl="+				currentItemEscapedFileUrl+				"&Source="+				GetSource()+"&FldUrl="+				escapeProperly(ctx.SendToLocationUrl)+"')";
			menuOption=CAMOpt(sm,
								ctx.SendToLocationName,
								strAction,
								"");
		}
		if (typeof(itemTable.getAttribute("HCD")) !="undefined" && itemTable.getAttribute("HCD")=="1")
		{
			strDisplayText=L_ExistingCopies_Text;
			strAction="STSNavigate('"+ctx.HttpRoot+				"/_layouts/updatecopies.aspx?"+				"SourceUrl="+				currentItemEscapedFileUrl+				"&Source="+				GetSource()+"')";
			strImagePath=ctx.imagesPath+"existingLocations.gif";
			menuOption=CAMOpt(sm, strDisplayText, strAction, strImagePath);
			menuOption.id="ID_ExistingCopies";
		}
		strDisplayText=L_OtherLocation_Text;
		strAction="STSNavigate('"+			ctx.HttpRoot+			"/_layouts/copy.aspx?"+			"SourceUrl="+			currentItemEscapedFileUrl+			"&Source="+			GetSource()+"')";
		strImagePath=ctx.imagesPath+"sendOtherLoc.gif";
		menuOption=CAMOpt(sm, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_OtherLocation";
		if (ctx.OfficialFileName !=null && ctx.OfficialFileName !="")
		{
			strDisplayText=ctx.OfficialFileName;
			strAction="STSNavigate('"+				ctx.HttpRoot+				"/_layouts/SendToOfficialFile.aspx?"+				"SourceUrl="+				currentItemEscapedFileUrl+				"&Source="+				GetSource()+"')";
			strImagePath="";
			CAMOpt(sm, strDisplayText, strAction, strImagePath);
		}
		CAMSep(sm);
	}
	if(HasRights(0x10, 0x0))
	{
		strDisplayText=L_SendToEmail_Text;
		var currentItemUrl=GetAttributeFromItemTable(itemTable, "Url", "ServerUrl");
		var httpRootWithSlash=ctx.HttpRoot.substr(0);
		if (httpRootWithSlash[httpRootWithSlash.length-1] !='/')
			httpRootWithSlash+='/';
		var slashLoc=-1;
		var fileUrl="";
		slashLoc=httpRootWithSlash.substring(8).indexOf('/')+8;
		fileUrl=httpRootWithSlash.substr(0, slashLoc)+			escapeProperlyCore(unescapeProperly(currentItemUrl), true);
		var serverFileRedir=itemTable.getAttribute("SRed");
		if ((serverFileRedir !=null) &&
			(serverFileRedir !="") &&
			(serverFileRedir !="1"))
		{
			if (serverFileRedir.substring(0,1) !="1")
			{
				fileUrl=serverFileRedir;
			}
			else
			{
				fileUrl=serverFileRedir.substring(1);
			}
		}
		strAction="javascript:navigateMailToLinkNew('"+fileUrl+"')";
		strImagePath=ctx.imagesPath+"gmailnew.gif";
		menuOption=CAMOpt(sm, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_SendToEmail";
	}
	var serverFileRedirect=itemTable.getAttribute("SRed");
	if (currentItemFSObjType !=1 &&
		ctx.listBaseType==1 &&
		(serverFileRedirect==null || serverFileRedirect==""
		   || HasRights(0x0, 0x20)))
	{
		if (ctx.listTemplate !=109 &&
			ctx.listTemplate !=119)
			AddWorkspaceMenuItem(sm, ctx);
		strAction="STSNavigate('"+			ctx.HttpRoot+			"/_layouts/download.aspx?"+			"SourceUrl="+			currentItemEscapedFileUrl+			"&Source="+			GetSource()+"&FldUrl="+			escapeProperly(ctx.SendToLocationUrl)+"')";;
		menuOption=CAMOpt(sm, L_DownloadACopy_Text, strAction, "");
		menuOption.id="ID_DownloadACopy";
	}
}
function AddDocTransformSubMenu(m, ctx)
{
	if (typeof(rgDocTransformers)=="undefined" ||
		rgDocTransformers==null)
	{
		return;
	}
	var sm=null;
	var currentItemUrl=GetAttributeFromItemTable(itemTable, "Url", "ServerUrl");
	var currentItemEscapedFileUrl;
	if (currentItemFileUrl !=null)
		currentItemEscapedFileUrl=escapeProperly(
		unescapeProperly(currentItemFileUrl));
	var iDot=currentItemUrl.lastIndexOf(".");
	if (iDot > 0)
	{
		var strExtension=currentItemUrl.substring(iDot+1, currentItemUrl.length).toLowerCase();
		var iTransformer;
		var fAddedTransformer=false;
		for (iTransformer=0; iTransformer < rgDocTransformers.length; iTransformer++)
		{
			if (rgDocTransformers[iTransformer].ConvertFrom==strExtension)
			{
				var ctid=GetAttributeFromItemTable(itemTable, "CId", "ContentTypeId");
				var re=new RegExp("/\|"+ctid+"\|/");
				if (ctid && !re.test(rgDocTransformers[iTransformer].ExcludedContentTypes))
				{
					if (!fAddedTransformer)
					{
						sm=CASubM(m, L_DocTran_Text, ctx.imagesPath+"ConvertDocument.gif", L_DocTran_Text, 500);
						sm.Id="ID_ConvertDocument";
						fAddedTransformer=true;
					}
					strAction="STSNavigate('"+ctx.HttpRoot+											"/_layouts/"+escapeProperlyCore(rgDocTransformers[iTransformer].TransformUIPage, true)+"?"+											"FileName="+currentItemEscapedFileUrl+											"&TID="+rgDocTransformers[iTransformer].Id+											"&Source="+GetSource()+											"')";
					var tm;
					tm=CAMOpt(sm, rgDocTransformers[iTransformer].Name, strAction, "");
					tm.Id="ID_Transform"+rgDocTransformers[iTransformer].Id;
				}
			}
		}
	}
}
function AddMeetingMenuItems(m, ctx)
{
	if (itemTable.getAttribute("menuType")=="Orphaned")
	{
		var menuOption;
		var currentInstanceId=GetAttributeFromItemTable(itemTable, "ItemId", "Id");
		strDisplayText=L_Move_Text;
		strAction="GoToMtgMove('"+ctx.listUrlDir+"',"+currentInstanceId+",'"+itemTable.getAttribute("DateTime")+"','"+itemTable.getAttribute("DateTimeISO")+"')";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_Move";
		strDisplayText=L_Keep_Text;
		strAction="MtgKeep('"+ctx.HttpPath+"','"+ctx.listName+"',"+currentInstanceId+")";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_Keep";
		strDisplayText=L_Delete_Text;
		strAction="MtgDelete('"+ctx.HttpPath+"','"+ctx.listName+"',"+currentInstanceId+")";
		strImagePath=ctx.imagesPath+"delitem.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_Delete";
	}
}
function AddListMenuItems(m, ctx)
{
	if (typeof(Custom_AddListMenuItems) !="undefined")
	{
		if (Custom_AddListMenuItems(m, ctx))
			return;
	}
	if (currentItemFileUrl==null)
		currentItemFileUrl=GetAttributeFromItemTable(itemTable, "Url", "ServerUrl");
	var currentItemEscapedFileUrl;
	if (currentItemFileUrl !=null)
		currentItemEscapedFileUrl=escapeProperly(unescapeProperly(currentItemFileUrl));
	if (currentItemIsEventsExcp==null)
	{
		currentItemIsEventsExcp=false;
		currentItemIsEventsDeletedExcp=false;
		currentItemEvtType=itemTable.getAttribute("EventType");
		if(currentItemEvtType !=null &&
			 (currentItemEvtType==2 || currentItemEvtType==3 || currentItemEvtType==4))
		{
			currentItemIsEventsExcp=true;
			if (currentItemEvtType==3)
	            currentItemIsEventsDeletedExcp=true;
		}
	}
	var menuOption;
	if (ctx.listBaseType==3 && ctx.listTemplate==108)
	{
		strDisplayText=L_Reply_Text;
		if(itemTable.getAttribute("Ordering").length>=504)
		{
			var L_ReplyLimitMsg_Text="Cannot reply to this thread. The reply limit has been reached.";
			strAction="alert('"+L_ReplyLimitMsg_Text+"')";
		}
		else
		{
			strAction="STSNavigate('"+ctx.newFormUrl
+"?Threading="+escapeProperly(itemTable.getAttribute("Ordering"))
+"&Guid="+escapeProperly(itemTable.getAttribute("ThreadID"))
+"&Subject="+escapeProperly(itemTable.getAttribute("Subject"))
+"&Source="+GetSource()+"')";
		}
		strImagePath=ctx.imagesPath+"reply.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 100);
		menuOption.id="ID_Reply";
	}
	AddSharedNamespaceMenuItems(m, ctx);
	if (currentItemID.indexOf(".0.") < 0 && HasRights(0x0, 0x8)
		  && !currentItemIsEventsExcp)
	{
		if (ctx.listBaseType==4)
			strDisplayText=L_DeleteResponse_Text;
		else
			strDisplayText=L_DeleteItem_Text;
		strAction="DeleteListItem()";
		strImagePath=ctx.imagesPath+"delitem.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 300);
		menuOption.id="ID_DeleteItem";
	}
	var contentTypeId=itemTable.getAttribute("CId");
	if (contentTypeId !=null && contentTypeId.indexOf("0x0106")==0
			&& HasRights(0x10, 0x0))
	{
		strDisplayText=L_ExportContact_Text;
		strAction="STSNavigate('"+ctx.HttpPath+"&Cmd=Display&CacheControl=1&List="+ctx.listName+"&ID="+currentItemID+"&Using="+escapeProperly(ctx.listUrlDir)+"/vcard.vcf"+"')";
		strImagePath=ctx.imagesPath+"exptitem.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 350);
		menuOption.id="ID_ExportContact";
	}
	CAMSep(m);
	if (ctx.verEnabled==1)
	{
		AddVersionsMenuItem(m, ctx, currentItemEscapedFileUrl);
	}
	AddWorkflowsMenuItem(m, ctx);
	CAMSep(m);
	if ((currentItemID.indexOf(".0.") < 0)
		  && HasRights(0x80, 0x0))
	{
		strDisplayText=L_Subscribe_Text;
		strAction="NavigateToSubNewAspx('"+ctx.HttpRoot+"', 'List="+ctx.listName+"&ID="+currentItemID+"')";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1100);
		menuOption.id="ID_Subscribe";
	}
	if (ctx.isModerated==true &&
		  HasRights(0x0, 0x10) && HasRights(0x0, 0x4)
			&& HasRights(0x0, 0x21000) && ctx.listBaseType !=4)
	{
		strDisplayText=L_ModerateItem_Text;
		strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/approve.aspx?List="+ctx.listName
+"&ID="+currentItemID+"&Source="+GetSource()+"')";
		strImagePath=ctx.imagesPath+"apprj.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1150);
		menuOption.id="ID_ModerateItem";
	}
	if (currentItemFSObjType==1 &&
		ctx.ContentTypesEnabled &&
		ctx.listTemplate !=108)
	{
		strDisplayText=L_CustomizeNewButton_Text;
		strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/ChangeContentTypeOrder.aspx?List="+ctx.listName+"&RootFolder="+currentItemEscapedFileUrl+"&Source="+GetSource()+"')";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1170);
		menuOption.id="ID_CustomizeNewButton";
	}
}
function ReplaceUrlTokens(urlWithTokens, ctx)
{
	if (currentItemID !=null)
		urlWithTokens=urlWithTokens.replace("{ItemId}", currentItemID);
	if (currentItemFileUrl !=null)
		urlWithTokens=urlWithTokens.replace("{ItemUrl}", currentItemFileUrl);
	if (ctx.HttpRoot !=null)
		urlWithTokens=urlWithTokens.replace("{SiteUrl}", ctx.HttpRoot);
	if (ctx.listName !=null)
		urlWithTokens=urlWithTokens.replace("{ListId}", ctx.listName);
	return urlWithTokens;
}
function InsertFeatureMenuItems(m, ctx)
{
	CAMSep(m);
	var fileType=GetAttributeFromItemTable(itemTable, "Ext", "FileType");
	var progId=GetAttributeFromItemTable(itemTable, "Type", "HTMLType");
	var contentTypeId=GetAttributeFromItemTable(itemTable, "CId", "ContentTypeId");
	var listTemplateId=null;
	if (ctx !=null)
		listTemplateId=ctx.listTemplate;
	if (fileType) fileType=fileType.toLowerCase();
	if (progId) progId=progId.toLowerCase();
	if (contentTypeId) contentTypeId=contentTypeId.toLowerCase();
	var menuOption;
	var elemTable=document.getElementById("ECBItems");
	if (elemTable !=null)
	{
		var elemTBody=elemTable.childNodes[0];
		for (var iMenuItem=0; iMenuItem < elemTBody.childNodes.length; iMenuItem++)
		{
			var elemTR=elemTBody.childNodes[iMenuItem];
			var elemTDRightsH=parseInt(GetInnerText(elemTR.childNodes[3]));
			var elemTDRightsL=parseInt(GetInnerText(elemTR.childNodes[4]));
			var regType=GetInnerText(elemTR.childNodes[5]);
			var regId=GetInnerText(elemTR.childNodes[6]);
			var fInsertMenuItem=false;
			if (regId)
			{
				regId=regId.toLowerCase();
				if (regType=="FileType")
				{
					fInsertMenuItem=						(fileType==regId.toLowerCase());
				}
				else if (regType=="ProgId")
				{
					fInsertMenuItem=						(progId==regId.toLowerCase());
				}
				else if (regType=="ContentType")
				{
					fInsertMenuItem=						(contentTypeId &&
						 contentTypeId.indexOf(regId.toLowerCase())==0);
				}
				else if (regType=="List")
				{
					fInsertMenuItem=						(listTemplateId &&
						 listTemplateId==regId);
				}
			}
			if (fInsertMenuItem &&
				HasRights(elemTDRightsH, elemTDRightsL))
			{
				var elemTDTitle=elemTR.childNodes[0];
				var elemTDImageUrl=elemTR.childNodes[1];
				var elemTDAction=elemTR.childNodes[2];
				var iSequence=parseInt(GetInnerText(elemTR.childNodes[7]));
				var strDisplayText=GetInnerText(elemTDTitle);
				var tdAction=ReplaceUrlTokens(GetInnerText(elemTDAction), ctx);
				var strAction;
				if (tdAction.substr(0,11)=="javascript:")
					strAction=tdAction;
				else
					strAction="STSNavigate('"+STSScriptEncode(tdAction)+"')";
				var strImagePath=ReplaceUrlTokens(GetInnerText(elemTDImageUrl), ctx);
				menuOption=CIMOpt(m, strDisplayText, strAction, strImagePath, null, iSequence);
			}
		}
	}
}
function GetRootFolder(ctx)
{
	var RootFolder=GetUrlKeyValue("RootFolder", true);
	if (RootFolder=="" || bValidSearchTerm)
	{
		var FileDirRef;
		if (itemTable)
			FileDirRef=GetAttributeFromItemTable(itemTable, "DRef", "FileDirRef");
		if (FileDirRef !=null)
			RootFolder="/"+FileDirRef;
		else
			RootFolder=ctx.listUrlDir;
		RootFolder=escapeProperly(RootFolder);
	}
	return "&RootFolder="+RootFolder;
}
function HasRights(requiredH, requiredL)
{
	if(currentItemPermMaskH==null)
	{
		if (itemTable==null) return true;
		var pmStr=GetAttributeFromItemTable(itemTable, "Perm", "PermMask");
		if(pmStr==null) return true;
		var currentItemAuthor=itemTable.getAttribute("Author");
		SetCurrentPermMaskFromString(pmStr, currentItemAuthor);
	}
	if(!currentItemCanModify
		&& (EqualRights(requiredH, requiredL, 0x0, 0x4)
		|| EqualRights(requiredH, requiredL, 0x0, 0x8)
		|| EqualRights(requiredH, requiredL, 0x40000000, 0x0)))
	{
		return false;
	}
	return (((requiredL & currentItemPermMaskL)==requiredL)
	&& ((requiredH & currentItemPermMaskH)==requiredH));
}
function EqualRights(rightsH1, rightsL1, rightsH2, rightsL2)
{
	return ((rightsH1==rightsH2) && (rightsL2==rightsL2));
}
function SetCurrentPermMaskFromString(pmStr, currentItemAuthor)
{
	var pmLen=pmStr.length;
	if(pmLen <=10 )
	{
		currentItemPermMaskH=0;
		currentItemPermMaskL=parseInt(pmStr);
	}
	else
	{
		currentItemPermMaskH=parseInt(pmStr.substring(2, pmLen - 8), 16);
		currentItemPermMaskL=parseInt(pmStr.substring(pmLen - 8, pmLen), 16);
	}
	currentItemCanModify=true;
	  currentItemCanModify=(currentItemAuthor==null)
							  || HasRights(0x0, 0x800)
							  || (ctx.CurrentUserId==currentItemAuthor)
							  || (ctx.CurrentUserId==null)
							  || (ctx.WriteSecurity==1);
}
function AddSharedNamespaceMenuItems(m, ctx)
{
	var RootFolder=GetRootFolder(ctx);
	setupMenuContext(ctx);
	if (currentItemFileUrl==null)
		currentItemFileUrl=GetAttributeFromItemTable(itemTable, "Url", "ServerUrl");
	if (currentItemFSObjType==null)
		currentItemFSObjType=GetAttributeFromItemTable(itemTable, "OType", "FSObjType");
	if (currentItemModerationStatus==null)
		currentItemModerationStatus=GetAttributeFromItemTable(itemTable, "MS", "MStatus");
	if (currentItemCheckedOutUserId==null)
		currentItemCheckedOutUserId=itemTable.getAttribute("COUId");
	if (currentItemCheckedoutToLocal==null)
		currentItemCheckedoutToLocal=GetAttributeFromItemTable(itemTable, "COut", "IsCheckedoutToLocal ");
	if (currentItemCheckedoutToLocal !=1)
		currentItemCheckedoutToLocal=0;
	bIsCheckout=0;
	if (ctx.isForceCheckout==true &&  currentItemCheckedOutUserId=="" &&
		currentItemFSObjType !=1)
	{
		bIsCheckout=1;
	}
	var currentItemEscapedFileUrl;
	if (currentItemFileUrl !=null)
		currentItemEscapedFileUrl=escapeProperly(
		unescapeProperly(currentItemFileUrl));
	var menuOption;
	if (ctx.listBaseType==1)
		strDisplayText=L_ViewProperties_Text;
	else if (ctx.listBaseType==4)
		strDisplayText=L_ViewResponse_Text;
	else
		strDisplayText=L_ViewItem_Text;
	strAction="STSNavigate('"+ctx.displayFormUrl+"?ID="+currentItemID+				"&Source="+GetSource()+RootFolder+"')";
	strImagePath="";
	menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 200);
	if (ctx.listBaseType==1)
		menuOption.id="ID_ViewProperties";
	else
		menuOption.id="ID_ViewItem";
	if (HasRights(0x0, 0x4) &&
	      !currentItemIsEventsDeletedExcp)
	{
		if (ctx.listBaseType==1)
			strDisplayText=L_EditProperties_Text;
		else if (ctx.listBaseType==4)
			strDisplayText=L_EditResponse_Text;
		else
			strDisplayText=L_EditItem_Text;
	   if (ctx.listBaseType==1)
	   {
		   strAction="STSNavigateWithCheckoutAlert('"+ctx.editFormUrl+"?ID="+currentItemID+					   "&Source="+GetSource()+RootFolder+"',"+bIsCheckout+",'"
+currentItemCheckedoutToLocal+"','"+STSScriptEncode(currentItemFileUrl)+"','"+ctx.HttpRoot+"')";
	   }
	   else
	   {
		   strAction="STSNavigate('"+ctx.editFormUrl+"?ID="+currentItemID+"&Source="+GetSource()+"')";
	   }
		strImagePath=ctx.imagesPath+"edititem.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 220);
		if (ctx.listBaseType==1)
			menuOption.id="ID_EditProperties";
		else
			menuOption.id="ID_EditItem";
		if (ctx.listTemplate==106 &&
			currentItemID.indexOf(".0.") > 0)
		{
			var SeriesIdEnd=currentItemID.indexOf(".0.");
			var itemSeriesID=currentItemID.substr(0, SeriesIdEnd);
			strDisplayText=L_EditSeriesItem_Text;
			strAction="STSNavigate('"+ctx.editFormUrl+"?ID="+itemSeriesID+"&Source="+					   GetSource()+"')";
			strImagePath=ctx.imagesPath+"recurrence.gif";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 230);
			menuOption.id="ID_EditSeriesItem";
		}
	}
	AddManagePermsMenuItem(m, ctx, ctx.listName, currentItemID);
}
function AddDocLibMenuItems(m, ctx)
{
	if (typeof(Custom_AddDocLibMenuItems) !="undefined")
	{
		if (Custom_AddDocLibMenuItems(m, ctx))
			return;
	}
	var RootFolder=GetRootFolder(ctx);
	var menuOption;
	AddSharedNamespaceMenuItems(m, ctx);
	var currentItemEscapedFileUrl;
	if (currentItemFileUrl !=null)
		currentItemEscapedFileUrl=escapeProperly(unescapeProperly(currentItemFileUrl));
	var serverFileRedirect=itemTable.getAttribute("SRed");
	if (HasRights(0x0, 0x4) && HasRights(0x10, 0x0)
		  && currentItemFSObjType !=1
		  && (serverFileRedirect==null || serverFileRedirect=="" || HasRights(0x0, 0x20))
		  )
	{
		if (ctx.isWebEditorPreview==0 && ctx.listBaseType==1)
		{
			if (ctx.listTemplate==109 && itemTable.getAttribute("IsImage")=="1")
			{
				strDisplayText=L_EditInOIS_Text;
				strAction="EditSingleImage('"+currentItemID+"')";
				strImagePath=ctx.imagesPath+"oisweb.gif";
				menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 240);
				menuOption.id="ID_EditInOIS";
			}
			else
			{
				setDocType();
				if (currentItemAppName !="" && currentItemOpenControl !="")
				{
		      strDisplayText="";	
		      if (currentItemAppName !=" ")
						strDisplayText=StBuildParam(L_EditIn_Text, currentItemAppName);
					else
			{			
			      var	objEditor=StsOpenEnsureEx(currentItemOpenControl+".3");
	        	      if (objEditor !=null )	
					strDisplayText=L_EditInApplication_Text;
						}
			if (strDisplayText !="")
			{
				strAction="editDocumentWithProgID2('"+currentItemFileUrl+"', '"+currentItemProgId+"', '"
+currentItemOpenControl+"', '"+bIsCheckout+"', '"+ctx.HttpRoot+"', '"+currentItemCheckedoutToLocal+"')";
	                    	strImagePath=ctx.imagesPath+currentItemIcon;
	                    	menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 240);
	                    	menuOption.id="ID_EditIn_"+currentItemAppName;
			}
				}
			}
		}
	}
	if (HasRights(0x0, 0x8))
	{
		strDisplayText=L_DeleteDocItem_Text;
		var isCopy="false";
		if (typeof(itemTable.getAttribute("CSrc")) !="undefined" &&
			itemTable.getAttribute("CSrc") !=null &&
			itemTable.getAttribute("CSrc") !="")
		{
			isCopy="true";
		}
		strAction="DeleteDocLibItem('"+				ctx.HttpPath+"&Cmd=Delete&List="+ctx.listName+				"&ID="+currentItemID+"&owsfileref="+				currentItemEscapedFileUrl+"&NextUsing="+GetSource()+"',"+				isCopy+")";
		strImagePath=ctx.imagesPath+"delitem.gif";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 310);
		menuOption.id="ID_DeleteDocItem";
	}
	AddGotoSourceItemMenuItem(m, ctx, itemTable, currentItemFSObjType);
	if (currentItemFSObjType !=1)
	{
		AddSendSubMenu(m,ctx);
		AddDocTransformSubMenu(m,ctx);
	}
	if (currentItemFSObjType !=1 &&
	   ctx.listTemplate==109 &&
	   typeof(DownloadOriginalImage)=="function")
	{
		strAction="DownloadOriginalImage("+currentItemID+")";
		strImagePath=ctx.imagesPath+"download.gif";
		strDisplayText=L_DownloadOriginal_Text;
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 550);
		menuOption.id="ID_DownloadOriginal";
	}
	if (HasRights(0x0, 0x4))
	{
		if ((ctx.isModerated==true) && (((currentItemModerationStatus==2) ||
				!ctx.EnableMinorVersions) && currentItemCheckedOutUserId=="" ||currentItemFSObjType==1))
		{
			strDisplayText=L_ModerateItem_Text;
			strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/approve.aspx?List="+ctx.listName
+"&ID="+currentItemID+"&Source="+GetSource()+GetRootFolder(ctx)+"')";
			strImagePath=ctx.imagesPath+"apprj.gif";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1150);
			menuOption.id="ID_ModerateItem";
		}
		if (currentItemFSObjType !=1)
		{
			if (ctx.listBaseType==1)
			{
				CAMSep(m);
				AddCheckinCheckoutMenuItem(m, ctx, currentItemEscapedFileUrl);
			}
		}
	}
	if (ctx.verEnabled==1 || ctx.isModerated)
		AddVersionsMenuItem(m, ctx, currentItemEscapedFileUrl);
	if (currentItemFSObjType !=1)
	{
		AddWorkflowsMenuItem(m, ctx);
		CAMSep(m);
		if (ctx.PortalUrl !=null)
		{
			strDisplayText=L_AddToMyLinks_Text;
			strAction="Portal_Tasks('PinToMyPage')"; ;
			strImagePath="";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1000);
			menuOption.id="ID_AddToMyLinks";
			CAMSep(m);
		}
	}
	else if (ctx.listBaseType==1
		  && HasRights(0x10, 0x0))
	{
		AddWorkOfflineMenuItem(m, ctx, currentItemFileUrl);
	}
	if (HasRights(0x80, 0x0))
	{
		strDisplayText=L_Subscribe_Text;
		strAction="NavigateToSubNewAspx('"+ctx.HttpRoot+"', 'List="+ctx.listName+"&ID="+currentItemID+"')";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1100);
		menuOption.id="ID_Subscribe";
	}
	if (currentItemFSObjType==1 &&
		ctx.ContentTypesEnabled &&
		ctx.listTemplate !=108)
	{
		strDisplayText=L_CustomizeNewButton_Text;
		strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/ChangeContentTypeOrder.aspx?List="+ctx.listName+"&RootFolder="+currentItemEscapedFileUrl+"&Source="+GetSource()+"')";
		strImagePath="";
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 1170);
		menuOption.id="ID_CustomizeNewButton";
	}
}
function AddManagePermsMenuItem(m, ctx, listId, url)
{
	if(!HasRights(0x40000000, 0x0) || currentItemIsEventsExcp)
		return;
	strDisplayText=L_MngPerms_Text;
	strAction="NavigateToManagePermsPage('"+ctx.HttpRoot+"', '"+listId+"','"+url+"')";
	strImagePath=ctx.imagesPath+"manageperm.gif";
	var menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 250);
	menuOption.id="ID_MngPerms";
}
function AddGotoSourceItemMenuItem(m, ctx, itemTable, objtype)
{
	if (objtype !=1 &&
		typeof(itemTable.getAttribute("CSrc")) !="undefined" &&
		itemTable.getAttribute("CSrc") !=null &&
		itemTable.getAttribute("CSrc") !="")
	{
		strDisplayText=L_GoToSourceItem_Text;
		strAction="NavigateToSourceItem('"+itemTable.getAttribute("CSrc")+"')";
		strImagePath=ctx.imagesPath+"goToOriginal.gif";
		var menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 340);
		menuOption.id="ID_GoToSourceItem";
	}
}
function AddCheckinCheckoutMenuItem(m, ctx, url)
{
	var menuOption;
	if(!HasRights(0x0, 0x4))
		return;
	if (currentItemCheckedOutUserId==null)
		currentItemCheckedOutUserId=itemTable.getAttribute("COUId");
	if (currentItemCheckedOutUserId !="")
	{
		if(currentItemCheckedOutUserId==ctx.CurrentUserId
	     || ctx.CurrentUserId==null
			|| HasRights(0x0, 0x100))
		{
			strDisplayText=L_Checkin_Text;
			strAction="NavigateToCheckinAspx('"+ctx.HttpRoot+"', 'List="+ctx.listName+"&FileName="+url+"')";
			strImagePath=ctx.imagesPath+"checkin.gif";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 700);
			menuOption.id="ID_Checkin";
			strDisplayText=L_DiscardCheckou_Text;
			strAction="UnDoCheckOut('"+ctx.HttpRoot+"', '"+url+"')";
			strImagePath=ctx.imagesPath+"unchkout.gif";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 710);
			menuOption.id="ID_DiscardCheckou";
		}
	}
	else
	{
		strDisplayText=L_Checkout_Text;
		if (currentItemOpenControl=="")
			setDocType();
		var opencontrol="";
		if (ctx.listTemplate !=109)
			opencontrol=currentItemOpenControl+".3";
		var serverFileRedirect=itemTable.getAttribute("SRed");
		if(serverFileRedirect==null || serverFileRedirect=="" || HasRights(0x0, 0x20))
		{
			strAction="CheckoutDocument('"+ctx.HttpRoot+"', '"+url+"', '"+opencontrol+"')";
			strImagePath=ctx.imagesPath+"checkout.gif";
			menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 700);
			menuOption.id="ID_Checkout";
		}
		if (currentItemModerationStatus==null)
			currentItemModerationStatus=GetAttributeFromItemTable(itemTable, "MS", "MStatus");
		if (ctx.EnableMinorVersions)
		{
			if (currentItemUIString==null)
				currentItemUIString=GetAttributeFromItemTable(itemTable, "UIS", "UIString");
			var minorversion=currentItemUIString%512;
			if ((((currentItemModerationStatus==1) ||
				(currentItemModerationStatus==3)) &&
				ctx.isModerated) ||
				(!ctx.isModerated  && minorversion !=0))
			{
				strDisplayText=L_PublishItem_Text;
				strAction="NavigateToCheckinAspx('"+ctx.HttpRoot+"', 'List="+ctx.listName+"&FileName="+url+"&Publish=true')";
				strImagePath=ctx.imagesPath+"pubmajor.gif";
				menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 720);
				menuOption.id="ID_PublishItem";
			}
			else
			{
				var strMenuOptionId;
				var  bCancelApproval=false;
				if ((!ctx.isModerated) || (currentItemModerationStatus==0))
				{
					strDisplayText=L_UnPublishItem_Text;
					strMenuOptionId="ID_UnPublishItem";
					strImagePath=ctx.imagesPath+"unpub.gif";
				}
				else
				{
					strDisplayText=L_CancelPublish_Text;
					strMenuOptionId="ID_CancelPublish";
					strImagePath=ctx.imagesPath+"unapprv.gif";
					bCancelApproval=true;
				}
				strAction="UnPublish('"+ctx.HttpRoot+"', 'FileName="+url+"&UnPublish=true',"+bCancelApproval+")";	
				menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 730);
				menuOption.id=strMenuOptionId;
			}
		}
	}
}
function AddWorkflowsMenuItem(m, ctx)
{
	if (ctx.WorkflowsAssociated && HasRights(0x0, 0x4))
	{
		var strCTID=GetAttributeFromItemTable(itemTable, "CId", "ContentTypeId");
		if (strCTID==null || strCTID.substr(0,8) !="0x010801")
		{
			var strImagePath=ctx.imagesPath+"workflows.gif";
			var itemID;
			var SeriesIdEnd=currentItemID.indexOf(".0.");
			if (SeriesIdEnd > 0)
				itemID=currentItemID.substr(0, SeriesIdEnd);
			else
				itemID=currentItemID;
			var strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/Workflow.aspx?ID="+itemID+"&List="+ctx.listName+"&Source="+GetSource()+"')";
			var menuOption=CAMOpt(m, L_Workflows_Text, strAction, strImagePath, null, 900);
			menuOption.id="ID_Workflows";
		}
	}
}
function AddWorkspaceMenuItem(m, ctx)
{
	var menuOption;
	var strSourceUrl=GetAttributeFromItemTable(itemTable, "SUrl", "SourceUrl");
	if ( strSourceUrl !=null && strSourceUrl !="" && strSourceUrl !="%20")
	{
		if (HasRights(0x0, 0x21000))
		{
			strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/publishback.aspx?list="+ctx.listName+"&item="+currentItemID+GetRootFolder(ctx)+"')";
			menuOption=CAMOpt(m, L_PublishBack_Text, strAction, "", null, 1140);
			menuOption.id="ID_PublishBack";
		}
	}
	else
	{
		if (HasRights(0x0, 0x800000) && HasRights(0x0, 0x21000) && HasRights(0x0, 0x4000000))
		{
			strAction="STSNavigate('"+ctx.HttpRoot+"/_layouts/createws.aspx?list="+ctx.listName+"&item="+currentItemID+GetRootFolder(ctx)+"')";
			menuOption=CAMOpt(m, L_CreateDWS_Text, strAction, "", null, 1140);
			menuOption.id="ID_CreateDWS";
		}
	}
}
function AddVersionsMenuItem(m, ctx, url)
{
	if (currentItemID !=null)
	{
	   var strCurrentItemID=currentItemID.toString();
	   if (strCurrentItemID.indexOf(".0.") >=0 )
	   return;
	}
	if (!HasRights(0x0, 0x40))
	  return;
	strDisplayText=L_Versions_Text;
	strAction="NavigateToVersionsAspx('"+ctx.HttpRoot+"', 'list="+ctx.listName+"&ID="+currentItemID+"&FileName="+url+"')";
	strImagePath=ctx.imagesPath+"versions.gif";
	var menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath, null, 800);
	menuOption.id="ID_Versions";
}
function AddWorkOfflineMenuItem(m, ctx, url)
{
	strDisplayText=GetStssyncAppNameForType("documents",L_WorkOffline_Text,strImagePath);
	if (strDisplayText)
	{
		strAction="javascript:ExportHailStorm('documents','"+ctx.HttpRoot+"','"+			ctx.listName+"','"+STSScriptEncode(ctx.SiteTitle)+			"','"+ctx.ListTitle+"','"+			STSScriptEncode(ctx.listUrlDir)+"','','"+STSScriptEncode(unescapeProperly(ctx.listUrlDir))+"'";
		strAction+=",'"+STSScriptEncode(unescapeProperly(url))+"','"+currentItemID+"')";
		strImagePath=GetStssyncIconPath(ctx.imagesPath+"tbsprsht.gif", ctx.imagesPath);
		menuOption=CAMOpt(m, strDisplayText, strAction, strImagePath);
		menuOption.id="ID_WorkOffline";
	}
}
function AddVersionMenuItems(m, ctx)
{
	if (typeof(AddVersionMenuItemsCore)=="function")
	{
		AddVersionMenuItemsCore(m, ctx);
	}
}
function NavigateToSubNewAspx(strHttpRoot, strArgs)
{
	STSNavigate(strHttpRoot+"/_layouts/SubNew.aspx?"+strArgs+"&Source="+GetSource());
}
function NavigateToVersionsAspx(strHttpRoot, strArgs)
{
	STSNavigate(strHttpRoot+"/_layouts/Versions.aspx?"+strArgs+"&Source="+GetSource());
}
var L_UndoCheckoutWarning_Text="If you discard your check out, you will lose all changes made to the document.  Are you sure you want to discard your check out?";
var L_UnPublishWarning_Text=" Are you sure you want to unpublish this version of the document?";
var L_CancleApproval_TEXT=" Are you sure that you want to cancel the approval of this document?";
function UnDoCheckOut(strHttpRoot, strUrl)
{
	try
	{
		var stsOpen=null;
		var strextension=SzExtension(unescapeProperly(strUrl));
   	 if (FSupportCheckoutToLocal(strextension) )
	 	stsOpen=StsOpenEnsureEx("SharePoint.OpenDocuments.3");
		if (stsOpen !=null)
		{
			var strDocument=currentItemFileUrl;
			if (strDocument.charAt(0)=="/" || strDocument.substr(0,3).toLowerCase()=="%2f")
				 strDocument=document.location.protocol+"//"+document.location.host+strDocument;
			stsOpen.DiscardLocalCheckout(strDocument);
			SetWindowRefreshOnFocus();
			return;
		 }
	else
	{
		if (!confirm(L_UndoCheckoutWarning_Text))
			{
			return;
			}
	}
	}
	catch (e)
	{
	}
	NavigateToCheckinAspx(strHttpRoot, "FileName="+strUrl+"&DiscardCheckout=true");
}
function UnPublish(strHttpRoot, strArgs, bCancelApproval)
{
	var strAlert=L_UnPublishWarning_Text;
	if (bCancelApproval)
	strAlert=L_CancleApproval_TEXT;	
	if (!confirm(strAlert))
		return;
   NavigateToCheckinAspx(strHttpRoot, strArgs)
}
function NavigateToCheckinAspx(strHttpRoot, strArgs)
{
	SubmitFormPost(strHttpRoot+"/_layouts"+		"/Checkin.aspx?"+strArgs+"&Source="+GetSource());
}
function NavigateToManagePermsPage(strHttpRoot, strListId, strFileRef)
{
	var strObjType=",LISTITEM";
	STSNavigate(strHttpRoot+		"/_layouts/User.aspx?obj="+strListId+","+strFileRef+strObjType+		"&List="+strListId+		"&Source="+GetSource());
}
function NavigateToSourceItem(url)
{
	var match=url.match(/[^\/]*\/\/[^\/]*/g);
	var serverUrl=match[0];
	url=escapeProperly(url);
	STSNavigate(serverUrl+"/_layouts/copyutil.aspx?GoToDispForm=1&Use=url&ItemUrl="+url);
}
function setDocType()
{
	var strArray;
	strArray=GetAttributeFromItemTable(itemTable, "Icon", "DocIcon").split("|");
	currentItemIcon=strArray[0];
	currentItemAppName=strArray[1];
	currentItemOpenControl=strArray[2];
	currentItemProgId=GetAttributeFromItemTable(itemTable, "Type", "HTMLType");
}
function DeleteListItem()
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	var ciid=currentItemID;
	if (confirm(ctx.RecycleBinEnabled ? L_STSRecycleConfirm_Text : L_STSDelConfirm_Text))
	{
		SubmitFormPost(ctx.HttpPath+"&Cmd=Delete&List="+ctx.listName+					"&ID="+ciid+"&NextUsing="+GetSource());
	}
}
function DeleteDocLibItem(delUrl, isCopy)
{
	if (! IsContextSet())
		return;
	var strConfirm=(currentItemFSObjType==1)  ?
		(ctx.RecycleBinEnabled ? L_STSRecycleConfirm1_Text : L_STSDelConfirm1_Text) :
		(ctx.RecycleBinEnabled ? L_STSRecycleConfirm_Text : L_STSDelConfirm_Text);
	if (isCopy && currentItemFSObjType !=1)
		strConfirm=L_NotifyThisIsCopy_Text+strConfirm;
	if (confirm(strConfirm))
		SubmitFormPost(delUrl);
}
function EditMenuDefaultForOnclick()
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	if (ctx.isVersions)
	{
		STSNavigate(itemTable.getAttribute("verUrl"));
	}
	else if (ctx.listTemplate==200)
	{
		var currentInstanceID=currentItemID;
		MtgNavigate(currentInstanceID);
	}
	else
	{
		EditListItem();
	}
}
function EditListItem()
{
	if (event.srcElement.tagName=="A" ||
		event.srcElement.parentNode.tagName=="A")
		return;
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	var editFormUrl=ctx.editFormUrl+"?ID="+currentItemID+					   "&Source="+GetSource()
	if (ctx.listBaseType==1)
		editFormUrl=editFormUrl+GetRootFolder(ctx)
	STSNavigate(editFormUrl);
}
function DoNavigateToTemplateGallery(strSaveLocUrl, strTGUrl)
{
	document.cookie="MSOffice_AWS_DefSaveLoc="+strSaveLocUrl;
	STSNavigate(strTGUrl);
}
function Portal_Tasks(cmd)
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	var fileRef=unescapeProperly(currentItemFileUrl);
	var idx1=0, idx2=0;
	idx1=fileRef.lastIndexOf("/")
	idx2=fileRef.lastIndexOf(".")
	if (idx1 < 0 || idx2 < 0 || idx1 > idx2)
		return;
	var fileName=fileRef.substr(idx1+1, idx2-idx1-1);
	var serverUrl="";
	idx1=ctx.HttpRoot.indexOf("://");
	if (idx1 > 0)
	{
		idx2=ctx.HttpRoot.indexOf("/", idx1+3);
		if (idx2 > 0)
			serverUrl=ctx.HttpRoot.substring(0, idx2);
		else
			serverUrl=ctx.HttpRoot;
	}
	var currentItemFileFullUrl="";
	if (currentItemFileUrl.charAt(0)=="/"
		|| currentItemFileUrl.substr(0,3).toLowerCase()=="%2f")
	{
		currentItemFileFullUrl=serverUrl+currentItemFileUrl;
	}
	else
	{
		currentItemFileFullUrl=currentItemFileUrl;
	}
	var strParams="";
	if (false==setElementValue("ListViewURL", currentItemFileFullUrl))
	{
		strParams=strParams+"&ListViewURL="+escapeProperly(currentItemFileFullUrl);
	}
	if (false==setElementValue("ListTitle", fileName))
	{
		strParams=strParams+"&ListTitle="+escapeProperly(fileName);
	}
	if (false==setElementValue("ListDescription", ""))
	{
		strParams=strParams+"&ListDescription=";
	}
	if (false==setElementValue("ReturnUrl", window.location.href))
	{
		strParams=strParams+"&ReturnUrl="+escapeProperly(window.location.href);
	}
	if (ctx.PortalUrl.substr(0, 4) !="http")
	{
		ctx.PortalUrl=serverUrl+ctx.PortalUrl;
	}
	var url=ctx.PortalUrl+"_vti_bin/portalapi.aspx?cmd="+cmd;
	url=url+"&IconUrl="+ctx.imagesPath+currentItemIcon+strParams;
	SubmitFormPost(url);
}
function IsContextSet()
{
	if (currentCtx==null)
		return false;
	else if (currentCtx.isExplictLogin)
		return true;
	else if (currentCtx.HttpPath==null || currentItemID==null)
		return false;
	return true;
}
function ChangeContentType(id)
{
	var obj=document.getElementById(id);
	var strUrl=window.location.href;
	var idxQuery=strUrl.indexOf("?");
	if (strUrl.indexOf("?") <=0)
	{
		strUrl=strUrl+"?ContentTypeId="+obj.value;
	}
	else if (strUrl.indexOf("&ContentTypeId=") <=0)
	{
		strUrl=strUrl+"&ContentTypeId="+obj.value;
	}
	else
	{
		var pattern=/&ContentTypeId=[^&]*/i;
		strUrl=strUrl.replace(pattern,"&ContentTypeId="+obj.value);
	}
	STSNavigate(strUrl);
}
function TopHelpButtonClick(strParam)
{
	if(typeof(navBarHelpOverrideKey) !="undefined")
	   return HelpWindowKey(navBarHelpOverrideKey);
	if (strParam !=null)
		HelpWindowKey(strParam);
	else
		HelpWindowKey('NavBarHelpHome');
}
function HelpWindowHelper(strParam)
{
	var strHelpUrl;
	if (typeof(strParam)=="undefined")
		{strHelpUrl="/_layouts/help.aspx?Lcid="+L_Language_Text;}
	else
		{strHelpUrl="/_layouts/help.aspx?Lcid="+L_Language_Text+strParam;}
	var wndHelp=window.open(strHelpUrl, "STSHELP",
		"height=500,location=no,menubar=no,resizable=yes,scrollbars=yes,status=no,toolbar=no,width=475"
		);
	wndHelp.focus();
}
function HelpWindowKey(strKey)
{
	HelpWindowHelper("&Key="+strKey);
}
function HelpWindowUrl(strUrl)
{
	HelpWindowHelper("&Url="+strUrl);
}
function HelpWindow()
{
	HelpWindowKey("helphome");
}
function HelpBack()
{
	history.back();
}
function HelpForward()
{
	history.forward();
}
function HelpPrint()
{
	window.print();
}
function HelpSearch(strStringToSearchFor)
{
	var nMaxLengthSearchString=256;
	var strLocationHref="";
	if (typeof(glob_strLocaleNumId)=="undefined")
	{
		return true;
	}
	if (typeof(glob_strCollectionIds)=="undefined")
	{
		return true;
	}
	if (glob_strCollectionIds.length <=0)
	{
		return true;
	}
	if (typeof(strStringToSearchFor)=="undefined")
	{
		return true;
	}
	if (strStringToSearchFor.length <=0)
	{
		return true;
	}
	strStringToSearchFor=TrimWhiteSpaces(strStringToSearchFor);
	if (strStringToSearchFor.length==0)
	{
		return true;
	}
	strStringToSearchFor=strStringToSearchFor.substr(0,nMaxLengthSearchString);
	strStringToSearchFor=encodeURIComponent(strStringToSearchFor);
	strLocationHref="/_layouts/HelpSearch.aspx?lcid="
+escapeProperlyCore(glob_strLocaleNumId, true);
	for (var i=0; i < glob_strCollectionIds.length ;i++)
		{
		strLocationHref=strLocationHref
+"&cid"
+i
+"="
+escapeProperlyCore(glob_strCollectionIds[i], true);
		}
	strLocationHref=strLocationHref
+"&sq="
+strStringToSearchFor
		;
	window.location.href=strLocationHref;
}
var L_EmptySlideShow_Text="No pictures found in the library. Add pictures and try again.";
var L_NotOurView_Text="This operation cannot be completed within current view. Please select another view and try again.";
function IsImgLibJssLoaded()
{
	if (typeof(fImglibJssLoaded) !="undefined")
		return fImglibJssLoaded;
	return false;
}
function EditSelectedImages()
{
	if (!IsImgLibJssLoaded())
	{
		alert(L_NotOurView_Text);
		return;
	}
	_EditSelectedImages();
}
function DeleteImages()
{
	if (!IsImgLibJssLoaded())
	{
		alert(L_NotOurView_Text);
		return;
	}
	_DeleteImages();
}
function SendImages()
{
	if (!IsImgLibJssLoaded())
	{
		alert(L_NotOurView_Text);
		return;
	}
	_SendImages();
}
function DownloadImages()
{
	if (!IsImgLibJssLoaded())
	{
		alert(L_NotOurView_Text);
		return;
	}
	_DownloadImages();
}
function MtgToggleTimeZone()
{
	var timezoneElem=document.getElementById("TimeZoneSection");
	var timezoneLinkElem=document.getElementById("TimeZoneLink");
	var L_ShowTZ_Text="Show time zone";
	var L_HideTZ_Text="Hide time zone";
	if ( timezoneElem.style.display=="none" )
	{
		timezoneElem.style.display="";
		timezoneLinkElem.innerHTML="&lt;&lt;"
		timezoneLinkElem.title=L_HideTZ_Text;
		SetCookie("MtgTimeZone", "1", "");	
	}
	else
	{
		timezoneElem.style.display="none";
		timezoneLinkElem.innerHTML="&gt;&gt;"
		timezoneLinkElem.title=L_ShowTZ_Text;
		SetCookie("MtgTimeZone", "0", "");		
	}
}
function GetPageUrl(fHomePage)
{
	return unescapeProperly(fHomePage ? g_webUrl : g_pageUrl);
}
function MtgNavigate(instanceId)
{
	if (instanceId==g_instanceId)
		return;
	var fHomePage=!g_fPageGlobal;
	window.location.href=GetPageUrl(fHomePage)+'?InstanceID='+instanceId+'&'+g_thispagedata;
}
function GoToMtgMove(listUrlDir, instanceId, instanceDateTime, instanceDateTimeISO)
{
	window.location.href=listUrlDir+'/movetodt.aspx'
+'?FromInstanceID='+instanceId
+'&FromInstanceDate='+escapeProperly(instanceDateTime)
+'&FromInstanceDateISO='+escapeProperly(instanceDateTimeISO)
+'&Source='+escapeProperly(window.location.href);
}
function MtgKeep(httpPath, listId, instanceId)
{
	var L_MtgKeepConfirm_Text="The information for this meeting date does not match the information in your calendar and scheduling program. If you keep this meeting date, it will continue to appear in the Meeting Series list in the workspace.";
	if (confirm(L_MtgKeepConfirm_Text))
		SubmitFormPost( httpPath
+'&Cmd=MtgKeep&List='+escapeProperly(listId)
+'&EditInstanceID='+instanceId
+'&NextUsing='+escapeProperly(window.location.href) );
}
function MtgDelete(httpPath, listId, instanceId)
{
	var L_MtgDeleteConfirm_Text="This meeting date and the content associated with it will be deleted from the workspace.";
	if (confirm(L_MtgDeleteConfirm_Text))
	{
		var fHomePage=(instanceId==g_instanceId);
		SubmitFormPost( httpPath
+'&Cmd=MtgMove&List='+escapeProperly(listId)
+'&FromInstanceID='+instanceId+'&ToInstanceID=-3'
+'&NextUsing='+escapeProperly(fHomePage ? GetPageUrl(true) : window.location.href) );
	}
}
function SetCookie(name, value, path)
{
	document.cookie=name+"="+value+";path="+path;
}
function SetAsLastTabVisited()
{
	if (typeof(g_pageUrl) !="undefined" && typeof(g_webUrl) !="undefined")
		SetCookie("MtgLastTabVisited",
			escapeProperly(unescapeProperly(g_pageUrl)),
			escapeProperlyCore(unescapeProperly(g_webUrl),  true));
}
function MtgDeletePageConfirm()
{
	var L_DeleteGlobalConfirm_Text="This page will be deleted from all meetings associated with this workspace.  ";
	var L_DeleteConfirm_Text="Are you sure you want to delete this page?";
	var text;
	if (document.getElementById("MtgTlPart_PageType").value=='MtgTlPart_LocalPage')
		text=L_DeleteConfirm_Text;
	else
		text=L_DeleteGlobalConfirm_Text+L_DeleteConfirm_Text;
	return confirm(text);
}
function MtgRedirect()
{
	var strServerRelative=GetCookie("MtgLastTabVisited");
	if (strServerRelative==null)
	{
		if (typeof(g_webUrl) !="undefined")
			strServerRelative=g_webUrl;
		else
			strServerRelative="../../";
	}
	else
		strServerRelative=escapeProperlyCore(strServerRelative, true);
	window.location.href=strServerRelative;
}
function MakeMtgInstanceUrl(strUrl, instanceID)
{
	if (instanceID !="undefined" && instanceID !='')
	{
		var iQueryString=strUrl.indexOf('?');
		if (iQueryString==-1 || strUrl.indexOf('InstanceID=', iQueryString)==-1)
			strUrl=strUrl+(iQueryString==-1 ? '?' : '&')+'InstanceID='+instanceID;
	}
	return strUrl;
}
function commonShowModalDialog(url, features, callback, args)
{
	if (document.getElementById("__spPickerHasReturnValue") !=null)
		document.getElementById("__spPickerHasReturnValue").value="";
	if (document.getElementById("__spPickerReturnValueHolder") !=null)
		document.getElementById("__spPickerReturnValueHolder").value="";
	commonModalDialogReturnValue.clear();
	var rv;
	if (window.showModalDialog)
	{
		rv=window.showModalDialog(url, args, features);
		onDialogClose(callback, null, rv);
	}
	else
	{
		var defaultWidth=500, defaultHeight=550, defaultScrollbars="yes";
		if(!features) features="width="+defaultWidth+",height="+defaultHeight;
		else
		{
			function assocArray() { return new Array(); }
			function assocArray_add(array, key, value)
			{
				array.push(key);
				array[key]=value;
			}
			function assocArray_keys(array)
			{
				var keys=new Array();
				for(var i=0; i<array.length; i++) keys.push(array[i]);
				return keys;
			}
			var feats=assocArray(), fre, split;
			if(features.search(/^(\s*\w+\s*:\s*.+?\s*)(;\s*\s*\w+\s*:\s*.+?\s*)*(;\s*)?$/) !=-1)
			{
				fre=/^\s*(\w+)\s*:\s*(.+?)\s*$/;
				split=features.split(/\s*;\s*/);
			}
			else
			{
				fre=/^\s*(\w+)\s*=\s*(.+?)\s*$/;
				split=features.split(/\s*,\s*/);
			}
			for(var feat in split)
			{
				var kv=fre.exec(split[feat]);
				if(kv && kv.length==3) assocArray_add(feats, kv[1].toLowerCase(), kv[2]);
			}
			if(!feats["width"]) assocArray_add(feats, "width", feats["dialogwidth"] || defaultWidth);
			if(!feats["height"]) assocArray_add(feats, "height", feats["dialogheight"] || defaultHeight);
			if(!feats["scrollbars"]) assocArray_add(feats, "scrollbars", feats["scroll"] || defaultScrollbars);
			features='';
			var keys=assocArray_keys(feats);
			for(var i in keys)
			{
				if(features) features+=",";
				features+=keys[i]+"="+feats[keys[i]];
			}
		}
		var modalDialog=window.open(url, '_blank', features+',modal=yes,dialog=yes');
		modalDialog.dialogArguments=args;
		window.onfocus=function() {
			var bHasReturnValue
=((document.getElementById("__spPickerHasReturnValue") !=null) &&
					 (document.getElementById("__spPickerHasReturnValue").value=="1"))
				  || commonModalDialogReturnValue.isSet();
			if (modalDialog && !modalDialog.closed && !bHasReturnValue)
			{
				modalDialog.focus();
			}
			else
			{
				window.onfocus=null;
				onDialogClose(callback, modalDialog, null);
			}
		}
	}
}
function onDialogClose(callback, modalDialog, rv)
{
	if(callback)
	{
		if(typeof(rv) !="undefined"
		   && rv !=null)
		{
			callback(rv);
		}
		else if (typeof(modalDialog) !="undefined"
		   && modalDialog !=null
		   && typeof(modalDialog.returnValue) !="undefined")
		{
			rv=modalDialog.returnValue;
			callback(rv);
		}
		else if (typeof(commonModalDialogReturnValue) !="undefined"
				 && commonModalDialogReturnValue !=null
				 && commonModalDialogReturnValue.isSet())
		{
			rv=commonModalDialogReturnValue.get();
			callback(rv);
			commonModalDialogReturnValue.clear();
		}
		else if (document.getElementById("__spPickerHasReturnValue") !=null &&
			document.getElementById("__spPickerHasReturnValue").value=="1" &&
			document.getElementById("__spPickerReturnValueHolder") !=null)
		{
			rv=document.getElementById("__spPickerReturnValueHolder").value;
			callback(rv);
		}
	}
}
function setModalDialogReturnValue(wnd, returnValue)
{
	if (wnd.opener !=null &&
		typeof(returnValue)=='string' &&
		wnd.opener.document.getElementById('__spPickerHasReturnValue') !=null &&
		wnd.opener.document.getElementById('__spPickerReturnValueHolder') !=null)
	{
		wnd.opener.document.getElementById('__spPickerHasReturnValue').value='1';
		wnd.opener.document.getElementById('__spPickerReturnValueHolder').value=returnValue;
	}
	else
	{
	   setModalDialogObjectReturnValue(wnd, returnValue);
	}
}
function setModalDialogObjectReturnValue(wnd, returnValue)
{
	if (wnd.showModalDialog)
	{
		wnd.returnValue=returnValue;
	}
	if(wnd.opener !=null)
	{
		wnd.opener.commonModalDialogReturnValue.set(returnValue);
	}
}
commonModalDialogReturnValue={
	 hasRetval: false,
	 retVal: null,
	 set: function (obj) {
			if(typeof(obj) !="undefined")
			{
				this.retVal=obj;
				this.hasRetval=true;
			}
		},
	 isSet: function() { return this.hasRetval;},
	 get: function() { if(this.hasRetval) return this.retVal; },
	 clear: function() { this.hasRetval=false; this.retVal=null; }
}
var filterTable=null;
var bIsFilterMenuShown=false;
var bIsFilterDataLoaded=false;
var filterImageCell=null;
var currentFilterMenu=null;
var loadingFilterMenu=null;
var ctxFilter=null;
var bIsFilterKeyPress=false;
var filterStr=null;
var strFieldName="";
var bMenuLoadInProgress=false;
var strFilteredValue=null;
var L_NotSortable_Text="This column type cannot be sorted";
var L_NotFilterable_Text="This column type cannot be filtered";
var L_AOnTop_Text="A on Top";
var L_ZOnTop_Text="Z on Top";
var L_SmallestOnTop_Text="Smallest on Top";
var L_LargestOnTop_Text="Largest on Top";
var L_OldestOnTop_Text="Oldest on Top";
var L_NewestOnTop_Text="Newest on Top";
var L_AttachmentsOnTop_Text="Attachments on Top";
var L_BlanksOnTop_Text="Blanks on Top";
var L_Ascending_Text="Ascending";
var L_Descending_Text="Descending";
var L_DontFilterBy_Text="Clear Filter from ^1";
var L_Loading_Text="Loading....";
var L_FilterMode_Text="Show Filter Choices";
var L_OpenMenu_Text="Open Menu";
function resetFilterMenuState()
{
	if (bMenuLoadInProgress)
		return;
	bIsFilterMenuShown=false;
	bIsFilterDataLoaded=false;
	filterTable=null;
	filterImageCell=null;
	currentFilterMenu=null;
	loadingFilterMenu=null;
	ctxFilter=null;
	bIsFilterKeyPress=false;
}
function setupFilterMenuContext(ctx)
{
	ctxFilter=ctx;
}
function IsFilterMenuOn()
{
	if (!bIsFilterMenuShown)
		return false;
	var bIsOpen=false;
	bIsOpen=MenuHtc_isOpen(currentFilterMenu) || MenuHtc_isOpen(loadingFilterMenu);
	if (!bIsOpen)
		bIsFilterMenuShown=false;
	return bIsOpen;
}
function IsFilterMenuEnabled()
{
	return true;
}
function OnMouseOverFilterDeferCall(elm)
{
	if (!IsFilterMenuEnabled())
		return false;
	if (IsFilterMenuOn())
		return false;
	if (window.location.href.search("[?&]Filter=1") !=-1)
		return false;
	if (elm.FilterDisable=="TRUE")
		return false;
	if (filterTable !=null)
		OnMouseOutFilter();
	filterTable=elm;
	var createCtx=new Function("setupFilterMenuContext(ctx"+filterTable.getAttribute('CtxNum')+");");
	createCtx();
	filterTable.className="ms-selectedtitle";
	filterTable.onclick=CreateFilterMenu;
	filterTable.oncontextmenu=CreateFilterMenu;
	filterTable.onmouseout=OnMouseOutFilter;
	var titleRow=filterTable.childNodes[0].childNodes[0];
	filterImageCell=titleRow.childNodes[titleRow.childNodes.length - 1];
	var filterArrow=filterImageCell.childNodes[0];
	filterArrow.src=ctxFilter.imagesPath+"menudark.gif";
	filterArrow.alt=L_OpenMenu_Text;
	filterArrow.style.visibility="visible";
	if (IsElementRtl(filterTable))
	{
		filterImageCell.style.right=null;
		filterImageCell.style.left="1px";
	}
	else
	{
		filterImageCell.style.left=null;
		filterImageCell.style.right="1px";
	}
	filterImageCell.className="ms-menuimagecell";
	return true;
}
function OnMouseOutFilter()
{
	if (!IsFilterMenuOn() && filterTable !=null)
	{
		filterTable.className="ms-unselectedtitle";
		filterTable.onclick="";
		filterTable.oncontextmenu="";
		filterTable.onmouseout="";
		if (filterImageCell !=null)
		{
			filterImageCell.childNodes[0].style.visibility="hidden";
			filterImageCell.className="";
		}
		resetFilterMenuState();
	}
}
function OnFocusFilter(elm)
{
	if (window.location.href.search("[?&]Filter=1") !=-1)
		return false;
	if (!IsFilterMenuEnabled())
		return false;
	elm.onblur=OnMouseOutFilter;
	elm.onkeydown=PopFilterMenu;
	var elmTmp=FindSTSMenuTable(elm, "CTXNum");
	if (elmTmp==null)
		return false;
	OnMouseOverFilter(elmTmp);
	return false;
}
function PopFilterMenu(e)
{
	if (!IsFilterMenuEnabled())
		return true;
	if (e==null)
		e=window.event;
	var nKeyCode;
	if (browseris.nav6up)
		nKeyCode=e.which;
	else
		nKeyCode=e.keyCode;
	if (!IsFilterMenuOn() && ((e.shiftKey && nKeyCode==13) || (e.altKey && nKeyCode==40)))
	{
		CreateFilterMenu(e);
		return false;
	}
	else
		return true;
}
function CreateFilterMenu(e)
{
	if (filterTable==null || filterImageCell==null)
		return true;
	if (e==null)
		e=window.event;
	bIsFilterMenuShown=true;
	window.document.body.onclick="";
	currentFilterMenu=CMenu("filter_menu");
	loadingFilterMenu=CMenu("filter_menu_loading");
	currentFilterMenu.setAttribute("CompactMode", "true");
	addSortMenuItems(currentFilterMenu, loadingFilterMenu);
	if (filterStr==null)
		addFilterMenuItems(currentFilterMenu, loadingFilterMenu);
	else
		addAdHocFilterMenuItems(currentFilterMenu, loadingFilterMenu);
	e.cancelBubble=true;
	return false;
}
function GetUrlWithNoSortParameters(strSortFields)
{
	var url=window.location.href;
	var strT;
	var ichStart=0;
	var ichEqual;
	var ichAmp;
	do
	{
		ichEqual=strSortFields.indexOf("=", ichStart);
		if (ichEqual==-1)
			return url;
		strT=strSortFields.substring(ichStart, ichEqual);
		if (strT !="");
			url=RemoveQueryParameterFromUrl(url, strT);
		ichAmp=strSortFields.indexOf("&", ichEqual+1);
		if (ichAmp==-1)
			return url;
		ichStart=ichAmp+1;
	} while (strT !="");
	return url;
}
function addSortMenuItems(menu, menuLoading)
{
	if (filterTable.getAttribute('Sortable')=="FALSE" || filterTable.getAttribute('SortDisable')=="TRUE" ||
		filterTable.getAttribute('FieldType')=="MultiChoice")
	{
		CAMOptFilter(menu, menuLoading, L_NotSortable_Text, "", "", false, "fmi_ns");
		CAMSep(menu);
		CAMSep(menuLoading);
		return;
	}
	var strSortAsc="";
	var strSortDesc="";
	var strFieldType="";
	var strImageAZ="/_layouts/"+L_Language_Text+"/images/SORTAZLang.gif";
	var strImageZA="/_layouts/"+L_Language_Text+"/images/SORTZALang.gif";
	if (filterStr==null)
	{
		var str=filterTable.getAttribute('SortFields');
		var ichSort=str.indexOf("&SortDir");
		if (ichSort==-1)
		{
			CAMOptFilter(menu, menuLoading, L_NotSortable_Text, "", "", false, "fmi_ns");
			CAMSep(menu);
			CAMSep(menuLoading);
			return;
		}
		var ichSortMac=str.indexOf("&", ichSort+1);
		var url=GetUrlWithNoSortParameters(str);
		url=RemovePagingArgs(url);
		if (url.indexOf("?") < 0)
			url+="?";
		else
			url+="&";
		strSortAsc="SubmitFormPost('"+STSScriptEncode(url)+STSScriptEncode(str.substr(0, ichSort)+"&SortDir=Asc"+str.substr(ichSortMac))+"');";
		strSortDesc="SubmitFormPost('"+STSScriptEncode(url)+STSScriptEncode(str.substr(0, ichSort)+"&SortDir=Desc"+str.substr(ichSortMac))+"');";
		var strFieldType=filterTable.getAttribute('FieldType');
		strFieldName=filterTable.getAttribute('Name');
	}
	else
	{
		var separator=' ';
		var index=filterStr.lastIndexOf(separator);
		strFieldType=filterStr.substring(index+1);
		if (strFieldType.substring(0, 2)=="x:")
			strFieldType=strFieldType.substring(2);
		var curStr=filterStr.substring(0, index);
		index=curStr.lastIndexOf(separator);
		strFieldName=curStr.substring(index+1);
		if(strFieldName.substring(0, 1)=='@')
			strFieldName=strFieldName.substring(1);
		curStr=filterStr.substring(0, index);
		index=curStr.lastIndexOf(separator);
		if (index > 0)
		{
			strFieldName=curStr.substring(0, index);
		}
		var titleRow=filterTable.childNodes[0].childNodes[0];
		var filterATag=titleRow.childNodes[0].childNodes[0];
		var strSort=filterATag.href;
		strSort=strSort.replace(/%20/g, " ");
		if (strSort.indexOf("'ascending'") > 0)
		{
			strSortAsc=strSort;
			strSortDesc=strSort.replace("'ascending'", "'descending'");
		}
		else
		{
			strSortDesc=strSort;
			strSortAsc=strSort.replace("'descending'", "'ascending'");
		}
	}
	strFieldType=strFieldType.toLowerCase();
	if (strFieldType=="dateTime")
	{
		CAMOptFilter(menu, menuLoading, L_OldestOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
		CAMOptFilter(menu, menuLoading, L_NewestOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
	}
	else if (strFieldType=="integer" || strFieldType=="number" || strFieldType=="currency")
	{
		CAMOptFilter(menu, menuLoading, L_SmallestOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
		CAMOptFilter(menu, menuLoading, L_LargestOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
	}
	else if (strFieldType=="text" || strFieldType=="user" || strFieldType=="string")
	{
		CAMOptFilter(menu, menuLoading, L_AOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
		CAMOptFilter(menu, menuLoading, L_ZOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
	}
	else if (strFieldType=="calculated")
	{
		var strResultType=filterTable.getAttribute('ResultType');
		if (strResultType=="Number" || strResultType=="Currency")
		{
			CAMOptFilter(menu, menuLoading, L_SmallestOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_LargestOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
		else if (strResultType=="dateTime")
		{
			CAMOptFilter(menu, menuLoading, L_OldestOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_NewestOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
		else if (strResultType=="boolean")
		{
			CAMOptFilter(menu, menuLoading, L_Ascending_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_Descending_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
		else
		{
			CAMOptFilter(menu, menuLoading, L_AOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_ZOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
	}
	else if (strFieldType=="attachments")
	{
		CAMOptFilter(menu, menuLoading, L_BlanksOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
		CAMOptFilter(menu, menuLoading, L_AttachmentsOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
	}
	else if (strFieldType=="lookup")
	{
		var curFieldName=filterTable.getAttribute('Name');
		if (curFieldName=="Last_x0020_Modified" || curFieldName=="Created_x0020_Date")
		{
			CAMOptFilter(menu, menuLoading, L_OldestOnTop_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_NewestOnTop_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
		else
		{
			CAMOptFilter(menu, menuLoading, L_Ascending_Text, strSortAsc, strImageAZ, true, "fmi_asc");
			CAMOptFilter(menu, menuLoading, L_Descending_Text, strSortDesc, strImageZA, true, "fmi_desc");
		}
	}
	else
	{
		CAMOptFilter(menu, menuLoading, L_Ascending_Text, strSortAsc, strImageAZ, true, "fmi_asc");
		CAMOptFilter(menu, menuLoading, L_Descending_Text, strSortDesc, strImageZA, true, "fmi_desc");
	}
	CAMSep(menu);
	CAMSep(menuLoading);
}
function CAMOptFilter(menu, menuLoading, wzText, wzAct, wzImage, bEnabled, strId)
{
	var mi;
	mi=CAMOpt(menu, wzText, wzAct, wzImage);
	mi.id=strId;
	if (!bEnabled)
		mi.setAttribute("enabled", "false");
	mi=CAMOpt(menuLoading, wzText, wzAct, wzImage);
	mi.id=strId+"_p";
	if (!bEnabled)
		mi.setAttribute("enabled", "false");
}
function ShowFilterLoadingMenu()
{
	if (!bIsFilterDataLoaded)
		OMenu(loadingFilterMenu, filterTable, null, null, -1);
}
function addFilterMenuItems(menu, menuLoading)
{
	var mi;
	if (filterTable.getAttribute('Filterable')=="FALSE"
		|| filterTable.getAttribute('FieldType ')=="Note"
		|| filterTable.getAttribute('FieldType ')=="URL")
	{
		mi=CAMOpt(menu, L_NotFilterable_Text, "");
		mi.setAttribute("enabled", "false");
		OMenu(menu, filterTable, null, null, -1);
		menu._onDestroy=OnMouseOutFilter;
		return;
	}
	var iframe=document.getElementById("FilterIframe"+filterTable.getAttribute('CtxNum'));
	if (iframe==null)
		return;
	var strDocUrl=iframe.getAttribute('FilterLink');
	var strFilterField=escapeProperly(filterTable.getAttribute('Name'));
	strFilteredValue=null;
	var strFilterQuery="";
	var i=0;
	var arrayField;
	do
	{
		i++;
		arrayField=strDocUrl.match("FilterField"+i+"=[^&]*"+			"&FilterValue"+i+"=[^&]*");
		if (arrayField !=null)
		{
			if (strFilteredValue==null)
				strFilteredValue=getFilterValueFromUrl(arrayField.toString(), strFilterField);
			strFilterQuery=strFilterQuery+"&"+arrayField;
		}
	} while (arrayField);
	var bFiltered=(strFilteredValue !=null);
	strDisplayText=StBuildParam(L_DontFilterBy_Text, filterTable.getAttribute('DisplayName'));
	var strFilterUrl="javascript:SubmitFormPost('"+		STSScriptEncode(FilterFieldV3(ctxFilter.view, strFilterField, "", 0, true))+"')";
	var strImageUrl;
	if (bFiltered)
		strImageUrl=ctxFilter.imagesPath+"FILTEROFF.gif";
	else
		strImageUrl=ctxFilter.imagesPath+"FILTEROFFDISABLED.gif";
	CAMOptFilter(menu, menuLoading, strDisplayText, strFilterUrl, strImageUrl, bFiltered, "fmi_clr");
	mi=CAMOpt(menuLoading, L_Loading_Text, "");
	mi.setAttribute("enabled", "false");
	setTimeout("ShowFilterLoadingMenu()", 500);
	menuLoading._onDestroy=OnMouseOutFilter;
	arrayField=strDocUrl.match("MembershipGroupId=[^&]*");
	if (arrayField !=null)
	{
		strFilterQuery=strFilterQuery+"&"+arrayField;
	}
	arrayField=strDocUrl.match("InstanceID=[^&]*");
	if (arrayField !=null)
	{
		strFilterQuery=strFilterQuery+"&"+arrayField;
	}
	var strRootFolder="";
	arrayField=strDocUrl.match("RootFolder=[^&]*");
	if (arrayField !=null)
		strRootFolder="&"+arrayField;
	if (browseris.safari)
	{
		iframe.src="/_layouts/blank.htm";
		iframe.style.offsetLeft="-550px";
		iframe.style.offsetTop="-550px";
		iframe.style.display="block";
	}
	iframe.src=ctxFilter.HttpRoot+"/_layouts/filter.aspx?ListId="+ctxFilter.listName+		strRootFolder+		"&FieldInternalName="+strFilterField+		"&ViewId="+ctxFilter.view+"&FilterOnly=1&Filter=1"+strFilterQuery;
	bMenuLoadInProgress=true;
}
function getFilterValueFromUrl(strUrl, strFilterField)
{
	var ichStart, ichEnd;
	var strFilterFieldUrl;
	ichStart=strUrl.indexOf("=");
	if (ichStart==-1)
		return;
	ichEnd=strUrl.indexOf("&");
	if (ichEnd==-1)
		return;
	if (ichEnd < ichStart)
		return;
	strUrl=CanonicalizeUrlEncodingCase(strUrl);
	strFilterFieldUrl=strUrl.substring(ichStart+1, ichEnd);
	if (strFilterFieldUrl==strFilterField)
	{
		var strUnescaped;
		ichStart=strUrl.indexOf("=", ichEnd+1);
		if (ichStart==-1)
			return;
		strUnescaped=strUrl.substr(ichStart+1);
		strUnescaped=unescapeProperly(strUnescaped);
		return strUnescaped;
	}
	return null;
}
function OnIframeLoad()
{
	bMenuLoadInProgress=false;
	if (filterTable !=null && filterTable.getAttribute('Name') !=null)
	{
		var iframe=window.frames["FilterIframe"+filterTable.getAttribute('CtxNum')];
		if (iframe !=null)
		{
			var strFieldName=filterTable.getAttribute('Name');
			var select=iframe.document.getElementById("diidFilter"+strFieldName);
			strFieldName=escapeProperly(strFieldName);
			if (select !=null)
			{
				var c=select.childNodes.length;
				if (c > 500)
				{
					addFilterOptionMenuItem();
				}
				else
				{
					var rgChoices=select.childNodes;
					for (var i=1; i < c; i++)
					{
						var strMenuText;
						if (rgChoices[i].innerText)
							strMenuText=rgChoices[i].innerText;
						else if (rgChoices[i].textContent)
							strMenuText=rgChoices[i].textContent;
						else
							strMenuText=rgChoices[i].innerHTML;
						var strFilterUrl="javascript:SubmitFormPost('"+							STSScriptEncode(FilterFieldV3(ctxFilter.view, strFieldName, rgChoices[i].value, i, true))+"')";
						var mi=CAMOpt(currentFilterMenu, strMenuText, strFilterUrl);
						if (strFilteredValue !=null && strFilteredValue==rgChoices[i].value)
							mi.setAttribute("checked", "true");
					}
				}
			}
			else
			{
			   addFilterOptionMenuItem();
			}
			bIsFilterDataLoaded=true;
			if (loadingFilterMenu !=null)
				loadingFilterMenu._onDestroy=null;
			if (currentFilterMenu !=null)
			{
				currentFilterMenu._onDestroy=OnMouseOutFilter;
				OMenu(currentFilterMenu, filterTable, null, null, -1);
			}
		}
	}
}
function addFilterOptionMenuItem()
{
	var strUrl=window.location.href;
	strUrl=StURLSetVar2(strUrl, "Filter", "1");
	strUrl=StURLSetVar2(strUrl, "View", ctxFilter.view);
	strUrl="javascript:SubmitFormPost('"+strUrl+"')";
	CAMOpt(currentFilterMenu, L_FilterMode_Text, strUrl);
}
function OnMouseOverAdHocFilterDeferCall(elm, fieldStr)
{
	filterStr=fieldStr;
	if (!browseris.ie55up || !browseris.win32)
		return false;
	if (IsFilterMenuOn())
		return false;
	if (filterTable !=null)
		OnMouseOutFilter();
	filterTable=elm;
	filterTable.className="ms-selectedtitle";
	filterTable.onclick=CreateFilterMenu;
	filterTable.oncontextmenu=CreateFilterMenu;
	filterTable.onmouseout=OnMouseOutFilter;
	var titleRow=filterTable.children[0].children[0];
	filterImageCell=titleRow.children[titleRow.children.length - 1];
	filterImageCell.children[0].src="/_layouts/images/menudark.gif";
	filterImageCell.children[0].style.visibility="visible";
	filterImageCell.style.visibility="visible";
	filterImageCell.className="ms-menuimagecell";
	return true;
}
function addAdHocFilterMenuItems(menu, menuLoading)
{
	var mi=CAMOpt(menuLoading, L_Loading_Text, "");
	mi.setAttribute("enabled", "false");
	OMenu(menuLoading, filterTable, null, null, -1);
	menuLoading._onDestroy=OnMouseOutFilter;
	DoCallBack("__filter={"+filterStr+"}");
}
function UpdateFilterCallback(filterHTML, foo)
{
	var select="</OPTION>";
	var i=-1;
	i=filterHTML.indexOf(select, i+1);
	var j=filterHTML.lastIndexOf('>', i);
	var strDisplayText=StBuildParam(L_DontFilterBy_Text, strFieldName);
	var strImageUrl;
	var strFilterUrl="";
	if (j < i - 1)
	{
		var index=filterHTML.lastIndexOf('\"', i);
		if (index > 0)
		{
			var index2=filterHTML.lastIndexOf('\"', index - 1);
			if (index2 > 0)
			{
				strFilterUrl=filterHTML.substring(index2+1, index);
			}
		}
	}
	if (j==i - 1)
		strImageUrl="/_layouts/images/FILTEROFFDISABLED.gif";
	else
		strImageUrl="/_layouts/images/FILTEROFF.gif";
	if (i > 0)
	{
	    var mi=CAMOpt(currentFilterMenu, strDisplayText, strFilterUrl, strImageUrl);
		mi.setAttribute("enabled", j==i - 1 ? "false" : "true");
		var index=i;
		var optionStart="<OPTION href=\"";
		i=filterHTML.indexOf(select, i+8);
		while ( i > 0)
		{
			j=filterHTML.indexOf(optionStart, index+8);
			j=filterHTML.indexOf('\"', j+20);
			if (j > 0 && j < i)
			{
				var strMenuText=filterHTML.substring(j+2, i);
				var strFilterUrl='';
				index=filterHTML.lastIndexOf('\"', j);
				if (index > 0)
				{
					var index2=filterHTML.lastIndexOf('\"', index - 1);
					if (index2 > 0)
					{
						strFilterUrl=filterHTML.substring(index2+1, index);
						strFilterUrl=strFilterUrl.replace(/&amp;/g, "&");
					}
				}
				if (strMenuText.length > 40)
					strMenuText=strMenuText.substring(0, 40)+"...";
				if (strMenuText.length > 0)
					CAMOpt(currentFilterMenu, strMenuText, strFilterUrl);
			}
			index=i;
			i=filterHTML.indexOf(select, i+8);
		}
	}
	else
	{
		var mi=CAMOpt(currentFilterMenu, L_NotFilterable_Text, "");
		mi.setAttribute("enabled", "false");
		OMenu(currentFilterMenu, filterTable, null, null, -1);
		return;
	}
	loadingFilterMenu._onDestroy=null;
	OMenu(currentFilterMenu, filterTable, null, null, -1);
	currentFilterMenu._onDestroy=OnMouseOutFilter;
}
function OnClickFilter(obj, e)
{
	var o=FindSTSMenuTable(obj, "CTXNum");
	if (o !=null && o.getAttribute("SortFields") !=null)
	{
		var strSortFields=o.getAttribute("SortFields");
		var url=GetUrlWithNoSortParameters(strSortFields);
		url=RemovePagingArgs(url);
		if (url.indexOf("?") < 0)
			url+="?";
		else
			url+="&";
		SubmitFormPost(url+strSortFields);
	}
	if (!bIsFileDialogView)
		e.cancelBubble=true;
	return false;
}
function ToggleSelectionAllUsers(viewCounter)
{
	var chkToggle=document.getElementById("spToggleUserSelectionCheckBox_"+viewCounter.toString());
	if (chkToggle !=null)
	{
		var name="spUserSelectionCheckBox_"+viewCounter.toString();
		var users=document.getElementsByName(name);
		chkToggle.checked=!chkToggle.checked;
		for (var i=0; i < users.length; i++)
		{
			var chkBox=users[i];
			chkBox.checked=chkToggle.checked;
		}
		var imageId="cbxUserSelectAll"+viewCounter.toString();
		var img=document.getElementById(imageId);
		if (img !=null)
		{
			if (chkToggle.checked)
				img.src='/_layouts/images/checkall.gif';
			else
				img.src='/_layouts/images/unchecka.gif';
		}
	}
}
function UserSelectionOnClick(chk, viewCounter)
{
	var imageId="cbxUserSelectAll"+viewCounter.toString();
	var img=document.getElementById(imageId);
	var chkToggle=document.getElementById("spToggleUserSelectionCheckBox_"+viewCounter.toString());
	if (!chk.checked)
	{
		if (chkToggle !=null)
		{
			chkToggle.checked=false;
		}
		if (img !=null)
		{
			img.src='/_layouts/images/unchecka.gif';
		}
	}
	else
	{
		var name="spUserSelectionCheckBox_"+viewCounter.toString();
		var users=document.getElementsByName(name);
		var bAllChecked=true;
		for (var i=0; i < users.length; i++)
		{
			var chkBox=users[i];
			if (!chkBox.checked)
			{
				bAllChecked=false;
				break;
			}
		}
		if (bAllChecked)
		{
			if (img)
				img.src='/_layouts/images/checkall.gif';
			if (chkToggle)
				chkToggle.checked=true;
		}
	}
}
var g_menuCounter=0;
var g_oSelRw=null;
var g_iEntityEditorLineHeight=16;
var g_EntityEditorHiddenEntityKeyId="HiddenEntityKey";
var g_EntityEditorHiddenEntityDisplayTextId="HiddenEntityDisplayText";
var g_EntityEditorShowEntityDisplayTextInTextBox="ShowEntityDisplayTextInTextBox";
var g_EntityEditorDownLevelId="downlevelTextBox";
var g_EntityEditorUpLevelId="upLevelDiv";
var g_EntityEditorHiddenId="hiddenSpanData";
var g_EntityEditorCheckNamesId="checkNames";
var g_EntityEditorOuterTableId="OuterTable";
var g_EntityEditorErrorLabelId="errorLabel";
var g_EntityEditorResultTableId="resultTable";
var g_EntityEditorResultTableAttrEditorId="EditorControlClientId";
function onKeyDownRw(div, parentid, maxHeight, allowTypeIn, e)
{
	if (!e) e=window.event;
	var iKC=e.keyCode;
	if((e.shiftKey && iKC==13) || (e.altKey && iKC==40))
	{
		onClickRw(true,false);
		canEvt(e);
		return;
	}
	if(allowTypeIn==false)
	{
		if (iKC!=8 && iKC!=46 && iKC!=37 && iKC!=39 && iKC!=9)
		{
			canEvt(e);
		}
		else
		{
			if (autoPostBackEnabled(div))
				schedulePostBack();
		}
		PickerAdjustHeight(parentid, maxHeight);
	}
	else
	{
		PickerAdjustHeight(parentid, maxHeight);
		if ((e.ctrlKey && iKC==75) || (!e.ctrlKey && !e.altKey && !e.shiftKey && (iKC==13)))
		{
			canEvt(e);
			var checkNamesId=getSubControlID(parentid, g_EntityEditorCheckNamesId);
			var button=document.getElementById(checkNamesId);
			if (button)
				button.click();
		}
	}
}
function onKeyUpRw(editorClientID)
{
	copyUplevelToHidden(editorClientID);
}
function onMouseDownRw()
{
	if (event.button==2)
		g_oSelRw=document.selection.createRange();
}
function onContextMenuSpnRw()
{
	var oSO=g_oSelRw;
	var oS=document.selection.createRange();
	if (oSO.text=='')
	{
		ret=onClickRw(false,false);
	}
	else
	{
		if(oSO.inRange(oS))
			oSO.select();
		else
			onClickRw(false,false);
	}
	return false;
}
function canEvt(e)
{
	if(e==null)
		e=event;
	e.returnValue=false;
	e.cancelBubble=true;
}
function copyUplevelToHidden(editorClientID)
{
	if (document.getElementById(editorClientID)==null)
		return;
	updateControlValue(editorClientID);
	var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
	var hidden=document.getElementById(getSubControlID(editorClientID, g_EntityEditorHiddenId));
	var children=uplevel.childNodes;
	for (i=0; i < children.length; i++)
	{
		if (children[i].tagName !='SPAN' && children[i].nodeType !=3)
		{
			if (children[i].tagName=='A')
			{
				var oR=document.body.createTextRange();
				oR.moveToElementText(children[i]);
				oR.execCommand('Unlink');
			}
			else
			{
				var oTN=document.createTextNode(children[i].innerText);
				children[i].replaceNode(oTN);
			}
		}
	}
	if (EntityEditor_UseContentEditableControl)
	{
		hidden.value=uplevel.innerHTML;
	}
	else
	{
		var downlevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorDownLevelId));
		hidden.value=downlevel.value;
	}
}
function getUplevel(editorClientID)
{
	if (EntityEditor_UseContentEditableControl)
	{
		var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
		var children=uplevel.childNodes;
		for (i=0; i < children.length; i++)
		{
			if (children[i].tagName !='SPAN' && children[i].nodeType !=3)
			{
				var oTN=document.createTextNode(children[i].innerText);
				children[i].replaceNode(oTN);
			}
		}
		return uplevel.innerHTML;
	}
	var downlevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorDownLevelId));
	return downlevel.value;
}
function EntityEditorHasData(editorClientID)
{
	if (EntityEditor_UseContentEditableControl)
	{
		var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
		var children=uplevel.childNodes;
		if (children.length > 0)
			return true;
	}
	else
	{
		var downlevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorDownLevelId));
		if (downlevel.value !=null && downlevel.value.length > 0)
			return true;
	}
	return false;
}
function EEDecodeSpecialChars(str)
{
	var decodedStr=str.replace(/&quot;/g, "\"");
	decodedStr=decodedStr.replace(/&gt;/g, ">");
	decodedStr=decodedStr.replace(/&lt;/g, "<");
	decodedStr=decodedStr.replace(/&#39;/g, "'");
	decodedStr=decodedStr.replace(/&amp;/g, "&");
	return decodedStr;
}
function onClickRw(showMenu, divClicked)
{
	var oR=document.selection.createRange();
	var oPE=oR.parentElement();
	var oPPE=null;
	if(oPE.tagName=="SPAN" && oPE.id=="content")
	{
		oPPE=oPE.parentElement;
	}
	else if(oPE.tagName=="SPAN" && oPE.id.substring(0,4)=="span" && ! divClicked)
	{
		oPPE=oPE;
	}
	if(oPPE!=null)
	{
	    oR.moveToElementText(oPPE);
	    var c="character";
	    oR.moveStart(c, -1);
		oR.moveEnd(c,1);
		oR.select();
		g_oSelRw=oR;
		var oDivEntityData=oPPE.children('divEntityData');
		var isResolved=oDivEntityData.getAttribute('isresolved');
		if(isResolved=="False")
		{
		    var menuOwner=oPPE;
		    if(menuOwner.getBoundingClientRect().right > menuOwner.parentElement.getBoundingClientRect().right)
			    menuOwner=menuOwner.parentElement;
		    var clientID=oPPE.parentElement.id.replace('_upLevelDiv', '');
			var keyRawValue=oDivEntityData.getAttribute('key');
		    var menu=DeferCall('CMenu', 'Entity_Menu'+g_menuCounter);
				g_menuCounter++;
			var morematches=null;
			if (matches[clientID] !=null && matches[clientID][keyRawValue] !=null)
				morematches=matches[clientID][keyRawValue];
			var EE=document.getElementById(clientID);
			var moreItemsText=EE.getAttribute('MoreItemsText');
			var removeText=EE.getAttribute('RemoveText');
			var noMatchesText=EE.getAttribute('NoMatchesText');
			if(morematches==null || morematches.childNodes.length==0)
				CAMOpt(menu, noMatchesText);
			else
			{
				for (x=0; x < morematches.childNodes.length; x++)
				{
					var otherMatch=morematches.childNodes[x];
					CAMOpt(menu, otherMatch.getAttribute('DisplayText'), "EEReplace('"+STSScriptEncode(clientID)+"', '"+STSScriptEncode(keyRawValue)+"', "+x+");");
				}
			}
			CAMSep(menu);
			CAMOpt(menu, removeText, "EERemove();");
			CAMOpt(menu, moreItemsText, "EEShowMore('"+STSScriptEncode(clientID)+"', '"+STSScriptEncode(keyRawValue)+"');");
			OMenu(menu, menuOwner, null, null, -1);
		}
	}
}
function EEShowMore(id, key)
{
	DeferCall('__Dialog__'+id, key);
}
function EEReplace(clientID, key, id)
{
  var otherMatch=matches[clientID][key].childNodes[id];
  var spandata=ConvertEntityToSpan("",  otherMatch);
  g_oSelRw.pasteHTML(spandata)
  PickerAdjustHeight(clientID, g_maxheight[clientID]);
  var downlevel=document.getElementById(getSubControlID(clientID, "downlevelTextBox"));
  if(downlevel !=null && autoPostBackEnabled(downlevel)) schedulePostBack();
}
function EERemove()
{
	g_oSelRw.select();
	document.selection.clear();
}
var g_maxheight=new Array();
function EntityEditorSetWaitCursor(ctx)
{
	if (document.getElementById(ctx)==null)
		return;
	var outerTable=document.getElementById(getSubControlID(ctx, g_EntityEditorOuterTableId));
	if (outerTable !=null)
	{
		outerTable.style.cursor="wait";
	}
}
function EntityEditorClearWaitCursor(ctx)
{
	if (document.getElementById(ctx)==null)
		return;
	var outerTable=document.getElementById(getSubControlID(ctx, g_EntityEditorOuterTableId));
	if (outerTable !=null)
	{
		outerTable.style.cursor="";
	}
}
function EntityEditorHandleCheckNameResult(result, ctx)
{
	EntityEditorClearWaitCursor(ctx);
	EntityEditorCallback(result, ctx);
}
function EntityEditorHandleCheckNameError(exception, ctx)
{
	EntityEditorClearWaitCursor(ctx);
	var errorControl=document.getElementById(getSubControlID(ctx, g_EntityEditorErrorLabelId));
	if (errorControl)
	{
		errorControl.innerHTML=STSHtmlEncode(exception);
	}
}
function EntityEditorCallback(result,ctx,preventAutoPostBack)
{
	if (document.getElementById(ctx)==null)
		return;
	var editor=document.getElementById(ctx);
	var errorControl=document.getElementById(getSubControlID(ctx, 'errorLabel'));
	var xmlDoc;
	if(document.implementation && document.implementation.createDocument)
	{
		xmlDoc=(new DOMParser()).parseFromString(result, "text/xml");
	}
	else
	{
		xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async=false;
		xmlDoc.loadXML(result);
	}
	var entities=xmlDoc.documentElement;
	var separator=entities.getAttribute("Separator");
	if (separator==null)
	{
		separator=String.fromCharCode(0);
	}
	var append=entities.getAttribute("Append");
	var maxHeight=entities.getAttribute("MaxHeight");
	g_maxheight[ctx]=maxHeight;
	var spanData="";
	var downlevelData="";
	if(append=="False")
		errorControl.innerHTML=STSHtmlEncode(entities.getAttribute("Error"));
	for(x=0;x<entities.childNodes.length;x++)
	{
		var entity=entities.childNodes[x];
		spanData+=ConvertEntityToSpan(ctx,entity);
		if (x==0 &&
			editor.getAttribute(g_EntityEditorShowEntityDisplayTextInTextBox)=="1")
		{
			downlevelData+=entity.getAttribute("DisplayText");
			document.getElementById(getSubControlID(ctx, g_EntityEditorHiddenEntityKeyId)).value=entity.getAttribute("Key");
			document.getElementById(getSubControlID(ctx, g_EntityEditorHiddenEntityDisplayTextId)).value=entity.getAttribute("DisplayText");
		}
		else
		{
			downlevelData+=entity.getAttribute("Key");
		}
		if(spanData!="" && x+1!=entities.childNodes.length)
		{
			spanData+=separator+" ";
			downlevelData+=separator+" ";
		}
	}
  var uplevel=document.getElementById(getSubControlID(ctx, g_EntityEditorUpLevelId));
  var hiddenSpan=document.getElementById(getSubControlID(ctx, g_EntityEditorHiddenId));
  var downlevel=document.getElementById(getSubControlID(ctx, g_EntityEditorDownLevelId));
  var shouldPostBack=(preventAutoPostBack==null || !preventAutoPostBack) && autoPostBackEnabled(uplevel);
  var shouldNotifyChange=(uplevel.innerHTML!=spanData);
  if(append=="True" && uplevel.innerHTML!='')
  {
	uplevel.innerHTML+=separator+" "+spanData;
	hiddenSpan.value+=separator+" "+spanData;
	downlevel.value+=separator+" "+downlevelData;
  }
  else
  {
	shouldPostBack=shouldPostBack&&uplevel.innerHTML!=spanData&&spanData.indexOf('ms-entity-resolved')!=-1;
	downlevel.value=downlevelData;
	uplevel.innerHTML=spanData;
	hiddenSpan.value=spanData;
  }
  if ((shouldNotifyChange) && (!shouldPostBack) &&(downlevel.onvaluesetfrompicker))
  {
	if (typeof(downlevel.onvaluesetfrompicker)=='function')
	{
		downlevel.onvaluesetfrompicker();
	}
	else
	{
		eval(downlevel.onvaluesetfrompicker);
	}
  }
  updateControlValue(ctx);
  PickerAdjustHeight(ctx, maxHeight);
  if(shouldPostBack) schedulePostBack();
  var cbScript=editor.getAttribute("EEAfterCallbackClientScript");
  if (cbScript !=null && cbScript !="")
  {
	if (preventAutoPostBack==undefined || preventAutoPostBack==false)
	{
	  var timeoutScript=cbScript+"('"+STSScriptEncode(ctx)+"', '"+STSScriptEncode(result)+"')";
	  setTimeout(timeoutScript, 500);
	}
  }
}
function updateControlValue(editorClientID)
{
	if (document.getElementById(editorClientID)==null)
		return;
	var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
	var editor=document.getElementById(editorClientID);
	editor.value=((uplevel.innerHTML !='') ? 'true' : '')
	CheckOk(editorClientID);
}
function CheckOk(editorClientID)
{
	var editor=document.getElementById(editorClientID);
	if (editor==null)
		return;
	var allowEmpty=false;
	if (editor.getAttribute('allowEmpty')=='1')
		allowEmpty=true;
	var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
	if(uplevel.innerHTML!='')
	{
		if(self.enableOK!=null)
			enableOK();
	}
	else
	{
		if(self.disableOK!=null && !allowEmpty)
			disableOK();
	}
}
var matches=new Array();
function ConvertEntityToSpan(ctx, entity)
{
	if(matches[ctx]==null)
		matches[ctx]=new Array();
	var key=entity.getAttribute("Key");
	var displayText=entity.getAttribute("DisplayText");
	var isResolved=entity.getAttribute("IsResolved");
	var description=entity.getAttribute("Description");
	var style='ms-entity-unresolved';
	if(isResolved=='True')
		style='ms-entity-resolved';
	var spandata="<span id='span"+STSHtmlEncode(key)+"' tabindex='-1' contentEditable='false' class='"+style+"' ";
	spandata+="title='"+STSHtmlEncode(description)+"'>"
	spandata+="<div style='display:none;' id='divEntityData' ";
	spandata+="key='"+STSHtmlEncode(key)+"' displaytext='"+STSHtmlEncode(displayText)+"' isresolved='"+STSHtmlEncode(isResolved)+"' ";
	spandata+="description='"+STSHtmlEncode(description)+"'>";
	var multipleMatches=EntityEditor_SelectSingleNode(entity, "MultipleMatches");
	matches[ctx][key]=multipleMatches;
	var extraData=EntityEditor_SelectSingleNode(entity, "ExtraData");
	if(extraData)
	{
		var data;
		if(extraData.firstChild)
			data=extraData.firstChild.xml;
		if(!data) data=extraData.innerXml || extraData.innerHTML;
		if(!data) data='';
		spandata+="<div data='"+STSHtmlEncode(data)+"'></div>";
	}
	else
	{
		spandata+="<div data=''></div>";
	}
	spandata+="</div>";
	spandata+="<span id='content' tabindex='-1' contenteditable onMouseDown='onMouseDownRw();' onContextMenu='onContextMenuSpnRw();' >";
	if(displayText !='')
		spandata+=STSHtmlEncode(displayText);
	else
		spandata+=STSHtmlEncode(key);
	spandata+="</span></span>";
	return spandata;
}
function PickerAdjustHeight(editorClientID, maxHeight)
{
	var editor=document.getElementById(editorClientID);
	if (editor==null)
		return;
	var downlevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorDownLevelId));
	var uplevel=document.getElementById(getSubControlID(editorClientID, g_EntityEditorUpLevelId));
	var rows=downlevel.rows;
	PickerAdjustHeight2(downlevel, rows, maxHeight);
	PickerAdjustHeight2(uplevel, rows, maxHeight);
}
function PickerAdjustHeight2(editorControl, rows, maxHeight)
{
	var iMaxHeightSize=maxHeight;
	if (editorControl !=null)
	{
		var contentheight=editorControl.scrollHeight;
		var clientHeight=editorControl.clientHeight;
		var bodyHeight=editorControl.offsetHeight;
		if(contentheight==0)
		{
			contentheight=13;
			clientHeight=14;
			bodyHeight=18;
		}
		var MaxHeightPixelSize=iMaxHeightSize * g_iEntityEditorLineHeight;
		contentheight=((contentheight < rows*g_iEntityEditorLineHeight)? rows*g_iEntityEditorLineHeight: contentheight);
		if (clientHeight !=contentheight && (contentheight <=MaxHeightPixelSize || clientHeight < MaxHeightPixelSize))
		{
			editorControl.style.height=bodyHeight+((contentheight > MaxHeightPixelSize)? MaxHeightPixelSize : contentheight)   - clientHeight;
		}
		else
		{
			if(clientHeight>MaxHeightPixelSize)
				editorControl.style.height=MaxHeightPixelSize;
		}
	}
}
function docopy()
{
	var rng=document.selection.createRange();
	window.clipboardData.setData('Text', rng.text);
	window.event.returnValue=false;
	return false;
}
function dopaste()
{
	var rng=document.selection.createRange();
	window.event.returnValue=false;
	rng.text=window.clipboardData.getData('Text');
	return false;
}
function getSubControlID(parentid, subcontrolid)
{
	return parentid+"_"+subcontrolid;
}
var nav4=window.Event ? true : false;
var selected=new Array(0);
var lastSelected;
function PickerDialogSetClearState()
{
	selected=new Array(0);
	lastSelected=null;
	PickerDialogUpdateAddSelectionButton();
}
function singleselectevent(e)
{
	if (!e) e=window.event;
	var el=null;
	if(nav4)
		el=e.target.parentNode || e.currentTarget.parentNode;
	else
	{
		el=e.srcElement;
		if(el.tagName=="TD")
			el=el.parentElement;
	}
	while (el.tagName !="TR")
		el=el.parentNode;
	addSelection(el, true, true);
	lastSelected=el;
	addSelected_Click();
	PickerDialogUpdateAddSelectionButton();
	return false;
}
function multiselectevent(e)
{
	if (!e) e=window.event;
	var shift=false;
	var ctrl=false;
	ctrl=e['ctrlKey'];
	shift=e['shiftKey'];
	var el=null;
	if(nav4)
		el=e.target.parentNode || e.currentTarget.parentNode;
	else
	{
		el=e.srcElement;
		if(el.tagName=="TD")
			el=el.parentElement;
	}
	while (el.tagName !="TR")
		el=el.parentNode;
	if(shift==false)
	{
		if(ctrl==false)
		{
			setSelectedColor(false);
			selected=new Array(0);
		}
		lastSelected=el;
		var found=-1;
		for(i=0;i<selected.length;i++)
		{
			if(selected[i]==el)
			{
				found=i;
				i=selected.length;
			}
		}
		if(found==-1)
			selected=selected.concat(new Array(el));
		else
		{
			setSelectedRowColor(selected[found], false);
			selected.splice(found,1);
		}
	}
	else
	{
		setSelectedColor(false);
		selected=new Array(0);
		var table;
		if(nav4)
			table=el.parentNode;
		else
			table=el.parentElement;
		var elIndex;
		var lastIndex;
		var childElements=table.rows;
		if(lastSelected==null)
			lastSelected=childElements[1];
		for(i=1;i<childElements.length;i++)
		{
			if(childElements[i]==el)
				elIndex=i;
			if(childElements[i]==lastSelected)
				lastIndex=i;
			if(elIndex!=null || lastIndex!=null )
				selected=selected.concat(new Array(childElements[i]));
			if(elIndex!=null && lastIndex!=null)
				i=childElements.length;
		}
	}
	setSelectedColor(true);
	PickerDialogUpdateAddSelectionButton();
	return false;
}
function setSelectedRowColor(row, isSelected)
{
	for (var chd=0; chd < row.childNodes.length; chd++)
	{
		var className=row.childNodes[chd].className;
		if (isSelected)
		{
			className="ms-pb-selected";
		}
		else
		{
			className="ms-pb";
		}
		row.childNodes[chd].className=className;
	}
}
function setSelectedColor(isSelected)
{
	for (i=0; i < selected.length; i++)
	{
		setSelectedRowColor(selected[i], isSelected);
	}
}
function IsSearchResultRow(row)
{
	if (row==null ||
		row.className=="ms-pickersearchsummarytr" ||
		row.className=="ms-pickeremptyresulttexttr" ||
		row.className=="ms-pickerresultheadertr")
	{
		return false;
	}
	return true;
}
function tableKeyDown(table, multiselect, e)
{
	if (table.rows.length <=1)
		return;
	if (!e) e=window.event;
	if (e.ctrlKey && e.keyCode==65 && multiselect==true)
	{
		for (x=1; x < table.rows.length; x++)
		{
			if (IsSearchResultRow(table.rows[x]))
				addSelection(table.rows[x], false, false);
		}
		return false;
	}
	if (e.keyCode==13)
	{
		addSelected_Click();
		if (multiselect==false &&
			selected.length > 0 &&
			self.doClickOK !=null && typeof(self.doClickOK)=="function")
		{
			window.setTimeout('doClickOK();', 100);
		}
	}
	if (e.keyCode==40 || e.keyCode==38)
	{
		var row=table.rows[1];
		if (e.keyCode==40)
		{
			if (lastSelected !=null &&
				IsSearchResultRow(lastSelected.nextSibling))
			{
				row=lastSelected.nextSibling;
			}
		}
		if (e.keyCode==38)
		{
			if (lastSelected !=null &&
				IsSearchResultRow(lastSelected.previousSibling))
			{
				row=lastSelected.previousSibling;
			}
			if (row==table.rows[0])
				row=table.rows[1];
		}
		if (IsSearchResultRow(row))
		{
			if(multiselect==true && e.shiftKey)
				addSelection(row, false, true);
			else
				addSelection(row, true, true);
			if(row!=null)
				lastSelected=row;
			if(multiselect==false)
				addSelected_Click();
			return false;
		}
	}
	PickerDialogUpdateAddSelectionButton();
}
function addSelection(row, clear, reposition)
{
	if(row==null)
		return;
	if(clear==true)
	{
		setSelectedColor(false);
		selected=new Array(0);
	}
	selected=selected.concat(new Array(row));
	setSelectedColor(true);
	if(reposition && row.focus)
	row.focus();
	PickerDialogUpdateAddSelectionButton();
}
function autoPostBackEnabled(elt)
{
  var autoPostBack=(elt==null)?null:elt.attributes.getNamedItem("AutoPostBack");
  return (autoPostBack!=null && autoPostBack.value=='1');
}
function schedulePostBack()
{
	window.setTimeout("__doPostBack('','')",0);
}
function saveOldEntities(elementId)
{
	var elt=document.getElementById(elementId);
	if(elt!=null&&autoPostBackEnabled(elt)) elt.oldEntities=getEntityKeysFromElement(elementId);
}
function postbackIfEntitiesChanged(elementId)
{
	var elt=document.getElementById(elementId);
	if (elt==null)
	{
		return false;
	}
	var oldKeys=elt.oldEntities;
	elt.oldEntities=null;
	var newKeys=getEntityKeysFromElement(elementId);
	var shouldPostBack=false;
	if(autoPostBackEnabled(elt))
	{
		if((oldKeys==null && newKeys!=null) || (oldKeys!=null && newKeys==null) || (oldKeys.length !=newKeys.length))
		{
			shouldPostBack=true;
		}
		else
		{
			for(i=0;!shouldPostBack&&i<oldKeys.length;i++)
			{
				if(oldKeys[i] !=newKeys[i])
				{
					shouldPostBack=true;
				}
			}
		}
	}
	if(shouldPostBack) schedulePostBack();
}
function getEntityKeysFromElement(elementId)
{
	var elt=document.getElementById(elementId);
	var keys=new Array();
	var i=0;
	for(x=0;elt!=null&&x<elt.childNodes.length;x++)
	{
		var child=elt.childNodes[x];
		if(child.attributes!=null)
		{
			var c=child.attributes.getNamedItem('class');
			if(c!=null&&c.value=='ms-entity-resolved')
			{
				var oDivEntityData=child.children('divEntityData');
				if (oDivEntityData !=null && oDivEntityData.getAttribute('key') !=null)
				{
					keys[i]=oDivEntityData.getAttribute('key');
					i++;
				}
			}
		}
	}
	return keys.sort();
}
function EntityEditor_SelectSingleNode(xmlNode, tagName)
{
	if(document.implementation && document.implementation.createDocument)
	{
		var elems=xmlNode.getElementsByTagName(tagName);
		if(elems.length > 0)
			return elems[0];
		return null;
	}
	else
	{
		return xmlNode.selectSingleNode(tagName);
	}
}
function PickerDialogCallbackContext()
{
	this.queryTextBoxElementId=null;
	this.resultTableId=null;
	this.errorElementId=null;
	this.htmlMessageElementId=null;
	this.queryButtonElementId=null;
}
function PickerDialogSetFocusDelay(elemId, delayTime)
{
	setTimeout("if (document.getElementById('"+elemId+"') !=null) { try {document.getElementById('"+elemId+"').focus(); } catch(e) {} }", delayTime);
}
function PickerDialogHandleQueryResult(results, ctx)
{
	var result=ParseMultiColumnValue(results);
	var itemCount=parseInt(result[0]);
	var error=document.getElementById(ctx.errorElementId);
	error.innerHTML=STSHtmlEncode(result[1]);
	var htmlMessage=document.getElementById(ctx.htmlMessageElementId);
	htmlMessage.innerHTML=result[2];
	var queryButton=document.getElementById(ctx.queryButtonElementId);
	if (queryButton !=null)
		SetControlDisabledStatus(queryButton, false);
	var resultControl=document.getElementById(ctx.resultTableId);
	var parent;
	if(nav4)
		parent=resultControl.parentNode;
	else
		parent=resultControl.parentElement;
	parent.innerHTML=result[3];
	if (itemCount > 0)
	{
		PickerDialogSetFocusDelay(ctx.resultTableId+"_row0_Link", 200);
	}
	else
	{
		PickerDialogSetFocusDelay(ctx.queryTextBoxElementId, 200);
	}
}
function PickerDialogHandleQueryError(exception, ctx)
{
	var error=document.getElementById(ctx.errorElementId);
	error.innerHTML=STSHtmlEncode(exception);
	var htmlMessage=document.getElementById(ctx.htmlMessageElementId);
	htmlMessage.innerHTML="";
	var queryButton=document.getElementById(ctx.queryButtonElementId);
	if (queryButton !=null)
		SetControlDisabledStatus(queryButton, false);
	var resultControl=document.getElementById(ctx.resultTableId);
	var parent;
	if(nav4)
		parent=resultControl.parentNode;
	else
		parent=resultControl.parentElement;
	parent.innerHTML=					   "<table id='"+ctx.resultTableId+"' width='100%' height='100%'>  "+					   " <tr>                                                              "+					   "    <td>                                                           "+					   "    </td>                                                          "+					   " </tr>                                                             "+					   "</table>";
	var queryTextBox=document.getElementById(ctx.queryTextBoxElementId);
	try
	{
		queryTextBox.focus();
	}
	catch(e)
	{
	}
}
function PickerDialogShowWait(ctx)
{
	var obj=document.getElementById(ctx.errorElementId);
	if (obj !=null)
		obj.innerHTML="";
	obj=document.getElementById(ctx.htmlMessageElementId);
	if (obj !=null)
		obj.innerHTML="";
	obj=document.getElementById(ctx.queryButtonElementId);
	if (obj !=null)
		SetControlDisabledStatus(obj, true);
	var resultControl=document.getElementById(ctx.resultTableId);
	if (resultControl !=null)
	{
		var parent;
		if(nav4)
			parent=resultControl.parentNode;
		else
			parent=resultControl.parentElement;
		var L_GearToolTip_TEXT="Query in progress. Please wait...";
		var L_PleaseWait_TEXT="Please wait while your query is processed.";
		parent.innerHTML=					   "<table id='"+ctx.resultTableId+"' class='ms-pickerwait'>"+					   " <tr>                                                              "+					   "    <td width='100%' height='100%' align='center' valign='middle'> "+					   "         <table width='100%'>                                      "+					   "            <tr>                                                   "+					   "                <td align='center' valign='middle'>                "+					   "                    <img alt='"+L_GearToolTip_TEXT+"' src='/_layouts/images/gears_an.gif' >"+					   "                </td>                                              "+					   "            </tr>                                                  "+					   "            <tr>                                                   "+					   "                <td align='center'>&nbsp;</td>                     "+					   "            </tr>                                                  "+					   "            <tr class='ms-pickerwaittexttr'>                         "+					   "                <td align='center' class='ms-descriptiontext'>     "+					   "                    "+L_PleaseWait_TEXT+					   "                </td>                                              "+					   "            </tr>                                                  "+					   "        </table>                                                   "+					   "    </td>                                                          "+					   " </tr>                                                             "+					   "</table>";
	}
}
function PickerResultsMultiSelectOnDblClick(row)
{
	var resultTable=document.getElementById(g_EntityEditorResultTableId);
	var xml=row.getAttribute('entityXml');
	var ctx=resultTable.getAttribute(g_EntityEditorResultTableAttrEditorId);
	EntityEditorCallback(xml,ctx);
}
function PickerResultsSingleSelectOnClick(row)
{
	var resultTable=document.getElementById(g_EntityEditorResultTableId);
	var xml=row.getAttribute('entityXml');
	var ctx=resultTable.getAttribute(g_EntityEditorResultTableAttrEditorId);
	EntityEditorCallback(xml,ctx);
}
function PickerResultsSingleSelectOnDblClick(row)
{
	var resultTable=document.getElementById(g_EntityEditorResultTableId);
	var xml=row.getAttribute('entityXml');
	var ctx=resultTable.getAttribute(g_EntityEditorResultTableAttrEditorId);
	EntityEditorCallback(xml,ctx);
	if (self.doClickOK !=null && typeof(self.doClickOK)=="function")
		doClickOK();
}
function PickerResultsMultiSelectOnNameClick(link, evt)
{
	var row=link;
	while (row.tagName !="TR")
	{
		row=row.parentNode;
	}
	PickerResultsMultiSelectOnDblClick(row);
	return true;
}
function PickerResultsSingleSelectOnNameClick(link, evt)
{
	var row=link;
	while (row.tagName !="TR")
	{
		row=row.parentNode;
	}
	PickerResultsSingleSelectOnDblClick(row);
	return true;
}
function PickerResultsNameOnFocus(link)
{
	var row=link;
	while (row.tagName !="TR")
	{
		row=row.parentNode;
	}
	addSelection(row, true, false);
	lastSelected=row;
}
function PickerResultsNameOnKeyDown(link, evt)
{
	if (evt !=null && evt.keyCode==13)
	{
		return false;
	}
	return true;
}
function MSOWebPartPage_GetLocalizedStrings()
{
	var L_ResetPagePersonalizationDialog_TXT="You are about to reset all personalized Web Parts to their shared values and delete any private Web Parts. Click OK to complete this operation. Click Cancel to keep your personalized Web Part settings and private Web Parts.";
	var L_ResetPartPersonalizationDialog_TXT="Resetting this Web Part will cause you to lose any changes you made.  Are you sure you want to do this? To reset this Web Part, click OK. To keep your changes, click Cancel.";
	var L_RemoveConnection_TXT="Are you sure you want to remove the connection between the %0 Web Part and the %1 Web Part? To remove the connection, click OK. To keep the connection, click Cancel.";
	var L_ExportPersonalization_TXT="This Web Part Page has been personalized. As a result, one or more Web Part properties may contain confidential information. Make sure the properties contain information that is safe for others to read. After exporting this Web Part, view properties in the Web Part description file (.webpart or .dwp) by using a text editor, such as Microsoft Notepad.";
	var L_GetPropertiesFailure_ERR="Cannot retrieve properties at this time.";
	var L_SaveDirtyParts_TXT="Changes have been made to the contents of one or more Web Parts on this page. To save the changes, press OK.  To discard the changes, press Cancel.";
	var L_ToolPaneWidenToolTip_TXT="Widen";
	var L_ToolPaneShrinkToolTip_TXT="Narrow";
	var L_ToolPartExpandToolTip_TXT="Expand Toolpart: %0";
	var L_ToolPartCollapseToolTip_TXT="Collapse Toolpart: %0";
	var L_WebPartBackgroundColor_TXT="Web Part Background Color";
	var L_TransparentTooltip_TXT="Transparent Web Part Background Color";
	var L_InvalidURLPath_ERR="The URL is not valid for the %0 property. Check the URL spelling and path and try again.";
	var L_InvalidFolderPath_ERR="The path to the folder is not valid for the %0 property. Check the path name and try again.";
	var L_InvalidFilePath_ERR="The path to the file or folder is not valid. Check the path and try again.";
	var L_FileOrFolderUnsupported_ERR="The current browser does not support links to files or folders. To specify a link to a file or folder, you must use Microsoft Internet Explorer 5.0 or later";
	var L_Link_TXT="Link";
	var L_TransparentLiteral_TXT="Transparent";
	var L_ContentEditorSaveFailed_ERR="Cannot save your changes.";
	var L_AccessDenied_ERR="Access Denied saving Web Part properties: either the Web Part is embedded directly in the page, or you do not have sufficient permissions to save properties.";
	var L_NoInitArgs_ERR="Cannot create or modify the connection. One of the Web Parts does not have any data fields.";
	var s=new Object();
	s.ResetPagePersonalizationDialogText=L_ResetPagePersonalizationDialog_TXT;
	s.ResetPartPersonalizationDialogText=L_ResetPartPersonalizationDialog_TXT;
	s.RemoveConnection=L_RemoveConnection_TXT;
	s.ExportPersonalizationDialogText=L_ExportPersonalization_TXT;
	s.GetPropertiesFailure=L_GetPropertiesFailure_ERR;
	s.SaveDirtyPartsDialogText=L_SaveDirtyParts_TXT;
	s.ToolPaneWidenToolTip=L_ToolPaneWidenToolTip_TXT
	s.ToolPaneShrinkToolTip=L_ToolPaneShrinkToolTip_TXT;
	s.ToolPartExpandToolTip=L_ToolPartExpandToolTip_TXT;
	s.ToolPartCollapseToolTip=L_ToolPartCollapseToolTip_TXT;
	s.WebPartBackgroundColor=L_WebPartBackgroundColor_TXT;
	s.TransparentTooltip=L_TransparentTooltip_TXT;
	s.InvalidURLPath=L_InvalidURLPath_ERR;
	s.InvalidFolderPath=L_InvalidFolderPath_ERR;
	s.InvalidFilePath=L_InvalidFilePath_ERR;
	s.FileOrFolderUnsupported=L_FileOrFolderUnsupported_ERR;
	s.Link=L_Link_TXT;
	s.TransparentLiteral=L_TransparentLiteral_TXT;
	s.ContentEditorSaveFailed=L_ContentEditorSaveFailed_ERR;
	s.AccessDenied=L_AccessDenied_ERR;
	s.NoInitArgs=L_NoInitArgs_ERR;
	return s;
}
var MSOStrings=MSOWebPartPage_GetLocalizedStrings();
var L_AccessibleMenu_Text="Menu";
function FNEmpWz(wz)
{
	return (wz&&wz!="");
}
function AChld(p,c)
{
	if(p&&c)p.appendChild(c);
}
function AImg(mi,wzISrc,wzIAlt)
{
	if(!mi)return;
	if(FNEmpWz(wzISrc))mi.setAttribute("iconSrc",wzISrc);
	if(FNEmpWz(wzIAlt))
		mi.setAttribute("iconAltText",wzIAlt);
	else
		mi.setAttribute("iconAltText","");
}
function CMenu(wzID)
{
	var m=document.getElementById(wzID);
	if (m)
	{
		m._initialized=false;
		m._oContents=null;
		m.innerHTML="";
		return m;
	}
	m=document.createElement("MENU");
	if(!m)return null;
	if(wzID)m.id=wzID;
	m.className="ms-SrvMenuUI";
	AChld(document.body,m);
	return m;
}
function CMItm(wzType)
{
	var mi=document.createElement("SPAN");
	if(!mi)return null;
	mi.setAttribute("type",wzType);
	return mi;
}
function SetInnerText(oNode, wzText)
{
	if (document.createTextNode !=null)
	{
		var parsedText=document.createTextNode(wzText);
		oNode.innerHTML="";
		oNode.appendChild( parsedText );
	}
	else
	{
		oNode.innerText=wzText;
	}
}
function CMOpt(wzText,wzAct,wzISrc,wzIAlt,wzISeq,wzDesc)
{
	var mo=CMItm("option");
	if(!mo)return null;
	mo.setAttribute("text", wzText);
	mo.setAttribute("onMenuClick", wzAct);
	if (wzDesc)mo.setAttribute("description", wzDesc);
	AImg(mo,wzISrc,wzIAlt);
	if(FNEmpWz(wzISeq))mo.setAttribute("sequence",wzISeq);
	return mo;
}
function CAMOpt(p,wzText,wzAct,wzISrc,wzIAlt,wzISeq,wzDesc)
{
	var mo=CMOpt(wzText,wzAct,wzISrc,wzIAlt,wzISeq,wzDesc);
	if(!mo)return null;
	AChld(p,mo);
	return mo;
}
function CIMOpt(p,wzText,wzAct,wzISrc,wzIAlt,wzISeq)
{
	var mo=CMOpt(wzText,wzAct,wzISrc,wzIAlt,wzISeq);
	if(!mo)return null;
	for (var i=0;i<p.childNodes.length;i++)
	{
		var iSeq=p.childNodes[i].getAttribute("sequence");
		if (iSeq)
		{
			if (iSeq > wzISeq)
			{
				p.childNodes[i].parentNode.insertBefore(mo, p.childNodes[i]);
				return mo;
			}
		}
	}
	AChld(p,mo);
	return mo;
}
function CMSep()
{
	var sep=CMItm("separator");
	SetInnerText(sep, "");
	return sep;
}
function CAMSep(p)
{
	var ms=CMSep();
	if(!ms)return null;
	AChld(p,ms);
	return ms;
}
function CSubM(wzText,wzISrc,wzIAlt,wzISeq,wzDesc)
{
	var sm=CMItm("submenu");
	if(!sm)return null;
	sm.setAttribute("text", wzText);
	if (wzDesc)sm.setAttribute("description", wzDesc);
	AImg(sm,wzISrc,wzIAlt);
	if(FNEmpWz(wzISeq))sm.setAttribute("sequence",wzISeq);
	return sm;
}
function CASubM(p,wzText,wzISrc,wzIAlt,wzISeq,wzDesc)
{
	var sm=CSubM(wzText,wzISrc,wzIAlt,wzISeq,wzDesc);
	if(!sm)return null;
	AChld(p,sm);
	return sm;
}
function FRdy(o)
{
	if (!o) return false;
	if (o.readyState==null)
		return true;
	switch (o.readyState)
		{
		case "loaded": case "interactive": case "complete": return true;
		default: return false;
		}
}
function OMenu(m,r,fr,ft,yoff)
{
	if(typeof(m)=="string")m=document.getElementById(m);
	if(m)
		{
			OMenuInt(m,r,fr,ft,yoff);
		}
	return false;
}
function OMenuInt(m,r,fr,ft,yoff)
{
	if(m&&!MenuHtc_isOpen(m)) MenuHtc_show(m,r,fr,ft,yoff);
}
function OMenuEvnt()
{
	var m=event.srcElement;
	if(m&&FRdy(document)&&FRdy(m))
		{
		var r=m.getAttribute("relativeTo");
		var fr=m.getAttribute("forceRefresh");
		var ft=m.getAttribute("flipTop");
		var yoff=m.getAttribute("yOffsetTop");
		if(r!=null)m.removeAttribute("relativeTo");
		if(fr!=null)m.removeAttribute("forceRefresh");
		if(ft!=null)m.removeAttribute("flipTop");
		if(yoff!=null)m.removeAttribute("yOffsetTop");
		m.onreadystatechange=null;
		OMenuInt(m,r,fr,ft,yoff);
		}
}
var kfnDisableEvent=new Function("return false");
var g_menuHtc_lastMenu=null;
var g_uniqueNumber=0;
function IsAccessibilityFeatureEnabledProxy()
{
	if (typeof(IsAccessibilityFeatureEnabled) !="undefined")
		return IsAccessibilityFeatureEnabled();
	return false;
}
function MenuHtc_show(oMaster, oParent, fForceRefresh, fFlipTop, yOffset)
{
	if (!(browseris.ie55up || browseris.nav6up || browseris.safari125up))
		return false;
	MenuHtc_hide();
	MenuHtc_init(oMaster);
	oMaster._oParent=oParent;
	oMaster._fIsRtL=IsElementRtl(oMaster._oParent);
	if ((browseris.ie || browseris.nav) && IsAccessibilityFeatureEnabledProxy())
	{
		var menu=null;
		if(oParent.foa !=null)
		{
			menu=byid(oParent.foa);			
			if(menu==null)
			{
				menu=eval(oParent.foa);	
			}
		}
		if (menu !=null && menu.onblur !=null)
		{
			menu.onblur();
		}
		RenderAccessibleMenu(oMaster, fForceRefresh);
		g_menuHtc_lastMenu=oMaster;
	}
	else
	{
		SetBodyEventHandlers(null);
		AssureId(oParent);
		var result=ShowRoot(oMaster, oParent, fForceRefresh, fFlipTop, yOffset);
		g_menuHtc_lastMenu=oMaster;
		NavigateToMenu(oMaster);
		SetBodyEventHandlers(HandleDocumentBodyClick);
	}
	if (browseris.ie)
	{
		if (window.event !=null)
			window.event.cancelBubble=true;
	}
	return false;
}
function MenuHtc_hide()
{
	ClearTimeOutToHideMenu();
	var oMaster=g_menuHtc_lastMenu;
	if (oMaster !=null)
	{
		if (oMaster._accessibleMenu !=null)
		{
			CloseAccessibleMenu(oMaster);
		}
		else
		{
			HideMenu(oMaster);
		}
	}
	g_menuHtc_lastMenu=null;
}
function MenuHtc_isOpen(oMaster)
{
	if (!oMaster || !oMaster._initialized)
		return false;
	var result=IsOpen(oMaster);
	return result;
}
function MenuHtc_item(oMaster, nLevel, nIndex)
{
	MenuHtc_init(oMaster);
	var result=GetItem(oMaster, nLevel, nIndex);
	return result;
}
function TrapMenuClick(e)
{
	if (e !=null)
		e.cancelBubble=true;
	return false;
}
function SetBodyEventHandlers(h)
{
	document.body.onclick=h;
}
function HandleDocumentBodyClick(e)
{
	if (g_menuHtc_lastMenu !=null)
	{
		var oMaster=g_menuHtc_lastMenu;
		if (oMaster !=null)
		{
			HideMenu(oMaster);
		}
	}
	return false;
}
function GetEventPopup(e)
{
	var obj=GetEventSrcElement(e);
	while (obj !=null)
	{
		if (obj.master !=null)
			return obj;
		obj=obj.parentNode;
	}
	return null;
}
function GetUniqueNumber()
{
	g_uniqueNumber++;
	return g_uniqueNumber;
}
function MenuHtc_init(oMaster)
{
	if (oMaster._initialized)
		return;
	oMaster._initialized=true;
	oMaster._wzPrefixID="mp"+GetUniqueNumber();
	if (oMaster.id==null)
		oMaster.id=oMaster._wzPrefixID+"_id";
	oMaster._nLevel=0;
	oMaster._arrPopup=new Array();
	oMaster._arrSelected=new Array();
	if (typeof(oMaster._onDestroy)=="undefined")
		oMaster._onDestroy=null;
	oMaster._fLargeIconMode=false;
	oMaster._fCompactItemsWithoutIcons=false;
}
function PrepContents(oMaster)
{
	oMaster._fLargeIconMode=(oMaster.getAttribute("largeIconMode")=="true");
	oMaster._fCompactItemsWithoutIcons=(oMaster.getAttribute("CompactMode")=="true");
	if (!browseris.safari)
	{
		oMaster._oContents=document.createElement("span");
		oMaster._oContents.style.display="none";
		oMaster._oContents.innerHTML=oMaster.innerHTML;
	}
	else
	{
		oMaster._oContents=oMaster.cloneNode(true);
		oMaster._oContents.style.display="none";
	}
	if (oMaster._fLargeIconMode)
	{
		if (oMaster._fIsRtL)
			oMaster._wzMenuStyle="ms-MenuUILargeRtL";
		else
			oMaster._wzMenuStyle="ms-MenuUILarge";
	}
	else
	{
		if (oMaster._fIsRtL)
			oMaster._wzMenuStyle="ms-MenuUIRtL";
		else
			oMaster._wzMenuStyle="ms-MenuUI";
	}
	oMaster._wzChkMrkPath="/_layouts/images/ChkMrk.gif";
	oMaster._wzMArrPath="/_layouts/images/MArr.gif";
	oMaster._wzMArrPathRtL="/_layouts/images/MArrRtL.gif";
}
function FixUpMenuStructure(oMaster)
{
	var menuNodes=oMaster._oRoot.childNodes;
	var lastGroupId=null;
	var lastMenuSeparatorRow=null;
	for (var nIndex=0; nIndex < menuNodes.length; nIndex++)
	{
		var menuRow=menuNodes[nIndex];
		if (menuRow.nodeType !=1)
			continue;
		var deleteRow=false;
		var displayNone=menuRow.style !=null && menuRow.style.display=='none';
		var jsHidden=FIsIHidden(menuRow);
		if (displayNone || jsHidden)
		{
			deleteRow=true;
		}
		else if (FIsIType(menuRow, "separator"))
		{
			if (lastMenuSeparatorRow !=null || nIndex==0)
				deleteRow=true;
			else
				lastMenuSeparatorRow=menuRow;
		}
		else
		{
			var cGroupId=menuRow.getAttribute("menuGroupId");
			if (cGroupId !=lastGroupId &&
				lastMenuSeparatorRow==null &&
				nIndex !=0)
			{
				var lastMenuSeparatorRow=document.createElement("ie:menuitem");
				lastMenuSeparatorRow.setAttribute("type","separator");
				oMaster._oRoot.insertBefore(lastMenuSeparatorRow,menuRow);
			}
			else if (FIsIType(menuRow, "submenu") && lastMenuSeparatorRow !=null)
			{
				menuRow.parentNode.removeChild(lastMenuSeparatorRow);
				lastMenuSeparatorRow=null;
			}
			else
			{
				lastMenuSeparatorRow=null;
			}
			lastGroupId=cGroupId;
		}
		if (deleteRow)
		{
			menuRow.parentNode.removeChild(menuRow);
			nIndex--;
		}
	}
	if(lastMenuSeparatorRow !=null)
		lastMenuSeparatorRow.parentNode.removeChild(lastMenuSeparatorRow);
}
function IsElementRtl(oCurrent)
{
	while (oCurrent !=null && oCurrent.tagName !=null)
	{
		var dir=oCurrent.getAttribute("dir");
		if ((dir==null || dir=="") && oCurrent.style !=null)
		{
			dir=oCurrent.style.direction;
		}
		if (dir=="rtl")
			return true;
		else if (dir=="ltr")
			return false;
		oCurrent=oCurrent.parentNode;
	}
	return false;
}
function AdjustScrollPosition(element, relativeToElement, result)
{
	var oCurrent=element;
	while (oCurrent !=null &&
		oCurrent !=relativeToElement &&
		oCurrent !=element.offsetParent &&
		oCurrent.tagName !=null &&
		oCurrent.tagName.toLowerCase() !="body" &&
		oCurrent.tagName.toLowerCase() !="html")
	{
		if (oCurrent.scrollWidth > oCurrent.clientWidth &&
			oCurrent.offsetWidth >=oCurrent.clientWidth &&
			oCurrent.clientWidth !=0)
		{
			if (!IsElementRtl(oCurrent))
			{
				if (oCurrent.scrollLeft > 0)
					result.x -=oCurrent.scrollLeft;
			}
			else
			{
				result.x+=(oCurrent.scrollWidth - oCurrent.offsetWidth - oCurrent.scrollLeft);
			}
		}
		if (oCurrent.scrollTop > 0)
			result.y -=oCurrent.scrollTop;
		oCurrent=oCurrent.parentNode;
	}
}
function MenuHtc_GetElementPosition(element, relativeToElement)
{
	var result=new Object();
	result.x=0;
	result.y=0;
	result.width=0;
	result.height=0;
	if (element.offsetParent) {
		var parent=element;
		while (parent !=null &&
			parent !=relativeToElement)
		{
			result.x+=parent.offsetLeft;
			result.y+=parent.offsetTop;
			AdjustScrollPosition(parent, relativeToElement, result);
			var parentTagName=parent.tagName.toLowerCase();
			if (parentTagName !="table" &&
				parentTagName !="body" &&
				parentTagName !="html" &&
				parentTagName !="div" &&
				parent.clientTop &&
				parent.clientLeft) {
				result.x+=parent.clientLeft;
				result.y+=parent.clientTop;
			}
			if (browseris.ie && parentTagName=="td")
			{
				if (parent.runtimeStyle.borderTopStyle !="none" ||
				    parent.currentStyle.borderTopStyle !="none")
				{
					var shift;
					if (parent.runtimeStyle.borderTopWidth !="")
					{
						shift=parseInt(parent.runtimeStyle.borderTopWidth);
					}
					else
					{
						shift=parseInt(parent.currentStyle.borderTopWidth);
					}
					if (!isNaN(shift))
					{
						result.y+=shift;
					}
				}
				if (parent.runtimeStyle.borderLeftStyle !="none" ||
				    parent.currentStyle.borderLeftStyle !="none")
				{
					var shift;
					if (parent.runtimeStyle.borderLeftWidth !="")
					{
						shift=parseInt(parent.runtimeStyle.borderLeftWidth);
					}
					else
					{
						shift=parseInt(parent.currentStyle.borderLeftWidth);
					}
					if (!isNaN(shift))
					{
						result.x+=shift;
					}
				}
			}
			parent=parent.offsetParent;
		}
	}
	else if (element.left && element.top) {
		result.x=element.left;
		result.y=element.top;
	}
	else {
		if (element.x) {
			result.x=element.x;
		}
		if (element.y) {
			result.y=element.y;
		}
	}
	if (element.offsetWidth && element.offsetHeight) {
		result.width=element.offsetWidth;
		result.height=element.offsetHeight;
	}
	else if (element.style && element.style.pixelWidth && element.style.pixelHeight) {
		result.width=element.style.pixelWidth;
		result.height=element.style.pixelHeight;
	}
	return result;
}
function MenuHtcInternal_Show(oMaster, oParent, y, fFlipTop)
{
	var oPopup=oMaster._arrPopup[oMaster._nLevel];	
	var nIndex;							
	var fTopLevel;							
	var oInnerDiv;
	if (!oMaster._oContents) PrepContents(oMaster);
	if (!oMaster._oContents || IsOpen(oMaster)) return;
	if (!oPopup && !oMaster._oRoot)
		{
		oMaster._nLevel=0;
		oMaster._oRoot=oMaster._oContents;
		}
	fTopLevel=oMaster._nLevel==0;
	fFlipTop=fFlipTop && fTopLevel;
	if (!oPopup)
	{
		oMaster._arrPopup[oMaster._nLevel]=document.createElement("DIV");
		oPopup=oMaster._arrPopup[oMaster._nLevel];
		oPopup.isMenu=true;
		oPopup.master=oMaster;
		oPopup.level=oMaster._nLevel;
		oInnerDiv=document.createElement("DIV");
		var oTable=document.createElement("table");
		var oTBody=document.createElement("tbody");
		oInnerDiv.isInner=true;
		oPopup.style.position="absolute";
		oInnerDiv.style.overflow="visible";
		oTable.appendChild(oTBody);
		oInnerDiv.appendChild(oTable);
		oPopup.appendChild(oInnerDiv);
		if (oMaster._fIsRtL)
			oPopup.setAttribute("dir", "rtl");
		else
			oPopup.setAttribute("dir", "ltr");
		document.body.appendChild(oPopup);
		FixUpMenuStructure(oMaster);
		var id=0;
		var childNodeLength=oMaster._oRoot.childNodes.length;
		for (nIndex=0; nIndex < childNodeLength; nIndex++)
		{
			var oNode=oMaster._oRoot.childNodes[nIndex];
			if (oNode.nodeType !=1)
				continue;
			if (!FIsIType(oNode, "label"))
			{
				var oItem=CreateMenuItem(oMaster, oNode, MakeID(oMaster, oMaster._nLevel, id));
				if (oItem) oTBody.appendChild(oItem);
				id++;
			}
		}
		oPopup.className="ms-MenuUIPopupBody";
		oTable.className=oMaster._wzMenuStyle;
		oTable.cellSpacing=0;
		oTable.cellPadding=0;
		oPopup.oncontextmenu=kfnDisableEvent;
		oPopup.ondragstart=kfnDisableEvent;
		oPopup.onselectstart=kfnDisableEvent;
		if (oParent._onmouseover==null)
			oParent._onmouseover=oParent.onmouseover;
		if (oParent._onmouseout==null)
			oParent._onmouseout=oParent.onmouseout;
		if (oParent._onmousedown==null)
			oParent._onmousedown=oParent.onmousedown;
		if (oParent._onclick==null)
			oParent._onclick=oParent.onclick;
		if (browseris.nav)
		{
			oPopup.onkeypress=function(e) {return false; };
			oPopup.onkeyup=function(e) {return false; };
			oPopup.onkeydown=function(e) {PopupKeyDown(e); return false; };
			oPopup.onmousedown=function(e) {TrapMenuClick(e); return false; };
			oPopup.onmouseover=function(e) {PopupMouseOver(e); return false; };
			oPopup.onmouseout=function(e) {PopupMouseLeave(e); return false; };
			oPopup.onclick=function(e) {PopupMouseClick(e); TrapMenuClick(e); return false; };
			oParent.onmouseover=function (e) {PopupMouseOverParent(e); return false; };
			oParent.onmouseout=function(e) {PopupMouseLeaveParent(e); return false; };
			oParent.onmousedown=function(e) {TrapMenuClick(e); return false; };
			oParent.onclick=function(e) {TrapMenuClick(e); return false; };
			oParent.oncontextmenu=function(e) {TrapMenuClick(e); return false; };
		}
		else
		{
			oPopup.onkeydown=new Function("PopupKeyDown(event); return false;");
			oPopup.onmousedown=new Function("TrapMenuClick(event); return false;");
			oPopup.onmouseover=new Function("PopupMouseOver(event); return false;");
			oPopup.onmouseout=new Function("PopupMouseLeave(event); return false;");
			oPopup.onclick=new Function("PopupMouseClick(event); TrapMenuClick(event); return false;");
			oParent.onmouseover=new Function("PopupMouseOverParent(event); return false;");
			oParent.onmouseout=new Function("PopupMouseLeaveParent(event); return false;");
			oParent.onmousedown=new Function("TrapMenuClick(event); return false;");
			oParent.onclick=new Function("TrapMenuClick(event); return false;");
			oParent.oncontextmenu=new Function("TrapMenuClick(event); return false;");
		}
		if (fTopLevel)
		{
			var wzOnUnload=oMaster.getAttribute("onunloadtext");
			if (wzOnUnload) oPopup.onunload=new Function(wzOnUnload);
		}
	}
	else
	{
		var oOld=oMaster._arrSelected[oMaster._nLevel];
		if (oOld) UnselectItem(oOld);
	}
	oMaster._arrSelected[oMaster._nLevel]=null;
	var oBackFrame;
	if (browseris.ie)
	{
		var originalScrollLeft=document.body.scrollLeft;
		oBackFrame=document.createElement("iframe");
		AssureId(oBackFrame);
		oBackFrame.src="/_layouts/blank.htm";
		oBackFrame.style.position="absolute";
		oBackFrame.style.display="none";
		oBackFrame.scrolling="no";
		oBackFrame.frameBorder="0";
		document.body.appendChild(oBackFrame);
		oPopup.style.zIndex=103;
		oPopup._backgroundFrameId=oBackFrame.id;
		if (originalScrollLeft !=document.body.scrollLeft)
		{
			document.body.scrollLeft=originalScrollLeft;
		}
	}
	SetMenuPosition(oMaster, oParent, oPopup, oInnerDiv, fFlipTop, fTopLevel);
	if (browseris.ie)
	{
		SetBackFrameSize(null, oPopup);
		oPopup.onresize=new Function("SetBackFrameSize(event, null);");
		oBackFrame.style.display="block";
		oBackFrame.style.zIndex=101;
	}
}
function SetMenuPosition(oMaster, oParent, oPopup, oInnerDiv, fFlipTop, fTopLevel)
{
	var maxWidth=window.screen.width;
	var maxHeight=window.screen.height;
	if (browseris.nav)
	{
		maxWidth=document.body.clientWidth;
		maxHeight=document.body.clientHeight;
	}
	else if (self.innerHeight)
	{
		maxWidth=self.innerWidth;
		maxHeight=self.innerHeight;
	}
	else if (document.documentElement && document.documentElement.clientHeight)
	{
		maxWidth=document.documentElement.clientWidth;
		maxHeight=document.documentElement.clientHeight;
	}
	else if (document.body)
	{
		maxWidth=document.body.clientWidth;
		maxHeight=document.body.clientHeight;
	}
	var nRealWidth=oPopup.scrollWidth+oPopup.offsetWidth - oPopup.clientWidth;
	var nRealHeight=oPopup.scrollHeight+oPopup.offsetHeight - oPopup.clientHeight;
	var widthTooBig=false;
	var heightTooBig=false;
	if (nRealWidth > maxWidth - 50)
	{
		widthTooBig=true;
		nRealWidth=maxWidth - 50;
	}
	if (oMaster._fCompactItemsWithoutIcons && nRealHeight >=375)
	{
		heightTooBig=true;
		nRealHeight=375;
	}
	if (nRealHeight >=maxHeight - 50)
	{
		heightTooBig=true;
		nRealHeight=maxHeight - 50;
	}
	if (!widthTooBig && !heightTooBig)
	{
		oInnerDiv.style.overflow="visible";
	}
	else
	{
		if (browseris.ie)
		{
			if (widthTooBig)
			{
				oPopup.style.width=nRealWidth+"px";
				oInnerDiv.style.width=nRealWidth+"px";
				oInnerDiv.style.overflowX="scroll";
			}
			else
			{
				oInnerDiv.style.width=nRealWidth+"px";
				oInnerDiv.style.overflowX="visible";
			}
			if (heightTooBig)
			{
				oPopup.style.height=nRealHeight+"px";
				oInnerDiv.style.height=nRealHeight+"px";
				oInnerDiv.style.overflowY="scroll";
			}
			else
			{
				oInnerDiv.style.height=nRealHeight+"px";
				oInnerDiv.style.overflowY="visible";
			}
		}
		else
		{
			oPopup.style.height=nRealHeight+"px";
			oInnerDiv.style.height=nRealHeight+"px";
			oPopup.style.width=nRealWidth+"px";
			oInnerDiv.style.width=nRealWidth+"px";
			oInnerDiv.style.overflow="auto";
		}
	}
	nRealWidth=oPopup.scrollWidth+oPopup.offsetWidth - oPopup.clientWidth;
	nRealHeight=oPopup.scrollHeight+oPopup.offsetHeight - oPopup.clientHeight;
	var EdgeLeft=0;
	var EdgeRight=maxWidth;
	var ParentLeft=0;
	var EdgeTop=0;
	var ParentTop=0;
	var oCurrent=oParent;
	if (browseris.safari)
	{
		if (oCurrent.tagName=="TR" && oCurrent.childNodes.length > 0)
			oCurrent=oCurrent.childNodes[0];
	}
	var p=MenuHtc_GetElementPosition(oCurrent);
	ParentLeft=p.x;
	ParentTop=p.y;
	var nParentWidth;
	if (fTopLevel)
	{
		nParentWidth=p.width;
		ParentTop+=p.height;
		ParentTop -=1;
	}
	else
	{
		nParentWidth=p.width+1;
	}
	var fTryGoDefault=!fFlipTop && !document.body.getAttribute("flipped");
	var fFlippedDefault, fFlippedNonDefault;
	var xDefault, xFlipped;
	if (!oMaster._fIsRtL)
	{
		var MenuRightDefault;
		var MenuLeftFlipped;
		if (fTopLevel)
		{
			xDefault=ParentLeft;
			MenuRightDefault=ParentLeft+nRealWidth;
			MenuLeftFlipped=ParentLeft+nParentWidth - nRealWidth;
		}
		else
		{
			xDefault=ParentLeft+nParentWidth;
			MenuRightDefault=ParentLeft+nParentWidth+nRealWidth;
			MenuLeftFlipped=ParentLeft - nRealWidth;
		}
		xFlipped=MenuLeftFlipped;
		fFlippedDefault=MenuRightDefault > EdgeRight && MenuLeftFlipped > EdgeLeft;
		fFlippedNonDefault=!(MenuLeftFlipped < EdgeLeft && MenuRightDefault < EdgeRight);
	}
	else
	{
		var MenuLeftDefault;
		var MenuRightFlipped;
		if (fTopLevel)
		{
			MenuLeftDefault=ParentLeft+nParentWidth - nRealWidth;
			MenuRightFlipped=ParentLeft+nRealWidth;
			xFlipped=ParentLeft;
		}
		else
		{
			MenuLeftDefault=ParentLeft - nRealWidth;
			MenuRightFlipped=ParentLeft+nParentWidth+nRealWidth;
			xFlipped=ParentLeft+nParentWidth;
		}
		xDefault=MenuLeftDefault;
		fFlippedDefault=MenuLeftDefault < EdgeLeft && MenuRightFlipped < EdgeRight;
		fFlippedNonDefault=!(MenuRightFlipped > EdgeRight && MenuLeftDefault > EdgeLeft);
	}
	var fFlipped=fTryGoDefault ? fFlippedDefault : fFlippedNonDefault;
	var x=fFlipped ? xFlipped : xDefault;
	var xOffset;
	var yOffset;
	if (browseris.nav)
	{
		xOffset=window.pageXOffset;
		yOffset=window.pageYOffset;
	}
	else
	{
		var htmlElement=document.body.parentElement;
		if (!IsElementRtl(document.body))
		{
			xOffset=document.body.scrollLeft;
			xOffset+=htmlElement.scrollLeft;
		}
		else
		{
			xOffset=-document.body.scrollWidth+document.body.offsetWidth+document.body.scrollLeft;
			xOffset+=-htmlElement.scrollWidth+htmlElement.offsetWidth+htmlElement.scrollLeft;
		}
		yOffset=document.body.scrollTop;
		yOffset+=htmlElement.scrollTop;
	}
	if (nRealWidth >=maxWidth)
	{
		x=xOffset;
	}
	else if (x - xOffset+nRealWidth >=maxWidth)
	{
		x=xOffset+maxWidth - nRealWidth;
	}
	var y;
	if (nRealHeight >=maxHeight)
	{
		y=yOffset;
	}
	else if (ParentTop+nRealHeight - yOffset >=maxHeight)
	{
		y=yOffset+maxHeight - nRealHeight;
	}
	else
	{
		y=ParentTop;
	}
	oPopup.setAttribute("flipped", fFlipTop ? fFlipped && fFlippedDefault : fFlipped);
	var posLeft=Math.max(x,xOffset);
	var posTop=Math.max(y,yOffset);
	oPopup.style.left=posLeft+"px";
	oPopup.style.top=posTop+"px";
}
function SetBackFrameSize(e, oPopup)
{
	if (oPopup==null)
		oPopup=GetEventSrcElement(e);
	var nRealWidth=oPopup.scrollWidth+oPopup.offsetWidth - oPopup.clientWidth;
	var nRealHeight=oPopup.scrollHeight+oPopup.offsetHeight - oPopup.clientHeight;
	var oBackFrame=document.getElementById(oPopup._backgroundFrameId);
	oBackFrame.style.left=oPopup.offsetLeft+"px";
	oBackFrame.style.top=oPopup.offsetTop+"px";
	oBackFrame.style.width=nRealWidth+"px";
	oBackFrame.style.height=nRealHeight+"px";
}
function HideMenu(oMaster, nPhase)
{
	ClearTimeOutToHideMenu();
	if (nPhase==null)
		nPhase=0;
	if (nPhase==2)
	{
		if (oMaster._onDestroy !=null)
		{
			oMaster._onDestroy();
			oMaster._onDestroy=null;
		}
		return;
	}
	if (IsOpen(oMaster) && !IsAccessibilityFeatureEnabledProxy())
	{
		if (oMaster._oParent !=null)
		{
			oMaster._oParent.onclick=oMaster._oParent._onclick;
			oMaster._oParent.onmouseover=oMaster._oParent._onmouseover;
			oMaster._oParent.onmouseout=oMaster._oParent._onmouseout;
			oMaster._oParent.onmousedown=oMaster._oParent._onmousedown;
		}
		SetBodyEventHandlers(null);
		UpdateLevel(oMaster, 0);
		var oPopup=oMaster._arrPopup[0];
		if (oPopup !=null)
		{
			var oBackFrame=document.getElementById(oPopup._backgroundFrameId);
			if (oBackFrame !=null)
				oBackFrame.parentNode.removeChild(oBackFrame);
			oPopup.parentNode.removeChild(oPopup);
			oMaster._arrPopup[0]=null;
			if (nPhase==0)
			{
				if (oMaster._onDestroy !=null)
				{
					oMaster._onDestroy();
					oMaster._onDestroy=null;
				}
			}
		}
		g_menuHtc_lastMenu=null;
	}
}
function IsOpen(oMaster)
{
	if (oMaster._accessibleMenu && !oMaster._accessibleMenu.closed)
		return true;
	if (!oMaster._arrPopup)
		return false;
	var oPopup=oMaster._arrPopup[oMaster._nLevel];
	return oPopup;
}
function FindLabel(oParent)
{
	var arrNodes=oParent ? oParent.childNodes : null;
	if (arrNodes)
		{
		for (var nIndex=0; nIndex < arrNodes.length; nIndex++)
			{
			var oNode=arrNodes[nIndex];
			if (oNode.nodeType !=1)
				continue;
			if (FIsIType(oNode, "label")) return oNode;
			}
		}
	return null;
}
function ShowRoot(oMaster, oParent, fForceRefresh, fFlipTop, yOffset)
{
	UpdateLevel(oMaster, 0);
	if (fForceRefresh)
		{
		oMaster._oContents=null;
		oMaster._oRoot=null;
		oMaster._nLevel=0;
		oMaster._arrPopup=new Array();
		oMaster._arrSelected=new Array();
		}
	else
		{
		oMaster._oRoot=oMaster._oContents;
		}
	var y=0;
	if (oParent) y+=oParent.offsetHeight;
	if (browseris.safari)
	{
		if (oParent.tagName=="TR" && oParent.childNodes.length > 0)
		{
			y+=(oParent.childNodes[0].offsetTop+oParent.childNodes[0].offsetHeight
				- oParent.offsetTop);
		}
	}
	if (yOffset) y+=yOffset;
	fFlipTop=fFlipTop !=false;
	MenuHtcInternal_Show(oMaster, oParent, y, fFlipTop);
}
function ShowSubMenu(oMaster, nLevel, oParent)
{
	if (!oParent) return;
	if (oParent.submenuRoot==null) return;
	UpdateLevel(oMaster, nLevel);
	oMaster._oRoot=oParent.submenuRoot;
	oMaster._nLevel=oMaster._nLevel+1;
	MenuHtcInternal_Show(oMaster, oParent, -1);
}
function ShowSubMenuEvnt(id)
{
	var oMaster=document.getElementById(id);
	var oPopup=oMaster._arrPopup[oMaster._nLevel];
	if (oPopup)
		{
		oPopup.removeAttribute("timeoutID");
		ShowSubMenu(oMaster, oMaster._nLevel, oMaster._arrSelected[oMaster._nLevel]);
		}
}
function SetShowSubMenuEvnt(oMaster)
{
	var oPopup=oMaster._arrPopup[oMaster._nLevel];
	if (oPopup)
	{
		ClearTimeOut("timeoutID");
		document.body.setAttribute("timeoutID", window.setTimeout(new Function("ShowSubMenuEvnt('"+oMaster.id+"');"), 100));
	}
}
function ClearTimeOut(oAttribute)
{
	var id=document.body.getAttribute(oAttribute);
	if (id !=null)
	{
		window.clearTimeout(id);
	}
	document.body.removeAttribute(oAttribute);
}
function ClearShowSubMenuEvnt(oPopup)
{
	ClearTimeOut("timeoutID");
}
function GetEventSrcItem(oMaster, srcElement)
{
	for (var oSrc=srcElement;
		oSrc && !FIStringEquals(oSrc.tagName, "BODY");
		oSrc=oSrc.parentNode)
	{
		if (FIStringEquals(oSrc.tagName, "TR") &&
			oSrc.id.substring(0, oMaster._wzPrefixID.length)==oMaster._wzPrefixID)
		{
			return oSrc;
		}
	}
	return null;
}
function UpdateLevel(oMaster, nLevel)
{
	var oPopup;
	while (oMaster._nLevel > nLevel)
		{
		oPopup=oMaster._arrPopup[oMaster._nLevel];
		if (oPopup)
			{
			ClearShowSubMenuEvnt(oPopup);
			var oBackFrame=document.getElementById(oPopup._backgroundFrameId);
			if (oBackFrame !=null)
				oBackFrame.parentNode.removeChild(oBackFrame);
			oPopup.parentNode.removeChild(oPopup);
			}
		oMaster._arrPopup[oMaster._nLevel]=null;
		oMaster._arrSelected[oMaster._nLevel]=null;
		oMaster._oRoot=oMaster._oRoot.parentNode;
		oMaster._nLevel--;
		}
	oPopup=oMaster._arrPopup[oMaster._nLevel];
	if (oPopup) ClearShowSubMenuEvnt(oPopup);
}
function PopupMouseOver(e)
{
	var oPopup=GetEventPopup(e);
	if (oPopup !=null)
	{
		var oMaster=oPopup.master;
		var nLevel=oPopup.level;
		if (nLevel < 0) return;
		var oSrcElem=GetEventSrcItem(oMaster, GetEventSrcElement(e));
		if (oSrcElem)
		{
			if (oSrcElem !=oMaster._arrSelected[nLevel])
			{
				if (FIsIType(oSrcElem, "separator"))
					return;
				ToggleMenuItem(oMaster, nLevel, oSrcElem);
				if (FIsIType(oSrcElem, "submenu"))
					EngageSelection(oMaster, true, true, false);
			}
			else if (nLevel < oMaster._nLevel)
			{
				UnselectCurrentOption(oMaster);
			}
		}
		ClearTimeOutToHideMenu();
	}
}
function PopupMouseLeave(e)
{
	var oPopup;
	oPopup=GetEventPopup(e);
	if (oPopup !=null)
	{
		UnselectCurrentOption(oPopup.master);
		SetTimeOutToHideMenu();
	}
	return false;
}
function PopupMouseOverParent(e)
{
	if (g_menuHtc_lastMenu !=null)
	{
		ClearTimeOutToHideMenu();
		if (g_menuHtc_lastMenu._oParent !=null && g_menuHtc_lastMenu._oParent._onmouseover !=null)
		{
			g_menuHtc_lastMenu._oParent._onmouseover();
		}
	}
}
function PopupMouseLeaveParent(e)
{
	if (g_menuHtc_lastMenu !=null)
	{
		if (g_menuHtc_lastMenu._oParent !=null && g_menuHtc_lastMenu._oParent._onmouseout !=null)
		{
				g_menuHtc_lastMenu._oParent._onmouseout();
		}		
		SetTimeOutToHideMenu();		
	}
}
function ClearTimeOutToHideMenu()
{
	if (document.body.getAttribute("HideMenuTimeOut") !=null)
	{
		ClearTimeOut("HideMenuTimeOut");
	}
}
function SetTimeOutToHideMenu()
{
	ClearTimeOut("HideMenuTimeOut");
	document.body.setAttribute("HideMenuTimeOut", window.setTimeout(MenuHtc_hide, 1500));
}
function PopupMouseClick(e)
{
	var oPopup=GetEventPopup(e);
	var oMaster=oPopup.master;
	var nLevel=oPopup.level;
	if (nLevel < 0) return;
	var oItem=oMaster._arrSelected[nLevel];
	UpdateLevel(oMaster, nLevel);
	EngageSelection(oMaster, true, false, false);
}
function PopupKeyDown(e)
{
	var oPopup=GetEventPopup(e);
	var oMaster=oPopup.master;
	var nLevel=oPopup.level;
	if (nLevel < 0)
		return;
	var nKeyCode=GetEventKeyCode(e);
	var shiftKey=e.shiftKey;
	if (oMaster._fIsRtL)
		{
		if (nKeyCode==37) nKeyCode=39;
		else if (nKeyCode==39) nKeyCode=37;
		}
	if (nKeyCode==9) nKeyCode=!shiftKey ? 40 : 38;
	ClearShowSubMenuEvnt(oPopup);
	switch (nKeyCode)
		{
	case 38:	
		MoveMenuSelection(oMaster, -1);
		break;
	case 40:	
		MoveMenuSelection(oMaster, 1);
		break;
	case 37:	
	case 27:	
		CloseCurrentLevel(oMaster, nKeyCode==27);
		break;
	case 39:	
	case 13:	
		EngageSelection(oMaster, nKeyCode==13, false, true);
		break;
		}
	e.returnValue=false;
}
function SetNewId(obj)
{
	obj.id="msomenuid"+GetUniqueNumber();
	return obj.id;
}
function AssureId(obj)
{
	if (obj.id==null || obj.id=="")
		obj.id="msomenuid"+GetUniqueNumber();
	return obj.id;
}
function NavigateToMenu(oMaster)
{
	var oMenu=oMaster._arrPopup[oMaster._nLevel].firstChild;
	AssureId(oMenu);
	try
	{		
		var oFirstItem=oMenu.firstChild.firstChild.firstChild;		
		oFirstItem.tabIndex=0;
		if (oFirstItem.setActive !=null)
			oFirstItem.setActive();
		else if (oFirstItem.focus !=null)
			oFirstItem.focus();
	}
	catch (e)
	{
	}
}
function ExecuteOnClick(fnOnClick)
{
	try
	{
		if (browseris.safari)
		{
			if (FIStringEquals(typeof(fnOnClick), "string"))
				eval("var document=window.document; {"+fnOnClick+"}");
			else
				fnOnClick();
		}
		else
		{
			if (FIStringEquals(typeof(fnOnClick), "string"))
			{
				fnOnClick=new Function("var document=window.document; {"+fnOnClick+"}");
			}
			var oTemp=window.document.body.appendChild(window.document.createElement("span"));
			oTemp.onclick=fnOnClick;
			oTemp.onclick();
			oTemp.parentNode.removeChild(oTemp);
		}
	}
	catch (e)
	{
	}
}
function EngageSelection(oMaster, fDoSelection, fDelayExpandSM, fEnterSM)
{
	var oItem=oMaster._arrSelected[oMaster._nLevel];
	if (!oItem || oItem.optionDisabled) return;
	if (FIsIType(oItem, "submenu"))
	{
		if (fDelayExpandSM)
		{
			SetShowSubMenuEvnt(oMaster);
		}
		else
		{
			ShowSubMenu(oMaster, oMaster._nLevel, oItem);
			if (fEnterSM) MoveMenuSelection(oMaster, 1);
		}
	}
	else if (fDoSelection)
	{
		var fEnabled=oItem.getAttribute("enabled");
		if (fEnabled !="false")
		{
			var fnOnClick=oItem.getAttribute("onMenuClick");
			if (fnOnClick)
			{
				HideMenu(oMaster, 1);
				ExecuteOnClick(fnOnClick);
				HideMenu(oMaster, 2);
			}
		}
	}
}
function CloseCurrentLevel(oMaster, fAllowHideRoot)
{
	if (oMaster._nLevel > 0)
	{
		UpdateLevel(oMaster, oMaster._nLevel - 1);
		var obj=oMaster._arrSelected[oMaster._nLevel];
		if (obj !=null)
		{
			if (browseris.nav)
			{
				obj=obj.firstChild.firstChild.firstChild.firstChild.firstChild.nextSibling.firstChild.firstChild;
				if (obj.focus !=null)
					obj.focus();
			}
			else
			{
				if (obj.focus !=null)
					obj.focus();
			}
		}
	}
	else if (fAllowHideRoot)
	{
		HideMenu(oMaster);
		var oParent=oMaster._oParent;
		while (oParent !=null &&
			oParent.tagName=="SPAN" &&
			oParent.getAttribute("contentEditable") !=null)
		{
			oParent=oParent.parentElement;
		}
		if (oParent !=null)
		{
			var focusElement=oParent;
			if (oParent.foa !=null)
			{
				var foa=null;
				foa=eval(oParent.foa);
				if(foa==null)
				{
					foa=byid(oParent.foa );
				}
				if (foa !=null)
				{
					focusElement=foa;
				}
			}
			if (focusElement.setActive !=null)
			{
				focusElement.setActive();
			}
			else if (focusElement.focus !=null)
			{
				focusElement.focus();
			}
		}
	}
}
function UnselectCurrentOption(oMaster)
{
	if (oMaster._nLevel >=0)
		{
		var oItem=oMaster._arrSelected[oMaster._nLevel];
		if (FIsIType(oItem, "option"))
			{
			UnselectItem(oItem);
			oMaster._arrSelected[oMaster._nLevel]=null;
			}
		}
}
function MakeID(oMaster, nLevel, nIndex)
{
	return oMaster._wzPrefixID+"_"+nLevel+"_"+nIndex;
}
function GetItem(oMaster, nLevel, nIndex)
{
	var oPopup=oMaster._arrPopup[nLevel];
	return oPopup ? document.getElementById(MakeID(oMaster, nLevel, nIndex)) : null;
}
function MoveMenuSelection(oMaster, iDir)
{
	var nIndex=-1;
	var nNumItems=oMaster._oRoot.childNodes.length;
	var oSelected=oMaster._arrSelected[oMaster._nLevel];
	if (oSelected)
	{
		var wzSelectedID=oSelected ? oSelected.id : null;
		if (wzSelectedID)
		{
			var nCurIndex=parseInt(wzSelectedID.substring(wzSelectedID.lastIndexOf("_")+1, wzSelectedID.length));
			nIndex=(nCurIndex+nNumItems+iDir) % nNumItems;
		}
	}
	if (nIndex < 0)
		nIndex=iDir > 0 ? 0 : (nNumItems - 1);
	var oItem;
	var nIndexStart=nIndex;
	do
	{
		oItem=GetItem(oMaster, oMaster._nLevel, nIndex);
		nIndex=(nIndex+nNumItems+iDir) % nNumItems;
	}
	while (nIndex !=nIndexStart &&
			 (!oItem || oItem.style.display=="none" ||
			  !(FIsIType(oItem, "option") || FIsIType(oItem, "submenu"))));
	ToggleMenuItem(oMaster, oMaster._nLevel, oItem);
}
function ToggleMenuItem(oMaster, nLevel, oItem)
{
	var oOld=oMaster._arrSelected[nLevel];
	if (!oItem || (oOld && oItem.id==oOld.id)) return;
	if (oOld)
	{
		UnselectItem(oOld);
		oOld.onkeydown=null;
		oOld.onmousedown=null;
		oOld.onmouseover=null;
		oOld.onmouseout=null;
		oOld.oncontextmenu=null;
	}
	UpdateLevel(oMaster, nLevel);
	SelectItem(oItem);
	oMaster._arrSelected[nLevel]=oItem;
	oItem.tabIndex=0;
	if (oItem.setActive !=null)
		oItem.setActive();
	else if (oItem.focus !=null)
		oItem.focus();
	var oPopup=oMaster._arrPopup[nLevel];
	var oDiv=oPopup.childNodes[0];
	var posPopup=MenuHtc_GetElementPosition(oItem, oDiv);
	if (posPopup.y+posPopup.height - oDiv.scrollTop > oDiv.offsetHeight)
	{
		oDiv.scrollTop=posPopup.y+posPopup.height - oDiv.offsetHeight;
	}
	else if (posPopup.y < oDiv.scrollTop)
	{
		oDiv.scrollTop=posPopup.y;
	}
}
function SelectItem(oItem)
{
	if (!oItem) return;
	var oItemTableCell=oItem.firstChild;
	var oItemTable=oItemTableCell.firstChild;
	if (oItemTableCell.className=="ms-MenuUIItemTableCellCompact")
		oItemTableCell.className="ms-MenuUIItemTableCellCompactHover";	
	else
		oItemTableCell.className="ms-MenuUIItemTableCellHover";
	oItemTable.className="ms-MenuUIItemTableHover";
}
function UnselectItem(oItem)
{
	if (!oItem) return;
	var oItemTableCell=oItem.firstChild;
	var oItemTable=oItemTableCell.firstChild;
	if (oItemTableCell.className=="ms-MenuUIItemTableCellCompactHover")
		oItemTableCell.className="ms-MenuUIItemTableCellCompact";	
	else
		oItemTableCell.className="ms-MenuUIItemTableCell";
	oItemTable.className="ms-MenuUIItemTable";
}
function SetImageSize(oMaster, oImg, oSize)
{
	if (oSize==null)
	{
		if (oMaster._fLargeIconMode)
			oSize=32;
		else
			oSize=16;
	}
	oImg.width=oSize;
	oImg.height=oSize;
}
function CreateMenuOption(oMaster, oRow, oNode, wzID, wzHtml)
{
	var oIcon=document.createElement("td");
	var oLabel=document.createElement("td");
	var oAccKey=document.createElement("td");
	var oArrow=document.createElement("td");
	oRow.appendChild(oIcon);
	oRow.appendChild(oLabel);
	oRow.appendChild(oAccKey);
	oRow.appendChild(oArrow);
	if (oMaster._fLargeIconMode)
		oIcon.className=!oMaster._fIsRtL ? "ms-MenuUIIconLarge" : "ms-MenuUIIconRtlLarge";
	else
		oIcon.className=!oMaster._fIsRtL ? "ms-MenuUIIcon" : "ms-MenuUIIconRtL";
	oIcon.align="center";
	if (oMaster._fCompactItemsWithoutIcons && !oNode.getAttribute("iconSrc"))
		oLabel.className=!oMaster._fIsRtL ? "ms-MenuUILabelCompact" : "ms-MenuUILabelCompactRtl";
	else
		oLabel.className=!oMaster._fIsRtL ? "ms-MenuUILabel" : "ms-MenuUILabelRtL";
	oAccKey.className="ms-MenuUIAccessKey";
	oArrow.className="ms-MenuUISubmenuArrow";
	if (!oMaster._fLargeIconMode)
	{
		oLabel.noWrap=true;
	}
	oIcon.noWrap=true;
	oAccKey.noWrap=true;
	oArrow.noWrap=true;
	oLabel.id=oNode.id;
	if (!wzHtml) wzHtml=oNode.innerHTML;
	if (oNode.getAttribute("enabled")=="false")
	{
		oRow.disabled=true;
		oLabel.className+=" ms-MenuUIItemTableCellDisabled";
	}
	var wzIconSrc=null, wzIconAlt=null;
	if (oNode.getAttribute("checked")=="true")
		{
		wzIconSrc=oMaster._wzChkMrkPath;
		wzIconAlt="*";
		}
	else
		{
		wzIconSrc=EvalAttributeValue(oNode, "iconSrc", "iconScript");
		wzIconAlt=oNode.getAttribute("iconAltText");
		}
	var innerHtml=wzHtml;
	var sText=EvalAttributeValue(oNode, "text", "textScript");
	var sDescription=EvalAttributeValue(oNode, "description", "descriptionScript");
	var oMenuItemBody=document.createElement("div");
	if (sDescription !=null && oMaster._fLargeIconMode)
	{
		var oBold=document.createElement("B");
		var oTextSpan=document.createElement("SPAN");
		var oTextNode=document.createTextNode(sText);
		var oBr=document.createElement("BR");
		var oDescSpan=document.createElement("SPAN");
		var oDescNode=document.createTextNode(sDescription);
		oTextSpan.setAttribute("style","white-space: nowrap;");
		oDescSpan.className="ms-menuitemdescription";
		oMenuItemBody.appendChild(oBold);
		oBold.appendChild(oTextSpan);
		oTextSpan.appendChild(oTextNode);
		oMenuItemBody.appendChild(oBr);
		oMenuItemBody.appendChild(oDescSpan);
		oDescSpan.appendChild(oDescNode);
	}
	else if (sText !=null)
	{
		var oTextSpan=document.createElement("SPAN");
		var oTextNode=document.createTextNode(sText);
		oTextSpan.setAttribute("style","white-space: nowrap;");
		oMenuItemBody.appendChild(oTextSpan);
		oTextSpan.appendChild(oTextNode);
	}
	var htmlSpan=document.createElement("SPAN");
	htmlSpan.innerHTML=innerHtml;
	oMenuItemBody.appendChild(htmlSpan);
	if (wzIconSrc)
	{
		var oImg=document.createElement("IMG");
		SetImageSize(oMaster, oImg);
		var oImgLbl=document.createElement("LABEL");
		oIcon.appendChild(oImg);
		oLabel.appendChild(oImgLbl);
		var wzIconId=wzID+"_"+"ICON";
		oImg.id=wzIconId;
		oImg.src=wzIconSrc;
		if (wzIconAlt)
		{
			oImg.alt="";
			oImg.title="";
		}
		oImgLbl.htmlFor=wzIconId;
		oImgLbl.appendChild(oMenuItemBody);
	}
	else
	{
		if (browseris.nav || oMaster._fLargeIconMode)
		{
			var oImg=document.createElement("IMG");
			SetImageSize(oMaster, oImg);
			var oImgLbl=document.createElement("LABEL");
			oIcon.appendChild(oImg);
			oLabel.appendChild(oImgLbl);
			var wzIconId=wzID+"_"+"ICON";
			oImg.id=wzIconId;
			oImg.src="/_layouts/images/blank.gif";
			oImg.alt="";
			oImg.title="";
			oImgLbl.htmlFor=wzIconId;
			oImgLbl.appendChild(oMenuItemBody);
			if (oMaster._fLargeIconMode)
			{
				oImg.width=32;
				oImg.height=16;
			}
			else
			{
				oImg.width=16;
			}
		}
		else
		{
			oIcon.innerHTML="&nbsp;";
			oLabel.appendChild(oMenuItemBody);
		}
	}
	var wzAccKey=oNode.getAttribute("accessKeyText");
	if (wzAccKey) oAccKey.innerHTML=wzAccKey;
	SetIType(oRow, "option");
}
function CreateMenuSeparator(oMaster, oRow)
{
	var oCell=document.createElement("td");
	var oDiv=document.createElement("div");
	oRow.appendChild(oCell);
	oCell.appendChild(oDiv);
	if (oMaster._fLargeIconMode)
		oDiv.className=!oMaster._fIsRtL ? "ms-MenuUISeparatorLarge" : "ms-MenuUISeparatorLargeRtl";
	else
		oDiv.className=!oMaster._fIsRtL ? "ms-MenuUISeparator" : "ms-MenuUISeparatorRtL";
	oDiv.innerHTML="&nbsp;";
	SetIType(oRow, "separator");
}
function CreateSubmenu(oMaster, oRow, oNode, wzID)
{
	var oLabelNode=FindLabel(oNode);
	CreateMenuOption(oMaster, oRow, oNode, wzID, oLabelNode ? oLabelNode.innerHTML : null);
	var oArrow=oRow.childNodes[3];
	var oArrowImg=document.createElement("IMG");
	SetImageSize(oMaster, oArrowImg, 16);
	oArrow.appendChild(oArrowImg);
	oArrowImg.src=!oMaster._fIsRtL ? oMaster._wzMArrPath : oMaster._wzMArrPathRtL;
	oArrowImg.alt=!oMaster._fIsRtL ? ">" : "<";
	oArrowImg.title="";
	SetIType(oRow, "submenu");
	oRow.submenuRoot=oNode;
}
function MergeAttributes(oTarget, oSource)
{
	if (browseris.nav || oTarget.mergeAttributes==null)
	{
		var oAttributes=oSource.attributes;
		for (var i=0; i < oAttributes.length; i++)
		{
			var oAttrib=oAttributes[i];
			if (oAttrib !=null &&
				oAttrib.specified &&
				oAttrib.nodeName !="id" &&
				oAttrib.nodeName !="ID" &&
				oAttrib.nodeName !="name")
			{
				oTarget.setAttribute(oAttrib.nodeName, oAttrib.nodeValue);
			}
		}
		if (oSource.getAttribute("type") !=null)
			oTarget.setAttribute("type", oSource.getAttribute("type"));
		if (oSource.submenuRoot !=null)
			oTarget.submenuRoot=oSource.submenuRoot;
	}
	else
	{
		oTarget.mergeAttributes(oSource);
	}
}
function CreateMenuItem(oMaster, oNode, wzID, wzHtml)
{
	if (FIsIType(oNode, "label")) return;
	var oRow=document.createElement("tr");
	MergeAttributes(oRow, oNode);
	oRow.setAttribute("onMenuClick", oNode.getAttribute("onMenuClick"));
	if (FIsIType(oNode, "separator"))
	{
		CreateMenuSeparator(oMaster, oRow);
		return oRow;
	}
	if (!GetIType(oNode)) SetIType(oNode, "option");
	var oFmtTableRow=document.createElement("tr");
	var oFmtTableCell=document.createElement("td");
	var oFmtTable=document.createElement("table");
	var oFmtTableBody=document.createElement("tbody");
	oFmtTableRow.appendChild(oFmtTableCell);
	oFmtTableCell.appendChild(oFmtTable);
	oFmtTable.appendChild(oFmtTableBody);
	oFmtTableBody.appendChild(oRow);
	if (oMaster._fCompactItemsWithoutIcons && !oNode.getAttribute("iconSrc"))
		oFmtTableCell.className="ms-MenuUIItemTableCellCompact";
	else
		oFmtTableCell.className="ms-MenuUIItemTableCell";
	oFmtTable.className="ms-MenuUIItemTable";
	oFmtTable.width="100%";
	oFmtTable.cellSpacing=0;
	oFmtTable.cellPadding=0;
	if (FIsIType(oNode, "submenu"))
		CreateSubmenu(oMaster, oRow, oNode, wzID);
	else if (FIsIType(oNode, "option"))
		CreateMenuOption(oMaster, oRow, oNode, wzID, wzHtml);
	if (oRow.disabled ||
		oRow.getAttribute("enabled")=="false")
	{
		oRow.disabled=false;
		oRow.className="ms-MenuUIDisabled";
		oRow.disabled=false;
		for (var nIndex=0; nIndex < oRow.childNodes.length; nIndex++)
		{
			if (oRow.childNodes[nIndex].nodeType !=1)
				continue;
			oRow.childNodes[nIndex].disabled=true;
			oFmtTableCell.className+=" ms-MenuUIItemTableCellDisabled";
		}
		oRow.optionDisabled=true;
	}
	MergeAttributes(oFmtTableRow, oRow);
	if (oRow.optionDisabled !=null)
	{
		oFmtTableRow.optionDisabled=oRow.optionDisabled;
	}
	oFmtTableRow.id=wzID;
	SetIType(oFmtTableRow, GetIType(oRow));
	return oFmtTableRow;
}
function GetItems(oMaster)
{
	if (!oMaster._oContents) PrepContents(oMaster);
	return oMaster._oContents.childNodes;
}
function GetIType(oItem)
{
	return oItem ? oItem.getAttribute("type") : null;
}
function FIsIType(oItem, wzType)
{
	return FIStringEquals(GetIType(oItem), wzType);
}
function SetIType(oItem, wzType)
{
	if (oItem) oItem.setAttribute("type", wzType);
}
function FIStringEquals(wzX, wzY)
{
	return wzX !=null && wzY !=null && wzX.toLowerCase()==wzY.toLowerCase();
}
function RenderAccessibleMenu(oMaster, fForceRefresh)
{
	if (fForceRefresh)
	{
		oMaster._oContents=null;
		oMaster._oRoot=null;
		oMaster._nLevel=0;
		oMaster._arrPopup=new Array();
		oMaster._arrSelected=new Array();
	}
	else
	{
		oMaster._oRoot=oMaster._oContents;
	}
	if (!oMaster._oContents) PrepContents(oMaster);
	if (!oMaster._oContents) return;
	if (!oMaster._oRoot)
	{
		oMaster._nLevel=0;
		oMaster._oRoot=oMaster._oContents;
	}
	FixUpMenuStructure(oMaster);
	var menuDir=oMaster._fIsRtL ? "rtl" : "ltr";
	g_menuHtc_html="<html dir='"+menuDir+"'><head><title>"+L_AccessibleMenu_Text+"</title></head><body><ul id='root'>";
	RenderMenuLevel(oMaster, oMaster._oRoot, true);
	g_menuHtc_html=g_menuHtc_html+"</ul></body></html>";
	var oNewWindow=window.open("/_layouts/blank.htm", "_blank", "status=no,toolbar=no,menubar=no,location=no");
	oMaster._accessibleMenu=oNewWindow;
	oNewWindow.document.write(g_menuHtc_html);
	oNewWindow.document.close();
	oNewWindow.focus();
}
function CloseAccessibleMenu(oMaster, n)
{
	if (n==null)
		n=0;
	if (oMaster !=null)
	{
		if (n==0 || n==1)
		{
			if (oMaster._accessibleMenu !=null)
			{
				oMaster._accessibleMenu.close();
				oMaster._accessibleMenu=null;
			}
		}
		if (n==0 || n==2)
		{
			if (oMaster._onDestroy !=null)
			{
				oMaster._onDestroy();
				oMaster._onDestroy=null;
			}
		}
	}
}
function GetMenuItemText(oMaster, oNode, s)
{
	if (s=="")
	{
		s=EvalAttributeValue(oNode, "text", "textScript");
		var description=EvalAttributeValue(oNode, "description", "descriptionScript");
		if (description !=null &&
			description !="" &&
			oMaster._fLargeIconMode)
		{
			if (s !="")
				s=s+": ";
			s=s+description;
		}
	}
	if (oNode.getAttribute("checked")=="true")
		s="* "+s;
	if (oNode.title !=null && oNode.title !="")
		s=s+": "+oNode.title;
	return s;
}
function GetMenuItemEnabled(oNode, fEnabled)
{
	if (!fEnabled)
		return false;
	if (oNode.getAttribute("enabled")=="false")
		return false;
	if (oNode.getAttribute("disabled") !=null && oNode.getAttribute("disabled") !="")
		return false;
	return true;
}
var g_menuHtc_html;
function RenderMenuLevel(oMaster, oRoot, fEnabled)
{
	for (var nIndex=0; nIndex < oRoot.childNodes.length; nIndex++)
	{
		var oNode=oRoot.childNodes[nIndex];
		if (oNode.nodeType !=1)
			continue;
		if (oNode.style.display=="none")
			continue;
		if (FIsIType(oNode, "option"))
		{
			var s=GetMenuItemText(oMaster, oNode, oNode.innerHTML);
			if (!GetMenuItemEnabled(oNode, fEnabled))
			{
				g_menuHtc_html=g_menuHtc_html+"<li><span id=\""
+oNode.id+"\">"
+s+"</span></li>";
			}
			else
			{
				g_menuHtc_html=g_menuHtc_html+"<li><a href=\"#\" id=\""
+oNode.id+"\" "
+"onMenuClick"
+"=\""
+oNode.getAttribute("onMenuClick")
+"\" onclick=\""
+"javascript:opener.ExecuteOnAccessibleClick(this.getAttribute('"+"onMenuClick"+"')); return false;"
+"\">"
+s
+"</a></li>";
			}
		}
		else if (FIsIType(oNode, "submenu"))
		{
			var s=GetMenuItemText(oMaster, oNode, "");
			g_menuHtc_html=g_menuHtc_html+"<li><span id=\""+oNode.id+"\">"+s;
			for (var n=0; n < oNode.childNodes.length; n++)
			{
				var oLabelNode=oNode.childNodes[n];
				if (oLabelNode.nodeType !=1)
					continue;
				if (oLabelNode.style.display=="none")
					continue;
				if (FIsIType(oLabelNode, "label"))
				{
					g_menuHtc_html=g_menuHtc_html+" "+oLabelNode.innerHTML;
					break;
				}
			}
			g_menuHtc_html=g_menuHtc_html+"</span><ul>";
			RenderMenuLevel(oMaster, oNode, GetMenuItemEnabled(oNode, fEnabled));
			g_menuHtc_html=g_menuHtc_html+"</ul></li>";
		}
	}
}
function ExecuteOnAccessibleClick(fnOnClick)
{
	var oMaster=g_menuHtc_lastMenu;
	if (oMaster !=null)
	{
		CloseAccessibleMenu(oMaster, 1);
		window.focus();
		ExecuteOnClick(fnOnClick);
		CloseAccessibleMenu(oMaster, 2);
	}
}
function FIsIHidden(oItem)
{
	if (oItem)
	{
		var hiddenFunc=oItem.getAttribute("hidden");
		if (!hiddenFunc) return false;
		return eval(hiddenFunc);
	}
	else
		return false;
}
function EvalAttributeValue(oNode, sAttribute1, sAttribute2)
{
	var result=oNode.getAttribute(sAttribute2);
	if (result !=null &&
		result.toLowerCase().indexOf("javascript:")==0)
	{
		result=eval(result.substring(11));
		if (result !=null && result !="")
			return result;
	}
	var result=oNode.getAttribute(sAttribute1);
	if (result==null)
		return "";
	return result;
}
var flyoutsAllowed=false;
function enableFlyoutsAfterDelay()
{
	setTimeout("flyoutsAllowed=true;", 25);
}
function overrideMenu_HoverStatic(item)
{
	if (!flyoutsAllowed)
	{
		setTimeout(delayMenu_HoverStatic(item), 50);
	}
	else
	{
		var node=Menu_HoverRoot(item);
		var data=Menu_GetData(item);
		if (!data) return;
		__disappearAfter=data.disappearAfter;
		Menu_Expand(node, data.horizontalOffset, data.verticalOffset);
	}
}
function delayMenu_HoverStatic(item)
{
	return (function()
	{
		overrideMenu_HoverStatic(item);
	});
}
var MMU_chDelim=",";
var MMU_chDelimEnc="%2c";
var MMU_postbackPrefix="javascript:__doPostBack(";
var MMU_chDelim2="%";
var MMU_chDelim2Enc="%25";
function MHash_New()
{
	var oMaster=new Object();
	oMaster._keys=new Array();
	oMaster._values=new Array();
	return oMaster;
}
function MHash_Add(oMaster, oKey, oValue)
{
	oMaster._keys.push(oKey);
	oMaster._values.push(oValue);
}
function MHash_Count(oMaster)
{
	return oMaster._keys.length;
}
function MHash_Keys(oMaster)
{
	return oMaster._keys;
}
function MHash_Values(oMaster)
{
	return oMaster._values;
}
function MHash_Exists(oMaster, oKey)
{
	for (var i=0; i < oMaster._keys.length; i++)
	{
		if (oMaster._keys[i]==oKey)
			return true;
	}
	return false;
}
function MHash_Item(oMaster, oKey)
{
	for (var i=0; i < oMaster._keys.length; i++)
	{
		if (oMaster._keys[i]==oKey)
			return oMaster._values[i];
	}
	return null;
}
var MMU_reDelimEnc=new RegExp(MMU_chDelimEnc, "g");
var MMU_reDelim2Enc=new RegExp(MMU_chDelim2Enc, "g");
var MMU_reDelimDec=new RegExp(MMU_chDelim, "g");
var MMU_reDelim2Dec=new RegExp(MMU_chDelim2, "g");
function MMU_EncVal(strDec)
{
	return strDec.replace(MMU_reDelimDec, MMU_chDelimEnc).replace(MMU_reDelim2Dec, MMU_chDelim2Enc);
}
function MMU_DecVal(strEnc)
{
	return strEnc.replace(MMU_reDelim2Enc, MMU_chDelim2).replace(MMU_reDelimEnc, MMU_chDelim);
}
function MMU_ParseNV(rgnv)
{
	var dictNV=MHash_New();
	var rgstrNV=rgnv.split(MMU_chDelim);
	if (rgstrNV !=null)
	{
		var i;
		for (i=0; i < rgstrNV.length; i++)
		{
			var strNV=rgstrNV[i];
			var iEq=strNV.indexOf("=");
			if (iEq==0)
			{
				continue;
			}
			var name=null;
			var value=null;
			if (iEq < 0)
			{
				name=strNV;
			}
			else
			{
				name=strNV.substr(0, iEq);
				if (iEq < strNV.length - 1)
				{
					value=MMU_DecVal(strNV.substr(iEq+1));
				}
				else
				{
					value="";
				}
			}
			MHash_Add(dictNV, name, value);
		}
	}
	return dictNV;
}
function MMU_ParseNVAttr(elem, attr)
{
	var val=elem.getAttribute(attr);
	if (val==null && elem.childNodes.length > 0 && elem.childNodes[0].nodeType==1)
	{
		val=elem.childNodes[0].getAttribute(attr);
	}
	if (val==null)
	{
		return MHash_New();
	}
	return MMU_ParseNV(val);
}
function MMU_ResetMenuState(menu, dis, hid, chk, tokval)
{
	var i;
	for (i=0; i < menu.childNodes.length; i++)
	{
		var mnu=menu.childNodes[i];
		if (mnu.nodeType !=1)
			continue;
		var mnuId=mnu.getAttribute("id");
		if ((mnu !=null) && (mnuId !=null) && (mnuId.length > 0))
		{
			if (mnu.childNodes.length > 0)
			{
				MMU_ResetMenuState(mnu, dis, hid, chk, tokval);
				continue;
			}
			if (MHash_Exists(hid, mnuId))
			{
				mnu.style.display="none";
			}
			else
			{
				mnu.style.display="";
				var enabledOverride=mnu.getAttribute("enabledOverride");
				if ((enabledOverride !=null) && (enabledOverride.length >0))
				{
					mnu.setAttribute("enabled", enabledOverride);
				}
				else
				{
					if (MHash_Exists(dis, mnuId))
					{
						mnu.setAttribute("enabled", "false");
					}
					else
					{
						mnu.setAttribute("enabled", "true");
						if (MHash_Exists(chk, mnuId))
						{
							mnu.setAttribute("checked", "true");
						}
						else
						{
							mnu.setAttribute("checked", "false");
						}
					}
				}
			}
			MMU_ReplTokValAttr(mnu, "onMenuClick", tokval);
			MMU_ReplTokValAttr(mnu, "text", tokval);
			MMU_ReplTokValAttr(mnu, "description", tokval);
			MMU_ReplTokValVal(mnu, tokval)
		}
	}
}
function MMU_ReplTokValAttr(elem, attr, tokval)
{
	var val=elem.getAttribute(attr);
	var orig=elem.getAttribute(attr+"_Original");
	if ((val !=null) && (orig==null) && (MHash_Count(tokval) > 0))
	{
		elem.setAttribute(attr+"_Original", val);
	}
	else if ((val !=null) && (orig !=null) && (val !=orig))
	{
		val=orig;
	}
	if ((val==null) || (val.length <=0))
	{
		return;
	}
	var newVal=MMU_ReplTokVal(val,  tokval);
	if (newVal !=val)
	{
		elem.setAttribute(attr, newVal);
	}
}
function MMU_ReplTokValVal(item, tokval)
{
	if(item.nextSibling==null)
	{
		return;
	}
	var val=item.nextSibling.nodeValue;
	var orig=item.getAttribute("valOrig");
	if ((val !=null) && (orig==null) && (MHash_Count(tokval) > 0))
	{
		orig=val;
		item.setAttribute("valOrig", orig);
	}
	else if ((val !=null) && (orig !=null) && (val !=orig))
	{
		val=orig;
	}
   var newVal=MMU_ReplTokVal(val,  tokval);
	if ((val !=null) && (newVal !=null) && (newVal !=val))
	{
		item.nextSibling.nodeValue=newVal;
	}
}
function MMU_ReplTokVal(toFix, tokval)
{
	if ((toFix !=null) && (toFix.indexOf("%") >=0) && (tokval !=null) && (MHash_Count(tokval) > 0))
	{
		var toks=MHash_Keys(tokval);
		var vals=MHash_Values(tokval);
		var i;
		for (i=0; i < toks.length; i++)
		{
			var tok=toks[i];
			var val=vals[i];
			toFix=toFix.replace("%"+tok+"%", val);
		}
	}
   return toFix;
}
var g_MMU_HighlightedEcbTable=null;
var g_MMU_HighlightedEcbTableOpen=null;
var g_MMU_OpenTimeoutHandle=null;
function MMU_Open(menu, ecbLink, e, fAlignRight, alignId, delay)
{
	try
	{
		if ((menu==null) || (ecbLink==null))
		{
			return;
		}
		if ((ecbLink.getAttribute("suppressBubbleIfPostback") !=null) && (e !=null) && (e.srcElement !=null) && (e.srcElement.href !=null) &&
			(e.srcElement.href.substr(0, MMU_postbackPrefix.length)==MMU_postbackPrefix))
		{
			event.cancelBubble=true;
			return;
		}
		ClearHighlightedEcbTableOpen();
		if (fAlignRight==null)
		{
			fAlignRight=true;
		}
		MMU_ResetMenuState(menu, MMU_ParseNVAttr(ecbLink, "menuItemsDisabled"), MMU_ParseNVAttr(ecbLink, "menuItemsHidden"),
			MMU_ParseNVAttr(ecbLink, "menuItemsChecked"), MMU_ParseNVAttr(ecbLink, "menuTokenValues"));
		var elemAlign=null;
		if ((alignId !=null) && (alignId.length > 0))
		{
			elemAlign=document.getElementById(alignId);
		}
		if (elemAlign==null)
		{
			elemAlign=document.getElementById(ecbLink.id+"_t");
		}
		if (elemAlign==null)
		{
			elemAlign=ecbLink;
		}
		MMU_EcbHighlight(MMU_GetHighlightElement(ecbLink), true);
		var openMenuScript="MenuHtc_show(document.getElementById('"+menu.id+"'), document.getElementById('"+elemAlign.id+				"'), true, "+fAlignRight+", null);";
		openMenuScript+="SetEcbMouseOutAndDestroy('"+menu.id+"');"
		if ((delay !=null) && (delay > 0))
		{
			openMenuScript+=" g_MMU_OpenTimeoutHandle=null;";
			g_MMU_OpenTimeoutHandle=window.setTimeout(openMenuScript, delay, "javascript");
		}
		else
		{
			eval(openMenuScript);
		}
		if (e !=null)
			e.cancelBubble=true;
	}
	catch (ex)
	{
		alert(L_Loading_Error_Text);
	}
}
function SetEcbMouseOutAndDestroy(menuId)
{
		if (g_MMU_HighlightedEcbTable !=null)
		{
			g_MMU_HighlightedEcbTable.onmouseout=null;
			g_MMU_HighlightedEcbTableOpen=g_MMU_HighlightedEcbTable;
			document.getElementById(menuId)._onDestroy=ClearHighlightedEcbTableOpen;
		}
}
function ClearHighlightedEcbTableOpen()
{
	if (g_MMU_HighlightedEcbTableOpen !=null)
	{
		MMU_EcbHighlight(g_MMU_HighlightedEcbTableOpen, false);
		g_MMU_HighlightedEcbTableOpen=null;
	}
}
function MMU_EcbLinkOnFocusBlurDeferCall(menu, ecbLink, fOnFocus)
{
	if (fOnFocus)
	{
		ecbLink.onblur=fOnFocus ? new Function("MMU_EcbLinkOnFocusBlurDeferCall(null, this, false)") : null;
	}
	if (g_MMU_HighlightedEcbTableOpen !=null)
		return;
	var ecbTable=document.getElementById(ecbLink.id+"_t");
	if (ecbTable !=null)
	{
		MMU_EcbHighlight(ecbTable, fOnFocus);
	}
}
function MMU_EcbLinkOnKeyDown(menu, ecbLink, e)
{
	if (e==null)
	{
		e=window.event;
		if (e==null)
			return;
	}
	var hasHref=((ecbLink.href !=null) && (ecbLink.href.length > 0));
	if (((e.shiftKey || !hasHref) && (GetEventKeyCode(e)==13)) || ((e.altKey) && (GetEventKeyCode(e)==40)))
	{
		var image=byid(ecbLink.id+"_ti");
		if(image==null)
		{
			var serverClientId=ecbLink.getAttribute("serverclientid");
			if ((serverClientId !=null) && (serverClientId.length > 0))
			{
				image=byid(serverClientId+"_ti");
			}
		}
		if (image !=null)
		{
			image.click();
		}
		else
		{
			ecbLink.click();
		}
		return false;
	}
	else
	{
		return true;
	}
}
function MMU_EcbTableMouseOverOutDeferCall(ecbTable, fMouseOver)
{
	if (fMouseOver)
	{
		if (ecbTable==g_MMU_HighlightedEcbTableOpen)
		{
			return;
		}
		ecbTable.onmouseout=fMouseOver ? new Function("MMU_EcbTableMouseOverOut(this, false)") : null;
	}
	MMU_EcbHighlight(ecbTable, fMouseOver);
}
function MMU_EcbHighlight(ecbTable, fHighlight)
{
	if ((ecbTable==null) && (!fHighlight))
	{
		ecbTable=g_MMU_HighlightedEcbTableOpen;
	}
	if (ecbTable==null)
	{
		return;
	}
	if (fHighlight==null)
	{
		fHighlight=false;
	}
	var hoverActive=ecbTable.getAttribute("hoverActive");
	var hoverInactive=ecbTable.getAttribute("hoverInactive");
	if ((hoverActive==null))
	{
		hoverActive="ms-selectedtitle";
	}
	if ((hoverInactive==null))
	{
		hoverInactive="ms-unselectedtitle";
	}
	if (fHighlight)
	{
		ecbTable.className=hoverActive;
		g_MMU_HighlightedEcbTable=ecbTable;
	}
	else
	{
		ecbTable.className=hoverInactive;
	}
	var menuFormat=ecbTable.getAttribute("menuformat");
	var imageCell=document.getElementById(ecbTable.id+"i");
	if (imageCell !=null && menuFormat!=null && menuFormat=="ArrowOnHover")
	{
		imageCell.style.visibility=fHighlight ? "visible" : "hidden";
	}
	if (!fHighlight)
	{
		g_MMU_HighlightedEcbTable=null;
	}
}
function MMU_PopMenuIfShowingDeferCall(menuElement)
{
	if (!IsAccessibilityFeatureEnabledProxy() && g_menuHtc_lastMenu)
	{
		var menuType=g_menuHtc_lastMenu.getAttribute("type");
		if (menuType && menuType=="ServerMenu")
			menuElement.onclick();
	}
}
function MMU_HandleArrowSplitButtonKeyDown(e, id, a ,t)
{
	if (!e.shiftKey &&
		!e.altKey &&
		!e.ctrlKey &&
		(GetEventKeyCode(e)==13))
	{
		t.parentNode.click();
		return;
	}
	return MMU_EcbLinkOnKeyDown(byid(id), a, e);
}
function MMU_GetHighlightElement(elem)
{
	var highlightElement=null
	highlightElement=document.getElementById(elem.id+"_t");
	if (highlightElement !=null)
		return highlightElement;
	else
		return elem;
}
function MMU_GetMenuFromClientId(clientId)
{
	return document.getElementById(clientId);
}
var g_MMU_theFormActionAtPageLoad=null;
var g_MMU_theFormActionAtPreMenuOpen=null;
var g_MMU_Form0ActionAtPageLoad=null;
var g_MMU_Form0ActionAtPreMenuOpen=null;
function MMU_CallbackPreMenuOpen(templateClientId, menuClientId, callbackEventReference, timeoutLength, timeoutMessage, e)
{
	try
	{
		g_MMU_theFormActionAtPreMenuOpen=(theForm !=null ? theForm.action : "null");
		g_MMU_Form0ActionAtPreMenuOpen=(document.forms !=null && document.forms.length > 0 ? document.forms[0].action : "null");
		var menuTemplate=document.getElementById(templateClientId);
		var menuLink=document.getElementById(menuClientId);
		if ((menuLink.getAttribute("suppressBubbleIfPostback") !=null) && (e !=null) && (e.srcElement !=null) && (e.srcElement.href !=null) &&
			(e.srcElement.href.substr(0, MMU_postbackPrefix.length)==MMU_postbackPrefix))
		{
			event.cancelBubble=true;
			return;
		}
		MMU_StopPendingTimerEventsFromCallback();
		MMU_RemoveCallbackItemsFromMenuTemplate(menuTemplate);
		var menu=document.getElementById(menuClientId);
		menu.setAttribute("callbackInProgress", "true");
		var loadingMessageMenuItem=CAMOpt(menuTemplate, L_Loading_Text, "null");
		loadingMessageMenuItem.setAttribute("callbackitem", "true");
		loadingMessageMenuItem.setAttribute("enabled", "false");
		var callbackContext=templateClientId+";"+menuClientId+";"+timeoutMessage.replace(/;/g, "%semi%").replace(/\'/g, "%quot%");
		callbackEventReference=callbackEventReference.replace(/__CALLBACKCONTEXT__/g, callbackContext);
		eval(callbackEventReference);
		g_MMU_RequestTimeoutTimeoutHandle=window.setTimeout("MMU_CallbackErrHandler('timeout', '"+callbackContext+"')", timeoutLength, "javascript");
	}
	catch (ex)
	{
		alert(L_Loading_Error_Text);
	}
}
var g_MMU_RequestTimeoutTimeoutHandle=null;
function MMU_RemoveCallbackItemsFromMenuTemplate(menuTemplate)
{
	try
	{
		for (var menuChildIndex=0; menuChildIndex < menuTemplate.childNodes.length; menuChildIndex++)
		{
			var menuChild=menuTemplate.childNodes[menuChildIndex];
			if ((menuChild.nodeType==1) && (menuChild.getAttribute("callbackitem")=="true"))
			{
				menuTemplate.removeChild(menuChild);
				--menuChildIndex;
			}
		}
	}
	catch (ex)
	{
		alert(L_Loading_Error_Text);
	}
}
function MMU_StopPendingTimerEventsFromCallback()
{
	if (g_MMU_OpenTimeoutHandle !=null)
	{
		window.clearTimeout(g_MMU_OpenTimeoutHandle);
		g_MMU_OpenTimeoutHandle=null;
	}
	if (g_MMU_RequestTimeoutTimeoutHandle !=null)
	{
		window.clearTimeout(g_MMU_RequestTimeoutTimeoutHandle);
		g_MMU_RequestTimeoutTimeoutHandle=null;
	}
}
function MMU_UpdateMenuTemplateWithErrorItem(menuTemplate, errorString)
{
	MMU_RemoveCallbackItemsFromMenuTemplate(menuTemplate);
	var errorMenuItem=CAMOpt(menuTemplate, errorString, "null");
	loadingMessageMenuItem.setAttribute("callbackitem", "true");
	loadingMessageMenuItem.setAttribute("enabled", "false");
}
function MMU_UpdateOpenedMenuWithErrorItem(menu, menuTemplate, errorString)
{
	MMU_UpdateMenuTemplateWithErrorItem(menuTemplate, errorString);
	HideMenu(menuTemplate);
	MMU_Open(menuTemplate, menu);
}
function MMU_CallbackHandler(result, contextString)
{
	{
		MMU_StopPendingTimerEventsFromCallback();
		var context=MMU_ParseContext(contextString);
		var menuTemplate=document.getElementById(context.TemplateClientId);
		if (menuTemplate==null) { alert(L_Loading_Error_Text); return; }
		var menu=document.getElementById(context.MenuClientId);
		if (menu==null) { alert(L_Loading_Error_Text); return; }
		var disabledIds="";
		var hiddenIds="";
		var checkedIds="";
		var tokensAndValues="";
		var menuItemsHtml="";
		var parts=result.split(MMU_chDelim);
		if ((parts==null) || (parts.length !=5))
		{
			menuItemsHtml=MMU_GenerateErrorMenuItem(L_Loading_Error_Text);
		}
		else
		{
			var re=new RegExp(MMU_chDelimEnc,"g");
			disabledIds=parts[0].replace(re, MMU_chDelim);
			hiddenIds=parts[1].replace(re, MMU_chDelim);
			checkedIds=parts[2].replace(re, MMU_chDelim);
			tokensAndValues=parts[3].replace(re, MMU_chDelim);
			menuItemsHtml=parts[4].replace(re, MMU_chDelim);
		}
		menu.setAttribute("menuItemsDisabled", disabledIds);
		menu.setAttribute("menuItemsHidden", hiddenIds);
		menu.setAttribute("menuItemsChecked", checkedIds);
		menu.setAttribute("menuTokenValues", tokensAndValues);
		MMU_RemoveCallbackItemsFromMenuTemplate(menuTemplate);
		menuTemplate.innerHTML=menuTemplate.innerHTML+menuItemsHtml;
		HideMenu(menuTemplate);
		MMU_Open(menuTemplate, menu);
		menu.setAttribute("callbackInProgress", "");
	}
	{
	}
}
function MMU_CallbackErrHandler(result, contextString)
{
	try
	{
		alert(L_Loading_Error_Text);
		var context=MMU_ParseContext(contextString);
		var menuTemplate=document.getElementById(context.TemplateClientId);
		if (menuTemplate==null) { alert(L_Loading_Error_Text); return; }
		var menu=document.getElementById(context.MenuClientId);
		if (menu==null) { alert(L_Loading_Error_Text); return; }
		menu.setAttribute("callbackInProgress", "");
		var errorMessage=L_Loading_Error_Text;
		if ((result=="timeout") && (context.TimeoutMessage !=null) && (context.TimeoutMessage.length > 0))
		{
			errorMessage=context.TimeoutMessage;
		}
		MMU_UpdateOpenedMenuWithErrorItem(menu, menuTemplate, errorMessage);
		;
	}
	catch (ex)
	{
		alert(L_Loading_Error_Text);
	}
}
function MMU_ParseContext(contextString)
{
	try
	{
		var context=new Object();
		var values=contextString.split(';');
		context.TemplateClientId=values[0];
		context.MenuClientId=values[1];
		context.TimeoutMessage=values[2].replace(/%semi%/g, ";").replace(/%quot%/g, "\'");
		return context;
	}
	catch (ex)
	{
		alert(L_Loading_Error_Text);
	}
}
var L_NewFormLibTb3_Text="The document(s) could not be merged.\nThe required application may not be installed properly, or the template for this document library cannot be opened.\n\nPlease try the following:\n1. Check the General Settings for this document library for the name of the template, and install the application necessary for opening the template. If the application was set to install on first use, run the application and then try creating a new document again.\n\n2.  If you have permission to modify this document library, go to General Settings for the library and configure a new template.";
var L_NewFormLibTb4_Text="Select the document(s) you want to merge, and then click 'Merge Selected Documents' on the toolbar.";
function combineDocuments(strProgID, strTemplate, strSaveLocation)
{
	fNewDoc=false;
	{
		if ((browseris.w3c) && (!browseris.ie))
			document.all=document.getElementsByTagName("*");
		var fSelectionError=true;
		var strTemplateUrl;
		var strProgID2;
		try
		{
			var chkCombineCollection=document.all.chkCombine;
			for (i=0; fSelectionError && i<chkCombineCollection.length; i++)
				if (chkCombineCollection[i].checked && fSelectionError)
				{
					fSelectionError=false;
					strTemplateUrl=document.all.chkUrl[i].HREF;
					strProgID2=document.all.chkProgID[i].HREF;
				}
		}
		catch(ex)
		{
		}
		try
		{
			if (fSelectionError && document.all.chkCombine.checked)
			{
				fSelectionError=false;
				strTemplateUrl=document.all.chkUrl.HREF;
				strProgID2=document.all.chkProgID.HREF;
			}
		}
		catch(ex)
		{
		}
		if (!fSelectionError)
		{
			var bSuccess=false;
			try
				{
				NewDocumentButton=new ActiveXObject(strProgID2);
				fNewDoc=NewDocumentButton !=null;
				}
			catch(ex)
				{
				}
			if (!fNewDoc)
				alert(L_NewFormLibTb3_Text);
			else
			{
				try
				{					
					bSuccess=NewDocumentButton.MergeDocuments(strTemplateUrl, document.all.chkCombine, makeAbsUrl(strSaveLocation));
				}
				catch(e)
				{
				}
				if (!bSuccess)
					alert(L_NewFormLibTb3_Text);
				else
					window.onfocus=RefreshOnFocus;
			}
		}
		else
			alert(L_NewFormLibTb4_Text);
	}
}
var L_NewFormLibTb5_Text="Select the document(s) you want to relink, and then click 'Relink Selected Documents' on the toolbar.";
var L_NewFormLibTb6_Text="Only 500 documents can be relinked at a time. Modify your selection and then try again.";
function repairLinks(strRootFolder, strList, strVDir)
{
	if ((browseris.w3c) && (!browseris.ie))
		document.all=document.getElementsByTagName("*");
	var cntChecked=0;	
	var inputSubmitRepairDocs=document.all.SubmitRepairDocs;
	inputSubmitRepairDocs.value="";
	var inputs=document.getElementsByTagName('input');
	for (var i=0; i < inputs.length; i++)
	{
		if (inputs[i].id=='chkRepair')
		{
			if (inputs[i].checked)
			{
				inputSubmitRepairDocs.value+=inputs[i].getAttribute('docID');
				inputSubmitRepairDocs.value+=" ";
				cntChecked++;
			}
		}
	}
	if (cntChecked > 0 && cntChecked <=500)
	{
	  document.all.SubmitRepairRedirectList.value=strList;
	  document.all.SubmitRepairRedirectFolder.value=strRootFolder;
	  document.all.SubmitRepairDocsForm.action=strVDir+"/submitrepair.aspx";
	  document.all.SubmitRepairDocsForm.submit();
	}
	else
	  alert(cntChecked==0 ? L_NewFormLibTb5_Text : L_NewFormLibTb6_Text);
}
function NavigateToManageCopiesPage(strHttpRoot, strFileRef)
{
	STSNavigate(strHttpRoot+"/_layouts"+		"/managecopies.aspx?ItemUrl="+strFileRef+	"&Source="+GetSource());
}
var L_ViewVersion_Text="View";
var L_RestoreVersion_Text="Restore";
var L_DeleteVersion_Text="Delete";
var L_DenyVersion_Text="Reject this version";
var L_UnPublishVersion_Text="Unpublish this version";
function AddVersionMenuItemsCore(m, ctx)
{
	if (currentItemID !=null)
	{
	   var strCurrentItemID=currentItemID.toString();
	   if (strCurrentItemID.indexOf(".0.") >=0 )
	   return;
	}
	if (!HasRights(0x0, 0x40))
	  return;
	var menuOption;
	var IsCurrent=itemTable.getAttribute("isCur");
	var iLevel=itemTable.getAttribute("Level");
	var canViewProperty=itemTable.getAttribute("canViewProperty");
	if (currentItemFSObjType==null)
		currentItemFSObjType=GetAttributeFromItemTable(itemTable, "OType", "FSObjType");
	if (canViewProperty !="0")
	{
	menuOption=CAMOpt(m, L_ViewVersion_Text, "javascript:ViewVersion()", "");
		menuOption.id="ID_ViewVersion";
	}
	if (HasRights(0x0, 0x4))
	{
		menuOption=CAMOpt(m, L_RestoreVersion_Text, "javascript:RestoreVersion()", "");
		menuOption.id="ID_RestoreVersion";
	}
	if (HasRights(0x0, 0x80) && IsCurrent !="1")
	{
		menuOption=CAMOpt(m, L_DeleteVersion_Text, "javascript:DeleteVersion()", "");
		menuOption.id="ID_DeleteVersion";
	}
	if (HasRights(0x0, 0x10) && HasRights(0x0, 0x4))
	{
		if ((ctx.isModerated || ctx.EnableMinorVersions) && (currentItemFSObjType !=1)  &&
			(iLevel==1 && IsCurrent=="1"))
		{
			var menustring=L_DenyVersion_Text;
			if (ctx.EnableMinorVersions)
				menustring=L_UnPublishVersion_Text;
			menuOption=CAMOpt(m, menustring, "javascript:TakeOfflineVersion()", "");
			menuOption.id="ID_TakeOfflineVersion";
		}
	}
}
function ViewVersion()
{
	if (! IsContextSet())
		return;
	STSNavigate(itemTable.getAttribute("verUrl"));
}
var L_Version_Restore_Confirm_Text="You are about to replace the current version with the selected version.";
var L_Version_RestoreVersioningOff_Confirm_Text="Versioning is currently disabled. As a result, you are about to overwrite the current version. All changes to this version will be lost.";
var L_Version_NoRestore_Current_ERR="Cannot restore the current version.";
function RestoreVersion()
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	if (itemTable.getAttribute("isMostCur") !="0")
	{
		alert(L_Version_NoRestore_Current_ERR);
	}
	else
	{
		var path=ctx.HttpPath+"&op=Restore&ver="+itemTable.getAttribute("verId")
		if (confirm(ctx.verEnabled ? L_Version_Restore_Confirm_Text : L_Version_RestoreVersioningOff_Confirm_Text))
		{
			SubmitFormPost(path);
		}
	}
}
var L_Version_NoOffline_NonCurrent_ERR="You can only take offline the current published or approved version";
var L_Version_unpublish_Confirm_Text="Are you sure you want to unpublish this version of the document?";
var L_Version_deny_Confirm_Text="Are you sure you want to deny this version of the document?";
function TakeOfflineVersion()
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	var confrimstr=L_Version_deny_Confirm_Text;
	if (ctx.EnableMinorVersions)
		confrimstr=L_Version_unpublish_Confirm_Text
	if (itemTable.getAttribute("isCur") !="1" || itemTable.getAttribute("Level") !=1)
	{
		alert(L_Version_NoOffline_NonCurrent_ERR);
	}
	else if (confirm(confrimstr))
	{
		SubmitFormPost(ctx.HttpPath+"&op=TakeOffline");
	}
}
var L_Version_Delete_Confirm_Text="Are you sure you want to delete this version?";
var L_Version_Recycle_Confirm_Text="Are you sure you want to send this version to the site Recycle Bin?";
var L_Version_NoDelete_Current_ERR="You cannot delete the current checked in version, major version, or approved version.";
function DeleteVersion()
{
	if (! IsContextSet())
		return;
	var ctx=currentCtx;
	if (itemTable.getAttribute("isCur") !="0")
	{
		alert(L_Version_NoDelete_Current_ERR);
	}
	else
	{
		var path=ctx.HttpPath+"&op=Delete&ver="+itemTable.getAttribute("verId");
		if (confirm(ctx.RecycleBinEnabled ? L_Version_Recycle_Confirm_Text : L_Version_Delete_Confirm_Text))
		{
			SubmitFormPost(path);
		}
	}
}
var L_Version_DeleteAll_Confirm_Text="Are you sure you want to delete all previous versions associated with this file?";
var L_Version_RecycleAll_Confirm_Text="Are you sure you want to send all previous versions associated with this file to the site Recycle Bin?";
var L_Version_DeleteAllMinor_Confirm_Text="Are you sure you want to delete all previous draft versions of this file?";
var L_Version_RecycleAllMinor_Confirm_Text="Are you sure you want to send all previous draft versions of this file to the site Recycle Bin?";
var L_Version_NoDeleteAll_None_ERR="There are no previous versions to delete.";
function DeleteAllVersions(nVers, ctx)
{
	if (nVers <=1)
	{
		alert(L_Version_NoDeleteAll_None_ERR);
	}
	else
	{
		if (confirm(ctx.RecycleBinEnabled ? L_Version_RecycleAll_Confirm_Text : L_Version_DeleteAll_Confirm_Text))
		{
			SubmitFormPost(ctx.HttpPath+"&op=DeleteAll");
		}
	}
}
function DeleteAllMinorVersions(nVers, ctx)
{
	if (nVers <=1)
	{
		alert(L_Version_NoDeleteAll_None_ERR);
	}
	else if (confirm(ctx.RecycleBinEnabled ? L_Version_RecycleAllMinor_Confirm_Text : L_Version_DeleteAllMinor_Confirm_Text))
	{
		SubmitFormPost(ctx.HttpPath+"&op=DeleteAllMinor");
	}
}
function EditInGrid(using, viewguid)
{
	EnsureListControl();
	if (fListControl)
	{
		encViewId=escapeProperly(viewguid);
		strDocUrl=using+"?ShowInGrid=True&View="+encViewId;
		pageView=GetUrlKeyValue("PageView", true);
		if (pageView !="")
		{
			strDocUrl=strDocUrl+"&PageView="+pageView;
		}
		showWebPart=GetUrlKeyValue("ShowWebPart", true);
		if (showWebPart !="")
		{
			strDocUrl=strDocUrl+"&ShowWebPart="+showWebPart;
		}
		viewId=GetUrlKeyValue("View", true);
		if ((viewId.toUpperCase()==viewguid.toUpperCase()) || (viewId.toUpperCase()==encViewId.toUpperCase()))
		{
			rootFolder=GetUrlKeyValue("RootFolder", true);
			if (rootFolder !="")
			{
				strDocUrl=strDocUrl+"&RootFolder="+rootFolder;
			}
		}
		SubmitFormPost(strDocUrl);
	}
	else
	{
		if (!fListErrorShown)
			{
			alert(L_EditInGrid_Text);
			fListErrorShown=true;
			}
	}
}
function ExitGrid(using)
{
	var strDocUrl;
	var pageView;
	var viewId;
	var rootFolder;
	strDocUrl=using;
	pageView=GetUrlKeyValue("PageView", true);
	viewId=GetUrlKeyValue("View", true);
	if (viewId !="")
	{
		strDocUrl=strDocUrl+"?View="+viewId;
		rootFolder=GetUrlKeyValue("RootFolder", true);
		if (rootFolder !="")
		{
			strDocUrl=strDocUrl+"&RootFolder="+rootFolder;
		}
		if (pageView !="")
		{
			strDocUrl=strDocUrl+"&PageView="+pageView;
		}
		showWebPart=GetUrlKeyValue("ShowWebPart", true);
		if (showWebPart !="")
		{
			strDocUrl=strDocUrl+"&ShowWebPart="+showWebPart;
		}
		strDocUrl=strDocUrl+"&ShowInGrid=HTML";
	}
	else
	{
		strDocUrl=strDocUrl+"?ShowInGrid=HTML";
		if (pageView !="")
		{
			strDocUrl=strDocUrl+"&PageView="+pageView;
		}
		showWebPart=GetUrlKeyValue("ShowWebPart", true);
		if (showWebPart !="")
		{
			strDocUrl=strDocUrl+"&ShowWebPart="+showWebPart;
		}
	}
	SubmitFormPost(strDocUrl);
}

