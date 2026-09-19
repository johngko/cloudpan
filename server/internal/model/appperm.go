package model

import (
	"encoding/json"
	"sync"
)

// 功能权限（应用级）三级解析：
//   全局开关(SystemApp) > 用户个人覆盖(User.AppPerms) > 用户组设置(UserGroup.AppPerms) > 默认允许
//
// AppPerms 字段为 JSON 对象 {"<appKey>": true|false}，只保存"显式设置"的键：
// 键不存在 = 继承下一级。个人层可双向覆盖组层（组禁、个人可单独放开；组放、个人可单独禁）。
// 管理员不受组/个人限制（全局开关对所有人生效，含管理员）。

// ParseAppPerms 解析 AppPerms JSON；空串/非法返回空 map
func ParseAppPerms(s string) map[string]bool {
	m := map[string]bool{}
	if s == "" {
		return m
	}
	_ = json.Unmarshal([]byte(s), &m)
	return m
}

// AppPermsJSON 序列化权限 map（空 map 存空串，便于"未设置"语义）
func AppPermsJSON(m map[string]bool) string {
	if len(m) == 0 {
		return ""
	}
	b, _ := json.Marshal(m)
	return string(b)
}

var appPermGroupCache sync.Map // groupID -> map[string]bool

// InvalidateAppPermCache 组权限变更后调用（保存用户组时）
func InvalidateAppPermCache(groupID uint) {
	appPermGroupCache.Delete(groupID)
}

// groupAppPerm 取用户组的显式权限（带缓存，保存用户组时失效）
func groupAppPerm(groupID uint) (map[string]bool, bool) {
	if groupID == 0 {
		return nil, false
	}
	if v, ok := appPermGroupCache.Load(groupID); ok {
		if m, ok := v.(map[string]bool); ok {
			return m, true
		}
	}
	var g UserGroup
	if err := DB.First(&g, groupID).Error; err != nil {
		return nil, false
	}
	m := ParseAppPerms(g.AppPerms)
	appPermGroupCache.Store(groupID, m)
	return m, true
}

// AppAllowed 判断用户能否使用功能 key。
// 管理员不受全局开关与组/个人权限约束（所有应用对管理员可用——桌面全量展示、可正常使用）；
// u 为 nil（匿名/公开分享）时仅受全局开关约束。
func AppAllowed(key string, u *User) bool {
	if u != nil && u.Role == "admin" {
		return true
	}
	if !AppEnabled(key) {
		return false
	}
	if u == nil {
		return true
	}
	// 1) 用户个人覆盖（显式设置优先）
	if v, ok := ParseAppPerms(u.AppPerms)[key]; ok {
		return v
	}
	// 2) 用户组设置
	if m, ok := groupAppPerm(u.GroupID); ok {
		if v, ok := m[key]; ok {
			return v
		}
	}
	// 3) 默认允许
	return true
}
