package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
)

// localShell 平台无关的本地 shell 抽象（实现见 terminal_unix.go / terminal_windows.go）：
//   - Unix：creack/pty（openpty + setsid），完整 PTY 体验
//   - Windows：ConPTY（CreatePseudoConsole）；若伪控制台在该环境未生效
//     （输出始终走真实控制台），自动回退为普通管道（shell 自行回显整行）
type localShell struct {
	read   func([]byte) (int, error)
	write  func([]byte) (int, error)
	resize func(cols, rows uint16)
	kill   func()
	wait   func() int
	close  func()
}

func (s *localShell) killAndWait() int {
	s.kill()
	return s.wait()
}

// 终端功能：本地真实 shell（PTY/ConPTY）与远程 SSH 终端。
// 前端 xterm.js 与本端点之间：二进制帧 = 原始 PTY 字节双向透传，
// 文本帧 = JSON 控制消息（hello/resize/error/exit/closed）。

const (
	maxLocalPerUser = 4
	maxSSHPerUser   = 8
	maxTermTotal    = 32
)

var (
	termSlots   = make(map[string]int) // "local:uid" / "ssh:uid"
	termSlotsMu sync.Mutex
	termTotal   int
)

// termAcquire 槽位获取：超限返回 false（WS 端点回 429）。
// DENY 日志保留——429 对用户可见但对运维不透明，日志能直接指出撞的是全局限额还是用户限额
func termAcquire(kind string, uid uint) bool {
	termSlotsMu.Lock()
	defer termSlotsMu.Unlock()
	k := kind + ":" + strconv.FormatUint(uint64(uid), 10)
	limit := maxLocalPerUser
	if kind == "ssh" {
		limit = maxSSHPerUser
	}
	if termTotal >= maxTermTotal {
		log.Printf("[term] DENY total=%d slots=%v（全局限额 %d）", termTotal, termSlots, maxTermTotal)
		return false
	}
	if termSlots[k] >= limit {
		log.Printf("[term] DENY k=%s slots=%v（用户限额 %d）", k, termSlots, limit)
		return false
	}
	termSlots[k]++
	termTotal++
	return true
}

func termRelease(kind string, uid uint) {
	termSlotsMu.Lock()
	defer termSlotsMu.Unlock()
	k := kind + ":" + strconv.FormatUint(uint64(uid), 10)
	if termSlots[k] > 0 {
		termSlots[k]--
	}
	if termTotal > 0 {
		termTotal--
	}
}

// wsMsg 文本帧控制消息（各字段按 type 取用）
type wsMsg struct {
	Type  string `json:"type"`
	Mode  string `json:"mode,omitempty"`  // hello: local | ssh
	OS    string `json:"os,omitempty"`    // hello: 本地平台
	Shell string `json:"shell,omitempty"` // hello: 本地 shell
	Host  string `json:"host,omitempty"`  // hello: 远程主机
	User  string `json:"user,omitempty"`  // hello: 远程用户
	Cols  uint16 `json:"cols,omitempty"`  // resize
	Rows  uint16 `json:"rows,omitempty"`  // resize
	Msg   string `json:"msg,omitempty"`   // error / closed
	Code  int    `json:"code,omitempty"`  // exit / closed
}

var termUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 32768,
	CheckOrigin: func(r *http.Request) bool {
		o := r.Header.Get("Origin")
		if o == "" {
			return true // 非浏览器客户端（脚本/测试）
		}
		u, err := url.Parse(o)
		return err == nil && u.Host == r.Host
	},
}

