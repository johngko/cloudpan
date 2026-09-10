//go:build windows

package handler

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// conptyVerifyTimeout 校验超时：伪控制台生效时，shell 启动后数秒内必然输出欢迎横幅；
// 超时仍无任何输出，判定该 Windows 环境下 ConPTY 未生效（进程挂到了真实控制台），回退管道
const conptyVerifyTimeout = 4 * time.Second

// conptyBroken 本机 ConPTY 校验失败过一次后永久置位：之后直接走管道回退，
// 避免每次连接白等 4 秒校验、子进程横幅漏到服务器控制台
var conptyBroken atomic.Bool

// startLocalShell Windows 实现：优先 ConPTY（CreatePseudoConsole，完整终端体验）；
// 启动或校验失败时自动回退为普通管道 + 服务端回显，保证任何 Windows 环境终端可用。
func startLocalShell(cmd *exec.Cmd) (*localShell, error) {
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}
	cmd.Env = append(cmd.Environ(), "TERM=xterm-256color", "ANSICON=140-0")
	if !conptyBroken.Load() {
		if ls, err := startConptyShell(cmd); err == nil {
			return ls, nil
		}
		conptyBroken.Store(true)
	}
	return startPipeShell(cmd)
}

func startConptyShell(cmd *exec.Cmd) (*localShell, error) {
	// 两条管道：输入（父进程写 inW → PC 读 inR）、输出（PC 写 outW → 父进程读 outR）
	var inR, inW, outR, outW windows.Handle
	if err := windows.CreatePipe(&inR, &inW, nil, 0); err != nil {
		return nil, err
	}
	var hPC windows.Handle
	var al *windows.ProcThreadAttributeListContainer
	var pi *windows.ProcessInformation
	var readF, writeF *os.File

	// inR/outW 在 CreatePseudoConsole 成功后即由父进程关闭（PC 持有自己的引用）；
	// 校验失败路径（尚未关闭时）仍需在 cleanup 里关掉，用 != 0 判空
	cleanup := func() {
		if readF != nil {
			_ = readF.Close()
			readF = nil
		}
		if writeF != nil {
			_ = writeF.Close()
			writeF = nil
		}
		if al != nil {
			al.Delete()
			al = nil
		}
		if hPC != 0 {
			windows.ClosePseudoConsole(hPC)
			hPC = 0
		}
		if pi != nil {
			windows.CloseHandle(pi.Process)
			windows.CloseHandle(pi.Thread)
			pi = nil
		}
		if outW != 0 {
			_ = windows.CloseHandle(outW)
			outW = 0
		}
		if inR != 0 {
			_ = windows.CloseHandle(inR)
			inR = 0
		}
	}

	if err := windows.CreatePipe(&outR, &outW, nil, 0); err != nil {
		cleanup()
		return nil, err
	}
	if err := windows.CreatePseudoConsole(windows.Coord{X: 120, Y: 32}, inR, outW, 0, &hPC); err != nil {
		cleanup()
		return nil, err
	}
	// 父进程立即关闭已交给伪控制台的两个管端（PC 内部持有自己的句柄引用，
	// 与 Windows Terminal conpty.c 同款做法）：否则子进程退出后父进程仍握着
	// 输出管写端，outR 永远收不到 EOF，输出 goroutine 挂死 → WS 处理器不返回 → 槽位泄漏
	_ = windows.CloseHandle(inR)
	_ = windows.CloseHandle(outW)
	inR, outW = 0, 0
	al, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		cleanup()
		return nil, err
	}
	if err := al.Update(windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, unsafe.Pointer(&hPC), unsafe.Sizeof(hPC)); err != nil {
		cleanup()
		return nil, err
	}

	var siex windows.StartupInfoEx
	siex.Cb = uint32(unsafe.Sizeof(siex))
	siex.Flags = windows.EXTENDED_STARTUPINFO_PRESENT
	siex.ProcThreadAttributeList = al.List()

	cmdLine, err := windows.UTF16PtrFromString(cmd.Path)
	if err != nil {
		cleanup()
		return nil, err
	}
	var cwd *uint16
	if cmd.Dir != "" {
		if cwd, err = windows.UTF16PtrFromString(cmd.Dir); err != nil {
			cleanup()
			return nil, err
		}
	}
	// 不设 STARTF_USESTDHANDLES：带 PSEUDOCONSOLE 属性的控制台进程 std 自动经由伪控制台
	pi = &windows.ProcessInformation{}
	if err := windows.CreateProcess(nil, cmdLine, nil, nil, false, 0, nil, cwd, &siex.StartupInfo, pi); err != nil {
		cleanup()
		return nil, err
	}
	readF = os.NewFile(uintptr(outR), "conpty-out")
	writeF = os.NewFile(uintptr(inW), "conpty-in")

	// 校验伪控制台是否真正接管了子进程输出（阻塞读 + 超时，不依赖 netpoller）
	type peek struct {
		data []byte
		err  error
	}
	ch := make(chan peek, 1)
	go func() {
		buf := make([]byte, 32*1024)
		n, rerr := readF.Read(buf)
		ch <- peek{buf[:n], rerr}
	}()
	var pending bytes.Buffer
	var ok bool
	select {
	case p := <-ch:
		ok = p.err == nil && len(p.data) > 0
		if ok {
			_, _ = pending.Write(p.data)
		}
	case <-time.After(conptyVerifyTimeout):
	}
	if !ok {
		windows.TerminateProcess(pi.Process, 1)
		cleanup()
		return nil, fmt.Errorf("伪控制台未产生输出（ConPTY 不可用）")
	}

	var mu sync.Mutex
	return &localShell{
		read: func(p []byte) (int, error) {
			mu.Lock()
			defer mu.Unlock()
			if pending.Len() > 0 {
				n, _ := pending.Read(p)
				return n, nil
			}
			return readF.Read(p)
		},
		write: func(p []byte) (int, error) {
			mu.Lock()
			defer mu.Unlock()
			return writeF.Write(p)
		},
		resize: func(cols, rows uint16) {
			_ = windows.ResizePseudoConsole(hPC, windows.Coord{X: int16(cols), Y: int16(rows)})
		},
		kill: func() {
			windows.TerminateProcess(pi.Process, 1)
		},
		wait: func() int {
			windows.WaitForSingleObject(pi.Process, windows.INFINITE)
			var code uint32
			_ = windows.GetExitCodeProcess(pi.Process, &code)
			return int(code)
		},
		close: cleanup,
	}, nil
}

