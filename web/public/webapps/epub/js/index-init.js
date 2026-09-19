(function(){
  const CODE='epub', STORE_KEY='epub_history_list';
  const app=document.getElementById('app');
  const sdk=()=>window.$v9os||parent.$v9os||null;
  let history=[];
  async function getData(k,d){ if(sdk()?.webDataPost){ const r=await sdk().webDataPost(CODE,'get',{key:k},''); return r==null?d:r;} try{return JSON.parse(localStorage.getItem(CODE+':'+k)||JSON.stringify(d));}catch(e){return d;} }
  async function setData(k,v){ if(sdk()?.webDataPost)return sdk().webDataPost(CODE,'set',{key:k,val:v},''); localStorage.setItem(CODE+':'+k,JSON.stringify(v)); }
  function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  async function addHistory(file){}
  async function openFile(file){ if(!file)return; location.href='./epub/index.html?url='+encodeURIComponent(file.url); }
  async function selectFile(){ const f=await sdk()?.file?.selectFile(null,'请选择 EPUB 文件','epub','false'); if(f) openFile(f); }
  function render(){ app.innerHTML=`<div class="nf-direct-home"><div class="nf-home-card"><img src="logo.png" class="nf-home-icon"><h1>Epub电子书阅读器</h1><p class="nf-muted">支持 epub</p><div class="nf-home-actions"><button data-open>打开文件</button></div></div></div>`; app.querySelector('[data-open]').onclick=selectFile; }
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
    const initial=parseInitial();
    if(initial) await previewFile(initial);
    else render();
    if(new URL(location.href).searchParams.get('action')==='open' && !initial){
      wait(()=>{sdk().event.on('fileOpenEdit',p=>{if(p?.target===CODE)openFile(p.data)}); sdk().event.emit('initFileOpenEdit',{type:'fileOpenEdit',confirm:true});});
    }
  })();
})();
