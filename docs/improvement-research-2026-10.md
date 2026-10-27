# CloudPan 改进调研（2026-10-26）

对标 Nextcloud / Seafile / Alist·OpenList / Cloudreve v4 / Filebrowser / Immich / PhotoPrism / Jellyfin / Stirling-PDF / Karakeep / Uptime Kuma / Vaultwarden，以及 Win11·macOS 窗口交互与 2025-2026 前端原生能力。四路并行调研 + 逐项与代码库核实去重。

> 调研口径：只列 CloudPan **没有**的功能；已核实的现状纠偏见文末「已核实说明」。
> 注：部分站点（raycast.com、os.js.org、web.dev、DDG/Bing）当时网络不可达，相关结论基于官方文档目录与 caniuse 实时数据，落点与成本判断不受影响。

## 实施进度（2026-10 月底更新）

- **已上线十六波**：波1 = A1 标签、A2 作用域 API 令牌、A4 重复文件清理、B6 最近文件、A7 容器查询/跟随系统深色；波2 = B1 内容全文检索、B4 收集式分享、A6 PDF 工具箱（pdfcpu）；波3 = B3 窗口手感（Alt+Tab、Win/Ctrl+Alt 方向键分屏、Snap Layouts flyout、任务栏/Dock 悬停预览）；波4 = B11 全局快捷键注册表 + `?` 速查 + Ctrl+K、B15 View Transitions（导航/视图/深浅色）；波5 = A9 HEIC/HEIF 前端解码（Picasa + libheif wasm）；波6 = B13 协作硬锁（编辑器心跳注册表 + 全写路径 423）、B14 断点续传（localStorage 哈希指纹缓存 + 服务端会话命中）；波7 = B16 文件事件 Webhook（持久化投递队列 + HMAC 签名 + SSRF 防护 + CP_WEBHOOK_ALLOW_PRIVATE 内网开关）、A10 补齐（分享页实时到期倒计时 + 站点品牌 Logo）；波8 = B8 虚拟桌面（任务视图条 ×3 主题 + Alt+Ctrl+PageUp/Dn + 窗口按桌面过滤）、B10 资源管理器标签拖出成窗/归位（torn 窗口 + CustomEvent 交接）；波9 = A11 补齐（压缩打包 ZIP/TAR.GZ/TAR 级联子菜单 + 方向性最小化：飞行偏移写入 CSS 变量 --min-dx/--min-dy，三主题任务按钮做锚点）、A8 浮层重建（右键菜单迁移到原生 Popover API[manual] + @starting-style 入场 + 顶层堆叠；全局 confirm/prompt 迁移到原生 `<dialog>` showModal：焦点陷阱/Esc/焦点归还/::backdrop 全交浏览器）。波10 = B2 全局命令面板（Ctrl+K：动作注册表[深浅色/主题/窗口/虚拟桌面/锁定/登出/面板/回收站/设置区/全部应用/网页搜索] + 文件全局搜索 + 最近打开货架 + 「>」仅动作前缀；原生 `<dialog>` 顶层面板，三主题桌面共用）。波11 = B5 Passkey/WebAuthn（go-webauthn v0.18 纯 Go 零 CGO：注册/登录 ceremony、challenge 会话内存一次性 5min TTL、凭据 whole-JSON 落库 + CredID 唯一键回写 SignCount、登录防枚举与口令登录对齐、失败限流复用 loginFails 桶、IP 直连明确拒绝[RPID 必须是域名]、设置→账号 Passkey 管理 + 三主题登录页「使用 Passkey 登录」入口；协议级 E2E 用手写 ES256 客户端验证注册/登录/重放拒绝——本机无头 Chromium 不支持 CDP 虚拟认证器，浏览器实机 GUI 无法走 WebAuthn）。 波12 证据见 `docs/test-evidence/t167–t168`（上传→秒传回填边车→播放页 sprite/波形）。波13 = B9 移动端闭环 + C3 照片时间流：SW（web/public/sw.js）只「收」——Web Share Target POST /share-target 落 IndexedDB 收件箱、push 事件弹系统通知（点击聚焦窗口 postMessage 开通知面板）；登录态应用启动排空收件箱（文件→上传队列 /来自分享，文本/链接→Markdown 剪藏）；Web Push 纯 stdlib+x/crypto 实现（RFC 8291 aes128gcm+RFC 8188 分帧+RFC 8292 VAPID ES256 JWT，密钥 JWK 存站点设置，404/410 自动清理失效订阅，Notify() 单点异步挂推送钩子）；相册备份纯前端（File System Access 目录句柄+游标 name|size|mtime 增量存 IDB，10 分钟循环；不支持的浏览器退化为手动增量手选去重）；设置→手机 页签（推送订阅表+备份控制）。C3 = /fs/photo-times 手工解析 JPEG APP1/PNG eXIf/WEBP EXIF/TIFF 迷你解码（无依赖），缓存表按 用户+策略+路径 唯一（本地盘虚拟路径按用户隔离——初版漏 UserID 造成跨用户串数据，已修）；图库按拍摄时间月份分组 + EXIF 徽标。另修复：独立应用模式(#/app/*)缺 DialogHost 挂载导致 toast/对话框全静默；manifest share_target 改 spec 的 params 形态。踩坑：big.Int.UnmarshalText 对无 0x 前缀的十六进制串按十进制解析并静默归零——VAPID d 曾因此恒为 0（推送报 "private key scalar is zero"），改 hex.DecodeString 后管线全通（日志推进到 DNS 层）。波13 证据见 `docs/test-evidence/t169–t172`（时间流分组/手机页签/分享收件箱落盘/备份游标去重）。波14 = C2 图片 OCR + C4 网页剪藏：OCR 全部在浏览器端（服务端零依赖）——tesseract.js v7 离线资产入 web/public/vendor/tesseract（worker.min.js + simd/relaxed 三档 core wasm + eng/chi_sim tessdata_fast gz，jsdelivr gh 镜像取），上传完成后入 IndexedDB 作业队列（utils/ocrQueue.ts，仅图片≤8MB、空闲时刻串行识别、blob URL 不跨重载故恢复时走 /fs/raw 重取），识别文本 POST /fs/ocr 并入 B1 全文索引（file_texts 与增量索引器互不干扰：textIndexExts 不匹配图片，OCR 行不会被覆盖），内容检索直接命中图上文字；base CSP 为此新增 'wasm-unsafe-eval' 与 worker-src 'self' blob:（tesseract 用 blob 包装 worker，初版曾被 CSP 静默拦截）。C4 = 资源管理器「新建→网页剪藏」：服务端自研 readability 抽取器（去样板标签→块级容器按 文本密度×(1−链接密度)+段落/逗号 打分取最优子树→按块收段落丢高链接密度残留），SSRF 三重防护复用离线下载栈（validateFetchURL+拨号级校验+重定向复检），写 <标题>-时间戳.md 并主动入全文索引，正文 <200 字退 422，可选原样 HTML 快照；抽取器踩坑：html.Parse 的文档首子节点是 doctype（逐层 FirstChild 找 body 恒空）、块收集标志位跨兄弟粘滞（整页只出第一段）——均已修并留 fixture 单测。另：服务器出网受限（wikipedia/go.dev TLS 超时，nginx.org 可达），GUI 用 nginx 文档页验证。波14 证据见 `docs/test-evidence/t173–t174`（OCR 图上文字被检索命中 / 剪藏 toast+落盘）。波15 = A3 TOTP 两步验证 + 恢复码（pquerna/otp 纯 Go，零新服务）：绑定流 setup→二维码/手输 secret→enable 校验并一次性发 10 个恢复码（sha256 哈希入库，用后即删）+ TokenVer 自增踢旧会话（换发新令牌随响应）；登录口令通过后 needTotp 二段弹码（三主题登录页共用 usePasswordLogin 补层），验证码错误与口令错误同形响应防枚举、错误码入同一锁定桶；恢复码登录（破折号归一化）；disable/regen 均需码在场；管理员全站强制：totp_enforce 开启后未绑定用户全部写接口 428（自助绑定/读/游客除外），http.ts 428→toast 提示去绑定；TOTPSeed 存密封后的完整 otpauth URI（secret 静态加密复用站点 enc:v1 密钥体系）。踩坑：gin 中间件写 428 后必须 c.Abort()，只 FailHTTP 不 Abort 会让后续 handler 继续执行并二次写 body（曾表现为 428+成功 双 JSON）；登录页无桌面壳，ShellHost 须为非桌面屏挂 DialogHost（两步验证弹码宿主）。测试脚本连打登录会被 loginLimiter(10/min 突发5) 挡出 429，非产品问题，脚本已加 7s 间隔。波15 证据见 `docs/test-evidence/t175–t176`（登录弹码 / 设置账号 TOTP 卡片）；协议层 15 项断言（绑定/踢旧会话/needTotp/同形 4001/恢复码消耗/regen/428 强制流）全过。波16 = C1 S3 兼容网关（gofakes3 v1.2.0 只做协议/XML + 手写每用户 SigV4 验证，零新服务）：端点 /s3 path-style，Bucket=disk-C/D…（对应本地盘符，按用户组策略门控）；用户凭据在 设置→账号 自助创建/轮换/删除（AccessKey 20 位大写 base32、Secret 30 位，明文只回显一次，Secret 静态加密复用 enc:v1；scope=rw/ro，只读凭据在网关层挡一切非 GET/HEAD）。SigV4 按 AWS 规范手搓：canonical request（URI/查询再编码排序、签名头连接、x-amz-content-sha256 载荷哈希）→ 四级 HMAC 签名链 → 常数时间比对，±15min 时钟偏差；写路径全部经 fscore Driver（秒传台账/配额/名字净化/版本 invariant 全保留），隐藏点条目（.versions/.thumbs）不外泄；未启用（站点设置 s3_enabled）整体 403；独立 IP 限流（60/s 突发 20），不经 JWT。踩坑：Go net/http 不把 Host 放进 Request.Header（canonical host 行恒空致全部 403），需 r.Host 特判；SigV4 canonical 是 headers(自带尾\n)+\n+SignedHeaders——测试客户端多拼一个空行即差一个空行，全部签名失败。GUI 验证证据见 `docs/test-evidence/t109–t177`（t177 = 设置账号 S3 凭据卡片）；协议层 16 项断言（手搓 SigV4 客户端直连网关：ListBuckets/Put/Get 内容一致/Head/Range206/中文深层 key/ListV2 前缀+delimiter 折叠/prefix 深钻/Copy/Delete/删后403 NoSuchKey/错签403/匿名403/只读凭据挡写/Web 端 fs/list 可见）全过。
- **后续修复（2026-10-27 录屏反馈）**：用户报告"打开文件夹/切页整页闪一下像刷新、还要重新登录"。根因：任何整页重载（F5、地址栏回车、Edge 睡眠标签唤醒、升级后 chunk 404 自动刷新）都重演三主题假开机动画并无条件 `replace('/login')`，令牌明明还在 sessionStorage 也被迫重新登录。修复：三主题 Boot 组件挂载时 `getToken()` 存在即 `replace('/desktop')` 跳过开机流；无令牌仍走开机→登录（新会话开机体验保留）。验证 t178：有令牌裸 URL 重载路由序列仅 `#/desktop`；清令牌重载仍 `#/boot -> #/login`。波12 = B14 补齐 + B7 媒体预览边车：上传泵哈希全部移出主线程（hash.worker：小文件 crypto.subtle / http 内网回退纯 JS / 大文件增量读块；≤16MB 整块 transfer 回主线程供分片循环复用）；B7 浏览器端生成视频拖动预览 sprite（seek 取帧→sprite.worker OffscreenCanvas 拼图）与音频波形 peaks，POST /fs/preview 存 ThumbDir 边车（键含 size/mtime，改写即失效），播放器 Artplayer thumbnails 直接吃边车、APlayer 下方自绘波形条点击定位；服务端零 ffmpeg，代价仅新上传有边车。踩坑：JS 移位 32 位溢出——4<<30 等于 0 曾令视频分支永不触发；Blob 可克隆但不可 transfer。
- **调研时已存在（本文判定过期）**：A5 回收站 TTL 早已实现（`tasks.go sweepRecycle` + 组配置）；B12 审计日志导出早已实现（`admin.go LogExport`，CSV+BOM+脱敏）。
- **明确不做**：A3 TOTP、C1 S3 网关（用户决定，2026-10）。
- **剩余**：无——方案 A/B/C 全部落地。其中 A5（回收站保留天数 `sweepRecycle`）与 B12（审计日志 CSV 导出 `LogExport`）经核实在初始全量重构版即已存在，未列入任何波次；A3 由波15 补齐，C1 由波16 补齐。

---

## A. 高投入产出比（小成本，建议先做）

| # | 事项 | 参考系统 | CloudPan 落点 | 依赖 |
|---|------|----------|--------------|------|
| A1 | **标签体系**（多标签/颜色/按标签过滤视图），星标扩展到文件（现仅目录可收藏） | Nextcloud Tags、Seafile Starred | 3 张小表 + 列表接口 filter + 右键菜单 + 地址栏过滤 chip | 无 |
| A2 | **Scoped API Token**（每用户可建、带 read/write/share scope、有效期、可单独撤销、hash 存储） | Immich API Keys、Nextcloud 应用密码 | `api_tokens` 表 + middleware 与 JWT 并列校验路径 + 设置页管理；也是 rclone/WebDAV 客户端不用填主密码的解法，S3 网关的前置件 | 纯 Go |
| A3 | **TOTP 两步验证 + 恢复码**（管理员可强制） | Uptime Kuma、PhotoPrism、Alist | `pquerna/otp` 纯 Go；绑定二维码前端渲染；开通时 bump TokenVer 踢旧会话 | 纯 Go |
| A4 | **重复文件清理器**（秒传台账变现最快路径）：列出同用户 copy>1 的组，批量移入回收站 | Immich duplicates（保留件元数据合并规则可借鉴） | 直接查 `file_hashes`/`file_hash_copies` + 一个 UI | 无 |
| A5 | **回收站自动到期清理**（版本保留策略已有，回收站缺 TTL） | Nextcloud `trashbin_retention_obligation`、Immich Trash 30 天 | 站点/组级配置 + 每日任务挂现有任务中心，真删走 `HashPathGone` | 无 |
| A6 | **PDF 工具箱**：合并/拆分/水印/旋转/加密（ONLYOFFICE 太重时的轻量面） | Stirling-PDF（50+ 工具的子集） | `pdfcpu` 纯 Go 直接 import 进 handler + AppGate | 纯 Go |
| A7 | **Container Queries 窗口内自适应**——窗口化桌面的结构性刚需（matchMedia 测不到单个窗口宽度） | CSS 标准（2023 Baseline，90%+） | 窗口 resize/贴边分屏时：资源管理器侧栏自动收起、工具栏折"更多"、预览面板窄时转抽屉；各应用自声明断点 | 无 |
| A8 | **Popover API + `<dialog>` + `@starting-style` 重做浮层/模态** | GitHub、Chrome DevTools | 右键菜单/长按菜单/通知下拉换原生 light-dismiss；top layer 根治祖先 `backdrop-filter` 截断层叠上下文的坑；模态 `::backdrop` 免费获得毛玻璃 | 无 |
| A9 | **HEIC/RAW 前端预览**（iPhone 照片进网盘后打不开是照片场景第一投诉） | PhotoPrism、Immich | 前端 `heic2any`/libheif wasm 懒加载（不进主包）；服务端解码会破单二进制，不做 | 前端 |
| A10 | **分享页升级**：访问/下载计数、有效期倒计时、站点品牌化，以及"仅预览禁下载/最多 N 次下载"开关 | Nextcloud/Seafile 付费主打的禁下载链接、Pixeldrain | 站点配置字段 + 链接属性 + 分享页渲染 | 无 |
| A11 | 桌面细节包：右键**二级级联子菜单**（打开方式/压缩格式子选）、列表**骨架屏**、深色**跟随系统**+主题切换全站过渡、最小化/还原**方向性动画**（transform-origin 指向任务栏按钮） | Win11、macOS、Notion/Linear | 通用 contextmenu 组件、资源管理器、themes/registry | 前端 |

## B. 功能级补齐（中成本）

| # | 事项 | 参考系统 | CloudPan 落点 | 依赖 |
|---|------|----------|--------------|------|
| B1 | **全文检索（内容搜索）**——与 Nextcloud/Seafile 最大的日常体感差距 | Nextcloud Full text search、Seafile Whoosh | MySQL 用 InnoDB FULLTEXT + **ngram**（原生中文）；SQLite 用 modernc 自带 **FTS5**；上传/保存时抽 txt/md/代码/pdf/docx/xlsx 正文入库；搜索框加"搜内容"模式。双后端各写一个适配即可，**不要**引 Meilisearch/Typesense | 无 |
| B2 | **全局命令面板**（Ctrl+K：搜文件、执行动作、最近/置顶货架、前缀命令） | PowerToys Command Palette、Raycast、Figma | 新 shell 组件聚合 apps store + 搜索 API + 动作注册表；与资源管理器"上下文感知命令栏"共享注册表 | 前端为主 |
| B3 | **窗口手感三件套**：Snap Layouts flyout（悬停最大化按钮出布局选择 + 拖顶边 Snap bar + Snap Assist 缩略图补位）、Alt+Tab 缩略图切换器、任务栏悬停窗口预览（简化版=标题列表） | Win11 Snap、PowerToys | `useWindowChrome` + 三主题 WindowFrame + 任务栏组件 | 前端 |
| B4 | **文件收集 / upload-only 链接**（匿名只能传、互相不可见，可加姓名/备注字段）——收作业/收投稿是自建网盘最高频对外场景，现有 guest 工作区粒度太粗 | Nextcloud file dropping、Seafile 上传链接、Cloudreve 表单 | 新增匿名上传路由（复用分片通道，挂 AppGate 语义）+ 落进指定目录 + 完成通知 | 无 |
| B5 | **Passkey/WebAuthn 免密登录**（与 TOTP 组合覆盖安全面，抗钓鱼） | Vaultwarden、GitHub/Google 主登录方式 | `go-webauthn` 纯 Go（challenge/attestation 全服务端），浏览器原生 API | 纯 Go |
| B6 | **最近/常用文件首屏**（Quick Access 按使用频率自动聚合） | OneDrive Quick Access、Google Drive Suggested | 轻量 recent 记录（后端）+ 资源管理器 home 分区（跨盘聚合） | 无 |
| B7 | **视频拖动预览帧 sprite + 音频波形** | Jellyfin Preview Thumbnails | 保单二进制的关键路线：**上传时浏览器端抽帧**（`<video>` seek + canvas 拼 sprite PNG + 时间映射 JSON 存 `.thumbs/`），服务端零 ffmpeg；代价是只对新上传生效 | 前端 |
| B8 | **虚拟桌面 + 窗口分组整组恢复** | Win11 Task View、macOS Spaces/Stage Manager | `windows.ts` 加 desktops 数组 + 组 id + 任务栏入口 + 三指横扫切换 | 前端 |
| B9 | **移动端"传"的闭环**：PWA 相机卷自动备份（本地游标增量）、Web Share Target、Web Push 通知 | Nextcloud Mobile 自动上传是移动端留存第一功能 | 备份大部分纯前端可做；Web Push 需 VAPID 密钥 + 订阅表（仍无第三方依赖） | 无 |
| B10 | **拖标签脱离成窗口 / 窗口归位**（tear-off / pop-in） | Golden Layout popout、Chrome/VS Code 肌肉记忆交互 | 资源管理器标签 mousedown 阈值→建同路径新窗口；标题栏 pop-in 入口 | 前端 |
| B11 | **全局快捷键体系 + "?" 速查浮层**（分屏/切窗/概览都键位化；Win+方向键连续换区语义） | Win11、Notion/Linear | shell 统一 hotkey registry（避开输入框） | 前端 |
| B12 | **审计日志导出**（CSV/JSON 流式、按时间/操作者过滤） | Nextcloud Audit Log（GDPR） | 复用现有脱敏规则 + 分页流式 | 无 |
| B13 | **协作硬锁**（检出即锁，他人写入 423，超时自动解锁）——现有"正在编辑"徽章只是通知，不防覆盖 | Nextcloud files_lock、Seafile lock | 文件 lock 字段 + 保存/上传校验 | 无 |
| B14 | **OffscreenCanvas/Worker 缩略图与 SHA-256**（不再卡虚拟滚动/窗口拖拽）+ **OPFS/IndexedDB 上传队列持久化**（刷新续传） | VS Code for Web、Photopea | transfer store 泵改造 + 缩略图管线出主线程 | 前端 |
| B15 | **View Transitions**：缩略图→预览大图共享元素、分享页转场、主题切换全站过渡——"像原生 OS"的分水岭（2026 三家浏览器 92.9%） | Chrome DevTools、各 OS | router 包装层 + `view-transition-name`；注意 hash 路由要手写触发、backdrop-filter 快照瞬间变纯色 | 前端 |
| B16 | **Webhook 升级**：现有 notify 只外发通知中心事件 → 通用文件事件总线（创建/修改/删除/分享 + 路径正则过滤 + 重试），供 n8n/HomeAssistant 接管 | Nextcloud Webhooks 应用、Gitea | 挂现有 fscore 变更点；出站必须过现有 SSRF 三层防护 | 无 |

## C. 战略可选项（大成本，需明确取舍）

| # | 事项 | 判断 |
|---|------|------|
| C1 | **S3 兼容网关（子集）**：把 CloudPan 暴露成 S3 端点，rclone/CloudSync/备份软件直接挂载。Alist/OpenList 将 S3 列为一等公民，Cloudreve 只有后端无前端——做了就是差异化。`gofakes3` 或手写 SigV4（标准库可完成），映射 fscore；与 A2 scoped token 天然配套 | 中等偏大、纯 Go，测试面广。建议排 B 完成之后 |
| C2 | **图片 OCR 入库**喂全文检索（截图/扫描件可搜）：`tesseract.js` 客户端 wasm（上传后 Worker 队列识别→存 `file_ocr`→进 B1 索引），用户可关。服务端 tesseract = 外部依赖，不做默认 | 中偏大，wasm 体积（eng+chi_sim 数 MB~20MB）与 CPU 占用要节流 |
| C3 | **照片时间流**：按 EXIF 拍摄时间倒序滚动的照片流 + 地点过滤（Immich 阶梯的第一步，前端+缩略图管线顺手提 EXIF 即可）；人脸聚类（Immich：独立 ML 进程 + DBSCAN + 向量索引）为远期实验开关 | 时间流值得做（中小）；人脸聚类任何路线都破单二进制，观望 |
| C4 | **网页剪藏**：Go readability 抽正文 + 原文快照；整页归档用可选附加组件 monolith（Rust 静态二进制，默认不启）。Karakeep 证明价值，Puppeteer 路线否决 | 中偏大，依赖管理是主要风险 |

## D. 明确不建议（调研后结论）

- **ClamAV 默认集成**：唯一成熟形态是外部 clamd 守护进程+病毒库，与"单二进制自托管"冲突；可留 `CP_CLAMD_ADDR` 可选对接。
- **Meilisearch/Typesense/Elasticsearch**：独立服务破坏卖点，B1 的 DB 原生全文够用。
- **原生 App**：PWA + B9 足够现阶段。
- **Material Web 组件库**：与三 OS 自绘方向不符；若要借行为件用 Reka UI（headless，Radix Vue 更名）只借不样式。
- **协议处理/url_handlers、VirtualKeyboard API**：仅 Chromium 30% 覆盖，暂不划算。

## 如果只做三件事（综合四路调研）

1. **全文检索（B1）+ 回收站到期（A5）+ 重复文件清理（A4）**——"找得到、清得掉"是网盘从工具到资产的核心体验，三项全部零外部依赖。
2. **安全开放底座：TOTP（A3）+ scoped API Token（A2）→ S3 网关（C1）**——补齐公开网盘的安全标配并打开通用生态（rclone/CLI/备份软件），纯 Go。
3. **桌面质感包：Container Queries（A7）+ Popover/dialog（A8）+ Snap Layouts/Alt+Tab（B3）+ 命令面板（B2）**——把"窗口化云桌面"从可用变成好用，这是 CloudPan 区别于所有传统网盘的立身卖点。

## 已核实说明（对调研原始结论的代码纠偏）

- 收藏/星标**已存在**（Explorer「快速访问」），但仅限目录；标签确实没有 → A1 措辞据此收窄。
- 版本历史**已有保留策略**（用户组 `KeepVersions`/`VersionRetentionDays`）；缺的是**回收站** TTL → A5 只剩这一半。
- 通知中心**已有 webhook/邮件外发**（`notify.go sendWebhook`）；差距是"通用文件事件 + 过滤规则" → B16 是升级不是新建。
- 2FA/Passkey/API token/全文检索确认代码中**完全不存在**，差距属实。
- 回收站存在且可手动清空（`RecyclePurge`），无自动过期任务。
