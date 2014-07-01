"use strict"; 

/*
  Copyright 2014 Google Inc. All rights reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

String.prototype.format = function() {
    var str = this;
    for (var i = 0; i < arguments.length; i++) 
        str = str.replace(new RegExp('_|-'+i+'-|_', 'gi'), arguments[i]);
    return str;
};



function requestURL(url,method,data,headerParams,responseType){
	return new Promise( function(resolve,reject){
		var oReq = new XMLHttpRequest();
		oReq.open(method, url, true);
		for(var param in headerParams)
			oReq.setRequestHeader(param, headerParams[param]);
		oReq.responseType = responseType;
		oReq.onload = function (oEvent) {
			if(oReq.status == 200)
				resolve(oReq.response);
			else
				reject(oReq.status+' '+oReq.statusText);
		};
		oReq.onerror = function() {
  			reject(Error("Network Error"));
		};
		oReq.send(data);
	});
}


function strToCodeArrayExceptCodes(str,codes){
	var len = str.length;
	var arr = [];
	var code;
	for(var i=0;i<len;i++)
	{
		code = str.charCodeAt(i);
		if(!codes.hasOwnProperty(code)){
			arr.push(code);
			codes[code]=0;
		}
	}
	return arr;
}

function readPersistedCharacters(idx_file,fs){
	return getFileAsText(fs,idx_file).then(function(idx_text){
		if(idx_text){
			return JSON.parse(idx_text);
		}else{
			return {};
		}
	});
}

function determineCharacters(font_name,codes,text){
	return new Promise(function(resolve,reject){
		var arr = strToCodeArrayExceptCodes(text,codes);
		resolve(arr);
	});
}

function requestCharacters(chars, font_name){

	return requestURL('/incremental_fonts/request','POST',JSON.stringify({'font':font_name,'arr':chars}),{'Content-Type':'application/json'},'arraybuffer');
}

function requestQuota(size){
	return new Promise(function(resolve,reject){
		navigator.webkitPersistentStorage.requestQuota(size + size/3,
			function(grantedSize) { 
				resolve(grantedSize); 
			}, 
			reject
		);		
	});
}

function setTheFont(font_name,font_src){
	font_src += ('?t='+Date.now());
	console.log(font_src);
	var font = new FontFace(font_name, "url("+font_src+")", {});
	document.fonts.add(font);
	font.load(); 
}

function requestTemporaryFileSystem(grantedSize){
	window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
	return new Promise(function(resolve,reject){
		window.requestFileSystem(window.TEMPORARY, grantedSize, resolve , reject);
	});
}



function requestPersistentFileSystem(grantedSize){
	window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
	return new Promise(function(resolve,reject){
		window.requestFileSystem(window.PERSISTENT, grantedSize, function(fs) {resolve(fs); } , reject);
	});
}

function requestBaseFont(name){
	return requestURL('/fonts/'+name+'/base','GET',null,{},'arraybuffer');
}

function requestBaseGZFont(name){
	return requestURL('/fonts/'+name+'/base.gz','GET',null,{},'arraybuffer');
}


function getBaseFont(inFS,fs,fontname,filename){
	if(inFS){
			return Promise.resolve();
	}else{
			return requestBaseGZFont(fontname).then(gunzipBaseFont).then(sanitizeBaseFont).then(
					function(sanitized_base){ 
						return persistToTheFilesystem(fs,filename,sanitized_base,'application/octet-binary');
				});
	}

}


function gunzipBaseFont(array_buffer){
	var gunzip = new Zlib.Gunzip(new Uint8Array(array_buffer));
	return gunzip.decompress().buffer;
}

function sanitizeBaseFont(baseFont){
    var fontObj = parseFont(baseFont);
    var fontParser = new Parser(new DataView(baseFont),0);
    var glyphOffset =  fontObj.glyfOffset;
    for(var i=1;i<fontObj.numGlyphs;i+=1)
    {
      fontParser.writeShortByOffset(glyphOffset+fontObj.loca[i],-1);  
    }
    return baseFont;
}

function createTheFile(filename){
	return new Promise(function(resolve,reject){
		fs.root.getFile(filename,{create:true},function(fe){ resolve(fe)},reject);
	});
}

function createFileWriter(fileEntry){
	return new Promise(function(resolve,reject){
		fileEntry.createWriter(function(fw){ resolve(fw);}
			,reject)
	});
}

function getFileEntry(fs,filename,toCreate){
	return new Promise(function(resolve,reject){
		fs.root.getFile(filename,{create:toCreate},
			function(fileEntry){resolve(fileEntry)},
			reject);
	});
}

function getFileObj(fileEntry){
	return new Promise(function(resolve,reject){
		fileEntry.file(function(file){ resolve(file) },reject);
	});
}

function readFileAsArrayBuffer(file){	
	return new Promise(function(resolve,reject){
		var reader = new FileReader();	
		reader.onloadend = function(e){resolve(e.target.result)};
		reader.onerror = reject;
		reader.readAsArrayBuffer(file);
	});
}

function readFileAsText(file){	
	return new Promise(function(resolve,reject){
		var reader = new FileReader();	
		reader.onloadend = function(e){resolve(e.target.result)};
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

function getFileWriter(fs,filename){
	return getFileEntry(fs,filename,true).then(createFileWriter);
}


function injectCharacters(baseFont,glyphData){
    var glyphParser = new Parser(new DataView(glyphData),0);
    console.log('bundle size:'+glyphData.byteLength);
    console.log('baseFont size:'+baseFont.byteLength);
    var fontParser = new Parser(new DataView(baseFont),0);
    var fontObj = parseFont(baseFont);
    var count = glyphParser.parseUShort();
    var flag_mtx = glyphParser.parseByte();
    var glyphOffset=  fontObj.glyfOffset;
    console.log('glyfOff2: '+glyphOffset);
    console.log('count'+count);
    for(var i=0;i<count;i+=1)
    {
       var id = glyphParser.parseUShort();
       var hmtx,vmtx;
       if(flag_mtx & 1){
           hmtx = glyphParser.parseUShort();
           fontObj.metrics[id][1] = hmtx
       }
       if(flag_mtx & 2){
          vmtx = glyphParser.parseUShort();
       }      
       var offset = glyphParser.parseULong();
       var length = glyphParser.parseUShort();
       //console.log('id:'+id+' off:'+offset+' len:'+length);
       var bytes = glyphParser.parseBytes(length);
       fontParser.setBytes(glyphOffset+offset,bytes);
    }
    if(flag_mtx & 1)
        fontParser.writeHmtx(fontObj);
    console.log('injection is done!');
    return baseFont;
}

function checkIfFileExists(fs,filename){
	return new Promise(function(resolve,reject){
		var dirReader = fs.root.createReader();
		dirReader.readEntries(function(entries){
			resolve(entries.some(function(elem,idx,arr){
				return elem.name == filename;
			}));
		});
	});
}

var formatFontFace = "\
     @font-face {\
        font-family: 'myfont';\
        src: url('_|-0-|_') format('truetype');\
      }"


function createCSSText(fileURL){
	return formatFontFace.format(fileURL+'?t='+Date.now());
}

function getFileAsArrayBuffer(fs,filename){
	return getFileEntry(fs,filename,true).then(getFileObj).then(readFileAsArrayBuffer);
}

function getFileAsText(fs,filename){
	return getFileEntry(fs,filename,true).then(getFileObj).then(readFileAsText);
}

function writeToTheFile(content,contentType,fileWriter){
	return new Promise(function(resolve,reject){
		fileWriter.onwriteend = function(e) { resolve(e); };
		fileWriter.onerror = function(e) {  reject(e)};                
        fileWriter.write(new Blob([content],{type:contentType}));
    });
}

function persistToTheFilesystem(fs,filename,content,type){
	return getFileWriter(fs,filename).then(function(fw){ 
		return writeToTheFile(content,type,fw);
	});	
}




var fileSystemReady = requestTemporaryFileSystem(8 * 1024 * 1024);

function getBaseToFileSystem(font_name)
{

	var FILENAME = font_name + '.ttf'

	var doesBaseExist = fileSystemReady.then(
		function(fs){
			return checkIfFileExists(fs,FILENAME)
		}
	);

	var baseFontPersisted = Promise.all([doesBaseExist, fileSystemReady]).then(
		function(results){
			return getBaseFont(results[0],results[1],font_name,FILENAME);
		}
	);

	var fileURLReady = Promise.all([baseFontPersisted,fileSystemReady])
	.then(
		function(results){ 
			return getFileEntry(results[1],FILENAME,false);
		})
	.then(
		function(fe){ 
			return fe.toURL(); 
		}
	);

	return fileURLReady.then(
		function(fileURL){
			setTheFont(font_name, fileURL);
		}
	);

}

function requestGlyphs(font_name,text)
{

	var INDEXFILENAME = font_name + '.idx'

	var injectedChars = fileSystemReady.then(
		function(fs){
			return readPersistedCharacters(INDEXFILENAME,fs);
		}
	);

	var charsDetermined = injectedChars.then(
		function(chars){
			return determineCharacters(font_name,chars,text);
		}
	);

	var indexUpdated = Promise.all([charsDetermined,fileSystemReady,injectedChars]).then(function(results){
		return persistToTheFilesystem(results[1],INDEXFILENAME,JSON.stringify(results[2]),'text/plain');
	});
	

	var bundleReady = Promise.all([charsDetermined,indexUpdated]).then(
		function(arr){ 
			return requestCharacters(arr[0],font_name).then(gunzipBaseFont);
		}
	);


	return bundleReady;
}

function injectBundle(font_name,bundle){
	var filename = font_name + '.ttf';

	var charsInjected =fileSystemReady.then(
		function(fs){
			return getFileAsArrayBuffer(fs,filename)
		}
	).then(
			function(baseFont){
				return injectCharacters(baseFont,bundle);
			}
	);

	var fileUpdated = Promise.all([charsInjected,fileSystemReady]).then(
		function(results){
			return persistToTheFilesystem(results[1],filename,results[0],'application/octet-binary');
		}
	);

	var fileURLReady = Promise.all([fileUpdated,fileSystemReady])
	.then(
		function(results){ 
			return getFileEntry(results[1],filename,false);
		})
	.then(
		function(fe){ 
			return fe.toURL(); 
		}
	);

	return fileURLReady.then(
		function(fileURL){
			setTheFont(font_name, fileURL);
		}
	);

}

function incrUpdate(font_name,text){

	var FILENAME = font_name + '.ttf'

	var bundleReady = requestGlyphs(font_name,text);

	return bundleReady.then(
		function(bundle){
				injectBundle(font_name,bundle);
		}
	);
}

function updateFont(font_name)
{
	if(!window.performance.perf)
		window.performance.perf = {};
	var START;
	FILENAME = font_name + '.ttf'
	INDEXFILENAME = font_name + '.idx'
	
	//var baseSanitized = requestBaseFont('noto')


	var fileSystemReady = requestTemporaryFileSystem(8 * 1024 * 1024);



	var isBaseExist = fileSystemReady.then(function(fs){
		START = Date.now();
		return checkIfFileExists(fs,FILENAME)});

	var baseFontPersisted  = Promise.all([isBaseExist, fileSystemReady]).then(function(results){
		return getBaseFont(results[0],results[1],font_name,FILENAME);
	});

	var injectedChars = fileSystemReady.then(function(fs){
		return readPersistedCharacters(INDEXFILENAME,fs);
	});
			

	var bundleReady = injectedChars.then(function(chars){
		return determineCharacters(font_name,chars,document.body.innerText);
	}).then(function(arr){ 

		return requestCharacters(arr[0],arr[1]).then(gunzipBaseFont);

	});

	var indexUpdated = Promise.all([bundleReady,fileSystemReady,injectedChars]).then(function(results){
		return persistToTheFilesystem(results[1],INDEXFILENAME,JSON.stringify(results[2]),'text/plain');
	});

	var charsInjected = Promise.all([baseFontPersisted,bundleReady,fileSystemReady]).then(
		function(results){
			return getFileAsArrayBuffer(results[2],FILENAME).then(
				function(baseFont){
					return injectCharacters(baseFont,results[1]);
				}
			);
		}
	);

	var fileURLReady = fileSystemReady.then(function(fs){ 
		return getFileEntry(fs,FILENAME,true)
	}).then(function(fe){ 
		return fe.toURL() 
	});

	var fileUpdated = Promise.all([charsInjected,fileSystemReady]).then(
		function(results){
			return persistToTheFilesystem(results[1],FILENAME,results[0],'application/octet-binary');
		}
	);

	/*var styleSheetReady = Promise.all([fileSystemReady,fileURLReady.then(createCSSText)]).then(function(results){
		return persistToTheFilesystem(results[0],'my_font.css',results[1],'text/css')
	});*/


	Promise.all([fileUpdated,fileURLReady,indexUpdated]).then(
		function(results){
			var END = Date.now();
			console.log('Took '+(END-START)+' ms to load');

			window.performance.perf[font_name] = (END-START);

			setTheFont(font_name, results[1]);

		}
	);

}
