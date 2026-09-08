package main

import (
	"log"

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
	// 注册全部存储驱动
	fscore.RegisterDriver("local", func(p *model.Policy) (fscore.Driver, error) {
		return fscore.NewLocal(p.RootPath)
	})
	fscore.RegisterDriver("pan123", driver.NewPan123)
	fscore.RegisterDriver("aliyun", driver.NewAliyun)
	fscore.RegisterDriver("baidu", driver.NewBaidu)
	fscore.RegisterDriver("tianyi", driver.NewTianyi)
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
