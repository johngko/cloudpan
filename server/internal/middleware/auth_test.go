package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// P1.1 防护：未经过 Auth（公开路由误用、中间件顺序错误）时，
// CurrentUser 必须返回 nil 而不是 panic，AdminOnly 必须 401 而不是 500 崩溃。

func TestCurrentUserNilSafe(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if u := CurrentUser(c); u != nil {
		t.Fatalf("无 user 上下文时 CurrentUser 应返回 nil，实际 %v", u)
	}
	// 上下文里放了非 *model.User 的值也不能 panic
	c.Set("user", "not-a-user")
	if u := CurrentUser(c); u != nil {
		t.Fatalf("类型不符时 CurrentUser 应返回 nil，实际 %v", u)
	}
}

func TestAdminOnlyWithoutUserReturns401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin", AdminOnly(), func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("未登录访问管理员接口应 401，实际 %d", w.Code)
	}
}

func TestAuditWithoutUserDoesNotPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	Audit(c, "noop", "detail") // 不应 panic（model.DB 保持 nil 也不会被触达）
}
