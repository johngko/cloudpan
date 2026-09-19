(function(){
  function loadScript(src){ document.write("<script src='"+src+"'></script>"); }
  function rootFrom(src, depth){ var ss = src.split('/'); ss.length = ss.length - depth; return ss.join('/'); }
  function currentScript(){
    var script = document.currentScript;
    if(!script && document.querySelector) script = document.querySelector("script[src*='init.js']");
    if(!script){
      var scripts = document.getElementsByTagName('script');
      script = scripts[scripts.length - 1];
    }
    return script;
  }
  var script = currentScript();
  var rootPath = rootFrom(script.src, 3);
  var search = script.src.substring(script.src.indexOf('?')!=-1 ? script.src.indexOf('?') : script.src.length);
  window.utils = window.utils || {};
  utils.rootPath = rootPath;
  utils.uihost = rootPath + '/common/smart-ui';
  utils.config = utils.config || {version: Date.now()};
  utils.uuid = utils.uuid || function(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); };
  utils.documentReady = utils.documentReady || function(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  };
  utils.delayAction = utils.delayAction || function(check, fn, timeout){
    var start = Date.now();
    (function loop(){
      if(check()){ fn(); return; }
      if(timeout && Date.now() - start > timeout) return;
      setTimeout(loop, 30);
    })();
  };
  utils.delayOneAction = utils.delayOneAction || function(key, delay, fn){
    utils.__delayTimers = utils.__delayTimers || {};
    clearTimeout(utils.__delayTimers[key]);
    utils.__delayTimers[key] = setTimeout(fn, delay);
  };
  utils.syncLoadData = utils.syncLoadData || function(url, cb){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if(xhr.status >= 200 && xhr.status < 300) cb(xhr.responseText);
  };
  utils.parseJSON = utils.parseJSON || function(text){ try{return JSON.parse(text);}catch(e){return null;} };
  utils.$ = utils.$ || {};
  utils.$.prompt = utils.$.prompt || function(text, cb){ var val = window.prompt(text || ''); cb(val !== null, val); };
  utils.$.confirm = utils.$.confirm || function(text, cb){ cb(window.confirm(text || '')); };
  utils.$.loading = utils.$.loading || function(){};
  utils.$.cancelLoading = utils.$.cancelLoading || function(){};
  if(window.Vue && !Vue.app){
    Vue.app = function(options){ return Vue.createApp(options).mount('#app'); };
  }
  window.smartInitHook = function(config){
    config.versionUrl = '';
    config.plugins.ace = [{js:rootPath + '/js/boot.js'}];
    var webos = null;
    try{ webos = parent.webos; }catch(e){}
    if(!webos){ config.plugins.ace.push({js: rootPath + '/common/sdk/plugins.sdk.js'}); }
    else{ window.webos = parent.webos; }
    if(window.initVersion){
      try{ utils.syncLoadData(rootPath + '/index.json?_=' + Date.now(), function(text){ var data = JSON.parse(text); config.version = data.version || data.Version || config.version; }); }catch(e){}
    }
  };
})();
