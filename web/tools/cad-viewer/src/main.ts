// CloudPan CAD 看图（DXF/DWG，纯浏览器端离线渲染）
// 基于 @mlightcad/cad-simple-viewer（MIT）；DWG 解析为可选的 LibreDWG wasm 转换器（GPL-3.0）。
// 文件打开走 CloudPan webapp URL 契约（?action=open&url=<rawUrl>&name=&ext=&pid=&path=&winId=），
// rawUrl 自带 ?t= 访问令牌，同源 fetch 无需额外鉴权。

const container = document.getElementById('cad-container') as HTMLDivElement
const uploadScreen = document.getElementById('upload-screen')!
const dropzone = document.getElementById('upload-dropzone')!
const fileInput = document.getElementById('file-input') as HTMLInputElement

let DocManager: any = null
let docManager: any = null
let layoutBackgroundColorFromRgb: (rgb: number) => string | undefined
let initialized = false
let openMode = 8 // AcEdOpenMode.Write（初始化时从包内枚举取值）

function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info') {
  document.querySelectorAll('.popup-message').forEach(e => e.remove())
  const el = document.createElement('div')
  el.className = `popup-message ${type}`
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true
  const mod: any = await import('@mlightcad/cad-simple-viewer')
  DocManager = mod.AcApDocManager
  layoutBackgroundColorFromRgb = mod.layoutBackgroundColorFromRgb
  openMode = mod.AcEdOpenMode?.Write ?? 8

  // DWG 支持（GPL-3.0 LibreDWG wasm，可选注册；DXF 内置转换器，不依赖此 worker）
  try {
    const dm: any = await import('@mlightcad/data-model')
    const { AcDbLibreDwgConverter } = await import('@mlightcad/libredwg-converter')
    const converter = new AcDbLibreDwgConverter({ convertByEntityType: false, useWorker: true, parserWorkerUrl: './assets/libredwg-parser-worker.js' })
    dm.AcDbDatabaseConverterManager.instance.register(dm.AcDbFileType.DWG, converter)
  } catch (e) {
    console.warn('DWG converter unavailable (DXF still works):', e)
  }

  DocManager.createInstance({
    container,
    busyIndicatorHost: container,
    autoResize: true,
    baseUrl: './cad-data/',
    webworkerFileUrls: { mtextRender: './assets/mtext-renderer-worker.js', dwgParser: './assets/libredwg-parser-worker.js' },
    checkWorkersOnInit: true,
    useMainThreadDraw: false,
    disableExport: false
  })
  docManager = DocManager.instance
  initialized = true
  return true
}

async function openBuffer(name: string, content: ArrayBuffer): Promise<boolean> {
  if (!(await ensureInitialized())) return false
  if (!(await docManager.areWorkersReady())) {
    showMessage('CAD worker 未就绪（部署缺 assets/*-worker.js）', 'error')
    return false
  }
  const ok = await docManager.openDocument(name, content, {
    mode: openMode,
    minimumChunkSize: 1000,
    sysVars: { paperbkcolor: layoutBackgroundColorFromRgb(0x1b1d21) }
  })
  if (ok) {
    uploadScreen.style.display = 'none'
    document.title = name
    showMessage(`已打开：${name}`, 'success')
  } else {
    showMessage(`打开失败：${name}`, 'error')
  }
  return ok
}

async function openFromUrl(url: string, name: string) {
  showMessage(`正在加载 ${name}…`, 'info')
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    await openBuffer(name, buf)
  } catch (e: any) {
    showMessage(`加载失败：${e?.message || e}`, 'error')
  }
}

function parseContract(): { url: string; name: string } | null {
  const p = new URL(location.href).searchParams
  if (!p.get('url')) return null
  return { url: p.get('url')!, name: p.get('name') || 'drawing.dxf' }
}

// 本地文件（拖拽 / 手选）
async function openLocal(file: File) {
  if (!/\.(dxf|dwg)$/i.test(file.name)) { showMessage('请选择 DXF 或 DWG 文件', 'error'); return }
  const buf = await file.arrayBuffer()
  await openBuffer(file.name, buf)
}
dropzone.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) openLocal(fileInput.files[0]); fileInput.value = '' })
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('is-dragover') })
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'))
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('is-dragover')
  const f = e.dataTransfer?.files?.[0]
  if (f) openLocal(f)
})

const initial = parseContract()
if (initial) {
  openFromUrl(initial.url, initial.name)
} else {
  // 无文件：仍初始化（worker 预检），保留选择界面
  ensureInitialized().catch(e => console.error('viewer init failed', e))
}
