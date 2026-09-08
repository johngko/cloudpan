package fscore

import (
	"fmt"
	"sync"
	"time"

	"cloudpan/internal/model"
)

// DriverFactory 由策略构造驱动实例
type DriverFactory func(p *model.Policy) (Driver, error)

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

func (s *Service) DriverOf(p *model.Policy) (Driver, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cd, ok := s.drivers[p.ID]; ok {
		if time.Now().Before(cd.expires) {
			return cd.drv, nil
		}
	}
	f, err := factoryOf(p.Type)
	if err != nil {
		return nil, err
	}
	d, err := f(p)
	if err != nil {
		return nil, err
	}
	ttl := time.Hour
	if p.Type != "local" {
		ttl = 10 * time.Minute // 云盘 token 可能刷新，缓存短一些
	}
	s.drivers[p.ID] = &cachedDriver{drv: d, expires: time.Now().Add(ttl)}
	return d, nil
}
