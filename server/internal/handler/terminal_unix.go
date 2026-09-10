//go:build !windows

package handler

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// startLocalShell Unix 实现：creack/pty（openpty + setsid），完整 PTY 体验。
func startLocalShell(cmd *exec.Cmd) (*localShell, error) {
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}
	cmd.Env = append(cmd.Environ(), "TERM=xterm-256color")
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 32, Cols: 120})
	if err != nil {
		return nil, err
	}
	return &localShell{
		read:   f.Read,
		write:  f.Write,
		resize: func(cols, rows uint16) { _ = pty.Setsize(f, &pty.Winsize{Rows: rows, Cols: cols}) },
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
		close: func() { _ = f.Close() },
	}, nil
}
