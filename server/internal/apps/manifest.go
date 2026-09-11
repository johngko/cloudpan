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
