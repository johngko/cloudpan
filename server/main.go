package main

import (
	"log"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/config"
	"cloudpan/internal/driver"
	"cloudpan/internal/fscore"
	"cloudpan/internal/handler"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
	"cloudpan/internal/web"
)

func fsService(cfg *config.Config) *fscore.Service {
	// 注册全部存储驱动（工厂统一为 策略+用户 签名；云盘忽略用户）
	fscore.RegisterDriver("local", func(p *model.Policy, u *model.User) (fscore.Driver, error) {
		root := p.RootPath
		if dir := fscore.UserDirOf(u); dir != "" { // 多用户数据隔离：每用户独立子目录
			root = filepath.Join(root, dir)
		}
		return fscore.NewLocal(root)
	})
	fscore.RegisterDriver("pan123", func(p *model.Policy, _ *model.User) (fscore.Driver, error) { return driver.NewPan123(p) })
	fscore.RegisterDriver("aliyun", func(p *model.Policy, _ *model.User) (fscore.Driver, error) { return driver.NewAliyun(p) })
	fscore.RegisterDriver("baidu", func(p *model.Policy, _ *model.User) (fscore.Driver, error) { return driver.NewBaidu(p) })
	fscore.RegisterDriver("tianyi", func(p *model.Policy, _ *model.User) (fscore.Driver, error) { return driver.NewTianyi(p) })
	return fscore.NewService(cfg.Sub("upload_tmp"), cfg.Sub("recycle"), cfg.Sub("thumbs"), cfg.Sub("ziptmp"))
}

func main() {
	cfg := config.Load()
	model.InitDB(cfg.DataDir)
	model.LoadAppCache() // 应用中心：功能开关内存缓存
	handler.StartSystemMonitor() // NAS 系统监控采样器（仪表盘数据源）
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	// 访问日志打码敏感查询参数：t=JWT、token=直链签名、st=分享提取码、pt=浏览器代理票据
	r.Use(middleware.AccessLogger("t", "token", "st", "pt"), gin.Recovery(), middleware.SecurityHeaders())
	r.MaxMultipartMemory = 64 << 20

	site := &handler.SiteHandler{Cfg: cfg, Fs: fsService(cfg), ZipTmp: cfg.Sub("ziptmp")}
	handler.InitTaskPool(site.Fs, cfg.Sub("bt_tmp"))
	handler.Setup(r, cfg, site)
	handler.RegisterDav(r, site.Fs)
	web.Register(r)

	log.Printf("CloudPan 启动: http://localhost:%s  数据目录: %s", cfg.Port, cfg.DataDir)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("启动失败: %v", err)
	}
}
