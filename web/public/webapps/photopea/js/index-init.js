(function(){
  const CODE='photopea', STORE_KEY='photopea_history_list';
  const app=document.getElementById('app');
  const sdk=()=>window.$v9os||parent.$v9os||null;
  let history=[], frame=null, ready=false, queue=[], currentFile=null;
  async function getData(k,d){ if(sdk()?.webDataPost){const r=await sdk().webDataPost(CODE,'get',{key:k},'');return r==null?d:r;} try{return JSON.parse(localStorage.getItem(CODE+':'+k)||JSON.stringify(d));}catch(e){return d;} }
  async function setData(k,v){ if(sdk()?.webDataPost)return sdk().webDataPost(CODE,'set',{key:k,val:v},''); localStorage.setItem(CODE+':'+k,JSON.stringify(v)); }
  function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function ensureFrame(){ if(frame)return; frame=document.getElementById('photopea-div'); if(frame)return; app.innerHTML='<iframe id="photopea-div" src="./photopea/index.html" style="border:0;width:100%;height:100vh"></iframe>'; frame=document.getElementById('photopea-div'); }
  async function addHistory(file){}
  async function openFile(file){ if(!file)return; currentFile=file; ensureFrame(); if(!file.url)return; const buffer=await fetch(file.url).then(r=>r.arrayBuffer()); const msg={action:'open',buffer,file}; if(ready) frame.contentWindow.postMessage(msg,'*'); else queue.push(msg); }
  async function selectFile(){ const f=await sdk()?.file?.selectFile(null,'请选择图片/PSD 文件',null,'true'); if(f) openFile(f); }
  function renderHome(){ ensureFrame(); }
  function sameName(a,b){ return String(a||'').toLowerCase() === String(b||'').toLowerCase(); }
  window.addEventListener('message',async e=>{ const d=e.data||{}; if(d.action==='iframeInit'){ ready=true; while(queue.length) frame.contentWindow.postMessage(queue.shift(),'*'); } if(d.action==='saveFile'){ const file=d.file||currentFile; const blob=new Blob([d.buffer]); const name=d.name||file?.name||'image.psd'; const canOverwrite=!!(file?.saveData&&sameName(name,file.name)); const ok=canOverwrite?await sdk().file.saveFileNoSelect(file.saveData,blob):await sdk().file.saveFile('请选择保存目录',name,blob); } });
  async function previewFile(file){ await openFile(file); }
  function parseInitial(){
    const p = new URL(location.href).searchParams;
    if (!p.get('url')) return null;
    return {
      ext: p.get('ext'),
      name: p.get('name'),
      size: Number(p.get('size') || 0),
      url: p.get('url'),
      saveData: p.get('saveData') ? JSON.parse(decodeURIComponent(p.get('saveData'))) : undefined
    };
  }
  function wait(cb){ if(window.__winId&&sdk()?.event?.on)cb(); else setTimeout(()=>wait(cb),30); }
  (async()=>{
    history=[];
    const initial = parseInitial();
    if(initial) await previewFile(initial);
    else renderHome();
    if(new URL(location.href).searchParams.get('action')==='open' && !initial){
      wait(()=>{sdk().event.on('fileOpenEdit',p=>{if(p?.target===CODE)openFile(p.data)});sdk().event.emit('initFileOpenEdit',{type:'fileOpenEdit',confirm:true});});
    }
  })();
})();
