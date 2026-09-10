package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// GuestReadOnly 游客共享账号身份级兜底：guest 账号是所有访客共用的系统托管身份
// （随机密码不可知、仅经 /auth/guest 登录、全体访客共用一个账号与存储目录）。
//
// 游客的定位是"24 小时临时工作区"（见 TaskPool.sweepGuestWorkspace 的 TTL 清理）：
// 可以上传/管理/在线编辑自己盘内的文件、离线下载，但一切"修改自己账号状态"的
// 操作都不成立——改密码/昵称、写用户设置 KV、收藏、通知已读等都会污染全体
// 访客共用的身份或在访客之间互相泄漏。
//
// 因此这里是"账号级"默认拒绝 + 显式白名单：白名单外的一切非 GET 请求一律 403，
// 今后新增任何写端点也默认对游客关闭，无需再逐个记得拦截。
//
// 白名单（全部落在"临时工作区"或"显式授权"范围内）：
//   - 自己盘的文件管理：新建/重命名/移动/复制/删除/记事本/回收站/版本恢复
//   - 上传会话：init/chunk/complete/abort（动态分片路径用前缀匹配）
//   - 离线下载：创建任务/取消任务（下载内容落在自己盘，随 24h TTL 清理）
//   - 被显式以 rw（可写）方式共享给访客的目录（显式授权优先，与原语义一致）
var guestWriteAllow = map[string]bool{
	// 临时工作区：自己盘的文件管理
	"/api/fs/mkdir":        true,
	"/api/fs/rename":       true,
	"/api/fs/move":         true,
	"/api/fs/copy":         true,
	"/api/fs/cross-copy":   true,
	"/api/fs/cross-move":   true,
	"/api/fs/delete":       true,
	"/api/fs/text":         true, // 记事本保存 = 往自己盘写文本文件
	"/api/recycle/restore": true,
	"/api/recycle/purge":   true,
	"/api/fileversions/restore": true,
	// 离线下载（24h 清理）
	"/api/offline":       true, // POST 创建任务
	"/api/offline/:id":   true, // DELETE 取消任务
	// 显式 rw 共享目录
	"/api/shared/:id/mkdir":  true,
	"/api/shared/:id/upload": true,
	"/api/shared/:id/delete": true,
}

// 前缀白名单（动态路径：/api/upload/chunk/:sid/:idx 等）
var guestWriteAllowPrefix = []string{
	"/api/upload/",
}

func GuestReadOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && model.IsGuestUser(CurrentUser(c)) && !guestWriteAllowed(c.FullPath()) {
			dto.Fail(c, 403, "游客为临时空间身份，不能执行该操作")
			c.Abort()
			return
		}
		c.Next()
	}
}

func guestWriteAllowed(fullPath string) bool {
	if guestWriteAllow[fullPath] {
		return true
	}
	for _, p := range guestWriteAllowPrefix {
		if strings.HasPrefix(fullPath, p) {
			return true
		}
	}
	return false
}
