(function(){
  const CODE='pdfjs';
  const sdk=()=>window.$v9os||parent.$v9os||null;
  function openFile(file){ if(file?.url && window.PDFViewerApplication){ hideEmpty(); PDFViewerApplication.open(file.url); } }
  function previewFile(file){ openFile(file); }
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
  async function selectFile(){ const f=await sdk()?.file?.selectFile(null,'请选择 PDF 文件','pdf','false'); if(f) openFile(f); }
  function hideEmpty(){ const el=document.getElementById('v9-empty'); if(el)el.remove(); }
  function showEmpty(){ if(document.getElementById('v9-empty'))return; const el=document.createElement('div'); el.id='v9-empty'; el.innerHTML='<div><h2>PDF 阅读器</h2><p>请选择 PDF 文件打开</p><button id="v9-open">打开文件</button></div>'; el.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-items:center;text-align:center;background:var(--user-bg-1-color,#f6f7fb);color:var(--user-text-2-color,#667085);font:14px system-ui'; document.body.appendChild(el); const b=document.getElementById('v9-open'); b.style.cssText='margin-top:14px;padding:11px 22px;border-radius:10px;border:1px solid #2080f0;background:#2080f0;color:#fff;font-size:15px;cursor:pointer'; b.onclick=selectFile; }
  const params=new URL(location.href).searchParams;
  const initial=parseInitial();
  if(initial) previewFile(initial); else if(params.get('action')!=='open') showEmpty();
  if(params.get('action')==='open' && !initial) wait(()=>{ sdk().event.on('fileOpenEdit',params=>{ if(params?.target===CODE) openFile(params.data); }); sdk().event.emit('initFileOpenEdit',{type:'fileOpenEdit',confirm:true}); });
})();
