# CloudPan

用 Go 和 Vue 写的私有云盘，带一套完整的 Web 桌面，Windows 12 / macOS / Deepin 三套主题可以随时切换。

![CloudPan 桌面](docs/screenshots/win12-02-desktop.png)

## 简介

CloudPan 是一个单二进制的自托管网盘。后端 Go（Gin + GORM），数据库默认 SQLite（零依赖），也可切换 MySQL 8（长期/多用户部署）；前端 Vue 3 + TypeScript + Vite，构建产物用 `go:embed` 打进二进制，编译出来一个可执行文件就能跑，不需要 Docker。

做这个项目的想法是把网盘和桌面结合起来：登录之后看到的不是一排排表单，而是一台「电脑」——开机动画、登录页、可以拖拽缩放贴边的窗口、开始菜单、任务栏、控制中心、全局搜索，桌面图标双击就能打开对应的应用。手机浏览器访问会自动进入移动布局（窗口全屏、触屏点选与长按菜单、侧栏抽屉化），并且支持「添加到主屏幕」作为 PWA 安装使用。

内置 30 余个应用：文件资源管理器（多标签、双视图、完整右键菜单）、存储分析、记事本与代码编辑器、计算器、终端（本地 shell 和远程 SSH，带 SFTP 面板）、内置浏览器（服务端代理，大部分网站都能嵌）、图片查看器与图库、在线 PS（Photopea）、媒体播放器与媒体中心、音乐播放器、Office 编辑器（对接 ONLYOFFICE）、PDF 阅读器、电子书与邮件查看器、思维导图、白板、流程图、SVG 编辑器、CAD 看图（DXF/DWG 离线渲染）、压缩包浏览器等。

网盘本身该有的也都有：分块上传、断点续传、秒传（SHA-256 台账 + 硬链接去重），分享链接（提取码 / 有效期 / 下载次数）与站内用户共享，回收站，在线解压，离线下载（HTTP / BT / 磁力，服务端代下），WebDAV，多用户、用户组、配额、审计日志。存储层参考了 Cloudreve 的驱动注册表设计，本地目录之外，123 云盘、阿里云盘、百度网盘、天翼云盘（实验性）都能挂。

字体、模型等资源全部打包在本地，整个系统在局域网里没有外网也能正常使用（只有天气小组件等少数可选项需要联网，离线时会明确提示）。

## 截图

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

## 功能

### 桌面外壳

三套主题共用同一套底层（`themes/` 目录下插件式组织）：

- 完整流程：开机动画 → 登录 / 注册 → 桌面，支持锁屏
- 窗口管理：拖拽、八向缩放、最大化 / 还原、贴边分屏、最小化动画、多标签资源管理器
- 手机适配：窄屏自动进入移动布局（窗口全屏铺满、单击选中再点打开、长按出菜单、侧栏抽屉化），可安装为 PWA
- Windows 12：BIOS 开机动画、悬浮胶囊任务栏、双栏开始菜单、全局搜索（应用 / 文档 / 网页分类结果）、控制中心、通知中心、小组件面板（计算器、存储空间、传输任务、收藏、天气、SSH 快捷连接）
- macOS：顶部菜单栏、高斯放大 Dock、Launchpad、红绿灯窗口按钮
- Deepin：DDE 25 风格全宽任务栏、全屏启动器
- 每主题 9 张壁纸 + 深色模式，设置里一键切换
- 通知中心（未读角标）、传输浮窗（多任务并发、暂停 / 继续 / 取消）、桌面与文件右键菜单

### 网盘

- 存储：本地目录 + 123 云盘 / 阿里云盘 / 百度网盘（默认只读）/ 天翼云盘（实验性），驱动注册表架构；管理台挂载、扫码授权、token 自动续期
- 首次部署自动预置本地 C(200G) / D(1000G) / E(500G) 三个盘符（根目录在数据目录 `storage/` 下），管理台可随意增删改
- 文件：新建 / 重命名 / 移动 / 复制 / 删除（入回收站）/ 搜索 / 收藏 / 属性；网格与列表双视图
- 上传：分块上传、断点续传、SHA-256 秒传（同内容硬链接，不占额外空间）；下载：单文件直下、多选打 zip 包、媒体流式预览
- 存储分析：按目录 / 类型 / 大文件等维度盘点磁盘占用
- 分享：提取码、有效期、剩余下载次数、公开分享页；站内用户共享（按用户 / 用户组 / 所有人，ro / rw）
- 回收站：还原 / 彻底删除 / 清空
- 压缩：右键打包 zip、在线解压（路径穿越校验、防 zip-bomb）
- 离线下载：HTTP(S) 与 BT / 磁力，服务端任务队列，SSRF 三层防护
- WebDAV：独立应用密码，可挂载进 Windows 资源管理器
- Office：对接 ONLYOFFICE 在线编辑，未配置时回退内置渲染
- 多用户、用户组、应用级权限、配额、只读组、审计日志

