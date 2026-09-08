package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func urlEscape(s string) string { return url.PathEscape(s) }

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func genID16() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func tempZipName() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return filepath.Join(os.TempDir(), "cloudpan_"+hex.EncodeToString(b)+".zip")
}

func osRemove(p string) { _ = os.Remove(p) }

func jsonMarshal(v interface{}) ([]byte, error) {
	b, err := json.Marshal(v)
	return b, err
}

func nowUnix() int64 { return time.Now().Unix() }

func bcryptCompare(hash, pwd string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pwd))
}

func httpServe(c *gin.Context, name string, mod time.Time, rc io.ReadSeeker) {
	http.ServeContent(c.Writer, c.Request, name, mod, rc)
}

func lastIndexByte(s string, b byte) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == b {
			return i
		}
	}
	return -1
}

func endsWith(s, suffix string) bool { return strings.HasSuffix(s, suffix) }

var _ = time.Now
