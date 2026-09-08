package handler

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ---- 离线下载 SSRF 防护 ----
// 代下载功能会按用户给的 URL 发起服务器端请求，必须阻止其被用来探测/访问
// 内网、云元数据服务（169.254.169.254）、本机服务等（经典 SSRF）。
// 三层防线：
//  1. 建任务时校验（validateFetchURL）：协议 + IP 字面量；
//  2. 重定向逐一复检（ssrfCheckRedirect）：公网 URL 302 回内网地址的绕过；
//  3. 拨号层复检（ssrfClient 的 DialContext）：DNS 解析后的真实 IP，
//     防 DNS rebinding（建任务时解析为公网、连接时解析为私网的域名）。

// ssrfBlocked 判断地址是否属于必须拒绝的范围（私网/回环/链路本地/保留/组播等）
func ssrfBlocked(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip4 := ip.To4(); ip4 != nil {
		ranges := []struct {
			network net.IP
			mask    net.IPMask
		}{
			{net.IPv4(0, 0, 0, 0), net.IPMask{255, 0, 0, 0}},       // 本网络
			{net.IPv4(10, 0, 0, 0), net.IPMask{255, 0, 0, 0}},      // 私有 A
			{net.IPv4(100, 64, 0, 0), net.IPMask{255, 192, 0, 0}},  // CGNAT
			{net.IPv4(127, 0, 0, 0), net.IPMask{255, 0, 0, 0}},    // 回环
			{net.IPv4(169, 254, 0, 0), net.IPMask{255, 255, 0, 0}}, // 链路本地（含云元数据）
			{net.IPv4(172, 16, 0, 0), net.IPMask{255, 240, 0, 0}},  // 私有 B
			{net.IPv4(192, 168, 0, 0), net.IPMask{255, 255, 0, 0}}, // 私有 C
			{net.IPv4(224, 0, 0, 0), net.IPMask{224, 0, 0, 0}},     // 组播 + 保留
		}
		for _, r := range ranges {
			if ip4.Mask(r.mask).Equal(r.network) {
				return true
			}
		}
		return false
	}
	switch {
	case ip.IsUnspecified(), ip.IsLoopback(), ip.IsLinkLocalUnicast(), ip.IsLinkLocalMulticast(), ip.IsMulticast():
		return true
	case ip[0]&0xfe == 0xfc: // fc00::/7 unique local
		return true
	}
	return false
}

// validateFetchURL 建任务时的目标校验：仅 http/https，IP 字面量不得落在受拒范围
func validateFetchURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("URL 非法")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("仅支持 http/https 链接")
	}
	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("URL 缺少主机")
	}
	if ip := net.ParseIP(host); ip != nil && ssrfBlocked(ip) {
		return fmt.Errorf("该地址属于内网/保留网段，不能用于离线下载")
	}
	return nil
}

// ssrfCheckRedirect 每次重定向都复检目标（含重定向次数上限）
func ssrfCheckRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return fmt.Errorf("重定向次数过多")
	}
	u := req.URL
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("重定向到不支持的协议")
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && ssrfBlocked(ip) {
		return fmt.Errorf("重定向目标属于内网/保留网段")
	}
	return nil
}

// ssrfClient 代下载专用 HTTP 客户端：
// - 禁用环境变量代理（避免 HTTP_PROXY 把请求劫持到不可控目标）；
// - DialContext 里先解析域名、任一解析结果落在受拒范围即整体拒绝（严格策略，
//   且实际拨号的就是被校验过的 IP），再逐 IP 拨号。
var ssrfHTTP = &http.Client{
	CheckRedirect: ssrfCheckRedirect,
	Transport: &http.Transport{
		Proxy:                 nil,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		IdleConnTimeout:       60 * time.Second,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			// IP 字面量直接校验
			if ip := net.ParseIP(host); ip != nil {
				if ssrfBlocked(ip) {
					return nil, fmt.Errorf("目标地址属于内网/保留网段，已拒绝")
				}
				d := &net.Dialer{Timeout: 30 * time.Second}
				return d.DialContext(ctx, network, addr)
			}
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, err
			}
			d := &net.Dialer{Timeout: 30 * time.Second}
			var lastErr error
			for _, ipa := range ips {
				if ssrfBlocked(ipa.IP) {
					// 严格策略：只要有一个解析结果指向内网即整体拒绝（防 DNS rebinding）
					return nil, fmt.Errorf("域名 %s 解析到内网/保留地址，已拒绝", host)
				}
				conn, derr := d.DialContext(ctx, network, net.JoinHostPort(ipa.IP.String(), port))
				if derr == nil {
					return conn, nil
				}
				lastErr = derr
			}
			if lastErr == nil {
				lastErr = fmt.Errorf("域名无法解析: %s", host)
			}
			return nil, lastErr
		},
	},
}
