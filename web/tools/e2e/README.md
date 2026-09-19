# CloudPan E2E 探针

用 Playwright 驱动无头 Chromium 的端到端测试脚本（2026-09 全面测试所用，抓出过 3 个真实 bug）。

## 运行前提

```bash
npm i playwright-core        # 或复用机器上已有的 playwright-core
export PW=/path/to/playwright-core/node_modules   # 脚本内 import 路径按此调整
```

脚本默认 `BASE=http://127.0.0.1:18322`，需要测试账号（环境重建见脚本内 upload 流程）：
默认组用户 cptest / 测试盘（建 `测试磁盘` 本地策略）。

## 脚本清单

| 脚本 | 覆盖 |
|------|------|
| sweep.mjs | 全桌面应用逐个开启/关闭 + console/网络错误采集 |
| interact2.mjs | 记事本输入、新建/重命名/删除文件 |
| fileops.mjs | 文件管理 新建→自动重命名→删除 全链路 |
| flash.mjs | 刷新后桌面图标首帧完整性（权限竞态回归） |
| cadverify.mjs | CAD 看图 DXF/DWG 打开渲染 |
| cademlverify.mjs | EML 空态回归 + 邮件渲染 + 白板字体离线检查 |
| secprobe.mjs | 安全探针：穿越/越权/JWT 篡改/SSRF/XSS 载体（只读，不破坏数据） |
