package config

import (
	"crypto/rand"
	"os"
	"path/filepath"
)

type Config struct {
	Port      string
	DataDir   string // 绝对路径：数据库、回收站、上传临时区
	Secret    []byte // JWT/签名共用密钥（持久化在 DataDir/secret.key）
	PublicURL string // 对外可访问地址（ONLYOFFICE 拉取文件/回调用）
}

func Load() *Config {
	c := &Config{Port: "8322"}
	if p := os.Getenv("CP_PORT"); p != "" {
		c.Port = p
	}
	dataDir := os.Getenv("CP_DATA")
	if dataDir == "" {
		dataDir = "./data"
	}
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		abs = dataDir
	}
	c.DataDir = abs
	_ = os.MkdirAll(c.DataDir, 0o755)

	if u := os.Getenv("CP_PUBLIC_URL"); u != "" {
		c.PublicURL = u
	} else {
		c.PublicURL = "http://localhost:" + c.Port
	}

	keyPath := filepath.Join(c.DataDir, "secret.key")
	if b, err := os.ReadFile(keyPath); err == nil && len(b) >= 32 {
		c.Secret = b
	} else {
		buf := make([]byte, 32)
		_, _ = rand.Read(buf)
		_ = os.WriteFile(keyPath, buf, 0o600)
		c.Secret = buf
	}
	return c
}

func (c *Config) Sub(name string) string {
	p := filepath.Join(c.DataDir, name)
	_ = os.MkdirAll(p, 0o755)
	return p
}
