package handler

import (
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
)

// ---- B13 协作硬锁（检出即锁，Nextcloud files_lock / Seafile 语义）----
//
// ONLYOFFICE 会话心跳（Status/StatusShare，mode=edit）顺带登记「编辑锁」；
// 所有非编辑器写路径（重命名/移动/删除/记事本保存/版本还原/分块上传覆盖/
// 共享盘写/WebDAV 写）写前统一查锁：被别人持有且未超时 → code 423。
//
// 为什么用内存注册表而不是 DB 字段：锁的生命周期与「浏览器里开着的编辑器」
// 完全同生共死——心跳 20s 续期、90s 无心跳视为已离开（编辑器崩溃/断电自然解锁，
// 无需解锁按钮兜底）；服务重启后前端 ≤20s 心跳重建，不存在 DB 脏锁漂移。
// 锁键 = 「属主策略ID|属主视图路径」，同一文件经自己盘/共享盘/分享链接打开
// 都归一到同一把锁。
type editLockEntry struct {
	UserID uint   `json:"userId"`
	Name   string `json:"name"`
	Last   time.Time
}

var editLocks = struct {
	sync.Mutex
	m map[string]map[string]*editLockEntry // "pid|path" -> sessID -> entry
}{m: map[string]map[string]*editLockEntry{}}

// 与协作 presence 同参数：3 次心跳（20s）未续视为已离开
const editLockTTL = editSessionTTL

func editLockKey(policyID uint, vp string) string { return fmt.Sprintf("%d|%s", policyID, vp) }

func pruneEditLocksLocked(now time.Time) {
	for k, m := range editLocks.m {
		for id, e := range m {
			if now.Sub(e.Last) > editLockTTL {
				delete(m, id)
			}
		}
		if len(m) == 0 {
			delete(editLocks.m, k)
		}
	}
}

// touchEditLock 心跳续期（编辑器开着时每 20s 一次）。sess 为空时退化为按用户占位。
func touchEditLock(policyID uint, vp, sess string, uid uint, name string) {
	if sess == "" {
		sess = fmt.Sprintf("u%d", uid)
	}
	editLocks.Lock()
	defer editLocks.Unlock()
	pruneEditLocksLocked(time.Now())
	k := editLockKey(policyID, vp)
	m := editLocks.m[k]
	if m == nil {
		m = map[string]*editLockEntry{}
		editLocks.m[k] = m
	}
	e := m[sess]
	if e == nil {
		e = &editLockEntry{UserID: uid}
		m[sess] = e
	}
	e.Name = name
	e.Last = time.Now()
}

// releaseEditLock 编辑器主动关闭时调用（beforeunload keepalive 请求）。
// 超时自然过期兜底，漏发不致命。
func releaseEditLock(policyID uint, vp, sess string) {
	if sess == "" {
		return
	}
	editLocks.Lock()
	defer editLocks.Unlock()
	k := editLockKey(policyID, vp)
	if m := editLocks.m[k]; m != nil {
		delete(m, sess)
		if len(m) == 0 {
			delete(editLocks.m, k)
		}
	}
}

// editLockHeldByOther 该路径是否存在「不属于 uid」的活锁；返回任一持锁人
func editLockHeldByOther(policyID uint, vp string, uid uint) *editLockEntry {
	editLocks.Lock()
	defer editLocks.Unlock()
	pruneEditLocksLocked(time.Now())
	for _, e := range editLocks.m[editLockKey(policyID, vp)] {
		if e.UserID != uid {
			return e
		}
	}
	return nil
}

// rejectIfEditLocked 写端点统一拦截（解析出属主策略+视图路径后调用）。
// 持锁人自己走别的写路径（同浏览器另一标签页改个名）不受限。
// 返回 true 表示已写入 423 响应，调用方必须立即 return。
func rejectIfEditLocked(c *gin.Context, policyID uint, vp string) bool {
	u := middleware.CurrentUser(c)
	var uid uint
	if u != nil {
		uid = u.ID
	}
	return failIfLockedByOther(c, policyID, vp, uid)
}

// rejectIfEditLockedUID 无 gin 登录态的写路径（WebDAV 自带鉴权上下文）用
func rejectIfEditLockedUID(c *gin.Context, policyID uint, vp string, uid uint) bool {
	return failIfLockedByOther(c, policyID, vp, uid)
}

func failIfLockedByOther(c *gin.Context, policyID uint, vp string, uid uint) bool {
	en := editLockHeldByOther(policyID, vp, uid)
	if en == nil {
		return false
	}
	dto.Fail(c, 423, fmt.Sprintf("文件正被 %s 编辑（其编辑器关闭或离线 90 秒后自动解锁）", en.Name))
	return true
}

// cleanLockPath 把视图路径清洗成锁键用的规范形式（清洗失败视为不拦截，
// 真正的越界由各端点自己的 Clean/越界检查处理）
func cleanLockPath(p string) (string, bool) {
	v, err := fscore.Clean(p)
	if err != nil {
		return "", false
	}
	return v, true
}

// lockInfoForBatch 给前端「正在编辑」徽章输出持锁人（登录/游客都可见，
// 与 presence 徽章同源信息，不泄露账号，只给昵称）
func editLockHolders(policyID uint, vp string) []editLockEntry {
	editLocks.Lock()
	defer editLocks.Unlock()
	pruneEditLocksLocked(time.Now())
	m := editLocks.m[editLockKey(policyID, vp)]
	if len(m) == 0 {
		return nil
	}
	out := make([]editLockEntry, 0, len(m))
	for _, e := range m {
		out = append(out, editLockEntry{UserID: e.UserID, Name: e.Name})
	}
	return out
}
