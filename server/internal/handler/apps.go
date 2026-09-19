package handler

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/apps"
	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

type appOut struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	Icon    string `json:"icon"`
	Desc    string `json:"desc"`
	Version string `json:"version"`
	Enabled bool   `json:"enabled"` // 全局是否启用（管理员视角）
	Allowed bool   `json:"allowed"` // 当前登录用户是否有权使用（组/个人权限解析后）
}

// AppList 系统功能清单 + 当前启用状态（登录用户可读，管理员可写）
func (h *SiteHandler) AppList(c *gin.Context) {
	var rows []model.SystemApp
	model.DB.Find(&rows)
	st := map[string]bool{}
	for _, r := range rows {
		st[r.Key] = r.Enabled
	}
	u := middleware.UserOrNil(c)
	out := make([]appOut, 0, len(apps.Manifest))
	for _, def := range apps.Manifest {
		on := def.DefaultEnabled
		if v, ok := st[def.Key]; ok {
			on = v
		}
		out = append(out, appOut{Key: def.Key, Name: def.Name, Icon: def.Icon, Desc: def.Desc, Version: def.Version,
			Enabled: on, Allowed: model.AppAllowed(def.Key, u)})
	}
	dto.OK(c, out)
}

// AppToggle 启停系统功能（仅管理员）
func (h *AdminHandler) AppToggle(c *gin.Context) {
	var in struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	key := c.Param("key")
	if apps.Find(key) == nil {
		dto.Fail(c, 404, "功能不存在")
		return
	}
	if err := model.SetAppEnabled(key, in.Enabled); err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	middleware.Audit(c, "app_toggle", fmt.Sprintf("%s:%v", key, in.Enabled))
	dto.OK(c, gin.H{"key": key, "enabled": in.Enabled})
}
