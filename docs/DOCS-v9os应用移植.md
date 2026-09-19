# CloudPan 应用移植方案（借鉴 v9os 商店插件生态）

> **变更记录（2026-09-19）**：birdpaper（小鸟壁纸）已下线——与壁纸中心功能重复
> 且依赖第三方公开 API。manifest/前端注册表/system_apps 行/CSP 例外/静态目录均已移除；
> 下文涉及 birdpaper 的段落保留作历史记录。壁纸 URL 功能由壁纸中心「我的壁纸」承载。
>
> 目标（用户核心思想）：以 CloudPan 为主体做深度完善——更完整、更漂亮、更快、
> 软件应用更丰富、架构更清晰，让人以 **PC 操作系统** 的逻辑使用 CloudPan。
>
> v9os 商店里有 27 个应用插件，其中 15 个（图片编辑器/泼辣修图/在线PS/SVG编辑器/
> Picasa/音乐播放器/EML查看器/PDF阅读器/思维导图/Excalidraw/Epub阅读器/drawio/
> 小鸟壁纸/Ai编辑器/多功能编辑器）质量高，均为 Go+Vue 体系的 **type-2 纯前端插件**，
> 本方案将其移植进 CloudPan，替换/新增对应应用。

## 1. 调研结论（2026-09-19，15 个包全部下载解包分析）

### 1.1 包结构（完全统一）

```
<code>.zip
├── index.json          # 清单：Name/Code/PluginType=2/IconUrl/OpenExts/EditExts/ExpandExts
├── index.html          # 入口：<script src=".../sdk.js"> + <script src="js/v9os-webos-compat.js">
├── js/v9os-webos-compat.js  # ★ 关键：把老 webos 插件 API（window.webos.*）映射到 window.$v9os
├── js/init.js          # 老 webos 工具垫片（utils.*）
├── logo.png
└── 应用本体静态资源（pdf.js / APlayer / Excalidraw / drawio / ACE ...，全部开源库本地化）
```

**本质：每个应用都是一个自包含静态 web 应用**，与宿主只通过 `window.webos.*`（经 compat 层
转发到 `window.$v9os`）通信。没有任何 Go 后端（type-2 = 纯前端插件）。

### 1.2 宿主 API 需求矩阵（全部应用共用的一个小集合）

| API | 用途 | 用到的应用 |
|---|---|---|
| `fileOpenEdit` 事件（`initFileOpenEdit` 握手，宿主回 `{url, ext, name}`） | 打开指定文件 | pdfjs/excalidraw/tui_image/svg_editor/polarr/eml_viewer/picasa |
| `inface.selectFileExt(filter, cb)` | 文件选择器 | 几乎所有 |
| `file.saveFileNoSelect(path, blob)` / `fileSystem.uploadSmallFile` | 保存到云盘 | 几乎所有 |
| `api.webDataPost(code,'get'/'set',{key,val})` | 每应用 KV 持久化 | music/epub/drawio/ace/photopea/birdpaper/ai_editor |
| `inface.closeCurrentWin` | 关窗 | 几乎所有 |
| `msg.success/error` | toast | 几乎所有 |
| `inface.canChangeWallpaper/changeWallpaper` | 换壁纸 | birdpaper |
| `util.*`（getExtByName/blobToBase64/getParentPath...） | 纯函数 | 所有 |

### 1.3 CloudPan 侧对接机制（已确认）

- 窗口渲染：`WinWindowFrame.vue:27` `<component :is="appComponent(w.app)" :win-id :props>` —— 应用组件拿 `winId` + `props`(FileItem)
- 应用注册：`themes/registry.ts` 的 `APP_LOADERS` + `stores/apps.ts` 的 `APPS` + `server/internal/apps/manifest.go`
- 文件 URL：`rawUrl(policyId, path)` → `/api/fs/raw?policyId=&path=&t=<token>`（iframe 同源可取 sessionStorage token）
- 文件保存：`fsApi.writeText`（文本）/ `uploadApi.init+chunk+complete`（二进制，单分片会话）
- 设置 KV：`settingsApi.get/set`（每用户，天然满足 webDataPost 语义，key 前缀 `app.<code>.`）
- 静态托管：vite `public/` 目录原样拷入 dist → `go:embed all:dist`（web.go:13）→ **新增 `/webapps/<code>/` 静态路由零后端改动**
- 打开方式：`Explorer.vue` 的 openWith 上下文菜单（按扩展名列出可用应用）

## 2. 总体架构

