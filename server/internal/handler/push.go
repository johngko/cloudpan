package handler

// B9 Web Push：站内通知（Notify()）实时推送到已订阅的浏览器/手机 PWA。
// 纯 stdlib+x/crypto 实现（RFC 8291 aes128gcm + RFC 8188 记录分帧 + RFC 8292 VAPID JWT）：
// VAPID 密钥对首启生成存站点设置（无第三方服务、无外部依赖）；订阅表按用户隔离；
// 推送 404/410 自动清理失效订阅。前端 Service Worker 收到 push 事件弹系统通知。

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

const pushRecordSize = 4096

// PushHandler 推送订阅管理端点
type PushHandler struct{}

// pushVapidKeys VAPID P-256 密钥（JWK 形态存站点设置）
type pushVapidKeys struct {
	X string `json:"x"`
	Y string `json:"y"`
	D string `json:"d"`
}

func loadOrCreateVapid() (*ecdsa.PrivateKey, error) {
	var s model.SiteSetting
	err := model.DB.Where("`key` = ?", "vapid_keys").First(&s).Error
	if err == nil && s.Value != "" {
		var k pushVapidKeys
		if json.Unmarshal([]byte(s.Value), &k) == nil && k.D != "" {
			// 必须按十六进制解码：big.Int.UnmarshalText 对无 0x 前缀的串按十进制解析会静默失败归零
			db, e1 := hex.DecodeString(k.D)
			xb, e2 := hex.DecodeString(k.X)
			yb, e3 := hex.DecodeString(k.Y)
			priv := &ecdsa.PrivateKey{
				D:         new(big.Int).SetBytes(db),
				PublicKey: ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(xb), Y: new(big.Int).SetBytes(yb)},
			}
			if e1 == nil && e2 == nil && e3 == nil && priv.D.Sign() > 0 && priv.PublicKey.Curve.IsOnCurve(priv.X, priv.Y) {
				return priv, nil
			}
		}
	}
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	k := pushVapidKeys{
		X: hex.EncodeToString(priv.X.Bytes()), Y: hex.EncodeToString(priv.Y.Bytes()), D: hex.EncodeToString(priv.D.Bytes()),
	}
	b, _ := json.Marshal(&k)
	model.DB.Save(&model.SiteSetting{Key: "vapid_keys", Value: string(b)})
	return priv, nil
}

// VapidPublicKey GET /push/vapid → 前端 subscribe 用的 applicationServerKey（65B 未压缩点 base64url）
func (h *PushHandler) VapidPublicKey(c *gin.Context) {
	priv, err := loadOrCreateVapid()
	if err != nil {
		dto.Fail(c, 500, "VAPID 初始化失败")
		return
	}
	un := elliptic.Marshal(priv.Curve, priv.X, priv.Y) // P-256：0x04||X||Y 共 65 字节
	dto.OK(c, gin.H{"publicKey": base64.RawURLEncoding.EncodeToString(un)})
}

