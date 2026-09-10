package driver

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"cloudpan/internal/model"
)

var client = &http.Client{Timeout: 60 * time.Second}

// jreq JSON 请求
func jreq(method, url string, headers map[string]string, body interface{}) (map[string]interface{}, error) {
	var rd io.Reader
	if body != nil {
		switch b := body.(type) {
		case []byte:
			rd = bytes.NewReader(b)
		default:
			buf, _ := json.Marshal(body)
			rd = bytes.NewReader(buf)
		}
	}
	req, err := http.NewRequest(method, url, rd)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncate(string(data), 200))
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("响应解析失败: %s", truncate(string(data), 200))
	}
	return m, nil
}

func jstr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func jnum(m map[string]interface{}, key string) float64 {
	if m == nil {
		return 0
	}
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func jarr(m map[string]interface{}, key string) []interface{} {
	if m == nil {
		return nil
	}
	if v, ok := m[key].([]interface{}); ok {
		return v
	}
	return nil
}

func jmap(m map[string]interface{}, key string) map[string]interface{} {
	if m == nil {
		return nil
	}
	if v, ok := m[key].(map[string]interface{}); ok {
		return v
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}

// persistPolicyOpt 把单个 key 写回策略 options（token 刷新轮换后落库，
// 否则驱动实例（10 分钟缓存）销毁后轮换出的新 refresh_token 会丢失、授权永久失效）
func persistPolicyOpt(policyID uint, key, val string) {
	if policyID == 0 || val == "" {
		return
	}
	var p model.Policy
	if model.DB.First(&p, policyID).Error != nil {
		return
	}
	o := p.Opts()
	if o[key] == val {
		return
	}
	o[key] = val
	b, _ := json.Marshal(o)
	_ = model.DB.Model(&p).UpdateColumn("options", string(b)).Error
}