// startPipeShell 回退实现：普通管道承载 shell。
// 方向：子进程 stdin=输入管道读端、stdout=输出管道写端；父进程握有输入写端/输出读端。
// 回显：不做服务端回显——cmd/PowerShell 以管道读 stdin 时会自行回显整行（探针验证），
// 服务端再回显会造成重影；代价是按键在回车前不可见（无 PTY 的固有限制）。
func startPipeShell(cmd *exec.Cmd) (*localShell, error) {
	inR, inW, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	outR, outW, err := os.Pipe()
	if err != nil {
		inR.Close()
		inW.Close()
		return nil, err
	}
	cmd.Stdin = inR
	cmd.Stdout = outW
	cmd.Stderr = outW
	if err := cmd.Start(); err != nil {
		inR.Close()
		inW.Close()
		outR.Close()
		outW.Close()
		return nil, err
	}
	// 启动成功后父进程关闭子进程侧的管端副本（子进程持有自己继承的句柄）：
	// 尤其 outW 必须关——子进程退出后若父进程仍握着输出管写端，outR 读不到 EOF，
	// 输出 goroutine 永久阻塞，runLocal 卡死在 <-quit，终端槽位永远不释放
	inR.Close()
	outW.Close()
	return &localShell{
		read: outR.Read,
		write: func(p []byte) (int, error) {
			// 管道模式的 cmd/PowerShell 只认 \n 为行终止符（\r 会被永久滞留输入缓冲），
			// 而 xterm 回车发送 \r：统一转成 \n 再交给子进程
			if bytes.IndexByte(p, '\r') < 0 {
				return inW.Write(p)
			}
			b := make([]byte, 0, len(p))
			for i := 0; i < len(p); i++ {
				if p[i] == '\r' {
					if i+1 < len(p) && p[i+1] == '\n' {
						i++
					}
					b = append(b, '\n')
				} else {
					b = append(b, p[i])
				}
			}
			return inW.Write(b)
		},
		resize: func(cols, rows uint16) {}, // 管道无屏幕尺寸概念
		kill:   func() { _ = cmd.Process.Kill() },
		wait: func() int {
			code := 0
			if err := cmd.Wait(); err != nil {
				if ee, ok := err.(*exec.ExitError); ok {
					code = ee.ExitCode()
				} else {
					code = 1
				}
			}
			return code
		},
		// inR/outW 已在 Start 后关闭（见上）；这里只关父进程持有的 inW/outR
		close: func() {
			inW.Close()
			outR.Close()
		},
	}, nil
}