// Platform GET /api/terminal/platform —— 本地平台与可用 shell 清单（前端选择器数据源）
func (h *TerminalHandler) Platform(c *gin.Context) {
	if runtime.GOOS == "windows" {
		dto.OK(c, gin.H{"os": "windows", "shells": []string{"cmd", "powershell"}, "defaultShell": "cmd"})
		return
	}
	candidates := []string{"/bin/bash", "/bin/sh", "/usr/bin/zsh", "/usr/bin/fish"}
	var list []string
	for _, s := range candidates {
		if _, err := os.Stat(s); err == nil {
			list = append(list, s)
		}
	}
	if len(list) == 0 {
		list = []string{"/bin/sh"}
	}
	def := ""
	if s := os.Getenv("SHELL"); s != "" {
		for _, l := range list {
			if l == s {
				def = s
				break
			}
		}
	}
	if def == "" {
		def = list[0]
	}
	dto.OK(c, gin.H{"os": runtime.GOOS, "shells": list, "defaultShell": def})
}

// WebSocket GET /api/terminal/ws?mode=local[&shell=] | mode=ssh&connId=
func (h *TerminalHandler) WebSocket(c *gin.Context) {
	x := ctxOf(c)
	mode := c.Query("mode")
	if mode != "local" && mode != "ssh" {
		dto.Fail(c, 400, "mode 必须为 local 或 ssh")
		return
	}
	// 安全边界（关键）：本地终端 = 项目服务器自身的 shell，仅管理员可用。
	// 普通用户/访客即使被授予「终端」功能权限，也只能用 SSH 远程终端连接自己的服务器，
	// 绝不允许拿到运行本项目的主机 shell（本服务以什么身份运行，本地终端就是什么身份）。
	if mode == "local" && (x.user == nil || x.user.Role != "admin") {
		dto.Fail(c, 403, "本地终端仅管理员可用")
		return
	}
	if !termAcquire(mode, x.user.ID) {
		dto.Fail(c, 429, "并发终端数已达上限，请关闭部分终端后重试")
		return
	}
	defer termRelease(mode, x.user.ID)

	ws, err := termUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer ws.Close()
	ws.SetReadLimit(1 << 20)

	// 单写者串行化：输出 goroutine、心跳、控制消息共用一把锁
	var wmu sync.Mutex
	write := func(mt int, data []byte) error {
		wmu.Lock()
		defer wmu.Unlock()
		ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
		return ws.WriteMessage(mt, data)
	}
	sendMsg := func(m wsMsg) {
		b, _ := json.Marshal(m)
		_ = write(websocket.TextMessage, b)
	}

	// 心跳：30s ping，90s 无 pong 判定死连接
	ws.SetReadDeadline(time.Now().Add(90 * time.Second))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})
	done := make(chan struct{})
	defer close(done)
	go func() {
		tk := time.NewTicker(30 * time.Second)
		defer tk.Stop()
		for {
			select {
			case <-tk.C:
				if err := write(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	if mode == "local" {
		h.runLocal(c, x, ws, write, sendMsg)
	} else {
		h.runSSH(c, x, ws, write, sendMsg)
	}
}

// localShells 本地 shell 白名单（不允许用户传入任意可执行文件）
func localShells() []string {
	if runtime.GOOS == "windows" {
		return []string{"cmd", "powershell"}
	}
	return []string{"/bin/bash", "/bin/sh", "/usr/bin/zsh", "/usr/bin/fish"}
}

func defaultLocalShell() string {
	if runtime.GOOS == "windows" {
		return "cmd"
	}
	if s := os.Getenv("SHELL"); s != "" {
		return s
	}
	return "/bin/bash"
}

func (h *TerminalHandler) runLocal(c *gin.Context, x ctx3, ws *websocket.Conn,
	write func(int, []byte) error, sendMsg func(wsMsg)) {

	shell := c.Query("shell")
	if shell == "" {
		shell = defaultLocalShell()
	}
	allowed := false
	for _, s := range localShells() {
		if s == shell {
			allowed = true
			break
		}
	}
	if !allowed {
		sendMsg(wsMsg{Type: "error", Msg: "不支持的 shell: " + shell})
		return
	}

	cmd := exec.Command(shell)
	ls, err := startLocalShell(cmd)
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "启动终端失败: " + err.Error()})
		return
	}
	defer ls.close()

	middleware.Audit(c, "terminal", "local "+shell)
	sendMsg(wsMsg{Type: "hello", Mode: "local", OS: runtime.GOOS, Shell: shell})

	// shell 输出 → 前端
	quit := make(chan struct{})
	go func() {
		defer close(quit)
		buf := make([]byte, 32*1024)
		for {
			n, rerr := ls.read(buf)
			if n > 0 {
				if werr := write(websocket.BinaryMessage, buf[:n]); werr != nil {
					return
				}
			}
			if rerr != nil {
				return
			}
		}
	}()

	// 前端 → shell（含 resize 控制帧）
	for {
		mt, data, rerr := ws.ReadMessage()
		if rerr != nil {
			break
		}
		if mt == websocket.TextMessage {
			var m wsMsg
			if json.Unmarshal(data, &m) == nil && m.Type == "resize" && m.Cols > 0 && m.Rows > 0 {
				ls.resize(m.Cols, m.Rows)
			}
			continue
		}
		if mt != websocket.BinaryMessage {
			continue
		}
		if _, werr := ls.write(data); werr != nil {
			break
		}
	}

	// 前端断开：杀进程，等 shell 退出
	code := ls.killAndWait()
	<-quit
	sendMsg(wsMsg{Type: "exit", Code: code})
}

