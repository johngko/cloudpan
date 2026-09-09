package fscore

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudpan/internal/model"
)

// ---- 文件版本管理 ----
// 版本按"策略 + 虚拟路径"关联，重命名/移动时随文件迁移（MigrateVersions）
// 保留策略来自用户所属用户组：KeepVersions（保留最近 N 版，-1 不限）、VersionRetentionDays（保留天数，0 永久）

// SaveVersion 目标文件被覆盖前，将其归档为历史版本
func SaveVersion(policyID, userID uint, vp, physTarget string) bool {
	fi, err := os.Stat(physTarget)
	if err != nil || !fi.Mode().IsRegular() {
		return false
	}
	// 版本号取当前最大值 +1，保证单调递增（旧版本被清理后不会与残留编号冲突）
	var maxVer int
	model.DB.Model(&model.FileVersion{}).
		Select("COALESCE(MAX(version), 0)").
		Where("path = ? AND policy_id = ?", vp, policyID).Scan(&maxVer)
	verDir := filepath.Join(filepath.Dir(physTarget), ".versions")
	verPath := filepath.Join(verDir, fmt.Sprintf("v%d_%s", maxVer+1, filepath.Base(physTarget)))
	_ = os.MkdirAll(verDir, 0o755)
	if err := os.Rename(physTarget, verPath); err != nil {
		return false
	}
	// 原路径移入版本目录：若它是某条哈希索引的源，清理之（版本文件可能被保留策略清理）
	UnlinkHashSource(physTarget)
	model.DB.Create(&model.FileVersion{
		UserID: userID, PolicyID: policyID, Path: vp,
		Version: maxVer + 1, Size: fi.Size(), PhysicalPath: verPath,
		Ext: extOf(filepath.Base(physTarget)), Operator: userName(userID),
	})
	pruneVersions(policyID, userID, vp)
	return true
}

// MigrateVersions 重命名/移动后迁移版本记录与物理版本文件（同策略内）
// 目录：物理版本随目录整体迁移，仅修正记录；文件：需显式搬移 .versions 下的版本文件
func MigrateVersions(d *LocalDriver, policyID uint, oldVP, newVP string, isDir bool) {
	if oldVP == newVP {
		return
	}
	oldPhys, err := d.Physical(oldVP)
	if err != nil {
		return
	}
	newPhys, err := d.Physical(newVP)
	if err != nil {
		return
	}
	oldPhysSlash := filepath.ToSlash(oldPhys)
	var vers []model.FileVersion
	model.DB.Where("policy_id = ?", policyID).Find(&vers)
	for _, v := range vers {
		var newPath, newPhysPath string
		if isDir {
			if v.Path != oldVP && !strings.HasPrefix(v.Path, oldVP+"/") {
				continue
			}
			newPath = newVP + strings.TrimPrefix(v.Path, oldVP)
			rem := strings.TrimPrefix(filepath.ToSlash(v.PhysicalPath), oldPhysSlash)
			newPhysPath = newPhys + filepath.FromSlash(rem)
		} else {
			if v.Path != oldVP {
				continue
			}
			newPath = newVP
			newPhysPath = filepath.Join(filepath.Dir(newPhys), ".versions", filepath.Base(v.PhysicalPath))
		}
		if newPhysPath != v.PhysicalPath {
			if _, err := os.Stat(v.PhysicalPath); err == nil {
				_ = os.MkdirAll(filepath.Dir(newPhysPath), 0o755)
				if err := os.Rename(v.PhysicalPath, newPhysPath); err != nil {
					continue // 迁移失败，保留原记录
				}
			} else if !isDir {
				continue // 物理文件已丢失且无法搬移，保留原记录
			} else if _, err := os.Stat(newPhysPath); err != nil {
				continue // 目录迁移后新位置也找不到，保留原记录
			}
		}
		model.DB.Model(&v).Updates(map[string]interface{}{"path": newPath, "physical_path": newPhysPath})
	}
}

// DeleteVersions 删除文件时同步清理其版本记录与物理版本文件
func DeleteVersions(policyID uint, vp string) {
	var vers []model.FileVersion
	model.DB.Where("path = ? AND policy_id = ?", vp, policyID).Find(&vers)
	for _, v := range vers {
		removeVersionFile(v.PhysicalPath)
		model.DB.Delete(&v)
	}
}

// PurgeDirVersions 彻底删除目录时清理其下所有版本记录（物理文件随目录一起被删除）
func PurgeDirVersions(policyID uint, dirVP string) {
	var vers []model.FileVersion
	model.DB.Where("policy_id = ?", policyID).Find(&vers)
	for _, v := range vers {
		if v.Path == dirVP || strings.HasPrefix(v.Path, dirVP+"/") {
			model.DB.Delete(&v)
		}
	}
}

// PruneAll 周期清理：按各用户组的版本保留天数删除过期版本
func PruneAll() {
	var groups []model.UserGroup
	model.DB.Find(&groups)
	gm := map[uint]model.UserGroup{}
	for _, g := range groups {
		gm[g.ID] = g
	}
	var users []model.User
	model.DB.Select("id", "group_id").Find(&users)
	for _, u := range users {
		g, ok := gm[u.GroupID]
		if !ok || g.VersionRetentionDays <= 0 {
			continue
		}
		cutoff := time.Now().AddDate(0, 0, -g.VersionRetentionDays)
		var vers []model.FileVersion
		model.DB.Where("user_id = ? AND created_at < ?", u.ID, cutoff).Find(&vers)
		for _, v := range vers {
			removeVersionFile(v.PhysicalPath)
			model.DB.Delete(&v)
		}
	}
}

// pruneVersions 按所属用户组的保留策略清理单个文件的旧版本
func pruneVersions(policyID, userID uint, vp string) {
	keep, days := versionPolicyOf(userID)
	if keep == -1 && days <= 0 {
		return // 不限量且永久保留
	}
	var vers []model.FileVersion
	model.DB.Where("path = ? AND policy_id = ?", vp, policyID).Order("version ASC").Find(&vers)
	for i := 0; i < len(vers); i++ {
		del := false
		if keep >= 0 && len(vers)-i > keep { // 只保留最新 keep 个（vers 升序，越靠后越新）
			del = true
		}
		if days > 0 && time.Since(vers[i].CreatedAt) > time.Duration(days)*24*time.Hour {
			del = true
		}
		if !del {
			continue
		}
		removeVersionFile(vers[i].PhysicalPath)
		model.DB.Delete(&vers[i])
	}
}

func versionPolicyOf(userID uint) (keep, days int) {
	keep, days = 10, 0
	var u model.User
	if err := model.DB.Select("group_id").First(&u, userID).Error; err != nil {
		return
	}
	var g model.UserGroup
	if err := model.DB.Select("keep_versions", "version_retention_days").First(&g, u.GroupID).Error; err != nil {
		return
	}
	if g.KeepVersions != 0 {
		keep = g.KeepVersions
	}
	days = g.VersionRetentionDays
	return
}

func userName(uid uint) string {
	var u model.User
	if err := model.DB.Select("username").First(&u, uid).Error; err != nil {
		return fmt.Sprint(uid)
	}
	return u.Username
}

// removeVersionFile 删除版本物理文件，并清理已空的 .versions 目录
func removeVersionFile(phys string) {
	if phys == "" {
		return
	}
	if err := os.Remove(phys); err != nil {
		return
	}
	dir := filepath.Dir(phys)
	if filepath.Base(dir) == ".versions" {
		if entries, e := os.ReadDir(dir); e == nil && len(entries) == 0 {
			_ = os.Remove(dir)
		}
	}
}
