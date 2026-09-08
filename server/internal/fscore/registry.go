package fscore

import (
	"fmt"
	"sync"
	"time"

	"cloudpan/internal/model"
)

// DriverFactory 由策略+用户构造驱动实例
// 本地策略：user 决定按用户隔离的根目录（RootPath/<用户目录>/）；云盘驱动忽略 user
type DriverFactory func(p *model.Policy, user *model.User) (Driver, error)

var (
	regMu    sync.RWMutex
	registry = map[string]DriverFactory{}
)

// RegisterDriver 注册存储驱动（main 包启动时注册本地与各云盘驱动）
func RegisterDriver(policyType string, f DriverFactory) {
	regMu.Lock()
	registry[policyType] = f
	regMu.Unlock()
}

func factoryOf(policyType string) (DriverFactory, error) {
	regMu.RLock()
	f, ok := registry[policyType]
	regMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("暂不支持的存储类型: %s", policyType)
	}
	return f, nil
}

// cachedDriver 带过期缓存的驱动实例（云盘驱动有 token 与目录缓存）
type cachedDriver struct {
	drv     Driver
	expires time.Time
}

// DriverFor 返回指定用户视角下的驱动
// 本地策略 = 该用户自己的隔离目录（RootPath/<用户目录>/）；云盘策略 = 共享驱动（与 user 无关）
func (s *Service) DriverFor(p *model.Policy, user *model.User) (Driver, error) {
	key := driverCacheKey(p, user)
	s.mu.Lock()
	defer s.mu.Unlock()
	if cd, ok := s.drivers[key]; ok {
		if time.Now().Before(cd.expires) {
			return cd.drv, nil
		}
	}
	f, err := factoryOf(p.Type)
	if err != nil {
		return nil, err
	}
	d, err := f(p, user)
	if err != nil {
		return nil, err
	}
	ttl := time.Hour
	if p.Type != "local" {
		ttl = 10 * time.Minute // 云盘 token 可能刷新，缓存短一些
	}
	s.drivers[key] = &cachedDriver{drv: d, expires: time.Now().Add(ttl)}
	return d, nil
}

// driverCacheKey 本地策略按用户维度缓存（隔离目录随用户变化），云盘策略共享缓存
func driverCacheKey(p *model.Policy, user *model.User) string {
	if p.Type == "local" && user != nil {
		return fmt.Sprintf("u%d:%d", p.ID, user.ID)
	}
	return fmt.Sprintf("p%d", p.ID)
}
