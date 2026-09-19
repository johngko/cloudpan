package model

import (
	"errors"
	"sync"
	"time"
)

// ErrAppUnknown 功能 key 不在清单/表中
var ErrAppUnknown = errors.New("功能不存在")

// 系统功能开关内存缓存（避免每请求查库）
var (
	appCacheMu sync.RWMutex
	appCache   = map[string]bool{}
)

// LoadAppCache 启动时从数据库加载功能开关
func LoadAppCache() {
	var rows []SystemApp
	DB.Find(&rows)
	m := make(map[string]bool, len(rows))
	for _, r := range rows {
		m[r.Key] = r.Enabled
	}
	appCacheMu.Lock()
	appCache = m
	appCacheMu.Unlock()
}

// AppEnabled 功能是否启用；未知 key 默认启用（向前兼容清单外功能）
func AppEnabled(key string) bool {
	appCacheMu.RLock()
	defer appCacheMu.RUnlock()
	on, ok := appCache[key]
	return !ok || on
}

// SetAppEnabled 更新功能开关（数据库 + 缓存），返回是否命中清单内 key
func SetAppEnabled(key string, on bool) error {
	res := DB.Model(&SystemApp{}).Where("`key` = ?", key).
		Updates(map[string]any{"enabled": on, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrAppUnknown
	}
	appCacheMu.Lock()
	appCache[key] = on
	appCacheMu.Unlock()
	return nil
}
