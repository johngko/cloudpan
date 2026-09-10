# CloudPan

**Go + Vue 自托管私有云存储 —— 带完整 Web 桌面外壳（Windows 12 / macOS / Deepin 三主题）的网盘系统**

A self-hosted private cloud drive in **Go + Vue** with a full **web desktop shell** — Windows 12, macOS and Deepin themes.

![CloudPan 桌面](docs/screenshots/win12-02-desktop.png)

---

## 项目简介

CloudPan 是一个用 **Go（Gin + GORM + SQLite）** 与 **Vue 3 + TypeScript + Vite** 从零实现的私有云存储系统。前端构建产物通过 `go:embed` 嵌入 Go 二进制，**单文件部署**，无 Docker 依赖。

它的最大特色是**完整的 Web 桌面外壳**：打开浏览器就像开了一台电脑——BIOS 风格开机动画、系统登录页、可拖拽/缩放/贴边的窗口、开始菜单 / Launchpad / 启动器、任务栏 / Dock、全局搜索、控制中心……并且内置 **三套可切换的操作系统主题**：

| Windows 12 概念版风格 | macOS（对标 Sonoma） | Deepin（对标 DDE 25） |
|---|---|---|
| ![win12](docs/screenshots/win12-02-desktop.png) | ![macos](docs/screenshots/macos-02-desktop.png) | ![deepin](docs/screenshots/deepin-02-desktop.png) |

桌面内置 16 个应用：文件资源管理器、此电脑、回收站、记事本、终端、计算器、网络测速、**内置浏览器**、图片查看器、媒体播放器、Office 编辑器、媒体中心、来自他人的共享、应用中心、设置、管理控制台。

网盘核心功能对齐主流网盘：分块上传 + 断点续传 + SHA-256 秒传、分享链接（提取码/有效期/次数）、回收站、压缩解压、离线下载（服务器代下 + SSRF 防护）、WebDAV、ONLYOFFICE 在线编辑、多用户/用户组/配额/审计日志。存储层采用**驱动注册表架构**（借鉴 Cloudreve 设计），本地目录与 123 云盘 / 阿里云盘 / 百度网盘 / 天翼云盘（实验性）即插即用。

## Project Overview

CloudPan is a private cloud storage system built from scratch with **Go (Gin + GORM + SQLite)** and **Vue 3 + TypeScript + Vite**. The frontend is embedded into the Go binary via `go:embed` — **single-file deployment**, no Docker required.

Its standout feature is a **complete web desktop shell**: opening the browser feels like booting a computer — BIOS-style boot animation, system login, draggable/resizable/snappable windows, Start menu / Launchpad / full-screen launcher, taskbar / Dock, global search, control center — with **three switchable OS themes**:

| Windows 12 (concept style) | macOS (Sonoma-style) | Deepin (DDE 25-style) |
|---|---|---|
| ![win12](docs/screenshots/win12-02-desktop.png) | ![macos](docs/screenshots/macos-02-desktop.png) | ![deepin](docs/screenshots/deepin-02-desktop.png) |

The desktop ships 16 built-in apps: File Explorer, This PC, Recycle Bin, Notepad, Terminal, Calculator, Network Speed Test, a **built-in browser** (server-side proxied), Image Viewer, Media Player, Office Editor, Media Center, Shared with Me, App Center, Settings, and an Admin Console.

The storage core matches mainstream cloud drives: chunked upload with resume + SHA-256 instant upload, share links (access code / expiry / download count), recycle bin, zip compression/extraction, offline download (server-side fetch with SSRF protection), WebDAV, ONLYOFFICE online editing, multi-user / user groups / quotas / audit log. The storage layer uses a **driver registry architecture** (inspired by Cloudreve): local directories plus 123Pan / Aliyun Drive / Baidu Wangpan / Tianyi Cloud (experimental) plug in and out.

---

## 截图 Screenshots

### Windows 12 主题

| 登录 | 桌面 | 开始菜单 |
|---|---|---|
| ![](docs/screenshots/win12-01-login.png) | ![](docs/screenshots/win12-02-desktop.png) | ![](docs/screenshots/win12-03-start.png) |

| 全局搜索（分类筛选） | 小组件 | 控制中心 |
|---|---|---|
| ![](docs/screenshots/win12-04-search.png) | ![](docs/screenshots/win12-05-widgets.png) | ![](docs/screenshots/win12-12-control.png) |

| 此电脑 | 文件资源管理器（C:\图片） | 内置浏览器（经服务端代理访问百度） |
|---|---|---|
| ![](docs/screenshots/win12-06-thispc.png) | ![](docs/screenshots/win12-07-files.png) | ![](docs/screenshots/win12-08-browser.png) |

| 设置（三主题 + 壁纸 + 深色模式） | 深色登录 | 深色桌面 |
|---|---|---|
| ![](docs/screenshots/win12-09-settings.png) | ![](docs/screenshots/win12-10-darklogin.png) | ![](docs/screenshots/win12-11-darkdesktop.png) |

### macOS 主题

| 登录 | 桌面（菜单栏 + 放大 Dock） | Launchpad |
|---|---|---|
| ![](docs/screenshots/macos-01-login.png) | ![](docs/screenshots/macos-02-desktop.png) | ![](docs/screenshots/macos-03-launchpad.png) |

| 文件管理器窗口（红绿灯） | 深色桌面 | 深色内置浏览器 |
|---|---|---|
| ![](docs/screenshots/macos-04-finder.png) | ![](docs/screenshots/macos-05-darkdesktop.png) | ![](docs/screenshots/macos-06-browser.png) |

### Deepin 主题

| 登录 | 桌面（DDE 25 全宽任务栏） | 全屏启动器 |
|---|---|---|
| ![](docs/screenshots/deepin-01-login.png) | ![](docs/screenshots/deepin-02-desktop.png) | ![](docs/screenshots/deepin-03-launcher.png) |

| 此电脑窗口 | 深色登录 | 深色启动器 |
|---|---|---|
| ![](docs/screenshots/deepin-04-thispc.png) | ![](docs/screenshots/deepin-05-darklogin.png) | ![](docs/screenshots/deepin-07-darklauncher.png) |

| 深色桌面 |
|---|
| ![](docs/screenshots/deepin-06-darkdesktop.png) |

---

## 功能特性

