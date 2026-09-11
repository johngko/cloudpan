package model

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"cloudpan/internal/apps"
)

var DB *gorm.DB

// ---- 用户体系 ----

type User struct {
	ID                 uint   `gorm:"primaryKey" json:"id"`
	Username           string `gorm:"size:64;uniqueIndex" json:"username"`
	PasswordHash       string `gorm:"size:128" json:"-"`
	WebdavPasswordHash string `gorm:"size:128" json:"-"`
	Nickname           string `gorm:"size:64" json:"nickname"`
	Avatar             int    `gorm:"default:0" json:"avatar"` // 头像色板索引
	Role               string `gorm:"size:16;default:user" json:"role"` // admin | user
	GroupID            uint   `json:"groupId"`
	Disabled           bool   `gorm:"default:false" json:"disabled"`
	// 个人配额覆盖（MB）：<0 = 跟随所在用户组；0 = 不限量；>0 = 该用户专属上限
	QuotaMB            int64  `gorm:"default:-1" json:"quotaMB"`
	// 个人应用权限覆盖：JSON {"<appKey>":true|false}，仅存显式设置项，优先于用户组（见 appperm.go）
	AppPerms           string `gorm:"size:512;default:''" json:"appPerms"`
	UsedBytes          int64  `gorm:"default:0" json:"usedBytes"`
	// 令牌版本：改密/重置密码时自增，使该用户旧 JWT 立即失效（旧令牌内嵌旧版本号，中间件比对拒绝）
	TokenVer           uint   `gorm:"default:0" json:"-"`
	CreatedAt          time.Time `json:"createdAt"`
	LastLoginAt        *time.Time  `json:"lastLoginAt"`
}

type UserGroup struct {
	ID                  uint   `gorm:"primaryKey" json:"id"`
	Name                string `gorm:"size:64;uniqueIndex" json:"name"`
	QuotaMB             int64  `gorm:"default:10240" json:"quotaMB"` // -1 = 不限量
	AllowShare          bool   `gorm:"default:true" json:"allowShare"`
	AllowWebdav         bool   `gorm:"default:true" json:"allowWebdav"`
	AllowArchive        bool   `gorm:"default:true" json:"allowArchive"`
	AllowOffline        bool   `gorm:"default:false" json:"allowOffline"`
	ShareAllowDownload  bool   `gorm:"default:true" json:"shareAllowDownload"`
	// ReadOnly 只读用户组：成员仅可查看/下载自己的盘，不能新建/上传/移动/删除（管理员豁免；不影响他人显式授予的可写共享）
	ReadOnly            bool   `gorm:"default:false" json:"readOnly"`
	DownloadSpeedKB     int64  `gorm:"default:0" json:"downloadSpeedKB"` // 0 = 不限速
	RecycleRetentionDays int   `gorm:"default:0" json:"recycleRetentionDays"` // 回收站保留天数，0 = 永久
	KeepVersions        int    `gorm:"default:10" json:"keepVersions"`   // 每个文件保留的历史版本数，-1 = 不限
	VersionRetentionDays int   `gorm:"default:0" json:"versionRetentionDays"` // 版本保留天数，0 = 永久
	AllowedPolicyIDs    string `gorm:"size:512;default:''" json:"allowedPolicyIds"` // JSON 数组，空 = 全部
	// 应用级权限：JSON {"<appKey>":true|false}，仅存显式设置项；缺省 = 允许（见 appperm.go）
	AppPerms            string `gorm:"size:512;default:''" json:"appPerms"`
	IsDefault           bool   `gorm:"default:false" json:"isDefault"`
	Remark              string `gorm:"size:255" json:"remark"`
	CreatedAt           time.Time `json:"createdAt"`
}

func (g *UserGroup) PolicyIDList() []uint {
	var ids []uint
	_ = json.Unmarshal([]byte(g.AllowedPolicyIDs), &ids)
	return ids
}

func (g *UserGroup) CanUsePolicy(pid uint) bool {
	ids := g.PolicyIDList()
	if len(ids) == 0 {
		return true
	}
	for _, id := range ids {
		if id == pid {
			return true
		}
	}
	return false
}

// ---- 存储策略（借鉴 Cloudreve：固定列 + Options 包） ----

