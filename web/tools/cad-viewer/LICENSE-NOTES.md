# CAD 看图 — 第三方组件与许可说明

本 webapp（/webapps/cad/）产物由 `web/tools/cad-viewer/` 工作区构建：

| 组件 | 许可 | 用途 |
|------|------|------|
| @mlightcad/cad-simple-viewer | MIT | CAD 查看核心（文档管理/命令栈/渲染集成） |
| @mlightcad/three-renderer + three.js | MIT | WebGL 渲染 |
| @mlightcad/data-model | MIT | DXF 解析（内置转换器） |
| @mlightcad/mtext-renderer | MIT | MTEXT 文字排版 |
| @mlightcad/libredwg-converter | **GPL-3.0** | DWG 解析（LibreDWG wasm，独立 worker 文件加载） |

DWG 解析依赖 LibreDWG（GPL-3.0）经 WASM 编译的 `assets/libredwg-web.wasm`。
DXF 功能完全不依赖该文件；如需移除 GPL 组件，删掉 assets/libredwg-* 两份文件即可，
DXF 查看不受影响。

字体：`cad-data/fonts/`（SHX/TTF/woff，来自 mlightcad/cad-data），供图纸文字渲染，
baseUrl 指向 `./cad-data/` —— 完全离线，无任何外部 CDN 请求。