**桌面外壳（三主题共享架构，`themes/` 插件包）**
- 开机动画 → 登录 → 桌面全流程；注册/锁屏；管理员与普通用户
- 窗口管理器：拖拽、8 向缩放、最大化、贴边分屏、最小化飞行动画、多标签资源管理器
- Windows 12：BIOS 开机 + 花朵加载、**悬浮多段胶囊 Dock**（开始/搜索/小组件/日-夜主题切换/控制中心/日期胶囊）、双栏开始菜单（应用列表 + 已固定 + 推荐收藏 + 电源区）、全局搜索面板（全部/应用/文档/网页/设置/文件夹/照片 分类，网页结果直达内置浏览器、设置分类深链到对应页）、控制中心（网速/通知/传输/护眼/深色/锁定 + 亮度）、时间小组件
- macOS：顶部菜单栏（应用菜单 + 系统托盘）、**高斯放大 Dock**（启动弹跳）、Launchpad（搜索 + 分类）、红绿灯窗口、无卡片式登录（大时钟 + 头像 + 胶囊输入）
- Deepin（DDE 25）：底部 48px 全宽任务栏（左启动器 / 中应用 / 右托盘 + 显示桌面）、**全屏启动器**（分类导航 + 搜索 + 电源区）、40px 居中标题栏、登录双栏
- 每主题 9 张壁纸（4 张 Unsplash 免费授权照片 + 5 套 CSS 渐变）+ 深色模式，设置里一键切换
- 全局右键菜单、通知中心（未读角标 + 软清除）、传输浮窗（多任务并发、暂停/继续/取消）

**网盘核心**
- 存储策略抽象（借鉴 Cloudreve 设计）：本地目录 + 123 云盘 + 阿里云盘 + 百度网盘（默认只读）+ 天翼云盘（实验性），驱动注册表架构，新后端即插即用；管理控制台挂载 + 测通 + OAuth 授权
- 文件管理：新建/重命名/移动/复制/删除（入回收站）/搜索（本盘/全局）/属性/收藏快速访问；网格与列表双视图；完整右键菜单
- 上传：**分块上传 + 断点续传 + SHA-256 秒传**（哈希索引去重）
- 下载：单文件直下、多选/目录 zip 打包流式下载；图片/视频/音频 Range 流式预览
- 分享：提取码/有效期/剩余下载次数/预览开关/浏览下载计数，公开分享页
- 回收站：还原 / 彻底删除 / 清空，删除自动计入用户用量
- 压缩解压：右键压缩为 zip / 解压到当前目录（含子目录安全校验）
- 离线下载：HTTP(S) 链接服务器代下载入网盘，DB 任务队列重启自动恢复，**SSRF 三层防护**
- WebDAV：`/dav/{用户名}/{盘符}/`，独立应用密码，可挂载进 Windows 资源管理器/手机
- ONLYOFFICE 在线编辑（未配置时自动回退内置编辑器：xlsx 可编辑表格 / docx 预览 / PDF 预览）

**终端（真实 shell）**
- 本地终端：服务端 PTY（Linux pty / Windows ConPTY，`creack/pty`）启动真实 shell，xterm.js + WebSocket 二进制透传，完整 TUI（vim/htop 均可用）；shell 白名单（Linux: bash/sh/zsh/fish，Windows: cmd/PowerShell），工具栏可切换
- 远程 SSH 终端：保存多个连接（密码 / 私钥，凭证 AES-256-GCM 加密落库，API 永不回显），`x/crypto/ssh` 拨号 + PTY 协商；主机密钥 **TOFU**（首次信任、变更即拒绝）；目标地址安全校验（拒绝 169.254/16 云元数据、0.0.0.0/8、组播/保留段，域名解析后逐 IP 复检）；测通接口返回延迟与远端系统信息
- **SFTP 文件管理面板**（SSH 模式）：面包屑浏览、上传（选择/拖拽，逐文件进度条）、下载（中文文件名 RFC5987）、新建/重命名/删除（目录递归）、连接池复用 + 空闲清扫
- 并发限制：每用户 4 本地 / 8 SSH 会话，全局 32；连接/文件操作全量审计日志；受「终端」系统功能门控（应用中心可停）

**内置浏览器（特色功能）**
- 桌面内置浏览器应用：多标签（每页独立沙箱 iframe）、地址栏（裸域名自动补 https、非 URL 当百度搜索词）、前进/后退/刷新/主页、快捷入口、"在系统浏览器中打开"兜底
- **服务端代理**绕过站点 X-Frame-Options/CSP frame-ancestors 的嵌入限制：HTML 自动重写 src/href/action/poster/srcset/meta-refresh 为代理路径、剥离站点 `<base>` 与 CSP、注入代理 base 兜底、gbk/big5/utf-16/latin1 转 UTF-8；非 HTML 资源透传（128MB 上限、300s 缓存）
- 安全设计：短时效 HMAC 代理票据（`pt`，30 分钟，非真实 JWT）；iframe 沙箱**故意不带 allow-same-origin**（站点 JS 读不到网盘登录态）；复用离线下载的 SSRF 三层防线（URL 校验 + 重定向复检 + 拨号层 DNS 复检）；每 IP 300 次/分钟限速；访问日志凭证脱敏

**多用户体系**
- 角色（admin/user）+ 用户组（配额、功能白名单：分享/WebDAV/压缩/离线/浏览器/应用中心、分享可下载、限速、可用存储策略白名单）
- **用户数据隔离**：本地存储策略按用户划分独立目录（`<策略根目录>/<用户目录名>/`，如 `C:/admin`、`C:/johngko`），每个用户在网页/WebDAV/分享/离线下载/版本恢复看到的都是自己目录下的虚拟根，互相不可见；目录名取安全 ASCII 用户名（其余取 `user_<id>`）并首次固化到 `UserSetting(local_dir)`，改用户名不影响已有数据。云盘策略不隔离（后端账号本身即边界）
- 站点设置：站点名、注册开关、邀请码、公告；审计日志（登录/文件操作/分享/管理动作/通知）
- 登录：Win12 登录页用户名框常显（预填 admin，注册用户可清空输入自己的账号）；开放注册后新用户即可登录并使用自己的隔离空间

**内置应用（16）**
文件资源管理器 / 此电脑 / 回收站 / 记事本（读写网盘文本）/ **终端**（本地真实 shell + 远程 SSH 终端，xterm.js 完整 TUI；SSH 模式带 SFTP 文件管理面板：浏览/上传/下载/新建/重命名/删除，支持拖拽上传）/ 计算器 / **网络测速**（界面仿 LibreSpeed，随机数据端点不可压缩防虚高）/ **内置浏览器** / 图片查看器（缩放旋转 + EXIF/GPS）/ 媒体播放器（视频 + 音频 + 歌词字幕，封面取自 ID3）/ Office 编辑器 / 媒体中心（可安装应用）/ 来自他人的共享 / 应用中心 / 设置（壁纸主题/账号/WebDAV 密码/我的分享/离线下载）/ 管理控制台（仪表盘/用户/用户组/存储策略与云盘授权/站点设置/审计日志）

