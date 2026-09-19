# CloudPan 工作区开发规范（AGENTS.md）

单二进制自托管网盘 + Web 云桌面：Go (Gin + GORM + modernc 纯 Go SQLite) 后端，Vue3 + TS + Vite 前端（`go:embed` 嵌入 `server/internal/web/dist`）。默认端口 **18322**，数据目录 `server/data`（WAL 模式）。

## 1. 分层结构（改动前先定位层）

```
server/main.go                 入口：driver 注册、显式 listener（自更新 syscall.Exec 用）、trusted proxies
server/internal/
  model/                       19 张表 + seed()（随机 admin 密码/guest 账号/站点默认/SystemApp 种子）
  fscore/                      核心抽象：Driver 接口、注册表(cachedDriver)、秒传台账、分片上传、
                               zip/tar/7z/rar、版本(.versions)、路径清洗、Windows 名净化
  middleware/                  auth(JWT+TokenVer)、guest(写白名单 default-deny)、
                               security(动态 CSP/日志脱敏/IP 限流)、appgate(三级应用门)
  handler/                     router.go 路由表 + 各业务 handler + 终端/通知/任务
  driver/                      pan123 / aliyun / baidu / tianyi（外部网盘接入，token 轮换必须 persistPolicyOpt）
  web/                         go:embed 静态托管 + SPA fallback
  （注：海报设计应用与内置海报资源库 T:/builtin、/vendor/poster 已整体下线删除，2026-09-19；用户数据不受影响）
  （注：CAD 看图 = webapps/cad，源码 web/tools/cad-viewer/（mlightcad MIT 核心 + LibreDWG GPL wasm 可选），DXF/DWG 离线渲染，CSP 需 unsafe-eval 子树例外）
  apps/manifest.go             SystemApp 定义（应用商店的"已内置"清单）
web/src/
  api/http.ts                  axios + sessionStorage 双 token + 401 单飞 refresh
  api/modules.ts               全部 API 模块（rawUrl/coverUrl/downloadUrl 的 ?t= 约定在此）
  router/index.ts              hash 路由：/boot /login /register /desktop + /s/:token + /office + /app/:app
  stores/                      session / windows / transfer / apps / appstate / dialog / notify / ui
  shell/                       ShellHost、useWindowChrome(窗口 chrome)、OfficePage、SharePage、StandaloneApp
  themes/                      ThemeDef 契约 + registry(懒加载 APP_COMPONENTS，404 自动 reload 一次)
  utils/                       sha256 / crypto(E2E 分享) / shareEncrypt / drop / markdown / clipboard
```

## 2. 构建与重启（⚠️ 最重要的规则）

**前端产物必须同步进 `server/internal/web/dist` 再 go build**，否则改前端不生效（build.sh 已自动化）：

```bash
cd /www/wwwhdd/cloudpan/ && ./build.sh        # npm build → rm+cp dist → touch .keep → go build
```

**重启必须用 `./start.sh`（它会加载 `env.local`，其中 CP_DB=mysql 等；裸启二进制会回落 SQLite 新建空库，导致"admin 密码登不上"的事故，2026-09-19 已发生过一次）**。改后端后推荐完整流程：

```bash
cd /www/wwwhdd/cloudpan/server
go build -ldflags "-X cloudpan/internal/handler.Version=$(git -C /www/wwwhdd/cloudpan rev-parse --short HEAD)" -o cloudpan .
cd /www/wwwhdd/cloudpan && ./start.sh restart
sleep 3 && curl -s -o /dev/null -w "up:%{http_code}\n" https://yun.johngko.com/   # 预期 up:200
# 确认日志首行是「数据库类型: mysql」：grep -a "数据库类型" /tmp/cloudpan-native.log | tail -1
```

环境变量见 `env.local`（`CP_PORT` / `CP_DATA` / `CP_DB`=mysql / `CP_MYSQL_*` / `CP_PUBLIC_URL` / `CP_TRUSTED_PROXIES`）；`./start.sh` 是唯一启动入口（含菜单/子命令 status|log）。

## 3. 数据不变量（改 fscore/model 必须保持）

- **秒传台账**：`file_hashes`(索引) + `file_hash_copies`(物理副本计数)。索引只在**最后一个物理副本消失**时删除；新增副本走 `RegisterHash`，重命名 `Renamed`，复制 `Copied`，删除路径 `HashPathGone`，启动 `reconcileHash` 兜底。百度语义。
- **TokenVer**：改密/登出 → `User.TokenVer+1`，旧 JWT 全部失效（Claims.Ver 校验）。
- **guest**：系统托管共享账号（24h TTL 工作区），写接口白名单见 `middleware/guest.go`，**default-deny**。
- **本地盘按用户隔离**：每用户 driver 根 = `root/fscore.UserDirOf(u)`。
- 版本文件存 `.versions/vN_原文件名`，`SaveVersion` 取 MAX+1。
- 解压上限：输入/总输出 20GB、10 万条目、深度 ≤12（zip-bomb 防护）。

## 4. 安全红线（不要碰）

- 新增**任何写接口**必须挂 `middleware.AppGate(key)`（游客会被 default-deny 挡住）；读接口按需 `AppGateAny`。
- `middleware/security.go` 的 CSP 是动态收紧的：不为省事加通配符；`/vendor/*` 的 frame-ancestors 例外按清单维护。
- 日志（AccessLogger）会脱敏 `t/token/st/pt` 与 `/s/<token>`；不要把凭据/token 打进新日志。
- 云盘 driver 的 token 轮换成功后必须 `persistPolicyOpt` 落库，否则重启后 refresh_token 丢失。
- 前端 E2E 加密分享（PBKDF2 10 万轮 + AES-256-CBC）只在客户端解密，密钥不过服务端；别加"服务端解密"捷径。
- **仓库与文档中禁止出现任何密码/密钥**（admin 口令、PAT 等一律不进文件；PAT 在 origin remote URL 里，别打印）。

## 5. 前端约定

- 鉴权 token 存 **sessionStorage**（每标签页独立）；资源 URL（img/video/下载/WS/SSE）走 `?t=` 查询参数传 token。
- 新应用 = `stores/apps.ts` 注册 + `themes/registry.ts` 的 `APP_COMPONENTS` 懒加载项 + `server/internal/apps/manifest.go`（若进应用商店）；单实例 vs 多开见 `windows.ts` 清单。
- 主题必须满足 `themes/types.ts` 的 ThemeDef 契约（含 geometry/snapEdges）；未知主题回落 win12。
- 上传走 `transfer.ts` 泵（并发 3、秒传 SHA-256 比对、分片循环），新上传入口不要自己造轮子。

## 6. Git 与发布

项目**不得提交 / 推送到 GitHub**（含代码、构建产物、文档），除非用户明确要求。
本地改动只在 `server/` 与 `web/` 内演进；构建产物（`server/internal/web/dist`、`cloudpan` 二进制）一律不进版本库。

## 7. 验证习惯

- 后端：`curl -s https://yun.johngko.com/api/site/public` 应返回 `{code:0,...}`；日志看 `/tmp/cloudpan-native.log`。
- GUI 改动：用 browser-use 实际点一遍，截图存 `docs/test-evidence/tNN-*.png`（NN 递增），写进 changelog/汇报。
- 查库用 MCP `cloudpan-db`（只读，工具 `list_tables`/`table_schema`/`query`/`overview`）；表名以 `list_tables` 实际结果为准（如用户表是 `users` 不是 `user`）。