### 终端

- 本地终端：服务端真实 shell（Linux pty / Windows ConPTY），xterm.js 前端，vim、htop 这类 TUI 程序正常使用；仅管理员可用
- 远程 SSH：多连接管理（密码 / 私钥，凭据 AES-256-GCM 加密存储），主机密钥 TOFU，SFTP 文件面板

### 内置浏览器

多标签页 + 服务端代理。有些网站不允许被 iframe 嵌入，代理会把页面内容改写后转发（链接、样式、编码都会处理）；安全上用短时效票据、iframe 沙箱、SSRF 防护和限速。

## 快速开始

### Linux / macOS（推荐，一条脚本全托管）

```bash
./start.sh install    # 初次安装向导：依赖 → 运行配置 → 数据库(可自动建库) → 管理员账号 → 构建 → 启动
bash start.sh         # 无参数运行进入数字菜单（启动/停止/重启/构建/日志/配置/初始化全都能点选）
```

常用管理命令：

```bash
./start.sh status        # 运行状态（端口/健康/数据库）
./start.sh log 100       # 看日志
./start.sh build         # 重新构建（前端 + 嵌入 + 后端）
./start.sh restart       # 重启
./start.sh admin         # 修改管理员账号（交互式改用户名/密码，可只改一项）
./start.sh init          # 一键恢复出厂（自动先备份再清空，需 y/n 确认，随后可自定义管理员账号）
./start.sh test-db       # 测试 MySQL 连接（库不存在会自动创建）
./start.sh set db mysql  # 切换数据库等配置项（改 env.local，重启生效）
```

- 运行配置存放在 `env.local`（含数据库密码，已被 .gitignore 排除，绝不提交）：安装向导会自动生成，也可手动 `cp env.example env.local` 后修改；模板里每项都有注释（端口 / 数据目录 / SQLite 或 MySQL / 管理员账号 / 反代网段等）
- **管理员账号**：初始化时可自定义用户名和密码（密码至少 8 位，也可以选择随机生成）；未自定义时用户名 `admin`、密码随机生成**仅在启动日志打印一次**，登录后请立即修改；`./start.sh admin` 随时可改用户名或密码（修改后所有登录会话失效）
- 默认端口 `18322`（`CP_PORT` 修改）；数据目录默认 `server/data/`（`CP_DATA` 重定向），上传的文件全在这里，请定期备份
- 首次使用：管理员登录 → 管理控制台 → 存储策略 → 挂载/调整磁盘，桌面「此电脑」即出现对应盘符

### Windows

```bat
build.bat      :: 构建前端并嵌入，产出 server\cloudpan.exe
start.bat      :: 启动，浏览器访问 http://localhost:18322
```

配置用系统环境变量（变量名与 `env.example` 相同，如 `CP_PORT`、`CP_DATA`、`CP_DB`），或使用 WSL / Git Bash 走 `./start.sh install` 向导。

**开发模式**

```bash
cd web && npm install && npm run dev   # Vite 5173，/api 代理到 18322
cd server && go run .                  # 后端
```

## 目录结构

```
cloudpan/
├── build.bat / build.sh               # 构建脚本（前端构建 → 嵌入 dist → 编译后端）
├── start.bat / start.sh               # 启动脚本（start.sh 含安装向导与全套管理菜单）
├── env.example                        # 运行配置模板（复制为 env.local；env.local 不进 git）
├── docs/screenshots/                  # README 截图
├── server/                            # Go 后端（单二进制，embed 前端）
│   ├── main.go                        # 入口：驱动注册、监听器、trusted proxies、reset-admin/rename-admin 运维子命令
│   └── internal/
│       ├── config/  model/  dto/      # 配置 / 全量表结构（含 seed 初始化）/ 统一响应
│       ├── fscore/                    # 存储驱动接口+注册表、路径安全、分块上传、秒传、zip、SSRF
│       ├── driver/                    # 123 / 阿里 / 百度 / 天翼 云盘驱动
│       ├── handler/                   # auth/fs/upload/share/recycle/admin/office/webdav/browser/tasks
│       └── web/                       # go:embed 前端产物
└── web/                               # Vue 3 + TS + Vite 前端
    └── src/
        ├── shell/                     # ShellHost 路由壳 / 分享页
        ├── themes/                    # 三套 OS 主题包（windows / macos / deepin，插件式）
        ├── apps/                      # 内置应用（资源管理器 / 存储分析 / CAD 看图 / Office 等）
        ├── stores/                    # session / windows / apps / ui / transfer / viewport (Pinia)
        └── api/                       # axios 封装与各模块 API
```

