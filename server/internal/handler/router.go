package handler

import (
	"github.com/gin-gonic/gin"

	"cloudpan/internal/config"
	"cloudpan/internal/middleware"
)

// Setup 装配全部路由
func Setup(r *gin.Engine, cfg *config.Config, site *SiteHandler) {
	api := r.Group("/api")

	// 公开
	api.GET("/site/public", site.PublicInfo)
	auth := &AuthHandler{Secret: cfg.Secret}
	// 登录/注册按来源 IP 限速，防密码暴破与批量注册
	loginLimiter := middleware.NewIPRateLimiter(10, 5) // 10 次/分钟，突发 5
	regLimiter := middleware.NewIPRateLimiter(5, 2)    // 5 次/小时，突发 2
	// 游客登录是匿名默认入口，限流比账号登录宽松但仍防爆刷
	guestLimiter := middleware.NewIPRateLimiter(30, 10) // 30 次/分钟，突发 10
	api.POST("/auth/login", middleware.RateLimit(loginLimiter), auth.Login)
	api.POST("/auth/register", middleware.RateLimit(regLimiter), auth.Register)
	api.POST("/auth/guest", middleware.RateLimit(guestLimiter), auth.GuestLogin)

	// 公开分享（受「公开分享」功能门控）
	sh := &ShareHandler{Site: site, Secret: cfg.Secret}
	sg := api.Group("/s/:token", middleware.AppGate("share"))
	{
		sg.GET("/info", sh.Info)
		sg.POST("/verify", sh.Verify)
		sg.GET("/list", sh.List)
		sg.GET("/download", sh.Download)
		sg.GET("/raw", sh.Raw)
	}

	// 需登录
	ug := api.Group("", middleware.Auth(cfg.Secret))
	{
		ug.GET("/auth/me", auth.Me)
		ug.PUT("/users/me", auth.UpdateMe)
		ug.PUT("/users/me/password", auth.ChangePassword)
		ug.PUT("/users/me/webdav-password", auth.SetWebdavPassword)

		ug.GET("/policies", site.Policies)

		ug.GET("/fs/list", site.List)
		ug.POST("/fs/mkdir", site.Mkdir)
		ug.POST("/fs/rename", site.Rename)
		ug.POST("/fs/move", site.Move)
		ug.POST("/fs/copy", site.Copy)
		ug.POST("/fs/cross-copy", site.CrossCopy)
		ug.POST("/fs/cross-move", site.CrossMove)
		ug.POST("/fs/delete", site.Delete)
		ug.GET("/fs/text", site.ReadText)
		ug.POST("/fs/text", site.WriteText)
		ug.GET("/fs/search", site.Search)
		ug.GET("/fs/global-search", middleware.AppGate("global_search"), site.GlobalSearch)
		ug.GET("/fs/properties", site.Properties)
		ug.GET("/fs/raw", site.Raw)
		ug.GET("/fs/download", site.Download)
		ug.POST("/fs/archive", site.Archive)

		// 文件版本管理（受「版本管理」功能门控）
		ug.GET("/fileversions", middleware.AppGate("version"), site.FileVersions)
		ug.GET("/fileversions/download", middleware.AppGate("version"), site.FileVersionDownload)
		ug.POST("/fileversions/restore", middleware.AppGate("version"), site.FileVersionRestore)

		up := &UploadHandler{Site: site}
		ug.POST("/upload/init", up.Init)
		ug.PUT("/upload/chunk/:sid/:idx", up.Chunk)
		ug.POST("/upload/complete", up.Complete)
		ug.DELETE("/upload/:sid", up.Abort)
		ug.GET("/upload/:sid/status", up.Status)

		ug.GET("/recycle", site.RecycleList)
		ug.POST("/recycle/restore", site.RecycleRestore)
		ug.POST("/recycle/purge", site.RecyclePurge)

		ug.GET("/stars", site.StarList)
		ug.POST("/stars", site.StarAdd)
		ug.DELETE("/stars", site.StarRemove)

		// 用户设置 KV（播放列表/观看进度等）
		ug.GET("/settings", site.UserSettingsGet)
		ug.PUT("/settings", site.UserSettingsSet)

		// 网络测速（内置应用，界面仿 LibreSpeed；download 随机数据 no-store，upload 丢弃）
		// 受「网络测速」功能门控：游客（访客组）无权限，API 403 且桌面/应用中心入口隐藏
		st := &SpeedTestHandler{}
		ug.GET("/speedtest/ping", middleware.AppGate("speedtest"), st.Ping)
		ug.GET("/speedtest/download", middleware.AppGate("speedtest"), st.Download)
		ug.POST("/speedtest/upload", middleware.AppGate("speedtest"), st.Upload)

		ug.GET("/shares", middleware.AppGate("share"), sh.Mine)
		ug.POST("/shares", middleware.AppGate("share"), sh.Create)
		ug.DELETE("/shares/:id", middleware.AppGate("share"), sh.Cancel)
		// 转存：公开分享内容一键保存到自己账号（登录态）
		ug.POST("/s/:token/save", sh.SaveToDrive)

		// ONLYOFFICE（受「在线 Office」功能门控）
		office := &OfficeHandler{Site: site}
		ug.GET("/office/config", middleware.AppGate("office"), office.Config)

		// 云盘授权
		ca := &CloudAuth{Site: site}
		ug.GET("/cloud/auth-url", ca.AuthURL)
		ug.POST("/cloud/exchange", ca.Exchange)
		ug.GET("/cloud/status", ca.Status)

		// 离线下载（HTTP 或 BT 任一启用即放行）
		off := &OfflineHandler{}
		ug.POST("/offline", middleware.AppGateAny("offline_http", "bt"), off.Create)
		ug.GET("/offline", off.List)
		ug.DELETE("/offline/:id", off.Cancel)

		// 站内通知（每用户隔离，受「站内通知」功能门控）
		notify := &NotifyHandler{}
		ug.GET("/notify", middleware.AppGate("notify"), notify.List)
		ug.GET("/notify/unread", middleware.AppGate("notify"), notify.Unread)
		ug.GET("/notify/stream", middleware.AppGate("notify"), notify.Stream)
		ug.POST("/notify/read", middleware.AppGate("notify"), notify.Read)
		ug.POST("/notify/clear", middleware.AppGate("notify"), notify.Clear)

		// 站内用户共享（受「内部共享」功能门控）
		ush := &UserShareHandler{Site: site}
		ug.GET("/users", ush.Users)
		ug.GET("/groups", ush.Groups)
		ug.POST("/usershares", middleware.AppGate("usershare"), ush.Create)
		ug.GET("/usershares", middleware.AppGate("usershare"), ush.Mine)
		ug.DELETE("/usershares/:id", middleware.AppGate("usershare"), ush.Cancel)
		ug.GET("/usershares/with-me", middleware.AppGate("usershare"), ush.WithMe)
		ug.GET("/shared/:id/info", middleware.AppGate("usershare"), ush.Info)
		ug.GET("/shared/:id/list", middleware.AppGate("usershare"), ush.List)
		ug.GET("/shared/:id/raw", middleware.AppGate("usershare"), ush.Raw)
		ug.GET("/shared/:id/download", middleware.AppGate("usershare"), ush.Download)
		ug.POST("/shared/:id/mkdir", middleware.AppGate("usershare"), ush.Mkdir)
		ug.POST("/shared/:id/upload", middleware.AppGate("usershare"), ush.Upload)
		ug.POST("/shared/:id/delete", middleware.AppGate("usershare"), ush.Delete)

		// 系统功能清单（应用中心数据源）
		ug.GET("/apps", site.AppList)

		// 终端：本地真实 shell（PTY/ConPTY）/ 远程 SSH 终端 + SFTP 文件管理（受「终端」功能门控）
		th := NewTerminalHandler(cfg.Secret)
		ug.GET("/terminal/ws", middleware.AppGate("terminal"), th.WebSocket)
		ug.GET("/terminal/platform", th.Platform)
		ug.POST("/terminal/conns", middleware.AppGate("terminal"), th.ConnSave)
		ug.GET("/terminal/conns", th.ConnList)
		ug.PUT("/terminal/conns/:id", middleware.AppGate("terminal"), th.ConnUpdate)
		ug.DELETE("/terminal/conns/:id", th.ConnDelete)
		ug.POST("/terminal/conns/:id/test", middleware.AppGate("terminal"), th.ConnTest)
		ug.GET("/terminal/fs/list", th.FSList)
		ug.POST("/terminal/fs/op", middleware.AppGate("terminal"), th.FSOps)
		ug.GET("/terminal/fs/download", th.FSDownload)
		ug.POST("/terminal/fs/upload", middleware.AppGate("terminal"), th.FSUpload)
	}

	// 内置浏览器代理：iframe 子资源请求没有 Authorization 头，故独立鉴权——
	// 登录 JWT（头或 ?t=）与短时效代理票据 ?pt= 二者皆可（见 browser.go）
	bh := &BrowserHandler{Secret: cfg.Secret}
	bg := api.Group("", bh.auth, middleware.AppGate("browser"), middleware.RateLimit(middleware.NewIPRateLimiter(300, 100)))
	bg.GET("/browser/session", bh.Session)
	bg.GET("/browser/p/:b64", bh.Proxy)

	// ONLYOFFICE 服务端回调（无 JWT，用签名 token 鉴权；受「在线 Office」功能门控）
	api.GET("/office/file", middleware.AppGate("office"), (&OfficeHandler{Site: site}).File)
	api.POST("/office/callback", middleware.AppGate("office"), (&OfficeHandler{Site: site}).Callback)

	// 直链提取：签发需登录，访问免登录
	dlh := &DLHandler{Site: site}
	ug2 := api.Group("", middleware.Auth(cfg.Secret))
	ug2.GET("/fs/dlink", dlh.Create)
	api.GET("/dl", dlh.Serve)

	// 管理端
	ag := api.Group("/admin", middleware.Auth(cfg.Secret), middleware.AdminOnly())
	{
		ad := &AdminHandler{Site: site}
		ag.GET("/dashboard", ad.Dashboard)

		// 系统资源监控（受「系统监控」功能门控）
		ag.GET("/system", middleware.AppGate("system_monitor"), ad.SystemInfo)

		ag.GET("/users", ad.UserList)
		ag.POST("/users", ad.UserCreate)
		ag.PUT("/users/:id", ad.UserUpdate)
		ag.PUT("/users/:id/password", ad.UserResetPassword)
		ag.DELETE("/users/:id", ad.UserDelete)

		ag.GET("/groups", ad.GroupList)
		ag.POST("/groups", ad.GroupSave)
		ag.PUT("/groups/:id", ad.GroupSave)
		ag.DELETE("/groups/:id", ad.GroupDelete)

		ag.GET("/policies", ad.PolicyList)
		ag.POST("/policies", ad.PolicyCreate)
		ag.PUT("/policies/:id", ad.PolicyUpdate)
		ag.PUT("/policies/:id/status", ad.PolicyToggle)
		ag.DELETE("/policies/:id", ad.PolicyDelete)

		ag.GET("/settings", ad.SettingsGet)
		ag.PUT("/settings", ad.SettingsSet)
		ag.GET("/logs", ad.LogList)
		ag.GET("/logs/export", ad.LogExport)
		ag.GET("/notifications", ad.NotificationList)
		ag.GET("/tasks", ad.TaskList)
		ag.GET("/shares", ad.ShareAudit)
		ag.DELETE("/shares/:id", ad.ShareDelete)

		ag.POST("/apps/:key/toggle", ad.AppToggle)
	}
}