```
Explorer「打开方式」/ 开始菜单
        │ store.open(appId, FileItem)
        ▼
WinWindowFrame ──<component WebAppHost :win-id :props>
        │  构建 /webapps/<code>/index.html?action=open&ext=&name=&url=<rawUrl>&winId=
        ▼
<iframe 同源>  应用静态资源（public/webapps/<code>/）
        │  应用自带的 js/v9os-webos-compat.js 找 window.$v9os || parent.$v9os
        ▼
CloudPan 宿主桥（两层）
  ├─ 父窗口 window.$v9os = { file, api.webDataPost, msg, invoke, host }（Shell 挂载）
  │     selectFile → FilePicker 对话框（盘/目录/文件浏览）
  │     saveFileNoSelect → 文本走 fsApi.writeText / 二进制走 uploadApi 单分片
  │     webDataPost → settingsApi（app.<code>.<key>）
  │     msg → 全局 toast；invoke('$wins','closeWindow') → windows.close
  └─ iframe 内 _bridge/cloudpan.js（替换原 sdk.js 标签）
        window.__winId、$v9os 事件总线、fileOpenEdit 自动应答（从 URL query 取文件信息）
```

**移植一个应用 = 静态资源放入 `web/public/webapps/<code>/` + index.html 一行
script 标签替换 + APPS/APP_LOADERS/manifest 三处注册 + Explorer openWith 菜单项。**
桥接层一次建设，所有应用共用。

## 3. 应用映射表

| v9os 商店应用 | 大小 | CloudPan 动作 | 说明 |
|---|---|---|---|
| pdfjs PDF阅读器 | 800K | **替换 pdfreader** | Mozilla PDF.js 完整版（缩略图/目录/附件/图层/中文化），现有 PdfReader 功能较简 |
| tui_image 图片编辑器 | 3.7M | **替换 imageeditor** | canvas 完整编辑（现有仅旋转/翻转/亮度对比度饱和度） |
| music 音乐播放器 | 80K | **新增**（APlayer+Meting2，支持歌词） | CloudPan 无音乐播放器 |
| picasa 图片预览 | 28K | **新增** | 相框式图片预览，与现有图片查看器并存 |
| epub Epub电子书阅读器 | 744K | **新增** | epub.js |
| ace 多功能编辑器 | 2.5M | **新增**（代码编辑器） | ACE，补全/多语言高亮，与记事本并存 |
| svg_editor SVG编辑器 | 1.1M | **新增** | Inkscape 同款 svg.js 编辑器 |
| eml_viewer EML查看器 | 404K | **新增** | 邮件文件查看 |
| photopea 在线PS | 1.8M | **新增**（批次三，✅） | 完整 vendored（离线可用）；图片可存回云盘 |
| birdpaper 小鸟壁纸 | 44K | **新增**（批次三，✅） | 山虎科技公开壁纸 API（仅该子树 CSP 例外）；可一键应用为桌面壁纸（经同源代理） |
| excalidraw 白板 | 4.8M | **保留现有** | CloudPan Whiteboard 已本地化同款 excalidraw 且已接云保存 |
| drawio 流程图 | 31M | **保留现有** | 同上（Flowchart 已接）；31M 不再重复嵌入 |
| minder 思维导图 | 4M | **保留现有** | MindMap 用 simple-mind-map（.smm 格式兼容优先） |
| polarr 泼辣修图 | 6.6M | **暂缓** | 依赖 PolarR 商业后端，需自备服务 |
| ai_editor Ai编辑器 | 396K | **暂缓** | 依赖 AI 后端/密钥配置 |
| video 视频播放器 | — | 跳过 | 包损坏且 CloudPan 已有 mediaviewer |

## 4. 批次计划（全部完成，2026-09-19）

- **批次 0（基础）✅**：`_bridge/cloudpan.js` + 父窗口宿主桥 + FilePicker + WebAppHost
  + registry `webapp(code)` 工厂 + 用 music（80K）与 picasa（28K）验证全链路
  （打开/选文件/保存/KV/toast/关窗）—— 34/34 通过，截图 t16
- **批次 1（核心替换）✅**：pdfjs 替换 PDF 阅读器、tui_image 替换图片编辑器
  —— 24/24 通过，截图 t17
- **批次 2（新增阅读/编辑）✅**：epub、ace、svg_editor、eml_viewer
  —— 30/30 通过，截图 t18
- **批次 3（外部依赖类）✅**：photopea、birdpaper（含壁纸应用接线 + 壁纸同源代理端点）
  —— 23/23 通过，截图 t19
- 每批次：构建 → 重启 → Playwright 实测 + 截图存 `docs/test-evidence/` → 更新本文档
- **全量回归（四批次脚本重跑）：111/111 PASS**（2026-09-19 13:54 部署后）

## 5. 红线与注意

- 移植的静态资源全部为开源库本地化（pdf.js Apache-2.0 / Excalidraw MIT / ACE Apache-2.0 /
  APlayer MIT / epub.js MIT / photopea 自托管 等），自托管无授权问题；仅 birdpaper
  运行时依赖山虎科技公开壁纸 API（界面标注来源，数据域按主机精确放行）
- iframe 同源无 sandbox（第一方代码，与 OfficeEditor PDF 预览同先例）；CSP 无需加通配符
  （同源 frame）
- 不引入任何新登录/鉴权体系；文件访问一律走既有 rawUrl `?t=` token 约定
- 仓库不提交构建产物；无密码/密钥入库

## 6. 落地实现要点（2026-09-19 完成）

### 6.1 各应用适配（v9os 原包 → CloudPan）