## 部署加固

**HTTPS（推荐 Caddy 自动签证书）**

```
pan.你的域名.com {
    reverse_proxy 127.0.0.1:18322
}
```

Nginx 参考：`location / { proxy_pass http://127.0.0.1:18322; proxy_set_header Host $host; client_max_body_size 0; }`（`client_max_body_size 0` 解除上传大小限制）。启用 HTTPS 后把 `CP_PUBLIC_URL` 设为 https 地址（ONLYOFFICE 集成要求两侧同协议），反代网段写入 `CP_TRUSTED_PROXIES`。

**开机自启**
- Linux systemd：`[Service] WorkingDirectory=/opt/cloudpan/server; ExecStart=/opt/cloudpan/server/cloudpan; Restart=always`（环境项建议经 EnvironmentFile 指向 env.local）
- Windows 服务（NSSM）：`nssm install CloudPan E:\cloudpan\server\cloudpan.exe` + `AppEnvironmentExtra CP_PORT=18322 CP_DATA=E:\cloudpan\server\data`

**安全说明**
- 登录防爆破：同 IP+用户名 15 分钟内失败 5 次锁定（Web 登录与 WebDAV 共用同一锁定表）；登录接口 IP 限速（10 次/分钟）
- **客户端 IP 信任边界**：默认**不信任任何** `X-Forwarded-For`（直接取 TCP 对端地址），攻击者无法伪造 XFF 头绕过上述按 IP 的限速/锁定。部署在反向代理之后时，用 `CP_TRUSTED_PROXIES` 显式声明代理网段，系统才会从 XFF 链中还原真实客户端 IP
- **终端默认仅管理员可用**：应用清单中终端默认关闭，且默认用户组权限禁用终端（存量部署启动时自动补上，尊重已显式配置）；如需放行，在应用中心开启并给用户组/个人授权。终端以服务器进程用户身份执行命令，请仅部署在受信任环境，或用独立低权限账号运行
- **管理员账号**：初始化可自定义用户名+密码；未自定义时密码随机生成仅启动日志打印一次；`cloudpan reset-admin <新密码>` / `cloudpan rename-admin <新用户名>` 两条本机运维子命令可随时找回（需服务器 shell 权限，不构成新攻击面）；改密/改名后该账号全部旧 JWT 立即失效
- 禁用账号与密码错误返回一致提示（防用户名枚举）
- 在线 Office 回调拉取**钉扎到配置的 Document Server 同源地址**（scheme + host 白名单），防止回调被利用发起 SSRF
- 磁力链显式 tracker（tr=）与 HTTP 直链/种子同过 SSRF 校验（内网/保留段拒绝）；BT/磁力需独立功能权限
- 分享提取码验证按 IP 限速（防爆破密码分享）；只读用户组的 WebDAV 一律拒绝写操作
- **html/htm/xhtml/svg 一律强制下载**（`attachment`），不以内联方式直接响应，杜绝存储型 XSS 在站内域执行；xlsx 预览 HTML 经 DOM 白名单净化
- CSP 收紧：移除 `unsafe-eval` 通配（仅 CAD 看图等确需的子树例外），`script/style/connect/frame` 按配置精确放行 ONLYOFFICE Document Server 来源
- SSH 连接凭证 AES-256-GCM 加密存储（密钥 = 服务器 secret.key）；主机密钥 TOFU 防中间人；目标地址拒绝云元数据/保留段
- 直链/预览支持 `?t=令牌` 查询参数（img/video/a 标签无法携带请求头），令牌即登录 JWT，生产环境建议全程 HTTPS
- 访问日志自动脱敏（`t`/`token`/`st`/`pt` 参数）
- 离线下载与内置浏览器代理均过 SSRF 三层防护（URL 校验 + 重定向复检 + 拨号层 DNS 复检），环回/链路本地/ftp 一律拒绝
- 资源硬上限：离线下载 / BT 种子 / 归档解压 / 上传分片均有总量与条目数上限（防 zip-bomb 与磁盘拖爆）
- 上传分片临时区每 6 小时自动清扫（结束/超时 48h 的会话）
- 备份建议：SQLite 部署定期备份 `server/data/`（数据库与上传文件同目录）；MySQL 部署用 `mysqldump` 备库 + 备份 `CP_DATA` 上传文件目录；`./start.sh init` 恢复出厂时会自动先备份这两者再清空

