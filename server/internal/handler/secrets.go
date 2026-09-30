package handler

// 站点敏感设置的静态加密：SMTP 授权码等落库前以服务器密钥（secret.key 派生，AES-GCM）
// 加密，读取时解密。历史明文在启动迁移时一次性密封（MigrateSiteSecrets）。
// 密文统一带 "enc:v1:" 前缀：无前缀的值按历史明文原样透传（兼容 + 惰性迁移），
// 前缀值解密失败时按空串处理并记日志（密钥轮换后的兜底，避免用坏密文外发）。
import (
	"errors"
	"log"
	"strings"

	"cloudpan/internal/model"
	"golang.org/x/crypto/bcrypt"
)

const secretEncPrefix = "enc:v1:"

// sealSecret 明文 → "enc:v1:<base64(AES-GCM)>"；空串原样返回
func sealSecret(plain string) string {
	if plain == "" || strings.HasPrefix(plain, secretEncPrefix) {
		return plain
	}
	enc, err := encryptBlob([]byte(plain))
	if err != nil {
		log.Printf("[secrets] 加密失败，按明文拒存处理: %v", err)
		return ""
	}
	return secretEncPrefix + enc
}

// openSecret "enc:v1:..." → 明文；无前缀按历史明文原样返回；解密失败返回空串
func openSecret(val string) string {
	if !strings.HasPrefix(val, secretEncPrefix) {
		return val
	}
	plain, err := decryptBlob(strings.TrimPrefix(val, secretEncPrefix))
	if err != nil {
		log.Printf("[secrets] 解密失败（密钥不匹配或数据损坏），该敏感设置按空值处理: %v", err)
		return ""
	}
	return string(plain)
}

// migrateSiteSecrets 启动时把历史明文的敏感设置一次性密封（幂等：带前缀的跳过）。
// 在 router 装配处（termSecret 已注入）之后调用。
func migrateSiteSecrets() {
	var rows []model.SiteSetting
	if err := model.DB.Where("`key` = ? AND value != ''", "notify_email_pass").Find(&rows).Error; err != nil {
		return
	}
	for _, r := range rows {
		if strings.HasPrefix(r.Value, secretEncPrefix) {
			continue
		}
		if sealed := sealSecret(r.Value); sealed != "" {
			model.DB.Model(&model.SiteSetting{}).Where("`key` = ?", r.Key).Update("value", sealed)
			log.Printf("[secrets] 已密封站点设置 %s（历史明文迁移）", r.Key)
		}
	}
}

// ResetAdminPassword 运维兜底：重置首个管理员账号口令并注销其全部会话（TokenVer+1）。
// 仅供服务器本机 CLI（cloudpan reset-admin <新密码>）使用——能碰服务器 shell 的人
// 本就能读写数据库，不构成新的攻击面。
func ResetAdminPassword(newPass string) error {
	if len(newPass) < 8 {
		return errors.New("新密码至少 8 位")
	}
	var u model.User
	if err := model.DB.Where("role = ?", "admin").Order("id").First(&u).Error; err != nil {
		return errors.New("管理员账号不存在")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return model.DB.Model(&u).Updates(map[string]interface{}{
		"password_hash": string(hash),
		"token_ver":     u.TokenVer + 1, // 旧 JWT 全部失效
	}).Error
}

// RenameAdminUsername 运维兜底：修改首个管理员账号的用户名并注销其全部会话（TokenVer+1）。
// 仅供服务器本机 CLI（cloudpan rename-admin <新用户名>）使用，与 ResetAdminPassword 同一攻击面假设。
// WebDAV/基础认证用的是用户名，改名后旧凭据自然失效，需用新用户名重登。
func RenameAdminUsername(newName string) error {
	newName = strings.TrimSpace(newName)
	if !model.IsValidAdminUsername(newName) {
		return errors.New("用户名需 2-32 位，仅字母/数字/下划线/短横线")
	}
	var u model.User
	if err := model.DB.Where("role = ?", "admin").Order("id").First(&u).Error; err != nil {
		return errors.New("管理员账号不存在")
	}
	if u.Username == newName {
		return errors.New("新用户名与当前用户名相同")
	}
	var n int64
	model.DB.Model(&model.User{}).Where("username = ?", newName).Count(&n)
	if n > 0 {
		return errors.New("该用户名已被其他账号占用")
	}
	return model.DB.Model(&u).Updates(map[string]interface{}{
		"username":  newName,
		"token_ver": u.TokenVer + 1, // 旧 JWT 全部失效
	}).Error
}