---

## 快速开始

```bat
:: Windows（需已安装 Go 1.22+ 与 Node.js 18+）
build.bat      :: 构建前端并嵌入，产出 server\cloudpan.exe
start.bat      :: 启动，浏览器访问 http://localhost:18322
```

```bash
# Linux / macOS
./build.sh && ./server/cloudpan
```

- 默认管理员：`admin / admin123`（**登录后请立即在 设置 → 账号 修改密码**）
- 数据目录：`server/data/`（SQLite 数据库、回收站、缩略图、上传临时区、密钥），可用环境变量 `CP_DATA` 重定向
- 端口：默认 `18322`，`CP_PORT` 修改；对外可达地址用 `CP_PUBLIC_URL` 配置（ONLYOFFICE 集成需要）
- 首次使用：管理员登录 → 管理控制台 → 存储策略 → 挂载一个本地目录为磁盘（如把某目录挂载为 C 盘），桌面"此电脑"即出现该盘

**开发模式**

```bash
cd web && npm install && npm run dev   # Vite 5173，/api 代理到 18322
cd server && go run .                  # 后端
```

## Quick Start

```bat
:: Windows (requires Go 1.22+ and Node.js 18+ installed)
build.bat      :: builds the frontend, embeds it, produces server\cloudpan.exe
start.bat      :: starts the server, open http://localhost:18322
```

```bash
# Linux / macOS
./build.sh && ./server/cloudpan
```

- Default admin: `admin / admin123` (**change it immediately in Settings → Account after first login**)
- Data directory: `server/data/` (SQLite DB, recycle bin, thumbnails, upload temp, secret key); override with `CP_DATA`
- Port: default `18322`, override with `CP_PORT`; public URL (needed by ONLYOFFICE) via `CP_PUBLIC_URL`
- First run: log in as admin → Admin Console → Storage Policies → mount a local directory as a disk (e.g. C:), which then shows up under This PC on the desktop

**Development mode**

```bash
cd web && npm install && npm run dev   # Vite on 5173, /api proxied to 18322
cd server && go run .                  # backend
```

---

## 目录结构

```
cloudpan/
├── build.bat / build.sh / start.bat   # 构建 & 启动脚本
├── docs/screenshots/                  # README 截图
├── server/                            # Go 后端（单二进制，embed 前端）
│   ├── main.go
│   └── internal/
│       ├── config/  model/  dto/      # 配置 / 全量表结构 / 统一响应
│       ├── fscore/                    # 存储驱动接口+注册表、路径安全、分块上传、秒传、zip、SSRF
│       ├── driver/                    # 123 / 阿里 / 百度 / 天翼 云盘驱动
│       ├── handler/                   # auth/fs/upload/share/recycle/admin/office/webdav/browser/tasks
│       └── web/                       # go:embed 前端产物
└── web/                               # Vue 3 + TS + Vite 前端
    └── src/
        ├── shell/                     # ShellHost 路由壳 / 分享页
        ├── themes/                    # 三套 OS 主题包（windows / macos / deepin，插件式）
        ├── apps/                      # 16 个内置应用
        ├── stores/                    # session / windows / apps / ui / transfer (Pinia)
        └── api/                       # axios 封装与各模块 API
```

## Repository Layout

```
cloudpan/
├── build.bat / build.sh / start.bat   # build & launch scripts
├── docs/screenshots/                  # README screenshots
├── server/                            # Go backend (single binary, embedded frontend)
│   ├── main.go
│   └── internal/
│       ├── config/  model/  dto/      # config / table models / unified responses
│       ├── fscore/                    # storage driver interface+registry, path safety, chunked upload, dedup, zip, SSRF guard
│       ├── driver/                    # 123Pan / Aliyun / Baidu / Tianyi cloud drivers
│       ├── handler/                   # auth/fs/upload/share/recycle/admin/office/webdav/browser/tasks
│       └── web/                       # go:embed frontend build output
└── web/                               # Vue 3 + TS + Vite frontend
    └── src/
        ├── shell/                     # ShellHost router shell / share page
        ├── themes/                    # three OS theme packages (windows / macos / deepin, pluggable)
        ├── apps/                      # 16 built-in applications
        ├── stores/                    # session / windows / apps / ui / transfer (Pinia)
        └── api/                       # axios wrapper and per-module APIs
```

---

## 部署加固

**HTTPS（推荐 Caddy 自动签证书）**

```
pan.你的域名.com {
    reverse_proxy 127.0.0.1:18322
}
```

Nginx 参考：`location / { proxy_pass http://127.0.0.1:18322; proxy_set_header Host $host; client_max_body_size 0; }`（`client_max_body_size 0` 解除上传大小限制）。启用 HTTPS 后把 `CP_PUBLIC_URL` 设为 https 地址（ONLYOFFICE 集成要求两侧同协议）。

**开机自启**
- Windows 服务（NSSM）：`nssm install CloudPan E:\cloudpan\server\cloudpan.exe` + `AppEnvironmentExtra CP_PORT=18322 CP_DATA=E:\cloudpan\server\data`
- Linux systemd：`[Service] WorkingDirectory=/opt/cloudpan/server; ExecStart=/opt/cloudpan/server/cloudpan; Restart=always`

**安全说明**
- 登录防爆破：同 IP+用户名 15 分钟内失败 5 次锁定；登录接口 IP 限速（10 次/分钟）
- **终端以服务器进程用户身份执行命令**（如以 root 启动即 root 权限），请仅部署在受信任环境，或用独立低权限账号运行
- SSH 连接凭证 AES-256-GCM 加密存储（密钥 = 服务器 secret.key）；主机密钥 TOFU 防中间人；目标地址拒绝云元数据/保留段
- 直链/预览支持 `?t=令牌` 查询参数（img/video/a 标签无法携带请求头），令牌即登录 JWT，生产环境建议全程 HTTPS
- 访问日志自动脱敏（`t`/`token`/`st`/`pt` 参数）
- 离线下载与内置浏览器代理均过 SSRF 三层防护（URL 校验 + 重定向复检 + 拨号层 DNS 复检），环回/链路本地/ftp 一律拒绝
- 上传分片临时区每 6 小时自动清扫（结束/超时 48h 的会话）
- 建议定期备份 `server/data/cloudpan.db`

## Deployment & Hardening

**HTTPS (Caddy recommended, auto-issued certs)**

```
pan.your-domain.com {
    reverse_proxy 127.0.0.1:18322
}
```

Nginx: `location / { proxy_pass http://127.0.0.1:18322; proxy_set_header Host $host; client_max_body_size 0; }` (`client_max_body_size 0` lifts the upload size limit). Once on HTTPS, set `CP_PUBLIC_URL` to the https URL (required for ONLYOFFICE; both sides must share the same scheme).