## 云盘接入与扫码绑定教程

支持的云盘：**123云盘**（官方开放平台）、**阿里云盘**（开放平台 OAuth）、**百度网盘**（官方 API，OAuth）、**天翼云盘**（Cookie，实验性）。
阿里云盘 / 百度网盘支持**手机扫二维码一键绑定**（参考 AList 的挂载体验）：管理台把厂商授权页渲染成二维码，手机扫码→登录确认→厂商重定向回系统回调接口→token 自动落库，全程无需复制粘贴。

### 通用前置：配置「公开地址」

扫码绑定依赖厂商把手机浏览器重定向回本系统（`<公开地址>/api/cloud/callback`），因此**手机必须能访问该地址**：

1. 管理控制台 → 站点设置 → **公开地址**，填写手机可访问的地址（如 `https://pan.example.com` 或内网 `http://192.168.1.10:18322`）
2. 纯内网部署：手机与服务器处于同一局域网，填内网 IP 即可
3. 公网部署：域名需能解析到服务器（含反向代理）
4. 手机完全不可达本站时，可改用对话框内的「粘贴授权码」回退模式（oob 授权页直接显示授权码，人工粘贴）

### 阿里云盘（扫码绑定）

1. 打开 <https://open.alipan.com>（阿里云盘开放平台），注册开发者账号
2. 「应用管理」→ 创建应用，获得 **ClientID / ClientSecret**
3. CloudPan 管理控制台 → 存储策略 → **挂载存储** → 类型选「阿里云盘」→ 填入 ClientID/ClientSecret
4. 点「**扫码授权**」→ 对话框出现二维码 → 用**阿里云盘 App**（或手机浏览器）扫描二维码
5. 手机上登录阿里云盘账号并确认授权 → 手机页面显示「绑定成功」
6. 管理台对话框 3 秒内自动检测到绑定、token 自动填入 → 点「挂载」保存 → 列表「测通」验证
7. 此后 access_token 自动续期（refresh_token 轮换后自动落库），长期有效

### 百度网盘（扫码绑定）

1. 打开 <https://console.bce.baidu.com>（百度智能云控制台）→ 「百度应用开放体系」创建应用，获得 **AppKey / SecretKey**
2. **在应用配置里登记回调地址**：`<本站公开地址>/api/cloud/callback`（百度要求回调地址预先登记，必须与站点设置一致）
3. CloudPan 管理控制台 → 存储策略 → 挂载存储 → 类型选「百度网盘」→ 填入 AppKey/SecretKey
4. 点「**扫码授权**」→ 手机扫二维码 → 登录百度账号并确认授权 → 自动回填
5. 保存 → 「测通」验证
6. 说明：**上传/写操作**（新建/上传/移动/删除）需向百度申请接口白名单，未获批前为**只读挂载**（浏览/预览/下载/秒传不受限）；token 自动滚动续期（30 天有效期自动刷新）

### 123云盘 / 天翼云盘

- **123云盘**：<https://www.123pan.com/developer> 注册开发者 → 创建应用 → 填入 ClientID/ClientSecret → 挂载 → 测通（无需 OAuth 跳转）
- **天翼云盘**（实验性，社区逆向 Cookie，随时可能失效）：电脑浏览器登录天翼云盘网页版 → F12 复制 Cookie 整串填入

## ONLYOFFICE 部署指南

配置 Document Server 后，所有 Office 文档（doc/docx/odt/rtf、xls/xlsx/ods、ppt/pptx/odp、csv）打开即进入 **ONLYOFFICE 真实编辑器**——与 Cloudreve 在线 Office 相同的模式：预览与编辑是同一套编辑器界面，权限决定只读/可写，保存自动归档旧版本。PDF 走内置查看器（与 Cloudreve 一致）。**未配置 Document Server 时自动回退内置静态渲染**（docx/xlsx/pptx 客户端渲染，编辑器窗口内有配置提示条）。

