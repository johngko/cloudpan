(function(){
  const CODE='ace', STORE_KEY='ace_history_list';
  const appEl=document.getElementById('app');
  const sdk=()=>window.$v9os||parent.$v9os||null;
  function extMode(ext){ext=String(ext||'').toLowerCase();const map={js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',json:'json',css:'css',scss:'scss',less:'less',html:'html',htm:'html',vue:'html',xml:'xml',md:'markdown',markdown:'markdown',py:'python',go:'golang',java:'java',c:'c_cpp',cpp:'c_cpp',h:'c_cpp',hpp:'c_cpp',cs:'csharp',php:'php',rb:'ruby',rs:'rust',sh:'sh',bash:'sh',bat:'batchfile',cmd:'batchfile',sql:'sql',yaml:'yaml',yml:'yaml',toml:'toml',ini:'ini',log:'text',txt:'text'};return map[ext]||'text'}
  function uid(){return 'ace-'+Date.now().toString(36)+Math.random().toString(36).slice(2)}
  async function readText(blob){const buffer=await blob.arrayBuffer();for(const enc of ['utf-8','gbk','big5','utf-16','iso-8859-1']){try{const text=new TextDecoder(enc).decode(buffer);if(!text.includes('�'))return text}catch(e){}}return new TextDecoder('utf-8').decode(buffer)}
  async function getData(k,d){if(sdk()?.webDataPost){const r=await sdk().webDataPost(CODE,'get',{key:k},'');return r==null?d:r}try{return JSON.parse(localStorage.getItem(CODE+':'+k)||JSON.stringify(d))}catch(e){return d}}
  async function setData(k,v){if(sdk()?.webDataPost)return sdk().webDataPost(CODE,'set',{key:k,val:v},'');localStorage.setItem(CODE+':'+k,JSON.stringify(v))}
  function parseInitial(){const p=new URL(location.href).searchParams;if(!p.get('url'))return null;return{ext:p.get('ext'),name:p.get('name'),size:Number(p.get('size')||0),url:p.get('url'),saveData:p.get('saveData')?JSON.parse(decodeURIComponent(p.get('saveData'))):undefined}}
  const app=Vue.createApp({
    data(){return{history:[],tabs:[],current:0,preview:false,previewEditor:null}},
    computed:{currentTab(){return this.tabs[this.current]},canSave(){return !!this.currentTab?.file?.saveData}},
    async mounted(){this.history=[];const initial=parseInitial();if(initial){const cp=window.__cpFile;if(cp&&cp.path){/* CloudPan「打开方式」：带 __cpFile（policyId+path）→ 可编辑打开，Ctrl-S 经 saveFileNoSelect 存回原路径 */await this.openFile(Object.assign({},initial,{saveData:{policyId:cp.policyId,path:cp.path,name:initial.name||cp.name||'untitled'}}))}else{await this.previewFile(initial)}return}this.bindOpenEvent();},
    methods:{
      bindOpenEvent(){if(new URL(location.href).searchParams.get('action')!=='open')return;const wait=()=>{if(window.__winId&&sdk()?.event?.on){sdk().event.on('fileOpenEdit',p=>{if(p?.target===CODE)this.openFile(p.data)});sdk().event.emit('initFileOpenEdit',{type:'fileOpenEdit',confirm:true})}else setTimeout(wait,30)};wait()},
      async persistHistory(){await setData(STORE_KEY,this.history)},
      async addHistory(file){},
      async selectFile(){const f=await sdk()?.file?.selectFile(null,'请选择文件',null,'true');if(f)await this.openFile(f)},
      async clearHistory(){},
      async openFile(file){if(!file)return;this.preview=false;let idx=this.tabs.findIndex(t=>t.file.url===file.url);if(idx<0){this.tabs.push({id:uid(),file,dirty:false,loading:false,editor:null});idx=this.tabs.length-1}this.current=idx;await this.$nextTick();this.ensureEditors()},
      async previewFile(file){this.preview=true;this.tabs=[];await this.$nextTick();const editor=ace.edit('preview-editor');this.previewEditor=editor;editor.setTheme('ace/theme/sqlserver');editor.session.setMode('ace/mode/'+extMode(file.ext));editor.setReadOnly(true);editor.setOption('highlightActiveLine',false);editor.setOption('showPrintMargin',false);editor.getSession().setUseWrapMode(true);const blob=await fetch(file.url).then(r=>r.blob());editor.setValue(await readText(blob),-1)},
      ensureEditors(){this.tabs.forEach((t,i)=>{if(t.editor)return;const el=document.querySelector(`[data-pane="${t.id}"]`);if(!el)return;const editor=ace.edit(el);t.editor=editor;t.loading=true;editor.setTheme('ace/theme/sqlserver');editor.session.setMode('ace/mode/'+extMode(t.file.ext));editor.setReadOnly(!t.file.saveData);editor.setOption('enableLiveAutocompletion',true);editor.setOption('enableBasicAutocompletion',true);editor.setOption('enableSnippets',true);editor.getSession().setUseWrapMode(true);editor.commands.addCommand({name:'save',bindKey:{win:'Ctrl-S',mac:'Command-S'},exec:()=>this.saveTab(t)});editor.session.on('change',()=>{if(!t.loading)t.dirty=true});(t.file.newFile||!t.file.url?Promise.resolve(''):fetch(t.file.url).then(r=>r.blob()).then(readText)).then(text=>{editor.setValue(text,-1);t.loading=false})})},
      changeTab(i){this.current=i;this.$nextTick(()=>this.ensureEditors())},
      closeTab(i){const t=this.tabs[i];t?.editor?.destroy();this.tabs.splice(i,1);if(this.current>=this.tabs.length)this.current=this.tabs.length-1;this.$nextTick(()=>this.ensureEditors())},
      async saveTab(tab){if(!tab)return;if(!tab.file.saveData){sdk()?.msg?.error?.('当前为只读打开，请使用编辑模式打开后保存');return}const ok=await sdk().file.saveFileNoSelect(tab.file.saveData,new Blob([tab.editor.getValue()]));if(ok){tab.dirty=false}},
      saveAll(){this.tabs.filter(t=>t.file.saveData).forEach(t=>this.saveTab(t))}
    },
    template:`<div v-if="preview" class="nf-page"><div id="preview-editor" style="position:fixed;inset:0"></div></div>
    <div v-else-if="tabs.length" class="nf-page">
      <div class="nf-toolbar"><n-button size="small" type="primary" :disabled="!canSave" @click="saveTab(currentTab)">保存</n-button><n-button size="small" @click="saveAll">全部保存</n-button><n-button size="small" @click="selectFile">打开...</n-button><n-button size="small" @click="currentTab?.editor?.execCommand('find')">搜索</n-button></div>
      <div class="nf-tabs"><button v-for="(t,i) in tabs" :key="t.id" class="nf-tab" :class="{active:i===current}" @click="changeTab(i)">{{t.dirty?'*':''}}{{t.file.name}}<b @click.stop="closeTab(i)">×</b></button></div>
      <div class="nf-panes"><div v-for="(t,i) in tabs" :key="t.id" class="nf-pane" :data-pane="t.id" :style="{display:i===current?'block':'none'}"></div></div>
    </div>
    <div v-else class="nf-home nf-direct-home"><div class="nf-home-card"><img src="logo.png" class="nf-home-icon"><h1>多功能编辑器</h1><p class="nf-muted">支持文本、代码、Markdown、配置等格式</p><div class="nf-home-actions"><n-button size="large" @click="selectFile">打开文件</n-button></div></div></div>`
  });
  app.use(naive);app.mount('#app');
})();