**Auto-start**
- Windows service (NSSM): `nssm install CloudPan E:\cloudpan\server\cloudpan.exe` + `AppEnvironmentExtra CP_PORT=18322 CP_DATA=E:\cloudpan\server\data`
- Linux systemd: `[Service] WorkingDirectory=/opt/cloudpan/server; ExecStart=/opt/cloudpan/server/cloudpan; Restart=always`

**Security notes**
- Login brute-force protection: 5 failures within 15 minutes for the same IP+username locks the account; login endpoint rate-limited per IP (10/min)
- Direct links/previews accept `?t=<jwt>` query params (img/video/a tags cannot carry headers); the token IS the login JWT — serve over HTTPS in production
- Access log auto-redacts credentials (`t`/`token`/`st`/`pt` params)
- Offline download and the built-in browser proxy both pass the 3-layer SSRF guard (URL validation + redirect re-check + dialer-level DNS re-check); loopback/link-local/ftp always rejected
- Chunked-upload temp area auto-swept every 6 hours (sessions finished/expired >48h)
- Back up `server/data/cloudpan.db` regularly

---

## 云盘接入准备

| 云盘 | 需要什么 | 在哪获取 |
|---|---|---|
| 123云盘 | clientID + clientSecret | 123 开放平台 https://www.123pan.com/developer |
| 阿里云盘 | client_id + client_secret（授权后自动保存 refresh_token） | 阿里云盘开放平台（需申请应用） |
| 百度网盘 | AppKey + SecretKey（OAuth 后自动保存 access_token；上传需白名单，默认只读） | 百度网盘开放平台 |
| 天翼云盘 | 网页版 Cookie（实验性） | 浏览器登录天翼云盘后复制 |

管理控制台 → 存储策略 → 挂载存储 → 选择类型、填入密钥 → 「测通」验证连通性；OAuth 类云盘点「授权」完成 code 交换。

## Cloud Storage Backends

| Cloud | Credentials | Where to get them |
|---|---|---|
| 123Pan | clientID + clientSecret | 123 developer platform https://www.123pan.com/developer |
| Aliyun Drive | client_id + client_secret (refresh_token stored after OAuth) | Aliyun open platform (app registration required) |
| Baidu Wangpan | AppKey + SecretKey (access_token stored after OAuth; upload needs allow-list, read-only by default) | Baidu open platform |
| Tianyi Cloud | Web cookie (experimental) | Copy from a logged-in browser session |

Admin Console → Storage Policies → Mount → pick a type and fill in credentials → verify with "test connection"; OAuth clouds use the "authorize" button for the code exchange.

---

## 更新日志 Changelog

> 每次更新推送时在此追加条目（中文 + 英文），最新在上。
> Every release appends entries here (Chinese + English), newest first.

### 2026-09-10

- **无权限功能入口全面隐藏（离线下载/终端/分享/压缩/收藏/版本历史/Office）**：系统排查发现一批"功能"型能力不在应用清单里（不受"无权限应用隐藏"机制覆盖），无权限用户仍能看到入口——① **离线下载**三处入口（设置「离线下载」页签、资源管理器右键「离线下载到此」——原先对无权限者显示置灰的"用户组已禁用"字样、Win12 搜索面板「离线下载」设置区），现与后端语义对齐（offline_http/bt 任一功能可用 且 组启用），无权限用户（含游客）三处入口整体消失；② 资源管理器右键「**在终端中打开**」（盘卡右键 + 文件夹右键两处）按终端功能权限隐藏；③ 资源管理器工具栏「分享」按钮与右键「分享/共享…」（公开分享需 share 功能、站内共享需 usershare 功能，另需管理员或组允许）按权限隐藏；④ 组禁用压缩时「压缩打包/解压到当前目录」整体隐藏（原先置灰显示）；⑤ 游客（共享账号）的「收藏」入口隐藏（收藏是共享状态，后端 GuestReadOnly 兜底）；⑥ 属性对话框「版本历史」区块按「版本管理」功能权限隐藏（无权限时也不再发请求）；⑦ 文件「打开方式」的「Office 编辑器」项需同时具备 Office 功能权限。全部与后端 403 语义对齐、符合"无权限功能完全隐藏"原则；有权限用户（普通用户/管理员）入口不变。另修复**线上库访客组标志漂移**：allowShare/allowArchive/allowWebdav 曾被误写为启用（游客实际可创建站内共享、可压缩打包），已恢复为种子值（全禁用），验证游客创建共享 403。GUI 27/27 + E2E 31/31 全部通过（含回归）
  - **Permission-less feature entries fully hidden (offline download / terminal / share / compress / favorites / version history / Office)**: a systematic audit found a batch of "feature" capabilities outside the app manifest (hence outside the "hide permission-less apps" mechanism) still visible to users without permission — ① offline download's three entry points (Settings tab, Explorer right-click "Download offline here" — previously shown greyed as "disabled by group", and the Win12 search-panel area), now matching backend semantics (either offline_http/bt available AND group allows offline) and hidden entirely for users without permission (incl. guests); ② the Explorer "Open in Terminal" context entries (drive-card + file menus) hidden by terminal feature permission; ③ the toolbar Share button and right-click Share / Share-with entries hidden by permission (public share needs the share feature, in-site share needs usershare, plus admin or group allowShare); ④ Compress & package / Extract hidden entirely when the group denies archive (previously greyed out); ⑤ favorites entries hidden for guests (favorites are shared-account state; backend GuestReadOnly is the backstop); ⑥ the properties dialog "Version history" block hidden by the version feature (no request made when unavailable); ⑦ the "Office Editor" open-with item requires the office feature permission as well. All aligned with backend 403 semantics and the "permission-less features fully hidden" principle; users with permission are unchanged. Also fixed **live-DB visitor-group flag drift**: allowShare/allowArchive/allowWebdav had been wrongly set enabled (guests could actually create in-site shares and compress files); restored to the all-disabled seed values, verified guest share creation returns 403. GUI 27/27 + E2E 31/31 (incl. regressions)
