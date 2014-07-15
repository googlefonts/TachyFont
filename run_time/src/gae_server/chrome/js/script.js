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



var TTF=true;
var fileSystemReady = requestTemporaryFileSystem(8 * 1024 * 1024);

var global_start_time = Date.now();
var RLE_OPS = {  0xC0 : 'copy', 0xC8 : 'fill'};

var LOCA_BLOCK_SIZE = 64;
var EMPTY_FS = false;

var CHARS_INJECTED={};
var RESULTS=[];


function time_start(msg) {
  console.time('@@@ ' + msg);
  console.timeStamp('@@@ begin ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('begin ' + msg + ' at ' + cur_time+'\n');
  console.log('@@@ begin ' + msg + ' at ' + cur_time);
}

function time_end(msg) {
  console.timeEnd('@@@ ' + msg);
  console.timeStamp('@@@ end ' + msg);
  var cur_time = Date.now() - global_start_time;
  RESULTS.push('end ' + msg + ' at ' + cur_time+'\n');
  console.log('@@@ end ' + msg + ' at ' + cur_time);
}

function updateResults(){
    var resultsElem = document.getElementById('results');
     var aResult;
     while( resultsElem && (aResult = RESULTS.shift())){
      resultsElem.appendChild(document.createTextNode(aResult));
      resultsElem.appendChild(document.createElement('br'));
     }
}


function requestURL(url,method,data,headerParams,responseType){
   //time_start('fetch ' + url)
	return new Promise( function(resolve,reject){
		var oReq = new XMLHttpRequest();
		oReq.open(method, url, true);
		for(var param in headerParams)
			oReq.setRequestHeader(param, headerParams[param]);
		oReq.responseType = responseType;
		oReq.onload = function (oEvent) {
			if(oReq.status == 200) {
			    //time_end('fetch ' + url)
				resolve(oReq.response);
			} else
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
			return {0:0};//always request .notdef
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


function setTheFont(font_name,font_src){
	font_src += ('?t='+Date.now());
	console.log(font_src);
	var font = new FontFace(font_name, "url("+font_src+")", {});
	document.fonts.add(font);
	font.load().then(function(){
		var elem= document.getElementById('incrfont');
		if(elem)
			elem.style.visibility = '';
	});
}

function requestTemporaryFileSystem(grantedSize){
	window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
	return new Promise(function(resolve,reject){
		window.requestFileSystem(window.TEMPORARY, grantedSize, resolve , reject);
	});
}


function requestBaseFont(name){
	return requestURL('/fonts/'+name+'/base','GET',null,{},'arraybuffer');
}


function getBaseFont(inFS,fs,fontname,filename){
	if(inFS){
			return Promise.resolve();
	}else{

			return requestBaseFont(fontname).then(rleDecode).then(sanitizeBaseFont).then(
					function(sanitized_base){ 
						return persistToTheFilesystem(fs,filename,sanitized_base,'application/octet-binary');
				});
	}

}


function  byteOp(op){
	var byteCount = op & 0x03;
	var byteOperation = RLE_OPS[op & 0xFC];
	return [byteCount , byteOperation];
}

function rleDecode(array_buffer){
	//time_start('rle');
	var readOffset = 0;
	var writeOffset = 0;
	var data = new DataView(array_buffer);
	var totalSize = data.getUint32(readOffset); 
	var fill_byte;
	var byteOperation;
	var operationSize;
	var operationInfo;
	var i;
	readOffset+=4;
	//time_start('rle_alloc');
	var decodedData = new DataView(new ArrayBuffer(totalSize));
	//time_end('rle_alloc');
	while(writeOffset<totalSize){
		byteOperation = data.getUint8(readOffset); 
		readOffset++;
		operationInfo= byteOp(byteOperation);

		if(operationInfo[0]==0){
			operationSize = data.getUint8(readOffset); 
			readOffset+=1;
		}else if(operationInfo[0]==1){
			operationSize = data.getUint16(readOffset); 
			readOffset+=2;
		}else if(operationInfo[0]==2){
			operationSize = data.getUint32(readOffset); 
			readOffset+=4;
		}
		if(operationInfo[1]=='copy'){
			for(i=0;i<operationSize;i++){
				decodedData.setUint8(writeOffset,data.getUint8(readOffset));
				readOffset++;
				writeOffset++;	
			}
		}else if(operationInfo[1]=='fill'){
			fill_byte = data.getUint8(readOffset);
			readOffset++;
			if(fill_byte != 0){
				for(i=0;i<operationSize;i++){
					decodedData.setUint8(writeOffset,fill_byte);
					writeOffset++;	
				}	
			}else{
				writeOffset+=operationSize;
			}		
		}

	}
	 //time_end('rle');
	return decodedData.buffer;
}


function sanitizeBaseFont(baseFont){

	if(TTF){

	    //time_start('sanitize');
	    var fontObj = parseFont(baseFont);
	    var fontParser = new Parser(new DataView(baseFont),0);
	    var glyphOffset =  fontObj.glyfOffset;
	    var glyphCount = fontObj.numGlyphs;
	    var glyphSize;
	    for(var i=(LOCA_BLOCK_SIZE-1);i<glyphCount;i+=LOCA_BLOCK_SIZE)
	    {
	      glyphSize = fontObj.loca[i+1]-fontObj.loca[i];
	      if(glyphSize)
	        fontParser.writeShortByOffset(glyphOffset+fontObj.loca[i],-1);  
	    }
	    //time_end('sanitize');
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

var HAS_CFF = 4;
var HAS_HMTX = 1;
var HAS_VMTX = 2;

function injectCharacters(baseFont,glyphData){
    //time_start('inject')
    var glyphParser = new Parser(new DataView(glyphData),0);
    console.log('bundle size:'+glyphData.byteLength);
    var fontParser = new Parser(new DataView(baseFont),0);
    var fontObj = parseFont(baseFont);
    var count = glyphParser.parseUShort();
    var flags = glyphParser.parseByte();

    var glyphOffset,locaOffset;  
    if(flags & HAS_CFF)
    	glyphOffset = fontObj.cffOffset;
    else{
    	glyphOffset =fontObj.glyfOffset;
    	locaOffset = fontObj.locaOffset;
    }
    console.log('count'+count);
    for(var i=0;i<count;i+=1)
    {
       var id = glyphParser.parseUShort();
       var hmtx,vmtx;
       if(flags & HAS_HMTX){
           hmtx = glyphParser.parseUShort();
           fontObj.metrics[id][1] = hmtx
       }
       if(flags & HAS_VMTX){
          vmtx = glyphParser.parseUShort();
       }      
       var offset = glyphParser.parseULong();
       var length = glyphParser.parseUShort();

       if(!(flags & HAS_CFF)){
       		fontObj.loca[id] = offset;
       		var isChanged = (fontObj.loca[id+1] != offset+length);
       		fontObj.loca[id+1] = offset+length;
       		var prev_id = id -1;
       		while(prev_id>=0 && fontObj.loca[prev_id]>offset){
       			fontObj.loca[prev_id] = offset;
       			prev_id--;
       		}
       		/*if value is changed and length is nonzero
       		we should write -1*/
       		if(length>0 && isChanged)
       			fontParser.writeShortByOffset(glyphOffset+fontObj.loca[id+1],-1);
       }
       //CHARS_INJECTED[id]=0;
       var bytes = glyphParser.parseBytes(length);
       fontParser.setBytes(glyphOffset+offset,bytes);
    }
    if(!(flags & HAS_CFF))
    	fontParser.writeLoca(fontObj);
    if(flags & HAS_HMTX)
        fontParser.writeHmtx(fontObj);
    console.log('injection is done!');
    //time_end('inject')

    return baseFont;
}

function checkIfFileExists(fs,filename){
	return new Promise(function(resolve,reject){
		
			var dirReader = fs.root.createReader();
			dirReader.readEntries(function(entries){
				var exists = entries.some(function(elem,idx,arr){
					return elem.name == filename;
				});

				resolve(exists && !EMPTY_FS);
			});

	});
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

function clearFileSystem(){
	return fileSystemReady.then(function(fs){	

		var dirReader = fs.root.createReader();
		dirReader.readEntries(function(entries){
			entries.forEach(function(elem){
				 if(elem.isDirectory){
				 	elem.removeRecursively();
				 }else{
				 	elem.remove();	
				 }
			});
		});
	});
}


function getBaseToFileSystem(font_name)
{
  //time_start('getBaseToFileSystem');
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
		  //time_end('getBaseToFileSystem');
		}
	);

}

function requestGlyphs(font_name,text)
{
  //time_start('request glyphs')

	var INDEXFILENAME = font_name + '.idx'

	var doesIdxExist = fileSystemReady.then(
		function(fs){
			return checkIfFileExists(fs,INDEXFILENAME)
		}
	);

	var injectedChars = Promise.all([fileSystemReady,doesIdxExist]).then(
		function(results){
			if(results[1])
				return readPersistedCharacters(INDEXFILENAME,results[0]);
			else
				return {};
		}
	);

	var charsDetermined = injectedChars.then(
		function(chars){
			return determineCharacters(font_name,chars,text);
		}
	);

	var indexUpdated = Promise.all([charsDetermined,fileSystemReady,injectedChars]).then(function(results){
		if (results[0].length) {
	    return persistToTheFilesystem(results[1],INDEXFILENAME,JSON.stringify(results[2]),'text/plain');
		}
	});
	

	var bundleReady = Promise.all([charsDetermined,indexUpdated]).then(
		function(arr){ 
		  if (arr[0].length) {
		    return requestCharacters(arr[0],font_name);
		  } else {
		    return null;
		  }
		}
	);


	return bundleReady;
}

function injectBundle(font_name,bundle){
  //time_start('inject bundle')
	var filename = font_name + '.ttf';

	var charsInjected, fileUpdated;
	if (bundle != null) {
  	charsInjected =fileSystemReady.then(
  		function(fs){
  			return getFileAsArrayBuffer(fs,filename)
  		}
  	).then(
  			function(baseFont){
  				return injectCharacters(baseFont,bundle);
  			}
  	);
  
  	fileUpdated = Promise.all([charsInjected,fileSystemReady]).then(
  		function(results){
  			return persistToTheFilesystem(results[1],filename,results[0],'application/octet-binary');
  		}
  	);
	} else {
	  charsInjected = fileUpdated = Promise.resolve();
	}

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
		  //time_end('inject bundle')
			setTheFont(font_name, fileURL);
		}
	);

}

function incrUpdate(font_name,text){

  //time_start('incrUpdate')
	var FILENAME = font_name + '.ttf'

	var bundleReady = requestGlyphs(font_name,text);

	return bundleReady.then(
		function(bundle){
				injectBundle(font_name,bundle);

			  //time_end('incrUpdate')
		}
	);
}