// Subscribe PUT /push/subscribe
func (h *PushHandler) Subscribe(c *gin.Context) {
	var in struct {
		Endpoint string `json:"endpoint"`
		P256dh   string `json:"p256dh"`
		Auth     string `json:"auth"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Endpoint == "" || in.P256dh == "" || in.Auth == "" {
		dto.Fail(c, 400, "订阅参数不完整")
		return
	}
	if !strings.HasPrefix(in.Endpoint, "https://") {
		dto.Fail(c, 400, "推送端点必须为 https")
		return
	}
	u := middleware.CurrentUser(c)
	row := model.PushSub{UserID: u.ID, Endpoint: in.Endpoint, P256dh: in.P256dh, Auth: in.Auth, CreatedAt: time.Now()}
	model.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"p256dh", "auth", "created_at"}),
	}).Create(&row)
	dto.OK(c, gin.H{"ok": true})
}

// Unsubscribe DELETE /push/subscribe?endpoint=
func (h *PushHandler) Unsubscribe(c *gin.Context) {
	u := middleware.CurrentUser(c)
	ep := c.Query("endpoint")
	if ep == "" {
		dto.Fail(c, 400, "缺少 endpoint")
		return
	}
	model.DB.Where("user_id = ? AND endpoint = ?", u.ID, ep).Delete(&model.PushSub{})
	dto.OK(c, gin.H{"ok": true})
}

// Mine GET /push/subs —— 当前用户订阅列表（设置页展示）
func (h *PushHandler) Mine(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var rows []model.PushSub
	model.DB.Where("user_id = ?", u.ID).Order("id DESC").Limit(50).Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		host := r.Endpoint
		if i := strings.Index(host, "://"); i > 0 {
			host = host[i+3:]
			if j := strings.Index(host, "/"); j > 0 {
				host = host[:j]
			}
		}
		out = append(out, gin.H{"id": r.ID, "host": host, "endpoint": r.Endpoint, "createdAt": r.CreatedAt})
	}
	dto.OK(c, gin.H{"subs": out})
}

// ---- 发送 ----

// pushNotifyPayload 推给 SW 的载荷（点击通知打开通知面板的深链）
type pushNotifyPayload struct {
	Title   string `json:"title"`
	Body    string `json:"body"`
	Type    string `json:"type"`
	Tag     string `json:"tag"`
}

// pushUser 站内通知落库后异步推给该用户全部订阅；错误只记日志（脱敏：不打 endpoint 全串）
func pushUser(userID uint, p pushNotifyPayload) {
	var subs []model.PushSub
	if err := model.DB.Where("user_id = ?", userID).Find(&subs).Error; err != nil || len(subs) == 0 {
		return
	}
	body, _ := json.Marshal(&p)
	for _, s := range subs {
		if err := pushOne(s, body); err != nil {
			var se *pushGone
			if ok := asGone(err, &se); ok {
				model.DB.Delete(&model.PushSub{}, s.ID)
				log.Printf("[WebPush] 订阅已失效，已清理 user=%d host=%s", userID, subHost(s.Endpoint))
				continue
			}
			log.Printf("[WebPush] 推送失败 user=%d host=%s: %v", userID, subHost(s.Endpoint), err)
		}
	}
}

func subHost(ep string) string {
	if i := strings.Index(ep, "://"); i > 0 {
		ep = ep[i+3:]
		if j := strings.Index(ep, "/"); j > 0 {
			ep = ep[:j]
		}
	}
	return ep
}

type pushGone struct{ status int }

func (e *pushGone) Error() string { return fmt.Sprintf("推送端点 %d", e.status) }

func asGone(err error, target **pushGone) bool {
	if g, ok := err.(*pushGone); ok {
		*target = g
		return true
	}
	return false
}

func pushOne(s model.PushSub, payload []byte) error {
	priv, err := loadOrCreateVapid()
	if err != nil {
		return err
	}
	aud, _ := originOf(s.Endpoint)
	jwt, err := vapidJWT(priv, aud)
	if err != nil {
		return err
	}
	enc, err := webpushEncrypt(s, payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", s.Endpoint, bytes.NewReader(enc))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", "86400")
	req.Header.Set("Urgency", "normal")
	req.Header.Set("Authorization", "application/jwt="+jwt)
	cl := &http.Client{Timeout: 15 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, io.LimitReader(resp.Body, 512))
	if resp.StatusCode >= 400 && (resp.StatusCode == 404 || resp.StatusCode == 410) {
		return &pushGone{status: resp.StatusCode}
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("推送端点 %d", resp.StatusCode)
	}
	return nil
}

func originOf(endpoint string) (string, error) {
	i := strings.Index(endpoint, "://")
	if i < 0 {
		return "", fmt.Errorf("坏端点")
	}
	rest := endpoint[i+3:]
	j := strings.Index(rest, "/")
	if j < 0 {
		return endpoint[:i+3] + rest, nil
	}
	return endpoint[:i+3] + rest[:j], nil
}

// vapidJWT RFC 8292：ES256，claims {aud, exp, sub}
func vapidJWT(priv *ecdsa.PrivateKey, aud string) (string, error) {
	exp := time.Now().Add(12 * time.Hour).Unix()
	header := map[string]string{"alg": "ES256", "typ": "JWT"}
	claims := map[string]any{"aud": aud, "exp": exp, "sub": "https://github.com/johngko/cloudpan"}
	hb, _ := json.Marshal(header)
	cb, _ := json.Marshal(claims)
	signing := base64.RawURLEncoding.EncodeToString(hb) + "." + base64.RawURLEncoding.EncodeToString(cb)
	hash := sha256.Sum256([]byte(signing))
	r, s, err := ecdsa.Sign(rand.Reader, priv, hash[:])
	if err != nil {
		return "", err
	}
	// ES256 签名：r||s 各 32 字节定长
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return signing + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// webpushEncrypt RFC 8291（aes128gcm 内容编码，含 RFC 8188 固定块头）：
// salt(16) || rs(4B BE) || idlen(1)=65 || ua公钥(65) || ce公钥(65) || 密文记录
func webpushEncrypt(s model.PushSub, payload []byte) ([]byte, error) {
	uaPub, err := base64.RawURLEncoding.DecodeString(s.P256dh)
	if err != nil || len(uaPub) != 65 {
		return nil, fmt.Errorf("p256dh 非法")
	}
	authSecret, err := base64.RawURLEncoding.DecodeString(s.Auth)
	if err != nil || len(authSecret) < 16 {
		return nil, fmt.Errorf("auth 非法")
	}
	uaKeyE, err := ecdh.P256().NewPublicKey(uaPub)
	if err != nil {
		return nil, fmt.Errorf("p256dh 非法")
	}
	cePriv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	cePub := elliptic.Marshal(cePriv.Curve, cePriv.X, cePriv.Y) // 0x04||X||Y
	ceE, err := cePriv.ECDH()
	if err != nil {
		return nil, err
	}
	z, err := ceE.ECDH(uaKeyE) // 共享秘密（x-only 32B）
	if err != nil {
		return nil, err
	}
	salt := make([]byte, 16)
	rand.Read(salt)
	info := append([]byte("WebPush: info\x00"), uaPub...)
	info = append(info, cePub...)
	ikm, err := hkdf.Key(sha256.New, z, authSecret, string(info), 32)
	if err != nil {
		return nil, err
	}
	cek, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		return nil, err
	}
	nonce, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		return nil, err
	}
	// RFC 8188 记录：明文按 rs-16 分块，每块后接分隔符（0x01 续 / 0x02 末），整条 AES-GCM
	var plain []byte
	chunk := pushRecordSize - 16
	for off := 0; ; off += chunk {
		end := off + chunk
		if end >= len(payload) {
			plain = append(plain, payload[off:]...)
			plain = append(plain, 0x02)
			break
		}
		plain = append(plain, payload[off:end]...)
		plain = append(plain, 0x01)
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ct := gcm.Seal(nil, nonce, plain, nil)
	out := bytes.NewBuffer(nil)
	out.Write(salt)
	var rs [4]byte
	binary.BigEndian.PutUint32(rs[:], pushRecordSize)
	out.Write(rs[:])
	out.WriteByte(65)
	out.Write(uaPub)
	out.Write(cePub)
	out.Write(ct)
	return out.Bytes(), nil
}

