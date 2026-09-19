(function(){
  window.__v9osWebosCompatInstalled = true;
  var api = function(){ return window.$v9os || parent.$v9os || null; };
  var code = (location.pathname.match(/\/api\/webplugin\/([^\/]+)/)||[])[1] || '';
  var host = function(){ return (api() && api().host) || location.origin; };
  var base = function(){ return host() + '/api/webplugin/' + code + '/'; };
  function msg(type,text){ var a=api(); if(a&&a.msg&&a.msg[type]) return a.msg[type](text); if(type==='error') alert(text); }
  function ext(name){ name=String(name||''); var i=name.lastIndexOf('.'); return i>=0?name.slice(i+1).toLowerCase():''; }
  function parentPath(path){ path=String(path||''); var i=path.lastIndexOf('/'); return i>0?path.slice(0,i):''; }
  function dataKey(k){ return code + ':' + k; }
  async function getData(k,def){ if(api()&&api().api&&api().api.webDataPost){ var r=await api().api.webDataPost(code,'get',{key:k},''); return r==null?def:r;} try{return JSON.parse(localStorage.getItem(dataKey(k))||JSON.stringify(def));}catch(e){return def;} }
  async function setData(k,v){ if(api()&&api().api&&api().api.webDataPost) return api().api.webDataPost(code,'set',{key:k,val:v},''); localStorage.setItem(dataKey(k),JSON.stringify(v)); return v; }
  function selectFileExt(filter,cb,multi){
    var a=api();
    if(!a||!a.file||!a.file.selectFile) return msg('error','please open plugin in V9OS');
    var writable = filter === 'folder' ? 'false' : 'true';
    if(filter === 'folder'){
      a.file.saveFile('请选择保存目录','未命名',new Blob([])).then(function(flag){ cb([]); });
      return;
    }
    a.file.selectFile(null,'请选择文件',filter&&filter!=='*'?filter:null,writable).then(function(res){
      if(!res) return;
      cb([res]);
    });
  }
  window.webos = window.webos || {};
  webos.context = webos.context || {set:function(){},get:function(){return null;}};
  webos.message = webos.message || {success:function(t){msg('success',t)},error:function(t){msg('error',t)},warn:function(t){msg('error',t)}};
  webos.inface = webos.inface || {};
  webos.inface.selectFileExt = webos.inface.selectFileExt || selectFileExt;
  webos.inface.setWinSimple = webos.inface.setWinSimple || function(){};
  webos.inface.closeCurrentWin = webos.inface.closeCurrentWin || function(){ var a=api(); a&&a.invoke&&a.invoke('$wins','closeWindow',window.__winId); };
  webos.inface.winChangeSize = webos.inface.winChangeSize || function(){};
  webos.inface.canChangeWallpaper = webos.inface.canChangeWallpaper || function(){return false;};
  webos.inface.changeWallpaper = webos.inface.changeWallpaper || function(){msg('error','wallpaper api not connected');};
  webos.util = webos.util || {};
  webos.util.getExtByName = webos.util.getExtByName || ext;
  webos.util.getParentPath = webos.util.getParentPath || parentPath;
  webos.util.getCacheTheme = webos.util.getCacheTheme || function(){return document.documentElement.dataset.theme||'light';};
  webos.util.blobToBase64 = webos.util.blobToBase64 || function(blob){return new Promise(function(resolve){var r=new FileReader();r.onload=function(){resolve(r.result)};r.readAsDataURL(blob);});};
  webos.util.getBigData = webos.util.getBigData || function(v){return v;};
  webos.util.getMainByName = webos.util.getMainByName || function(n){return n;};
  webos.util.getQrcodeInfo = webos.util.getQrcodeInfo || function(){return '';};
  webos.util.toQrcode = webos.util.toQrcode || function(){return '';};
  webos.fileSystem = webos.fileSystem || {};
  webos.fileSystem.zl = webos.fileSystem.zl || async function(path){return path;};
  webos.fileSystem.zlByName = webos.fileSystem.zlByName || async function(path){return path;};
  webos.fileSystem.videoUrl = webos.fileSystem.videoUrl || async function(path){return path;};
  webos.fileSystem.getDriveType = webos.fileSystem.getDriveType || async function(){return {};};
  webos.fileSystem.fileIconCalc = webos.fileSystem.fileIconCalc || async function(item){item.thumbnail='icon.png';return item;};
  webos.fileSystem.listFileByPath = webos.fileSystem.listFileByPath || async function(){return [];};
  webos.fileSystem.uploadSmallFile = webos.fileSystem.uploadSmallFile || async function(param){
    var a=api();
    if(!a||!a.file) return false;
    var blob = param && param.file ? param.file : new Blob([]);
    if(param && param.saveData) return await a.file.saveFileNoSelect(param.saveData, blob);
    if(param && param.fileData && param.fileData.saveData) return await a.file.saveFileNoSelect(param.fileData.saveData, blob);
    var name = (param && param.name) || 'untitled';
    return await a.file.saveFile('select save folder', name, blob);
  };
  webos.softUserData = webos.softUserData || {};
  webos.softUserData.syncList = webos.softUserData.syncList || async function(k,v){ if(arguments.length>1){await setData(k,v); return v;} var r=await getData(k,[]); return Array.isArray(r)?r:[]; };
  webos.softUserData.syncObject = webos.softUserData.syncObject || async function(k,v){ if(arguments.length>1){await setData(k,v); return v;} var r=await getData(k,{}); return r&&typeof r==='object'?r:{}; };
  webos.request = webos.request || {commonData:async function(){return null;}};
  webos.htmlHost = base().replace(/\/$/,''); webos.webHost = host();
  webos.el = webos.el || {isInClass:function(){return false;}};
})();