type Policy struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"size:64" json:"name"`
	Letter    string `gorm:"size:4;uniqueIndex" json:"letter"` // 虚拟盘符 C/D/E.../云盘名
	Type      string `gorm:"size:16" json:"type"`  // local | pan123 | aliyun | baidu | tianyi
	RootPath  string `gorm:"size:512" json:"rootPath"` // 本地策略的物理根目录
	Options   string `gorm:"type:text" json:"-"`       // JSON：云盘 token/密钥等
	Status    string `gorm:"size:16;default:active" json:"status"` // active | error | disabled
	StatusMsg string `gorm:"size:255" json:"statusMsg"`
	UsageBytes int64     `gorm:"default:0" json:"usageBytes"`
	UsageAt    *time.Time `json:"-"`
	CreatedBy uint   `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

type PolicyOptions map[string]string

func (p *Policy) Opts() PolicyOptions {
	m := PolicyOptions{}
	_ = json.Unmarshal([]byte(p.Options), &m)
	return m
}

// ---- 秒传哈希索引 ----

type FileHash struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Hash      string `gorm:"size:64;uniqueIndex" json:"hash"` // sha256 hex
	Size      int64  `json:"size"`
	SourcePath string `gorm:"size:512" json:"-"` // 当前可用的首份内容物理路径（秒传硬链/复制源），失效时自动改指其他存活副本
	RefCount  int64  `gorm:"default:1" json:"refCount"` // 存活物理副本数（含回收站/版本文件），0 时整条删除
	CreatedAt time.Time `json:"createdAt"`
}

// FileHashCopy 每个物理副本一行：同一内容的硬链接/拷贝各自登记，
// 某用户的副本（含其在回收站里的形态）被删除时只移除自己那一行——
// 只要还有任何一个副本存活，索引就保留、秒传继续可用；
// 最后一个副本物理消失时索引才删除，文件数据也随之真正释放。
type FileHashCopy struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Hash      string    `gorm:"size:64;index" json:"-"`
	PhysPath  string    `gorm:"size:512;uniqueIndex" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

// BackfillHashCopies 升级回填：旧版索引只有 SourcePath 单源记录，按当前源补一条副本行；
// 源已失效的索引（无任何存活副本可登记）直接清理，下次同内容上传会自愈重建
func BackfillHashCopies() {
	var rows []FileHash
	DB.Find(&rows)
	for _, r := range rows {
		if r.SourcePath == "" {
			DB.Delete(&FileHash{}, r.ID)
			continue
		}
		if fi, err := os.Stat(r.SourcePath); err != nil || !fi.Mode().IsRegular() || fi.Size() != r.Size {
			DB.Delete(&FileHash{}, r.ID)
			continue
		}
		var n int64
		DB.Model(&FileHashCopy{}).Where("phys_path = ?", r.SourcePath).Count(&n)
		if n == 0 {
			DB.Create(&FileHashCopy{Hash: r.Hash, PhysPath: r.SourcePath})
		}
	}
}

// ---- 分块上传会话（断点续传） ----

type UploadSession struct {
	ID           string `gorm:"size:40;primaryKey" json:"id"`
	UserID       uint   `json:"userId"`
	PolicyID     uint   `json:"policyId"`
	ParentPath   string `gorm:"size:512" json:"parentPath"`
	Name         string `gorm:"size:255" json:"name"`
	Size         int64  `json:"size"`
	ChunkSize    int64  `json:"chunkSize"`
	TotalChunks  int    `json:"totalChunks"`
	Hash         string `gorm:"size:64" json:"hash"` // 客户端预计算的 sha256，可为空
	Received     string `gorm:"type:text" json:"received"` // JSON []int 已收分片
	Status       string `gorm:"size:16;default:uploading" json:"status"` // uploading | completed | aborted
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (s *UploadSession) ReceivedList() []int {
	var l []int
	_ = json.Unmarshal([]byte(s.Received), &l)
	return l
}

// ---- 分享 ----

type Share struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	UserID         uint   `json:"userId"`
	PolicyID       uint   `json:"policyId"`
	Path           string `gorm:"size:512" json:"path"`
	Name           string `gorm:"size:255" json:"name"`
	IsDir          bool   `json:"isDir"`
	Token          string `gorm:"size:40;uniqueIndex" json:"token"`
	PasswordHash   string `gorm:"size:128" json:"-"` // 空 = 无密码
	ExpiresAt      *time.Time `json:"expiresAt"`
	RemainDownloads int   `gorm:"default:-1" json:"remainDownloads"` // -1 = 不限
	PreviewEnabled bool   `gorm:"default:true" json:"previewEnabled"`
	AllowDownload  bool   `gorm:"default:true" json:"allowDownload"`
	// AllowEdit 分享访客可否在线编辑（ONLYOFFICE 编辑器 edit 权限）；默认开，
	// 与 Cloudreve 分享模式一致：任何人打开分享链接都能在线编辑，保存走创建者目录并归档旧版本
	AllowEdit      bool   `gorm:"default:true" json:"allowEdit"`
	Views          int64  `gorm:"default:0" json:"views"`
	Downloads      int64  `gorm:"default:0" json:"downloads"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (s *Share) Available() bool {
	if s.ExpiresAt != nil && time.Now().After(*s.ExpiresAt) {
		return false
	}
	if s.RemainDownloads == 0 {
		return false
	}
	return true
}

