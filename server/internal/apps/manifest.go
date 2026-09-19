// Package apps 定义系统功能应用清单（应用中心）。
// 新增功能 = 在此登记 + 在路由处挂 middleware.AppGate(key)。
package apps

// Def 一个可启停的系统功能
type Def struct {
	Key            string `json:"key"`
	Name           string `json:"name"`
	Icon           string `json:"icon"` // 前端 AppIcon 名称
	Desc           string `json:"desc"`
	Version        string `json:"version"`
	DefaultEnabled bool   `json:"-"`
}

// Manifest 内置系统功能清单
var Manifest = []Def{
	{Key: "app_center", Name: "应用中心", Icon: "grid", Desc: "功能应用管理与启停", Version: "1.0", DefaultEnabled: true},
	{Key: "offline_http", Name: "离线下载", Icon: "download", Desc: "HTTP/HTTPS 链接服务端代下载", Version: "1.0", DefaultEnabled: true},
	{Key: "bt", Name: "BT / 磁力", Icon: "cloud", Desc: "BT 种子与磁力链接离线下载", Version: "1.0", DefaultEnabled: true},
	{Key: "webdav", Name: "WebDAV", Icon: "drive", Desc: "挂载到 Windows 资源管理器", Version: "1.0", DefaultEnabled: true},
	{Key: "office", Name: "在线 Office", Icon: "office", Desc: "ONLYOFFICE 文档在线编辑", Version: "1.0", DefaultEnabled: true},
	{Key: "archive_view", Name: "压缩包浏览器", Icon: "archive", Desc: "zip/7z/tar 族在线浏览与解压（支持密码/GBK）", Version: "1.0", DefaultEnabled: true},
	{Key: "mindmap", Name: "思维导图", Icon: "mindmap", Desc: ".smm 思维导图在线编辑（simple-mind-map）", Version: "1.0", DefaultEnabled: true},
	{Key: "whiteboard", Name: "白板", Icon: "whiteboard", Desc: ".excalidraw 协作白板在线编辑", Version: "1.0", DefaultEnabled: true},
	{Key: "flowchart", Name: "流程图", Icon: "flowchart", Desc: ".drawio 流程图 / UML 在线编辑", Version: "1.0", DefaultEnabled: true},
	{Key: "image_editor", Name: "图片编辑器", Icon: "imageedit", Desc: "TOAST UI 图片编辑器（v9os 商店移植）：画笔/橡皮/蒙版/裁剪/滤镜/文字标注，PNG 保存到云盘", Version: "2.0", DefaultEnabled: true},
	{Key: "pdf_reader", Name: "PDF 阅读器", Icon: "pdfreader", Desc: "pdf.js PDF 阅读器（v9os 商店移植）：缩略图/大纲/查找/标注/演示模式", Version: "2.0", DefaultEnabled: true},
	{Key: "thumbnail", Name: "图片缩略图", Icon: "image", Desc: "服务端生成图片缩略图缓存", Version: "1.0", DefaultEnabled: true},
	{Key: "version", Name: "版本管理", Icon: "refresh", Desc: "文件覆盖时保留历史版本", Version: "1.0", DefaultEnabled: true},
	{Key: "notify", Name: "站内通知", Icon: "bell", Desc: "任务与配额事件通知中心", Version: "1.0", DefaultEnabled: true},
	{Key: "global_search", Name: "全局搜索", Icon: "search", Desc: "跨所有存储盘搜索文件", Version: "1.0", DefaultEnabled: true},
	{Key: "share", Name: "公开分享", Icon: "link", Desc: "生成外链分享（密码/有效期/次数）", Version: "1.0", DefaultEnabled: true},
	{Key: "usershare", Name: "内部共享", Icon: "share", Desc: "用户之间共享目录（只读/读写）", Version: "1.0", DefaultEnabled: true},
	{Key: "browser", Name: "内置浏览器", Icon: "browser", Desc: "桌面内置浏览器（服务端代理访问网站）", Version: "1.0", DefaultEnabled: true},
	{Key: "system_monitor", Name: "系统监控", Icon: "admin", Desc: "CPU/内存/磁盘/网络实时监控", Version: "1.0", DefaultEnabled: true},
	{Key: "terminal", Name: "终端", Icon: "terminal", Desc: "本地真实终端与远程 SSH 终端（含 SFTP 文件管理）", Version: "2.0", DefaultEnabled: false},
	{Key: "speedtest", Name: "网络测速", Icon: "speedtest", Desc: "内置网络速度测试", Version: "1.0", DefaultEnabled: true},
	// v9os 商店移植 webapps：自包含静态应用（/webapps/<code>/，容器 WebAppHost），无独立后端接口
	{Key: "music_player", Name: "音乐播放器", Icon: "media", Desc: "支持歌词的音乐播放器（移植自 v9os 商店）", Version: "1.0", DefaultEnabled: true},
	{Key: "picasa", Name: "Picasa 图片预览", Icon: "image", Desc: "相框式图片预览（移植自 v9os 商店）", Version: "1.0", DefaultEnabled: true},
	// 批次 2 移植
	{Key: "epub_reader", Name: "Epub 电子书阅读器", Icon: "book", Desc: "EPUB 电子书在线阅读（移植自 v9os 商店，epub.js 全本地解析）", Version: "1.0", DefaultEnabled: true},
	{Key: "code_editor", Name: "多功能编辑器", Icon: "code", Desc: "文本/代码/配置多标签编辑（移植自 v9os 商店，Ace 引擎，Ctrl-S 存回云盘）", Version: "1.0", DefaultEnabled: true},
	{Key: "svg_editor", Name: "SVG 编辑器", Icon: "vector", Desc: "SVG 矢量图在线编辑（移植自 v9os 商店 Method Draw，可存回云盘）", Version: "1.0", DefaultEnabled: true},
	{Key: "eml_viewer", Name: "EML 查看器", Icon: "mail", Desc: "EML/MHT 邮件文件查看（正文 DOMPurify 消毒，移植自 v9os 商店）", Version: "1.0", DefaultEnabled: true},
	// 批次 3 移植：在线PS。birdpaper（小鸟壁纸）已下线：与壁纸中心功能重复
	// 且依赖第三方公开 API（system_apps 旧行由部署方清理，见 docs 变更记录）
	{Key: "photopea", Name: "在线PS", Icon: "ps", Desc: "Photoshop 级图片/PSD 编辑（photopea 完整内置，可存回云盘）", Version: "1.0", DefaultEnabled: true},
	{Key: "cad_viewer", Name: "CAD 看图", Icon: "cad", Desc: "DXF/DWG 图纸在线看图（mlightcad/cad-simple-viewer 内置，纯浏览器端离线渲染，DWG 走 LibreDWG wasm）", Version: "1.0", DefaultEnabled: true},
}

// Find 按 key 查清单
func Find(key string) *Def {
	for i := range Manifest {
		if Manifest[i].Key == key {
			return &Manifest[i]
		}
	}
	return nil
}
