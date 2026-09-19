package handler

import (
	"strings"
	"testing"
)

// 敏感设置密封/解密往返 + 历史明文透传 + 前缀幂等
func TestSecretSealRoundTrip(t *testing.T) {
	NewTerminalHandler([]byte("0123456789abcdef0123456789abcdef")) // 32 字节测试密钥
	plain := "S3cret!授权码"
	sealed := sealSecret(plain)
	if !strings.HasPrefix(sealed, secretEncPrefix) {
		t.Fatalf("密文应带前缀: %q", sealed)
	}
	if sealed == plain {
		t.Fatal("密文不应等于明文")
	}
	if got := openSecret(sealed); got != plain {
		t.Fatalf("往返失配: %q", got)
	}
	// 幂等：密文再密封应原样透传
	if again := sealSecret(sealed); again != sealed {
		t.Fatalf("重复密封应幂等: %q", again)
	}
	// 历史明文（无前缀）open 原样返回
	if got := openSecret("legacy-plain"); got != "legacy-plain" {
		t.Fatalf("历史明文应原样返回: %q", got)
	}
	// 空串
	if sealSecret("") != "" || openSecret("") != "" {
		t.Fatal("空串应原样处理")
	}
	// 坏密文 → 空串（不外发坏值）
	if got := openSecret(secretEncPrefix + "not-base64!!"); got != "" {
		t.Fatalf("坏密文应返回空串: %q", got)
	}
}