// ---- 回收站 / 收藏 ----

type RecycleItem struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	UserID    uint   `json:"userId"`
	PolicyID  uint   `json:"policyId"`
	OrigPath  string `gorm:"size:512" json:"origPath"`
	TrashPath string `gorm:"size:512" json:"-"` // 回收区内的相对路径
	Name      string `gorm:"size:255" json:"name"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size"`
	DeletedAt time.Time `json:"deletedAt"`
}

type UserStar struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	UserID    uint   `json:"userId"`
	PolicyID  uint   `json:"policyId"`
	Path      string `gorm:"size:512" json:"path"`
	Name      string `gorm:"size:255" json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// UserShare 站内用户共享：把目录共享给指定用户/用户组/所有注册用户（ro 只读 / rw 可写）
type UserShare struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	OwnerID   uint   `gorm:"index" json:"ownerId"`
	// TargetType: user=指定用户（TargetID=用户ID）；group=用户组（TargetID=组ID）；all=所有注册账号（TargetID=0）
	TargetType string `gorm:"size:8;default:user;index" json:"targetType"`
	TargetID   uint   `gorm:"index" json:"targetId"`
	PolicyID   uint   `json:"policyId"`
	Path       string `gorm:"size:512" json:"path"`
	Name       string `gorm:"size:255" json:"name"`
	Perm       string `gorm:"size:4;default:ro" json:"perm"` // ro | rw
	CreatedAt  time.Time `json:"createdAt"`
}

// FileVersion 文件版本管理：保存文件的每个历史版本，支持恢复
type FileVersion struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"index" json:"userId"`
	PolicyID   uint      `json:"policyId"`
	Path       string    `gorm:"size:512;index" json:"path"` // 当前路径，用于关联版本
	Version    int       `json:"version"`                    // 版本号，从1开始
	Size       int64     `json:"size"`
	PhysicalPath string  `gorm:"size:512" json:"-"`          // 版本文件的物理路径
	Ext        string    `json:"ext"`
	Operator   string    `gorm:"size:64" json:"operator"`    // 操作者用户名
	CreatedAt  time.Time `json:"createdAt"`
}

// ---- 任务队列 / 离线下载 ----

type Task struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	UserID    uint   `json:"userId"`
	Type      string `gorm:"size:24" json:"type"`  // offline | compress | decompress | transfer
	Status    string `gorm:"size:16;default:queued" json:"status"` // queued|processing|error|canceled|finished
	Progress  int    `json:"progress"` // 0-100
	Error     string `gorm:"size:512" json:"error"`
	Props     string `gorm:"type:text" json:"props"` // JSON 各类型私有字段
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ---- 站内通知（每用户最多保留 200 条，由 emitter 负责裁剪） ----

type Notification struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	Type      string    `gorm:"size:24" json:"type"` // task | quota | system
	Title     string    `gorm:"size:128" json:"title"`
	Content   string    `gorm:"size:512" json:"content"`
	RefID     uint      `json:"refId"` // 关联对象 ID（如任务 ID）
	Read      bool      `gorm:"default:false" json:"read"`
	Cleared   bool      `gorm:"default:false" json:"cleared"` // 软清除：从用户通知中心隐藏，数据保留供管理员审计
	CreatedAt time.Time `json:"createdAt"`
}

