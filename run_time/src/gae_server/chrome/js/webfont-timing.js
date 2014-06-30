var fontInfo = [
  { familyName: 'Acme', fileName: 'ueamsayjg_AE6hBQnsEcc_esZW2xOQ-xsNqO47m55DA.woff', size: '1.5' },
  { familyName: 'Geo', fileName: 'UI8QzXA7yD17NFtVExV-lg.woff', size: '11.2' },
  { familyName: 'Roboto', fileName: 'MMDEOSa6i6T9gBocjYCJkQ.woff', size: '72.4' },
  { familyName: 'Kranky', fileName: 'xoWb9ls7gtfC6bcwSS2agA.woff', size: '101.1' },
  { familyName: 'NotoSansUI', fileName: 'dOQO_yw3RAZ8Oi34Tamht_nZvTSLrt0ODqUY3DjsCVw.woff', size: '171.2' },
  { familyName: 'Arimo', fileName: '__nOLWqmeXdhfr0g7GaFePesZW2xOQ-xsNqO47m55DA.ttf', size: '435.7' },
  { familyName: 'Andika', fileName: 'U3ktHGd7aNMDoALZkNNnKfesZW2xOQ-xsNqO47m55DA.ttf', size: '1,086.0' },
  { familyName: 'NanumGothic', fileName: 'NanumGothic-Bold.ttf', size: '2,369.6' },
  { familyName: 'NanumBrushScript', fileName: 'NanumBrushScript-Regular.ttf', size: '3,745.3' },
  { familyName: 'NotoSans', fileName: 'noto-sans/base.gz', size: '15' },
  { familyName: 'NanumBrush', fileName: 'nanum-brush/base.gz', size: '62.6' }
];

function displayTimings() {
  var table = document.getElementById('timingTable');
  appendNavigationTimingRow(table, window.performance.timing);

  var resources = window.performance.getEntriesByType("resource");
  //console.log('resources.length = ' + resources.length);
  //alert('resources.length = ' + resources.length);
  var resourcesMap = {};
  for (var i = 0; i < resources.length; i++) {
    var entry = {};
    entry.resource = resources[i];
    var fontNameStart = entry.resource.name.lastIndexOf('/') + 1;
    var fileName = entry.resource.name.substr(fontNameStart);
    if(fileName == 'base.gz'){
      var fontFolderStart = entry.resource.name.substr(0,fontNameStart-1).lastIndexOf('/');
      fileName = entry.resource.name.substr( fontFolderStart+1 );
      console.log(fileName);
    }  
    resourcesMap[fileName] = entry;
  }
  for (var i = 0; i < fontInfo.length; i++) {
    //alert('fileName = ' + fontInfo[i].fileName);
    if (!resourcesMap[fontInfo[i].fileName])
      continue;
    fontInfo[i].resource = resourcesMap[fontInfo[i].fileName].resource;
    //alert('resource = ' + fontInfo[i].resource);
    appendFontTimingRow(table, fontInfo[i]);
  }
  
   //appendFontProcessingTimingRow(table,'noto-sans');
   appendFontProcessingTimingRow(table,'nanum-brush' );
}



function appendFontProcessingTimingRow(table,name) {
  //alert('navTiming = ' + navTiming);
  var row = table.insertRow(table.rows.length);
  var cell = 0;
  appendTimingCell(row, cell++, name+' processing time', 'left');
  appendTimingCell(row, cell++, '--');
  appendTimingCell(row, cell++, '--');
  appendTimingCell(row, cell++, '--');
  appendTimingCell(row, cell++, '--');
  appendTimingCell(row, cell++,window.performance.perf[name]);
}

function appendNavigationTimingRow(table, navTiming) {
  //alert('navTiming = ' + navTiming);
  var row = table.insertRow(table.rows.length);
  var cell = 0;
  appendTimingCell(row, cell++, '(this web page)', 'left');
  appendTimingCell(row, cell++, '1.8');
  appendTimingCell(row, cell++, navTiming.domainLookupEnd - navTiming.domainLookupStart);
  appendTimingCell(row, cell++, navTiming.connectEnd - navTiming.connectStart);
  appendTimingCell(row, cell++, navTiming.requestStart - navTiming.navigationStart);
  appendTimingCell(row, cell++, navTiming.responseEnd - navTiming.navigationStart);
}

function appendFontTimingRow(table, fontInfo) {
  var resourceTiming = fontInfo.resource;
  //alert('resourceTiming = ' + resourceTiming);
  var row = table.insertRow(table.rows.length);
  var cell = 0;
  appendTimingCell(row, cell++, fontInfo.familyName, 'left');
  appendTimingCell(row, cell++, fontInfo.size);
  appendTimingCell(row, cell++, resourceTiming.domainLookupEnd - resourceTiming.domainLookupStart);
  appendTimingCell(row, cell++, resourceTiming.connectEnd - resourceTiming.connectStart);
  appendTimingCell(row, cell++, resourceTiming.startTime);
  appendTimingCell(row, cell++, resourceTiming.duration);
}

function appendTimingCell(row, pos, value, align) {
  var cell = row.insertCell(pos);
  var mytype = typeof value;
  if (typeof value === 'number')
    cell.innerHTML = '' + Math.round(value);
  else
    cell.innerHTML = value;
  if (align)
    cell.style.textAlign = align;
}