- **游客共享账号只读兜底（修复"游客可改密码/自改账号"一类逻辑漏洞）**：系统排查发现游客共享账号存在 9 处可写自身状态的逻辑问题——修改登录密码、修改昵称/头像、设置 WebDAV 密码、写用户设置 KV（媒体观看进度/播放列表）、保存记事本、加收藏、标记站内通知已读、绑定云盘等。根因：游客是全体访客共用的系统托管身份（随机密码不可知、共用一个账号与存储目录），而系统此前只有"功能级"（应用门控）与"盘级"（只读组）防护，缺少"账号级"默认拒绝。现新增 `GuestReadOnly` 中间件兜底：**游客令牌的一切非 GET 请求一律 403**（游客合法操作——浏览/下载/预览/搜索/查看共享——全部是 GET，不受影响），今后新增任何写端点也默认被拒，此类问题不会再出现；唯一例外是被显式以 rw（可写）方式共享给访客的目录（显式授权优先于只读兜底，与原只读组语义一致）。同时：设置应用账号页对游客显示"共享只读身份"说明（隐藏昵称/修改密码/WebDAV 密码入口），记事本对游客只读（可查看不可保存）；`/auth/me` 与登录响应新增 `isGuest` 字段供前端判断。E2E 31/31 + GUI 12/12 全部通过
  - **Guest shared-account read-only fallback (closes the "guest can change password / self-manage account" class of logic holes)**: a systematic audit found 9 ways the guest shared account could mutate its own state — changing the login password, nickname/avatar, setting the WebDAV password, writing the user-settings KV (media progress / playlists), saving notepad files, adding favorites, marking in-site notifications read, binding a cloud drive, etc. Root cause: the guest is a system-managed identity shared by every visitor (random unknown password, one account and one storage directory in common), yet only "feature-level" (app gates) and "drive-level" (read-only group) protections existed — no "account-level" default-deny. A new `GuestReadOnly` middleware now rejects **every non-GET request made with a guest token** (all legitimate guest operations — browse / download / preview / search / view shares — are GETs, so unaffected); any future write endpoint is denied by default, so this class of problem cannot recur. The single exception is a folder explicitly shared rw (explicit grant overrides the read-only fallback, same semantics as the read-only group). Also: the Settings account page shows a "shared read-only identity" note to guests (hiding the nickname / change-password / WebDAV-password controls), Notepad is read-only for guests (can view, cannot save); `/auth/me` and the login responses now return `isGuest` for the frontend. E2E 31/31 + GUI 12/12
- **游客不再可见「应用中心/网络测速」+ 站点主题改管理员全局设置（非管理员无任何个性化入口）**：① 访客组（游客）在原有禁用（终端/浏览器/Office/WebDAV/分享/离线下载/BT/系统监控）基础上，进一步**隐藏「应用中心」与「网络测速」**——「网络测速」由纯前端功能升级为带后端权限门控的一等功能（应用清单条目 + 路由级 AppGate），从此可按用户组/个人开关，且其 API 对游客直接 403；游客桌面只剩基础应用（资源管理器/此电脑/回收站/记事本/计算器/图片媒体查看/设置），应用中心与网络测速的全部入口（桌面图标/开始菜单/搜索面板）彻底消失。② **主题不再是访客个人偏好，而是站点级设置**：管理员在「管理控制台 → 站点设置 → 站点主题」选择 Windows 12 概念版 / macOS（Sonoma）/ Deepin（DDE），之后**所有访问者（游客/普通用户/管理员）打开系统都渲染管理员所选主题**，公开分享链接页也按站点主题渲染；非法值自动回落 Windows 12。移除了原先按浏览器 localStorage 记忆的本地主题（cp_theme）。③ **个性化入口对非管理员完全隐藏**：设置应用「个性化」页签、Win12 桌面右键「个性化/切换深色」、macOS 菜单栏「个性化…」、Deepin 桌面菜单「个性化」、搜索面板个性化区域——全部只对管理员可见；游客与普通用户看不到任何主题个性化入口，只有管理员能改站点主题。E2E 14/14 + GUI（Playwright）17/17 全部通过
  - **Guests no longer see App Center / Speed Test + theme is now an admin-controlled site setting (no personalization for non-admins)**: ① the visitor group (guests) now also hides **App Center** and **Network Speed Test** on top of the existing denials (terminal / browser / Office / WebDAV / share / offline download / BT / system monitor) — "Speed Test" is upgraded from a frontend-only feature to a first-class feature with a backend permission gate (manifest entry + route-level AppGate), so it can be toggled per group / per user, and its APIs return 403 for guests; the guest desktop keeps only the basic apps (explorer / This PC / recycle bin / notepad / calculator / image-media viewer / settings), and every entry point for App Center and Speed Test (desktop icon, start menu, search panel) is gone. ② **The theme is no longer a per-visitor preference but a site-level setting**: the admin picks "Site Theme" (Windows 12 concept / macOS Sonoma / Deepin DDE) in Admin Console → Site Settings, and after that **every visitor (guest / regular user / admin) sees the theme the admin chose**, and the public share-link page renders in the site theme too; invalid values fall back to Windows 12. The old per-browser localStorage theme (cp_theme) is removed. ③ **All personalization entry points are hidden from non-admins**: the "Personalization" tab in Settings, the "Personalization / switch dark" items in the Win12 desktop context menu, "Personalization…" in the macOS menu bar, "Personalization" in the Deepin desktop menu, and the personalization area in the search panel are visible to admins only — guests and regular users see no theme-personalization entry anywhere; only the admin can change the site theme. Verified: E2E 14/14 + GUI (Playwright) 17/17

### 2026-09-09

- **游客登录（登录页默认游客入口，去除 admin 默认）**：三主题（Win12 / macOS / Deepin）登录页默认进入**游客登录**模式——只有一个「游客登录」按钮，点击即以「游客」身份进入系统（24 小时令牌、独立限流），全程不输账号密码，页面上不再出现 admin；点「使用账号登录 →」可切换为账号密码登录，用户名框默认**空**（移除三主题原先的 admin 预填与"默认 admin"占位文案），账号模式下可再切回游客。系统首次启动自动创建共享 guest 账号（昵称「游客」、归入访客组、随机密码永不出库）；管理控制台「站点设置」新增「游客登录」开关（默认开），关闭后登录页游客入口自动消失、/auth/guest 返回 403
  - **Guest login (login pages default to a guest entry; admin is no longer shown)**: all three themed login pages (Win12 / macOS / Deepin) now default to **guest mode** — a single "Guest Login" button that enters the system as "Guest" (24-hour token, dedicated rate limit) with no username/password at all, and "admin" appears nowhere on the page. "Sign in with an account →" switches to account mode, where the username field is **empty** by default (the old admin prefill and "default admin" placeholder are removed from all themes), and you can switch back to guest from there. A shared guest account (nickname "游客", in the visitor group, random never-exposed password) is auto-created on first startup; the admin console's site settings gain a "Guest login" switch (on by default) — turning it off removes the guest entry from login pages and makes /auth/guest return 403