// ---- 站点/用户设置、审计 ----

type UserSetting struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	UserID uint   `gorm:"index" json:"userId"`
	Key    string `gorm:"size:64;index" json:"key"`
	Value  string `gorm:"type:text" json:"value"`
}

type SiteSetting struct {
	Key   string `gorm:"size:64;primaryKey" json:"key"`
	Value string `gorm:"type:text" json:"value"`
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"userId"`
	Username  string    `gorm:"size:64" json:"username"`
	Action    string    `gorm:"size:32;index" json:"action"`
	Detail    string    `gorm:"size:512" json:"detail"`
	IP        string    `gorm:"size:64" json:"ip"`
	CreatedAt time.Time `json:"createdAt"`
}

// SystemApp 站点级功能开关（应用中心）。管理员可启停，前端入口与路由门控随之联动
type SystemApp struct {
	Key       string    `gorm:"size:64;primaryKey" json:"key"`
	Enabled   bool      `gorm:"default:true" json:"enabled"`
	Version   string    `gorm:"size:32" json:"version"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ---- 初始化 ----

func hashPwd(pwd string) string {
	b, _ := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	return string(b)
}

func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func InitDB(dataDir string) {
	logCfg := logger.New(log.New(os.Stdout, "\r\n", log.LstdFlags), logger.Config{LogLevel: logger.Warn})
	db, err := gorm.Open(sqlite.Open(filepath.Join(dataDir, "cloudpan.db")+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"), &gorm.Config{Logger: logCfg})
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	DB = db
	// quota_mb 列首次新增时，SQLite 会把存量行填 0（=不限量），必须回填 -1（=随组）
	quotaColNew := !DB.Migrator().HasColumn(&User{}, "quota_mb")
	if err := DB.AutoMigrate(&User{}, &UserGroup{}, &Policy{}, &FileHash{}, &FileHashCopy{}, &UploadSession{}, &Share{}, &RecycleItem{}, &UserStar{}, &UserShare{}, &FileVersion{}, &Task{}, &Notification{}, &UserSetting{}, &SiteSetting{}, &AuditLog{}, &SystemApp{}); err != nil {
		log.Fatalf("建表失败: %v", err)
	}
	// 存量秒传索引回填副本行（旧版本只有 SourcePath 单源记录）
	BackfillHashCopies()
	if quotaColNew {
		DB.Model(&User{}).Where("quota_mb IS NULL OR quota_mb = 0").UpdateColumn("quota_mb", -1)
	}
	seed()
}

// GuestUsername 游客共享账号的系统用户名。该账号由系统托管（随机密码不可知、
// 仅经 /auth/guest 登录、多访客共用一个身份），不允许任何自管理操作——
// 由 middleware.GuestReadOnly 统一兜底拦截（详见该文件注释）。
const GuestUsername = "guest"

// IsGuestUser 判断是否为游客共享账号
func IsGuestUser(u *User) bool { return u != nil && u.Username == GuestUsername }

// guestAppPerms 访客组默认应用权限：基础应用 + 内部共享（查看共享）+ 在线 Office +
// HTTP 离线下载；禁止终端/浏览器/WebDAV/公开分享/BT/系统监控。
// 应用中心与网络测速对游客隐藏（基础应用之外不提供功能管理/测速入口）
const guestAppPerms = `{"terminal":false,"browser":false,"office":true,"webdav":false,"share":false,"offline_http":true,"bt":false,"system_monitor":false,"app_center":false,"speedtest":false}`

// visitorGroupProfile 系统托管「访客」组的标准画像（游客 = 24 小时临时工作区）：
// 可写自己盘（上传/管理/在线编辑/离线下载，文件 24h 后自动清除），
// 不可分享/不可 WebDAV/不可压缩；自管理类操作由 middleware.GuestReadOnly 账号级兜底
func visitorGroupProfile() UserGroup {
	return UserGroup{
		Name: "访客", QuotaMB: 1024,
		AllowShare: false, AllowWebdav: false, AllowArchive: false, AllowOffline: true,
		ReadOnly: false, AppPerms: guestAppPerms,
		Remark: "游客：24 小时临时工作区（可上传/离线下载/在线 Office；文件 24 小时后自动清除）",
	}
}

func seed() {
	// 默认用户组禁用终端（安全加固：终端可执行任意 shell 命令，仅管理员默认可用；
	// 管理员可在用户组权限里显式放行）
	const defaultGroupAppPerms = `{"terminal":false}`
	var gc int64
	DB.Model(&UserGroup{}).Count(&gc)
	if gc == 0 {
		DB.Create(&UserGroup{Name: "默认用户组", QuotaMB: 10240, AllowShare: true, AllowWebdav: true, AllowArchive: true, AllowOffline: true, IsDefault: true, AppPerms: defaultGroupAppPerms, Remark: "系统默认"})
		vis := visitorGroupProfile()
		DB.Create(&vis)
	} else {
		// 存量部署幂等刷新访客组画像：语义从"只读访客"演进为"24h 临时工作区"
		// （quota/限速等运维自定义项不动，只对齐标志与权限）
		var gg UserGroup
		if err := DB.Where("name = ?", "访客").First(&gg).Error; err == nil {
			prof := visitorGroupProfile()
			DB.Model(&gg).Updates(map[string]interface{}{
				"allow_share": prof.AllowShare, "allow_webdav": prof.AllowWebdav,
				"allow_archive": prof.AllowArchive, "allow_offline": prof.AllowOffline,
				"read_only": prof.ReadOnly, "app_perms": prof.AppPerms, "remark": prof.Remark,
			})
		}
		// 存量部署：默认用户组幂等补「终端禁用」（已显式设置过的尊重管理员自定义，不覆盖）
		var dg UserGroup
		if err := DB.Where("is_default = ?", true).First(&dg).Error; err == nil {
			perms := ParseAppPerms(dg.AppPerms)
			if _, ok := perms["terminal"]; !ok {
				perms["terminal"] = false
				DB.Model(&dg).UpdateColumn("app_perms", AppPermsJSON(perms))
			}
		}
	}
	var uc int64
	DB.Model(&User{}).Count(&uc)
	if uc == 0 {
		var g UserGroup
		DB.Where("is_default = ?", true).First(&g)
		// 首次部署管理员密码随机生成、仅启动日志打印一次（不落库外任何位置），登录后立即改密
		adminPwd := "admin" + randomToken(8)
		DB.Create(&User{Username: "admin", PasswordHash: hashPwd(adminPwd), Nickname: "管理员", Role: "admin", GroupID: g.ID})
		log.Printf("[CloudPan] 首次部署：初始管理员密码为 %s（仅本次日志输出，登录请立即修改）", adminPwd)
	}
	// 游客账号：登录页「游客登录」的共享身份（密码随机不可知，仅经 /auth/guest 登录）。
	// 幂等：缺失即补建；管理员关闭游客登录用站点开关 guest_login 或禁用该账号
	var gg UserGroup
	if err := DB.Where("name = ?", "访客").First(&gg).Error; err == nil {
		var gn int64
		DB.Model(&User{}).Where("username = ?", GuestUsername).Count(&gn)
		if gn == 0 {
			DB.Create(&User{Username: GuestUsername, PasswordHash: hashPwd(randomToken(16)), Nickname: "游客", Role: "user", GroupID: gg.ID, QuotaMB: -1})
		}
	}
	var sc int64
	DB.Model(&SiteSetting{}).Count(&sc)
	if sc == 0 {
		defaults := map[string]string{
			"site_name": "CloudPan 网盘", "register_open": "false", "register_invite_code": "",
			"onlyoffice_url": "", "onlyoffice_jwt": "", "webdav_enabled": "true", "announcement": "",
			"guest_login": "true", "site_theme": "win12",
		}
		for k, v := range defaults {
			DB.Create(&SiteSetting{Key: k, Value: v})
		}
	}
	var pc int64
	DB.Model(&Policy{}).Count(&pc)
	_ = pc // 存储策略由管理员在界面挂载，不预置

	// 系统功能应用：按清单补种（已存在的保留其启用状态）
	for _, def := range apps.Manifest {
		var row SystemApp
		if err := DB.Where("key = ?", def.Key).First(&row).Error; err != nil {
			DB.Create(&SystemApp{Key: def.Key, Enabled: def.DefaultEnabled, Version: def.Version, UpdatedAt: time.Now()})
		} else {
			DB.Model(&row).Update("version", def.Version)
		}
	}
}