| 应用 | 目录 | 关键适配 |
|---|---|---|
| music | `webapps/music/` | sdk.js→桥；APlayer 曲目经 Blob URL 注入（CSP connect-src 仅 self） |
| picasa | `webapps/picasa/` | sdk.js→桥；图片走 rawUrl |
| pdfjs | `webapps/pdfjs/` | 替换原 PdfReader；完整 viewer（缩略图/目录/附件/中文化） |
| tui_image | `webapps/tui_image/` | 替换原 ImageEditor；kodApi.fileSave 两级桥接存回云盘 |
| epub | `webapps/epub/` | 原包引用 Google Fonts CDN + Raven 上报 → **移除**；Material Icons/Lato 等字体自托管（`epub/fonts/`），rendition 注入改本地 fonts.css |
| ace | `webapps/ace/` | Vue3+NaiveUI UMD 本地化（`lib/`）；打开方式带文件进入可编辑态（saveData 凭据），Ctrl-S 存回云盘；CSP 补 `worker-src 'self' blob:`（mode worker 走 Blob 回退） |
| svg_editor | `webapps/svg_editor/` | Inkscape methodDraw；文件菜单「Open Local SVG File」→ 宿主 FilePicker；保存优先 saveData 覆盖、否则目录选择器；修正 `Darkmode.js` 大小写 404 |
| eml_viewer | `webapps/eml_viewer/` | 邮件正文用 **DOMPurify 3.2.6** 消毒（实测注入的 script/onerror 全部剥离，宿主 `__pwned` 探针未被触发）；PHP 后端目录不引入 |
| photopea | `webapps/photopea/` | 完整 vendored photopea（非远程服务封装，离线可用）；webos-plugins.js 钩子改走桥：打开文件 fetch(rawUrl)→arrayBuffer→postMessage，保存回 saveFileNoSelect/saveFile；字体 CDN（st0.dancf.com）被严格 CSP 阻断属预期，界面优雅降级；CSP 对该子树单独放开 `unsafe-eval`（pp.js 内 23 处 eval） |
| birdpaper | `webapps/birdpaper/` | 山虎科技公开壁纸 API（JSONP+fetch）；所有渲染位 toHttps；「应用」按钮 → 宿主 `wallpaper.set` 桥 → `session.setWallpaper('ext:'+url)`；CSP 对该子树按主机精确放行 3 个数据域 + img/media https:（**不污染全局**） |

### 6.2 CSP 决策（安全红线的两个关键取舍）

1. **不做全局 `https:` 通配**。外部内容一律走「路径级最小例外」（`/webapps/birdpaper/`、
   `/webapps/photopea/`、`/webapps/ace/` 子树）或同源代理。
2. **外部壁纸走同源代理** `GET /api/fs/wallpaper?p=<base64url(图片URL)>&t=<token>`
   （`server/internal/handler/wallpaper.go`）。背景：壁纸中心「我的壁纸（URL）」与小鸟壁纸
   「应用」都依赖顶层 SPA 文档用 CSS 变量 `--wp-ext-url` 加载外部图，而顶层 CSP
   `img-src 'self' data: blob:` 会拦截；若为壁纸放宽全局 img-src https:，恶意 .md/office
   文件里一行 `<img src=https://evil/track>` 就成为像素外传通道——因此改为服务端代取：
   - SSRF 防护：仅 http/https 公网地址；环回/私网/链路本地/CGNAT/IETF 保留段全部拒绝；
     重定向逐跳复检（防 302 跳板）；DNS 解析后逐 IP 校验
   - 只回传 `image/*`（防被当任意内容抓取器）；20MB 上限；`Cache-Control: private`
   - 同源相对路径（管理员目录里可能配 `/vendor/…`）不经代理直接引用
   - 顺带修复了壁纸中心 URL 壁纸此前被 CSP 拦截的存量缺陷
   - 已验证：loopback/10.x/192.168.x/169.254/100.64.x/metadata 域名全部 400 拒绝，
     非图片内容 502，真实图片 200 + image/*

### 6.3 宿主桥新增能力（web/src/webapp/bridge.ts）

- `selectFile` 返回 `saveData{policyId,path,name}`（编辑模式凭据，跨盘精确）
- `saveFileNoSelect(target, blob)` 接受 `string | {policyId,path,name}`
- `wallpaper.set(url, type)`：校验 https? → `session.setWallpaper('ext:'+url)`
  （视频壁纸提示不支持；壁纸中心/锁屏/登录页统一经 `wallpaperProxyUrl()` 渲染）

### 6.4 验证证据

- `docs/test-evidence/t16-*.png`（批次 0）、`t17-*.png`（批次 1）、`t18-*.png`（批次 2）、
  `t19-*.png`（批次 3），详见 `TEST-REPORT.md`
- 回归脚本保留于 `/tmp/pw-batch0..3.js`（密码经 `CP_ADMIN_PW` 环境变量注入，不落盘），
  测试夹具在 `/tmp/b2assets/`（重跑前用 `/tmp/b2-upload.mjs` 上传到 C: 根）