- **访客只读用户组（仅查看与下载 + 基础应用）**：用户组新增组级**只读**标志（组编辑对话框勾选框）：只读组成员对自己的盘只可查看/下载/搜索/预览/收藏/设置，新建/上传/重命名/剪切/复制/粘贴/删除/批量重命名/版本恢复一律 403「该用户组为只读，仅可查看和下载」；管理员豁免。内置「访客」组默认只读并只保留基础应用（资源管理器、此电脑、回收站、记事本、计算器、网速测试、图片/媒体查看、应用中心、设置），禁用终端/浏览器/Office/WebDAV/分享/离线下载/BT/系统监控——访客仍能浏览共享给自己的内容（内部共享应用放行）。边界：只读约束的是**自己的盘**；若有人把目录以可写（rw）方式共享给访客组，访客可写该共享（显式授权优先于组只读）
  - **Read-only visitor group (view + download only, basic apps)**: user groups gain a group-level **read-only** flag (checkbox in the group editor): members of a read-only group can only view / download / search / preview / favorite / configure their own drive — mkdir / upload / rename / cut / copy / paste / delete / batch-rename / version-restore all return 403 ("this group is read-only — view and download only"); admins are exempt. The built-in "访客 (Visitor)" group is read-only by default and keeps only the basic apps (explorer, This PC, recycle bin, notepad, calculator, speed test, image/media viewer, app center, settings), denying terminal / browser / Office / WebDAV / share / offline download / BT / system monitor — while the in-site share app stays allowed so visitors can browse what is shared to them. Boundary: read-only constrains **your own drive**; if someone shares a folder rw to the visitor group, guests may write into that share (explicit grant overrides group read-only)
