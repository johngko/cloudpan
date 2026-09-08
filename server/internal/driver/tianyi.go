package driver

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

// Tianyi 天翼云盘驱动（实验性：社区逆向接口，结构预留，待授权流程联调后启用）
type Tianyi struct {
	idMu   sync.Mutex
	http   *http.Client
	Cookie string
}

func NewTianyi(p *model.Policy) (fscore.Driver, error) {
	o := p.Opts()
	if o["cookie"] == "" {
		return nil, fmt.Errorf("天翼云盘为实验性驱动：需在存储策略中粘贴网页版 Cookie（会话过期后需更新）")
	}
	return &Tianyi{Cookie: o["cookie"], http: &http.Client{Timeout: 120000000000}}, nil
}

func (d *Tianyi) notReady() error {
	return fmt.Errorf("天翼云盘实验性驱动：接口联调中，当前仅支持挂载校验")
}

func (d *Tianyi) List(dir string) ([]fscore.Entry, error)              { return nil, d.notReady() }
func (d *Tianyi) Stat(p string) (*fscore.Entry, error)                 { return nil, d.notReady() }
func (d *Tianyi) Mkdir(dir string) error                               { return d.notReady() }
func (d *Tianyi) Rename(p, n string) error                             { return d.notReady() }
func (d *Tianyi) Move(s, dd string) error                              { return d.notReady() }
func (d *Tianyi) Copy(s, dd string) error                              { return d.notReady() }
func (d *Tianyi) Delete(p string) error                                { return d.notReady() }
func (d *Tianyi) Open(p string) (fscore.ReadSeekCloser, error)         { return nil, d.notReady() }
func (d *Tianyi) DirectURL(p string) (string, error)                   { return "", d.notReady() }
func (d *Tianyi) CreateFile(p string, r io.Reader) error               { return d.notReady() }
func (d *Tianyi) Quota() (int64, int64, error)                         { return 0, 0, d.notReady() }
func (d *Tianyi) Capabilities() fscore.Cap                             { return fscore.Cap{} }
func (d *Tianyi) invalidate(vp string)                                 { d.idMu.Lock(); d.idMu.Unlock() }

var (
	_ = os.Stat
	_ = path.Join
	_ = strings.TrimSpace
	_ = http.MethodGet
	_ = model.Policy{}
	_ = fscore.Cap{}
)
