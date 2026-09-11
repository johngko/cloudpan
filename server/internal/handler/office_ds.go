package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// ---- 多 Document Server（健康检查 + 按优先级故障切换）----
//
// 站点设置 onlyoffice_dses = JSON 数组：
//   [{"name":"DS-1","url":"http://10.0.0.1:8080","jwt":"secret","priority":1}, ...]
//
// 列表非空时优先于单 DS 设置（onlyoffice_url/onlyoffice_jwt，作为兼容回退）。
// 后台每 60s 探测各 DS 的 /healthcheck；编辑器配置取「健康且优先级最高」的 DS，
// 全部不健康时回退第一个（尽力而为，编辑器侧会显示连接错误）。
// DS 保存回调（saveCallbackBody）放行所有已配置 DS 主机；CSP 放行所有 DS origin。

// OfficeDS 单个 Document Server 配置
type OfficeDS struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	JWT      string `json:"jwt"`
	Priority int    `json:"priority"` // 越小越优先；同优先级按数组顺序
}

var dsHealth = struct {
	sync.Mutex
	Healthy   map[string]bool
	LatencyMs map[string]int
	LastCheck int64
}{Healthy: map[string]bool{}, LatencyMs: map[string]int{}}

func dsMark(url, key string, healthy bool, ms int) {
	dsHealth.Lock()
	dsHealth.Healthy[key] = healthy
	dsHealth.LatencyMs[key] = ms
	dsHealth.LastCheck = time.Now().Unix()
	dsHealth.Unlock()
}

// dsList 当前生效的 DS 列表（onlyoffice_dses 优先，回退单 DS 设置）
func dsList() []OfficeDS {
	s := GetSiteSettings()
	raw := strings.TrimSpace(s["onlyoffice_dses"])
	if raw != "" && raw != "[]" {
		var list []OfficeDS
		if err := json.Unmarshal([]byte(raw), &list); err == nil {
			out := make([]OfficeDS, 0, len(list))
			for i, d := range list {
				d.URL = strings.TrimRight(strings.TrimSpace(d.URL), "/")
				if d.URL == "" {
					continue
				}
				if d.Name == "" {
					d.Name = "DS-" + strconv.Itoa(i+1)
				}
				out = append(out, d)
			}
			if len(out) > 0 {
				sort.SliceStable(out, func(i, j int) bool { return out[i].Priority < out[j].Priority })
				return out
			}
		}
	}
	if u := strings.TrimSpace(s["onlyoffice_url"]); u != "" {
		return []OfficeDS{{Name: "default", URL: strings.TrimRight(u, "/"), JWT: s["onlyoffice_jwt"], Priority: 0}}
	}
	return nil
}

// activeDS 选当前应使用的 DS：健康者优先（priority 已排序），全不健康回退第一个；无配置返回 nil
func activeDS() *OfficeDS {
	list := dsList()
	if len(list) == 0 {
		return nil
	}
	dsHealth.Lock()
	healthy := dsHealth.Healthy
	dsHealth.Unlock()
	for i := range list {
		if healthy[keyOf(list[i])] {
			return &list[i]
		}
	}
	return &list[0]
}

func keyOf(d OfficeDS) string { return d.Name + "|" + d.URL }

func dsOriginOf(u string) string {
	pu, err := url.Parse(u)
	if err != nil || pu.Host == "" || (pu.Scheme != "http" && pu.Scheme != "https") {
		return ""
	}
	return pu.Scheme + "://" + pu.Host
}

// dsOrigins 全部已配置 DS 的 origin（CSP 放行用）
func dsOrigins() []string {
	out := []string{}
	for _, d := range dsList() {
		if o := dsOriginOf(d.URL); o != "" {
			out = append(out, o)
		}
	}
	return out
}

// dsHosts 全部已配置 DS 的 host（回调 SSRF 放行用）
func dsHosts() []string {
	out := []string{}
	for _, d := range dsList() {
		pu, err := url.Parse(d.URL)
		if err == nil && pu.Host != "" {
			out = append(out, pu.Host)
		}
	}
	return out
}

// probeDS 单次健康探测（/healthcheck），返回 是否健康 + 延迟 ms
func probeDS(dsURL string) (bool, int, string) {
	start := time.Now()
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(dsURL + "/healthcheck")
	ms := int(time.Since(start).Milliseconds())
	if err != nil {
		return false, ms, "连接失败：" + err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != 200 {
		return false, ms, "HTTP " + strconv.Itoa(resp.StatusCode)
	}
	_ = body
	return true, ms, "OK"
}

// StartDSHealthChecker 后台 60s 健康检查（main 启动时调用一次）
func StartDSHealthChecker() {
	go func() {
		tick := func() {
			for _, d := range dsList() {
				ok, ms, _ := probeDS(d.URL)
				dsMark(d.URL, keyOf(d), ok, ms)
			}
		}
		tick()
		for range time.Tick(60 * time.Second) {
			tick()
		}
	}()
}

// DSEndpoint 管理员：DS 列表 + 健康状态 + 当前生效
func (h *OfficeHandler) DSEndpoint(c *gin.Context) {
	list := dsList()
	dsHealth.Lock()
	healthy := map[string]bool{}
	lat := map[string]int{}
	last := dsHealth.LastCheck
	for k, v := range dsHealth.Healthy {
		healthy[k] = v
	}
	for k, v := range dsHealth.LatencyMs {
		lat[k] = v
	}
	dsHealth.Unlock()
	type dsOut struct {
		OfficeDS
		Healthy  bool   `json:"healthy"`
		Latency  int    `json:"latencyMs"`
		Active   bool   `json:"active"`
		Origin   string `json:"origin"`
	}
	act := activeDS()
	out := make([]dsOut, 0, len(list))
	for _, d := range list {
		out = append(out, dsOut{OfficeDS: d, Healthy: healthy[keyOf(d)], Latency: lat[keyOf(d)],
			Active: act != nil && act.URL == d.URL && act.Name == d.Name, Origin: dsOriginOf(d.URL)})
	}
	dto.OK(c, gin.H{"list": out, "lastCheck": last, "active": act})
}

// DSSave 管理员：保存 DS 列表（JSON 数组）；保存后立即全量探测一次
func (h *OfficeHandler) DSSave(c *gin.Context) {
	var list []OfficeDS
	if err := c.ShouldBindJSON(&list); err != nil {
		dto.Fail(c, 400, "参数错误（需 JSON 数组）")
		return
	}
	for i := range list {
		u := strings.TrimRight(strings.TrimSpace(list[i].URL), "/")
		if u == "" {
			dto.Fail(c, 400, "第 "+strconv.Itoa(i+1)+" 项缺少地址")
			return
		}
		pu, err := url.Parse(u)
		if err != nil || pu.Host == "" || (pu.Scheme != "http" && pu.Scheme != "https") {
			dto.Fail(c, 400, "第 "+strconv.Itoa(i+1)+" 项地址非法（需 http/https）")
			return
		}
		if list[i].Name == "" {
			list[i].Name = "DS-" + strconv.Itoa(i+1)
		}
		list[i].URL = u
	}
	b, _ := json.Marshal(list)
	model.DB.Save(&model.SiteSetting{Key: "onlyoffice_dses", Value: string(b)})
	middleware.Audit(c, "office-ds", "保存 Document Server 列表（"+strconv.Itoa(len(list))+" 台）")
	// 立即探测一次，管理页状态即时可见
	for _, d := range dsList() {
		ok, ms, _ := probeDS(d.URL)
		dsMark(d.URL, keyOf(d), ok, ms)
	}
	dto.OK(c, gin.H{"saved": len(list)})
}
