package handler

import (
	"runtime"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"

	"cloudpan/internal/dto"
)

// 系统监控（应用中心 key: system_monitor）：
// 后台采样器每 2 秒刷新一次 CPU/内存/磁盘/网络/运行时长快照，
// GET /api/admin/system 直接返回最近快照（非阻塞，仪表盘 3s 轮询无压力）。

type sysDisk struct {
	Mount  string  `json:"mount"`
	Fstype string  `json:"fstype"`
	Total  uint64  `json:"total"`
	Used   uint64  `json:"used"`
	Free   uint64  `json:"free"`
	Pct    float64 `json:"pct"`
}

type sysNet struct {
	Name    string `json:"name"`
	RxRate  uint64 `json:"rxRate"`  // 字节/秒
	TxRate  uint64 `json:"txRate"`  // 字节/秒
	RxTotal uint64 `json:"rxTotal"`
	TxTotal uint64 `json:"txTotal"`
}

type sysSnapshot struct {
	At        int64     `json:"at"`
	Hostname  string    `json:"hostname"`
	OS        string    `json:"os"`
	Platform  string    `json:"platform"`
	Kernel    string    `json:"kernel"`
	Uptime    int64     `json:"uptime"` // 秒
	GoVersion string    `json:"goVersion"`
	CPU       []float64 `json:"perCore"`
	CPUPct    float64   `json:"cpuPct"`
	Cores     int       `json:"cores"`
	Model     string    `json:"model"`
	MemTotal  uint64    `json:"memTotal"`
	MemUsed   uint64    `json:"memUsed"`
	MemPct    float64   `json:"memPct"`
	SwapTotal uint64    `json:"swapTotal"`
	SwapUsed  uint64    `json:"swapUsed"`
	Disks     []sysDisk `json:"disks"`
	Nets      []sysNet  `json:"nets"`
}

var (
	sysMu      sync.RWMutex
	sysLatest  *sysSnapshot
	sysLastNet map[string]netSample
	sysSampler sync.Once
)

type netSample struct {
	rx, tx uint64
	at     time.Time
}

// StartSystemMonitor 在 main 启动时调用：预热 CPU 计数器并启动后台采样
func StartSystemMonitor() { startSystemSampler() }

func startSystemSampler() {
	sysSampler.Do(func() {
		// 预热 CPU 计数器，使第一次 cpu.Percent(0) 有基准
		_, _ = cpu.Percent(300*time.Millisecond, false)
		sysLastNet = map[string]netSample{}
		go systemSamplerLoop()
	})
}

func systemSamplerLoop() {
	last := time.Now()
	for {
		time.Sleep(2 * time.Second)
		now := time.Now()
		dt := now.Sub(last).Seconds()
		if dt <= 0 {
			dt = 2
		}
		last = now
		snap, err := takeSystemSnapshot(dt)
		if err != nil {
			continue
		}
		sysMu.Lock()
		sysLatest = snap
		sysMu.Unlock()
	}
}

func takeSystemSnapshot(dt float64) (*sysSnapshot, error) {
	s := &sysSnapshot{At: time.Now().Unix(), GoVersion: runtime.Version(), CPU: []float64{}, Disks: []sysDisk{}, Nets: []sysNet{}}

	if per, err := cpu.Percent(0, true); err == nil {
		s.CPU = per
		var sum float64
		for _, p := range per {
			sum += p
		}
		if len(per) > 0 {
			s.CPUPct = round1(sum / float64(len(per)))
		}
	} else {
		if p, err := cpu.Percent(0, false); err == nil && len(p) > 0 {
			s.CPUPct = round1(p[0])
		}
	}
	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		s.Model = infos[0].ModelName
	}
	if c, err := cpu.Counts(true); err == nil {
		s.Cores = c
	}

	if v, err := mem.VirtualMemory(); err == nil {
		s.MemTotal = v.Total
		s.MemUsed = v.Used
		s.MemPct = round1(v.UsedPercent)
	}
	if sw, err := mem.SwapMemory(); err == nil {
		s.SwapTotal = sw.Total
		s.SwapUsed = sw.Used
	}

	if u, err := host.Uptime(); err == nil {
		s.Uptime = int64(u)
	}
	if hi, err := host.Info(); err == nil {
		s.Hostname = hi.Hostname
		s.OS = hi.OS
		s.Platform = hi.Platform
		s.Kernel = hi.KernelVersion
	}

	// 磁盘：去重（Windows 上同一盘可能出现 \\.\C: 与 C: 两条）
	seen := map[string]bool{}
	if parts, err := disk.Partitions(true); err == nil {
		for _, p := range parts {
			if p.Mountpoint == "" || seen[p.Mountpoint] {
				continue
			}
			seen[p.Mountpoint] = true
			u, err := disk.Usage(p.Mountpoint)
			if err != nil || u.Total == 0 {
				continue
			}
			s.Disks = append(s.Disks, sysDisk{
				Mount:  p.Mountpoint,
				Fstype: p.Fstype,
				Total:  u.Total,
				Used:   u.Used,
				Free:   u.Free,
				Pct:    round1(u.UsedPercent),
			})
		}
	}
	sort.Slice(s.Disks, func(i, j int) bool { return s.Disks[i].Mount < s.Disks[j].Mount })

	// 网络：按接口算速率，只保留有过流量的接口
	if counters, err := gnet.IOCounters(true); err == nil {
		now := time.Now()
		for _, c := range counters {
			if c.Name == "lo" || c.Name == "Loopback Pseudo-Interface 1" {
				continue
			}
			n := sysNet{Name: c.Name, RxTotal: c.BytesSent, TxTotal: c.BytesRecv}
			if prev, ok := sysLastNet[c.Name]; ok {
				d := now.Sub(prev.at).Seconds()
				if d > 0 {
					if c.BytesSent >= prev.rx {
						n.RxRate = uint64(float64(c.BytesSent-prev.rx) / d)
					}
					if c.BytesRecv >= prev.tx {
						n.TxRate = uint64(float64(c.BytesRecv-prev.tx) / d)
					}
				}
			}
			sysLastNet[c.Name] = netSample{rx: c.BytesSent, tx: c.BytesRecv, at: now}
			if c.BytesSent+c.BytesRecv > 0 {
				s.Nets = append(s.Nets, n)
			}
		}
	}
	sort.Slice(s.Nets, func(i, j int) bool { return s.Nets[i].Name < s.Nets[j].Name })

	return s, nil
}

// SystemInfo 系统资源快照（管理端，受 system_monitor 功能门控）
func (h *AdminHandler) SystemInfo(c *gin.Context) {
	startSystemSampler()
	sysMu.RLock()
	s := sysLatest
	sysMu.RUnlock()
	if s == nil {
		dto.Fail(c, 503, "系统采样初始化中，请稍候重试")
		return
	}
	dto.OK(c, s)
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}
