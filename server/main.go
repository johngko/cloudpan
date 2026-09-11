package main

import (
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

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
	handler.StartDSHealthChecker() // 多 Document Server 健康检查（60s，故障切换数据源）
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	// ClientIP 信任边界：默认不信任任何 X-Forwarded-For（直接取 TCP 对端地址），
	// 防止攻击者伪造 XFF 头绕过登录限速/锁定等按 IP 的防护。
	// 部署在反向代理之后时，用环境变量 CP_TRUSTED_PROXIES 显式声明代理网段（逗号分隔 CIDR/IP），
	// 此时 gin 才从 XFF 链中取真实客户端 IP。
	if tp := strings.TrimSpace(os.Getenv("CP_TRUSTED_PROXIES")); tp != "" {
		var proxies []string
		for _, s := range strings.Split(tp, ",") {
			if s = strings.TrimSpace(s); s != "" {
				proxies = append(proxies, s)
			}
		}
		if len(proxies) > 0 {
			if err := r.SetTrustedProxies(proxies); err != nil {
				log.Printf("CP_TRUSTED_PROXIES 配置无效，回退为不信任任何代理: %v", err)
			}
		}
	} else {
		// 显式置空 = 不信任任何代理
		_ = r.SetTrustedProxies(nil)
	}
	// 访问日志打码敏感查询参数：t=JWT、token=直链签名、st=分享提取码、pt=浏览器代理票据
	r.Use(middleware.AccessLogger("t", "token", "st", "pt"), gin.Recovery(), middleware.SecurityHeaders())
	r.MaxMultipartMemory = 64 << 20

	site := &handler.SiteHandler{Cfg: cfg, Fs: fsService(cfg), ZipTmp: cfg.Sub("ziptmp")}
	handler.InitTaskPool(site.Fs, cfg.Sub("bt_tmp"))
	handler.Setup(r, cfg, site)
	handler.RegisterDav(r, site.Fs)
	web.Register(r)

	// 显式监听器（而非 r.Run）：系统更新自重启（syscall.Exec）继承 FD 表，
	// 若不先释放端口，新进程绑定同端口会 EADDRINUSE；update 流程持有引用以便关闭
	ln, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		log.Fatalf("监听 :%s 失败: %v", cfg.Port, err)
	}
	handler.SetUpdateListener(ln)
	log.Printf("CloudPan 启动: http://localhost:%s  数据目录: %s", cfg.Port, cfg.DataDir)
	if err := (&http.Server{Handler: r}).Serve(ln); err != nil {
		if errors.Is(err, net.ErrClosed) {
			// 系统更新自重启：更新流程 exec 前会关闭监听器，此时主流程退出，
			// 睡一段时间给 exec 留出接管时间（exec 成功后本进程已不存在，睡眠无副作用）
			log.Printf("监听器已关闭（系统更新自重启中），等待 exec 接管…")
			time.Sleep(10 * time.Second)
			return
		}
		log.Fatalf("启动失败: %v", err)
	}
}