- **共享目标扩展（指定用户 / 用户组 / 所有人）+「共享」虚拟盘**：站内共享（内部共享）目标从"单个用户"扩展为三类——**指定用户 / 某个用户组 / 所有人**（所有人 = 全部注册账号，含以后注册者）；普通用户与管理员都可发起共享（管理员豁免所在组的共享限制），共享对话框新增「共享范围」三选一（选用户组出现组下拉，选所有人出现范围提示），共享列表显示目标名称（用户名/组名/所有人），同范围同目录去重。共享给我目录的文件现在以**挂载盘**形式可见：「此电脑」视图顶部新增「共享 (N)」盘卡、侧栏「此电脑」区新增「共享」入口；打开后列出所有共享给我的目录（重名自动附创建者区分，带只读/可写标记），内部可预览/下载，可写共享还可新建/上传/删除（含拖拽上传）；共享盘内禁用剪切/复制/粘贴/重命名/压缩/收藏；原「来自他人的共享」独立窗口与侧栏快捷列表保留
  - **Share targets expanded (specific user / user group / everyone) + a mounted "Shared" drive**: in-site shares now support three target types — **specific user / user group / everyone** (everyone = all registered accounts, including future ones); both regular users and admins can create shares (admins bypass their group's share restriction). The share dialog gains a three-way "Share scope" radio (picking a group shows a group dropdown; picking everyone shows a scope hint), share lists display the target's name (username / group name / "everyone"), and duplicate shares of the same folder to the same scope are rejected. Shared-with-me folders now also appear as a **mounted drive**: the This PC view gets a "Shared (N)" drive card on top and the sidebar a "Shared" entry under This PC; opening it lists every folder shared to you (duplicate names disambiguated by creator, with read-only/writable badges), where you can preview and download — writable shares additionally allow new folder / upload / delete (drag & drop included); cut / copy / paste / rename / archive / star are disabled on the shared drive. The standalone "Shares from others" window and its sidebar shortcuts are kept
- **分享转存（公开链接一键保存到自己账号，百度网盘式）**：登录用户打开公开分享链接页（带提取码的先输码）时，头部出现「**保存到网盘**」按钮——点击后在对话框中选择目标盘与目标文件夹（迷你目录浏览器，带面包屑，默认根目录），一键将分享内容**递归复制到自己账号**：先按总大小预检配额再复制并记账；同名条目不覆盖（自动加后缀，非破坏）；复制时计算内容 SHA-256 并登记秒传账本——转存过的内容此后任何人再上传同内容直接**秒传**（硬链接、磁盘仅一份物理数据）。只读组（访客）转存被拒 403，未登录 401
  - **Save-to-drive on public share links (Baidu-style transfer-save)**: signed-in users opening a public share link (entering the extraction code first when set) see a **Save to Drive** button in the header — clicking it opens a dialog to pick the target drive and folder (mini directory browser with breadcrumb, defaults to root), and the shared content is **recursively copied into the user's own account**: quota is pre-checked by total size, then applied after the copy; same-name entries are never overwritten (auto-suffixed, non-destructive); during the copy the content's SHA-256 is computed and registered in the instant-upload ledger, so the saved content becomes **instant-uploadable** for everyone afterwards (hard link, one physical copy on disk). Read-only groups (visitors) get 403 on transfer-save; anonymous requests get 401

- **无权限的功能对用户完全隐藏**：此前被用户组/个人禁用（或全局停用）的功能，无权限用户仍能看到图标与卡片（仅置灰提示"无权限"）。现在改为——只要该用户对这个功能没有权限（全局停用、组禁止或个人禁止任一命中），该功能就从**所有入口彻底消失**：桌面图标、开始菜单/Dock/Launchpad、应用中心卡片都不再显示，"连图标都看不到"；管理员不受影响，仍能在应用中心看到并管理全部功能。同时修复：登录/切换账号后会重新拉取功能清单（此前启动时拉取发生在登录前、无令牌 401，导致权限不生效、图标不隐藏）
  - **Permission-less features are now fully hidden**: previously a feature denied to a user (by group, by the user, or globally disabled) still showed its icon/card to that user (just greyed out with a "no permission" tag). Now, whenever the user lacks permission for a feature (global disable, group deny, or per-user deny — any one), the feature disappears from **every** entry point: no desktop icon, no start-menu/Dock/Launchpad entry, no app-center card — "not even visible". Admins are unaffected and can still see and manage all features in the app center. Also fixed: the feature list is now re-fetched on login / account switch (it was previously fetched at startup, before login, with no token → 401, so permissions never applied and icons were never hidden)
- **秒传去重改为"副本账本"（真正的百度网盘语义）**：此前删除某份内容会直接清掉哈希索引，导致其他用户手里的同内容副本不再参与秒传。现在为每个物理副本单独记账（`file_hash_copies`）——某用户删除自己的文件（哪怕是移入回收站、清空回收站）只移除**他自己的**那一条记录，只要还有任意一个副本存活，索引就保留、秒传继续可用、源路径自动改指存活副本；只有当**最后一个**副本物理消失时（硬链接数归零），索引才删除、文件数据才真正释放。覆盖上传/改名/移动/复制/回收站/版本历史等全部路径
  - **Instant-upload dedup rebuilt as a "copy ledger" (true Baidu-Netdisk semantics)**: previously deleting any copy of a content dropped its hash index, so other users' same-content copies stopped benefiting from instant upload. Now each physical copy is tracked individually (`file_hash_copies`) — when a user deletes their own file (even into the recycle bin, or emptying it), only **their** record is removed; as long as any copy survives, the index stays, instant upload keeps working, and the source path auto-repoints to a surviving copy; only when the **last** copy physically vanishes (hard-link count hits zero) is the index dropped and the data truly released. Covers upload / rename / move / copy / recycle bin / version history — all paths
- **秒传（跨用户 / 跨目录去重，类百度网盘）**：全站维护一份 SHA-256 内容哈希索引（`file_hashes`：哈希 / 大小 / 首份内容物理路径 / 引用数）。上传时先按哈希查库——命中且源文件完好即"秒传"：优先硬链接（同一 inode，磁盘上只保留一份物理数据），跨卷失败则本地复制；用户在自己目录里看到完整文件，空间只占一份。删除 / 移动 / 移入回收站 / 版本覆盖时同步维护索引（源失效即清理，后续同内容上传自动重新登记自愈）。跨用户、跨目录均生效
  - **Instant upload (cross-user / cross-directory dedup, Baidu-Netdisk style)**: a site-wide SHA-256 content-hash index (`file_hashes`: hash / size / first-copy physical path / ref count) is maintained. On upload the hash is looked up first — a hit with an intact source triggers an "instant upload": a hard link is created first (same inode, ONE physical copy on disk) with a local copy as fallback, so the user sees a complete file in their own directory while storage holds just one. Deletion / move / recycle-bin / version-overwrite all maintain the index (a dead source is dropped; the next same-content upload re-registers it). Works across users and directories
- **完整的应用权限系统（用户组 + 单个用户）**：每个系统功能（终端、WebDAV、离线下载、分享、系统监控等）可在**用户组**与**单个用户**两级分别设置三态开关——默认/继承、允许、禁止。解析优先级：全局停用 > 个人设置 > 用户组设置 > 默认允许；管理员不受组/个人限制（但仍受全局停用约束）。被禁用的功能：API 直接 403、应用中心显示"无权限"锁定态且不可开启。管理控制台的用户组编辑与用户行"权限"按钮均可配置。终端等危险功能可禁用到普通用户组，防止越权
  - **Complete app permission system (group + per-user)**: every system feature (terminal, WebDAV, offline download, share, system monitor, …) can be set in a three-state switch (default/inherit, allow, deny) at **both** the user-group and the individual-user level. Resolution order: global disable > per-user override > group setting > allow-by-default; admins bypass group/user settings but not global disable. A denied feature returns 403 on its APIs and shows a locked "no permission" state in the app center (cannot be enabled from there). Configurable from the group editor and the per-user "Permissions" button in the admin console. Dangerous features like the terminal can be denied to regular user groups to prevent privilege escalation

- **修复拖入空文件夹报错**：部分浏览器内核无法为"空文件夹"生成目录条目，空文件夹会退化成一个 0 字节且不可读的 File 占位项，前端读取其内容算哈希时直接抛错。现在 0 字节文件不再读取文件本体（空内容哈希是确定的），拖入空文件夹不再报错；读取真实文件内容失败时给出明确提示（含文件名与原始错误）
  - **Fixed an error when dropping an empty folder**: some browser kernels cannot produce a directory entry for an empty folder, which degenerates into a 0-byte, unreadable File placeholder, and reading its contents for hashing threw. Zero-byte files no longer read the file body (the empty-content hash is deterministic), so dropping empty folders no longer errors; failing to read a real file's contents now yields a clear message with the file name and original error
- **修复一次拖入多个文件夹只上传一个**：部分浏览器内核只把拖入内容的一部分放进 `dataTransfer.items`（其余只在 `files` 里出现），此前落下的文件夹会静默丢失。现在拖放收集合并两个来源——`items` 里能遍历的目录树照常遍历，`files` 中未被覆盖的项一并补收（去重），不再无声丢失
  - **Fixed "only one folder uploaded when dragging multiple folders"**: some browser kernels put only part of the dropped content in `dataTransfer.items` (the rest appears only in `files`), and the leftover folders were silently lost. Drop collection now merges both sources — directory trees traversable from `items` are walked as usual, and uncovered `files` entries are picked up (deduplicated), so nothing disappears silently
- **空目录显式创建**：空目录（内部没有任何文件）上传时不会被自动建出来（没有文件触发建目录），拖放后现在通过 mkdir 显式创建（网盘资源管理器与 SFTP 面板均支持；SFTP 的 mkdir 改为幂等逐级创建，嵌套路径可用、已存在不报错）
  - **Empty directories are now created explicitly**: empty directories (containing no files) were never auto-created because no file upload triggers their creation; they are now created via mkdir after a drop (cloud drive and SFTP panel; SFTP mkdir is now idempotent and recursive, tolerating existing directories)
- **拖拽读取失败逐项上报**：某个目录/文件读取失败时给出明确提示与控制台日志，不再整批静默丢失
  - **Drop read errors are reported per item**: a failed directory/file read now produces a clear notice and console log instead of silently dropping the whole batch
- **支持 0 字节（空）文件上传**：此前空文件会被拒（参数错误）；文件夹里常见空文件（如 .gitkeep、锁文件），现在可正常上传
  - **Zero-byte (empty) file uploads now supported**: empty files were previously rejected with a parameter error; folders commonly contain empty files (e.g. .gitkeep, lock files) and they now upload normally
- **修复拖拽文件夹上传失败**：部分浏览器 / 内嵌 WebView 拖入文件夹时不会展开内容，只递交一个 0 字节的"文件夹"条目，导致上传报错（Windows 上表现为系统错误 267）。现在拖放时改用 `webkitGetAsEntry()` 递归遍历目录树（`readEntries` 按 100 条分批读到空），目录结构与文件内容完整保留；不支持 entries API 的旧浏览器自动退回扁平文件列表。网盘资源管理器与 SSH 的 SFTP 面板拖拽均生效
  - **Fixed drag-and-drop folder upload failures**: some browsers / embedded WebViews deliver a dragged folder as a single 0-byte entry instead of its contents, causing upload errors (system error 267 on Windows). Drops now use `webkitGetAsEntry()` to walk the directory tree recursively (`readEntries` in batches of 100), preserving structure and contents; browsers without the entries API fall back to the flat file list. Applies to both the cloud drive explorer and the SSH SFTP panel
- **上传/新建重名冲突给出明确提示**：上传的文件名与已存在目录同名时，返回明确错误「已存在同名目录，无法用文件覆盖（请先删除该目录或改名上传）」，不再出现含义不明的系统错误；SFTP 上传同样处理
  - **Clear error on name collisions**: uploading a file whose name matches an existing directory now returns an explicit message ("a directory with the same name already exists — delete it or rename the upload") instead of an obscure system error; SFTP uploads behave the same
- **修复根目录上传**：修复了路径规范化在虚拟根 `/` 上误报「路径非法」的问题（此前 Windows 部署下往根目录上传全部失败）；上传完成接口返回的路径统一规整（不再出现 `//` 双斜杠）
  - **Fixed root-level uploads**: path normalization no longer rejects the virtual root `/` as an invalid path (this broke all root uploads on Windows deployments); the completed-upload response now returns a properly normalized path (no double slashes)

### 2026-09-08

- **修复 Windows 部署下文件夹上传报错**：Windows 创建文件/目录时会静默截断名称末尾的空格与点，导致前后路径不一致、报系统错误 267「A requested file or directory could not be found / 找不到请求的文件或目录」。现在上传/新建/重命名前统一规范化路径段——尾部空格与点自动去除，Windows 保留设备名（NUL/CON/COM1-9/LPT1-9 等）与非法字符（`<>:"/\|?*`）给出明确中文提示；SFTP 面板按最严格规则处理（目标机可能是 Windows）；Linux 部署行为不变。另：上传失败时浏览器控制台会输出一条黄色警告 `[CloudPan 上传失败]`，含目标路径与原始错误，便于定位
  - **Fixed folder upload failing on Windows deployments**: Windows silently trims trailing spaces/dots from file and directory names, which desyncs the path and triggers system error 267 ("A requested file or directory could not be found"). Path segments are now normalized before upload / mkdir / rename — trailing spaces and dots are stripped, Windows reserved device names (NUL, CON, COM1-9, LPT1-9, …) and invalid characters (`<>:"/\|?*`) produce a clear message; the SFTP panel applies the strictest rules since its target may be Windows; Linux behavior is unchanged. Also: on upload failure the browser console now prints a yellow `[CloudPan 上传失败]` warning with the target path and raw error for diagnosis
- **终端 v2（真实 shell）**：本地终端改为服务端真实 PTY（Linux pty / Windows ConPTY，xterm.js + WebSocket，完整 TUI 可跑 vim/htop，shell 白名单）；新增远程 SSH 终端——保存多个连接（密码/私钥，AES-256-GCM 加密落库、API 永不回显）、主机密钥 TOFU、目标地址安全校验；SSH 模式带 **SFTP 文件管理面板**（浏览/上传/下载/新建/重命名/删除，拖拽上传带进度条）
  - **Terminal v2 (real shells)**: local terminal is now a genuine server-side PTY (Linux pty / Windows ConPTY, xterm.js + WebSocket, full TUI — vim/htop work, shell whitelist); new **remote SSH terminal** with multiple saved connections (password/private key, AES-256-GCM encrypted at rest, never echoed by the API), TOFU host keys and target-address safety checks; SSH mode includes an **SFTP file panel** (browse / upload / download / mkdir / rename / delete, drag & drop with per-file progress)
- **多用户数据隔离**：本地存储策略按用户划分独立目录（`<策略根>/<用户目录>/`），每个用户看到自己的虚拟根，互不可见；网页 / WebDAV / 分享 / 直链 / 在线编辑 / 离线任务 / 回收站 / 版本恢复全部按数据属主解析
  - **Per-user data isolation**: each local storage policy now gives every user a dedicated subdirectory (`<policy root>/<user dir>/`); each user sees their own virtual root and users cannot see each other's data; web UI / WebDAV / shares / direct links / online editing / offline tasks / recycle bin / version restore all resolve through the data owner
- **文件夹上传**：支持上传整个文件夹并保留目录结构（网盘「上传 → 上传文件夹」+ 拖拽文件夹；SSH 的 SFTP 面板同样支持，服务端自动创建子目录）
  - **Folder upload**: upload an entire folder with its directory structure preserved (cloud drive "Upload → Upload folder" + drag & drop; the SFTP panel in SSH mode supports it too, with the server creating subdirectories automatically)
- **修复 Fixes**：Win12 登录页用户名输入框常显（此前隐藏，注册用户无法登录 / registered users previously could not log in — the username field is now always visible）；SSH 连接管理对话框表单无法打开的问题 / the SSH connection form never opened; 开机动画卸载后残留定时器把用户踢回登录页 / boot-screen timers kicked fast logins back to the login page; 前端升级后旧缓存页面自动刷新一次 / stale cached pages auto-reload once after a deploy
- **其他 Other**：默认端口改为 18322 / default port changed to 18322

### 2026-09-08（首次发布 Initial release）

- CloudPan 首个版本：Go（Gin + GORM + 纯 Go SQLite）+ Vue 3 / TS / Vite 单二进制部署；Win12 / macOS / Deepin 三主题网页桌面外壳；本地 + 123 云盘 / 阿里云盘 / 百度网盘 / 天翼云盘存储策略；分块上传断点续传秒传、分享、回收站、压缩解压、离线下载（SSRF 防护）、WebDAV、ONLYOFFICE 在线编辑、内置浏览器（服务端代理）、多用户体系（角色/用户组/配额/审计）
  - First release of CloudPan: Go (Gin + GORM + pure-Go SQLite) + Vue 3 / TS / Vite, shipped as a single binary; web desktop shell with Windows 12 / macOS / Deepin themes; local + 123Pan / Aliyun Drive / Baidu Wangpan / Tianyi Cloud storage policies; chunked upload with resume & instant upload, sharing, recycle bin, archive compress/extract, offline download (SSRF-protected), WebDAV, ONLYOFFICE online editing, built-in browser (server-side proxy), multi-user system (roles / groups / quotas / audit log)

---

## 许可

- 本项目代码：**MIT**（见 [LICENSE](LICENSE)）
- 壁纸照片来自 Unsplash 免费授权；网络测速仅仿 LibreSpeed 界面布局（未复制代码/资产）
- Windows、Windows 11/12、macOS、Apple、Deepin 为各自权利人的商标，本项目为独立实现，与 Microsoft / Apple / 深度科技无任何关联

## License

- This project's code: **MIT** (see [LICENSE](LICENSE))
- Wallpaper photos are from Unsplash's free license; the network speed test imitates LibreSpeed's UI layout only (no code/assets copied)
- Windows, Windows 11/12, macOS, Apple and Deepin are trademarks of their respective owners. This project is an independent implementation and is not affiliated with Microsoft, Apple or Deepin Technology

---

## 联系 Contact

- **johngko**
- Email: **mail@johngko.com**

欢迎 Star / Issue / PR。

Stars, issues and PRs are welcome.
