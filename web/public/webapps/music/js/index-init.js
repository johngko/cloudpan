(function(){
  const CODE='music', STORE_KEY='music_history_list';
  const app=document.getElementById('app');
  const sdk=()=>window.$v9os||parent.$v9os||null;
  const AUDIO_EXTS='mp3,flac,aac,ogg,wav,m4a,wma';
  let history=[];
  let currentApiUrl='';
  async function getData(k,d){ if(sdk()?.webDataPost){const r=await sdk().webDataPost(CODE,'get',{key:k},'');return r==null?d:r;} try{return JSON.parse(localStorage.getItem(CODE+':'+k)||JSON.stringify(d));}catch(e){return d;} }
  async function setData(k,v){ if(sdk()?.webDataPost)return sdk().webDataPost(CODE,'set',{key:k,val:v},''); localStorage.setItem(CODE+':'+k,JSON.stringify(v)); }
  function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function ext(name){ name=String(name||''); const i=name.lastIndexOf('.'); return i>=0?name.slice(i+1).toLowerCase():''; }
  async function addHistory(file){}
  function revokeCurrentApiUrl(){ if(currentApiUrl){ URL.revokeObjectURL(currentApiUrl); currentApiUrl=''; } }
  function makeMusicList(files,playUrl){
    const list=(files||[]).filter(item=>item&&item.url).map(item=>({
      artist:item.artist||'',
      lrc:item.expandUrl||item.lrc||item.lrcUrl||'',
      name:item.name||decodeURIComponent(String(item.url).split('/').pop()||'未知音乐'),
      pic:item.pic||item.cover||'',
      url:item.url
    }));
    const idx=list.findIndex(item=>item.url===playUrl);
    if(idx>0) list.unshift(list.splice(idx,1)[0]);
    return list;
  }
  function blobApiUrl(list){
    revokeCurrentApiUrl();
    currentApiUrl=URL.createObjectURL(new Blob([JSON.stringify(list)],{type:'application/json'}));
    return currentApiUrl;
  }
  async function openFiles(files,playUrl){
    if(!files||!files.length)return;
    const first=files.find(item=>item&&item.url)||files[0];
    const list=makeMusicList(files,playUrl||(first&&first.url));
    if(!list.length)return;
    const api=blobApiUrl(list);
    app.innerHTML=`<iframe src="./HeoMusic/index.html?id=default&server=v9os&type=playlist&api=${encodeURIComponent(api)}&time=${Date.now()}" style="border:0;width:100%;height:100vh"></iframe>`;
  }
  async function openFile(file){
    const normalized = normalizeFiles([file]);
    const play = normalized.find(item=>item&&item.default) || normalized[0];
    await openFiles(normalized, play && play.url);
  }
  async function selectFile(){ const f=await sdk()?.file?.selectFile(null,'请选择音频文件',AUDIO_EXTS,'false'); if(f) openFile(f); }
  function renderHome(){ app.innerHTML=`<div class="nf-direct-home"><div class="nf-home-card"><img src="logo.png" class="nf-home-icon"><h1>音乐播放器</h1><p class="nf-muted">支持 mp3, flac, aac, ogg, wav, m4a, wma</p><div class="nf-home-actions"><button data-open>打开文件</button></div></div></div>`; app.querySelector('[data-open]').onclick=selectFile; }
  async function previewFile(file){ await openFile(file); }
  function parseInitial(){
    const p = new URL(location.href).searchParams;
    if (!p.get('url')) return null;
    const name=p.get('name')||p.get('fname')||decodeURIComponent(p.get('url')).split('/').pop();
    return {
      ext: p.get('ext')||ext(name),
      name,
      size: Number(p.get('size') || 0),
      url: p.get('url'),
      saveData: p.get('saveData') ? JSON.parse(decodeURIComponent(p.get('saveData'))) : undefined,
      expandUrl: p.get('expandUrl') || p.get('lrc') || ''
    };
  }
  function normalizeOne(file){
    if(!file) return null;
    const name=file.name||file.fname||decodeURIComponent(String(file.url||file.path||'')).split('/').pop();
    return {...file,name,ext:file.ext||ext(name),url:file.url||file.path,expandUrl:file.expandUrl||file.lrc||file.lrcUrl||''};
  }
  function normalizeFiles(files){
    const result=[];
    (files||[]).forEach(file=>{
      if(!file) return;
      if(Array.isArray(file.expandFiles) && file.expandFiles.length){
        file.expandFiles.forEach(one=>{
          const item=normalizeOne(one);
          if(item) result.push(item);
        });
        return;
      }
      const item=normalizeOne(file);
      if(item) result.push(item);
    });
    return result.filter(item=>item&&item.url);
  }
  function wait(cb){ if(window.__winId&&sdk()?.event?.on)cb(); else setTimeout(()=>wait(cb),30); }
  window.addEventListener('beforeunload',revokeCurrentApiUrl);
  window.addEventListener('message',function(e){
    const data=e.data||{};
    if(data.action==='addOpenFiles'){
      const files=normalizeFiles(data.files);
      const play=files.find(item=>item&&item.default)||files[0];
      if(files.length) openFiles(files,play&&play.url);
    }
  });
  (async()=>{
    history=[];
    const initial = parseInitial();
    if(initial) await previewFile(initial);
    else renderHome();
    if(new URL(location.href).searchParams.get('action')==='open' && !initial){
      wait(()=>{sdk().event.on('fileOpenEdit',p=>{if(p?.target===CODE)openFile(p.data);});sdk().event.emit('initFileOpenEdit',{type:'fileOpenEdit',confirm:true});});
    }
  })();
})();