**1. 部署 Document Server（Docker 推荐，官方镜像 `onlyoffice/documentserver`，约 2GB 内存）**

```bash
# JWT 密钥：生成一个随机串，DS 与 CloudPan 两侧必须一致（9.4.0+ 镜像 JWT 默认开启，环境变量名是 JWT_SECRET）
SECRET=$(openssl rand -hex 32)

docker run -d --name cloudpan-ds --restart unless-stopped --network host \
  -e JWT_SECRET="$SECRET" \
  onlyoffice/documentserver
```

- `--network host`：DS 直接监听宿主机 80 端口，且能回拉 `127.0.0.1:18322` 的文件。若用端口映射（`-p 11111:80`），DS 必须能按「公开地址」访问到 CloudPan（容器内 127.0.0.1 指向容器自身，需改用宿主机 IP 或 `--add-host=host.docker.internal:host-gateway`）。
- 首次启动需 1–3 分钟初始化（PostgreSQL/RabbitMQ/文档服务），`/healthcheck` 返回 `true` 即就绪。

**2. CloudPan 侧配置（管理控制台 → 站点设置）**

| 设置项 | 值 | 说明 |
|---|---|---|
| Document Server 地址 | `http://127.0.0.1` | **浏览器**访问 DS 的地址；外网/其他机器访问时改为服务器对外地址 |
| ONLYOFFICE JWT | 上面生成的 `$SECRET` | 必须与 DS 的 `JWT_SECRET` 一致，文档配置与回调因此带签名 |
| 公开地址 | 留空或 `http(s)://<服务器地址>:18322` | **DS 回拉文件/回调**用的 CloudPan 地址（DS 必须可达）；留空按访客浏览器地址自动推导 |

点「连接测试」应显示"连接正常"。CSP 会自动钉扎 DS 来源（10 秒缓存），无需其他改动。

**3. 行为说明**

- 编辑：可写身份（管理员/可写组/ rw 共享）打开即编辑态；只读身份（只读组/ ro 共享/游客）强制只读视图，保存回调对只读令牌一律拒写。
- 保存：DS 自动/强制保存 → 回调 CloudPan → 旧版本自动归档进版本历史 → 覆盖文件（rename-in 原子写）。
- 安全：回调拉取钉扎 DS 同源地址（防 SSRF）；文件拉取/回调走 HMAC 签名 token（24h 有效）。

## 更新日志

> 每次更新推送时在此追加条目（**仅中文**），最新在上；**只保留最近 2 天**的日期段，推送时删除更早的段。

### 2026-09-30

- **手机适配与 PWA**：窄屏自动进入移动布局——窗口全屏铺满、单击选中再点打开、长按 500ms 出菜单、侧栏抽屉化、工具栏自动换行；支持「添加到主屏幕」作为 PWA 安装（manifest + 四尺寸图标，含 maskable）；桌面端行为不受影响（data-mobile 作用域隔离）
- **存储分析应用**：按目录 / 类型 / 大文件等维度盘点各盘占用
- **管理员整盘共享越权修复**：管理员把整盘共享给他人/游客时，此前会把策略根下其他注册用户的目录一并暴露；现共享解析统一收口到「共享安全视图」（不再合并他人目录），显式共享某用户文件夹的能力不受影响，附回归测试
- **start.sh 一键管理套件**：`./start.sh install` 安装向导（依赖→配置→数据库自动建库→管理员账号→构建→启动）、`init` 一键恢复出厂（先备份再清空，y/n 确认）、`admin` 修改管理员账号（用户名/密码，交互式）、`test-db` 连接测试、数字菜单全功能点选；交互统一为「填写→汇总确认」模式，输入流中断自动中止防误操作
- **初始化默认值**：全新部署自动预置本地 C(200G)/D(1000G)/E(500G) 三盘（之后可随意增删，重启不复活）；管理员账号密码可在初始化时自定义（`CP_ADMIN_USER`/`CP_ADMIN_PASSWORD`），未设置时密码随机仅日志打印一次；新增 `env.example` 配置模板
- **管理后台重构**：统一「总账」数据模型与全局样式，页签直接取用；系统更新来源切换修复；回收站图标可读性修复

- 壁纸照片来自 Unsplash 免费授权；网络测速仅仿 LibreSpeed 界面布局（未复制代码/资产）
- Windows、Windows 11/12、macOS、Apple、Deepin 为各自权利人的商标，本项目为独立实现，与 Microsoft / Apple / 深度科技无任何关联