func (h *TerminalHandler) runSSH(c *gin.Context, x ctx3, ws *websocket.Conn,
	write func(int, []byte) error, sendMsg func(wsMsg)) {

	id, err := strconv.ParseUint(c.Query("connId"), 10, 64)
	if err != nil || id == 0 {
		sendMsg(wsMsg{Type: "error", Msg: "缺少 connId"})
		return
	}
	cc, err := h.getSSHConn(x.user.ID, uint(id))
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "连接不存在"})
		return
	}

	// 独立连接（不进连接池）：会话生命周期 = WebSocket 生命周期
	client, err := sshDial(cc)
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "SSH 连接失败: " + err.Error()})
		return
	}
	defer client.Close()
	if cc.HostKey != "" {
		_ = h.updateSSHConn(x.user.ID, cc) // TOFU 主机密钥回写
	}

	sess, err := client.NewSession()
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "SSH 会话创建失败: " + err.Error()})
		return
	}
	defer sess.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:                 10,
		ssh.TTY_OP_ISPEED:        14400,
		ssh.TTY_OP_OSPEED:        14400,
	}
	if err := sess.RequestPty("xterm-256color", 32, 120, modes); err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "PTY 协商失败: " + err.Error()})
		return
	}
	stdin, err := sess.StdinPipe() // 前端按键 → 远程
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "会话管道失败: " + err.Error()})
		return
	}
	defer stdin.Close()
	stdout, err := sess.StdoutPipe() // 远程输出 → 前端
	if err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "会话管道失败: " + err.Error()})
		return
	}
	if err := sess.Shell(); err != nil {
		sendMsg(wsMsg{Type: "error", Msg: "启动远程 Shell 失败: " + err.Error()})
		return
	}

	middleware.Audit(c, "terminal", "ssh "+cc.Username+"@"+cc.Host+":"+strconv.Itoa(cc.Port))
	sendMsg(wsMsg{Type: "hello", Mode: "ssh", Host: cc.Host, User: cc.Username})

	// 远程输出 → 前端
	quit := make(chan struct{})
	go func() {
		defer close(quit)
		buf := make([]byte, 32*1024)
		for {
			n, rerr := stdout.Read(buf)
			if n > 0 {
				if werr := write(websocket.BinaryMessage, buf[:n]); werr != nil {
					return
				}
			}
			if rerr != nil {
				return
			}
		}
	}()

	// 前端 → 远程
	for {
		mt, data, rerr := ws.ReadMessage()
		if rerr != nil {
			break
		}
		if mt == websocket.TextMessage {
			var m wsMsg
			if json.Unmarshal(data, &m) == nil && m.Type == "resize" && m.Cols > 0 && m.Rows > 0 {
				_ = sess.WindowChange(int(m.Rows), int(m.Cols))
			}
			continue
		}
		if mt != websocket.BinaryMessage {
			continue
		}
		if _, werr := stdin.Write(data); werr != nil {
			break
		}
	}

	_ = sess.Close()
	code := 0
	if err := sess.Wait(); err != nil {
		code = 1
	}
	<-quit
	sendMsg(wsMsg{Type: "closed", Code: code, Msg: "远程连接已断开"})
}

