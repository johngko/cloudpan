package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// GuestReadOnly 游客共享账号身份级兜底：guest 账号是所有访客共用的系统托管身份
// （随机密码不可知、仅经 /auth/guest 登录、全体访客共用一个账号与存储目录），
// 因此对它的一切"修改自己状态"的操作都不成立：
//   - 改自己的密码/昵称/头像/WebDAV 密码 → 污染全体访客共用的账号身份
//   - 写用户设置 KV / 收藏 / 通知已读状态 → 访客 A 的数据会泄漏给访客 B
//   - 保存记事本 / 绑定云盘 → 共享目录里的内容全体访客可见
//
// 已有的应用门控（AppGate）与只读组（requireWritable）都是"功能级/盘级"防护，
// 这里补上"账号级"默认拒绝：游客令牌的一切非 GET 请求一律 403。
// 游客的合法操作（浏览/下载/预览/搜索/查看共享）全部是 GET，不受影响；
// 今后新增任何写端点也无需再逐个记得拦截游客。
//
// 唯一例外：被显式以 rw（可写）方式共享给访客的目录（/shared/:id/*）——
// 显式授权优先于共享账号的只读兜底，与原"只读组"语义一致。
var guestWriteAllow = map[string]bool{
	"/api/shared/:id/mkdir":  true,
	"/api/shared/:id/upload": true,
	"/api/shared/:id/delete": true,
}

func GuestReadOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && model.IsGuestUser(CurrentUser(c)) && !guestWriteAllow[c.FullPath()] {
			dto.Fail(c, 403, "游客为共享只读身份，不能执行该操作")
			c.Abort()
			return
		}
		c.Next()
	}
}