// sshHostBlocked SSH 目标地址安全校验：允许内网/公网（SSH 本就要连内网服务器），
// 拒绝链路本地（含云元数据 169.254.169.254）、本网络、组播/保留段与 IPv6 环回/链路本地
var sshBlockedCIDRs = []string{
	"0.0.0.0/8",
	"169.254.0.0/16",
	"224.0.0.0/4",
	"::1/128",
	"fe80::/10",
	"ff00::/8",
}

func sshHostBlocked(ip net.IP) bool {
	for _, s := range sshBlockedCIDRs {
		_, cidr, err := net.ParseCIDR(s)
		if err == nil && cidr.Contains(ip) {
			return true
		}
	}
	return false
}

// sshDial 建立 SSH 客户端连接。
// 安全：目标域名解析后对全部 IP 复检（防 DNS rebinding）；
// 主机密钥 TOFU（首次连接记录、此后不一致即拒绝，密钥存于加密连接配置）。
func sshDial(cc *sshConnCfg) (*ssh.Client, error) {
	host := cc.Host
	var ips []net.IP
	if ip := net.ParseIP(host); ip != nil {
		ips = []net.IP{ip}
	} else {
		addrs, err := net.DefaultResolver.LookupIPAddr(context.Background(), host)
		if err != nil {
			return nil, errors.New("主机解析失败: " + err.Error())
		}
		for _, a := range addrs {
			ips = append(ips, a.IP)
		}
	}
	for _, ip := range ips {
		if sshHostBlocked(ip) {
			return nil, errors.New("目标地址被安全策略禁止（链路本地/元数据/保留段）")
		}
	}

	var auth []ssh.AuthMethod
	switch cc.AuthType {
	case "password":
		if cc.Password == "" {
			return nil, errors.New("缺少密码")
		}
		auth = []ssh.AuthMethod{ssh.Password(cc.Password)}
	case "key":
		sig, err := ssh.ParsePrivateKey([]byte(cc.PrivateKey))
		if err != nil {
			return nil, errors.New("私钥解析失败，请检查 PEM 内容")
		}
		auth = []ssh.AuthMethod{ssh.PublicKeys(sig)}
	default:
		return nil, errors.New("未知认证方式")
	}

	if cc.Port <= 0 {
		cc.Port = 22
	}
	cfg := &ssh.ClientConfig{
		User:    cc.Username,
		Auth:    auth,
		Timeout: 8 * time.Second,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			if cc.HostKey == "" {
				cc.HostKey = encodePublicKey(key)
				return nil // TOFU：首次信任
			}
			stored, err := decodePublicKey(cc.HostKey)
			if err != nil || !stringEqual(stored.Marshal(), key.Marshal()) {
				return errors.New("服务器主机密钥已变更（TOFU 拒绝）：删除该连接后重新添加")
			}
			return nil
		},
	}
	client, err := ssh.Dial("tcp", net.JoinHostPort(host, strconv.Itoa(cc.Port)), cfg)
	if err != nil {
		// 认证失败类错误不保留 TOFU 密钥（HostKeyCallback 未走到信任分支）
		return nil, err
	}
	_ = client
	return client, nil
}

func stringEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
