package handler

// C3 照片时间流：提取照片 EXIF 拍摄时间（DateTimeOriginal，回退 DateTime），
// 结果按 策略+路径 缓存进 file_exifs 表（size/mtime 变了才重读），
// /fs/photo-times 一次返回目录内全部照片的拍摄时间，前端按拍摄时间分组滚动。
// 纯手工解析（JPEG APP1 / PNG eXIf / WEBP EXIF chunk + 迷你 TIFF 解码），无第三方依赖。

import (
	"encoding/binary"
	"path"
	"strings"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

var exifImgExts = map[string]bool{"jpg": true, "jpeg": true, "png": true, "webp": true, "tif": true, "tiff": true}

const (
	exifWalkMax     = 5000 // 单次请求最多分析的照片数（防超大目录失控）
	exifWalkDepth   = 10
	exifReadLimit   = 128 << 10 // 只读文件头 128KB：EXIF 段都在前部
	exifDirWalkMax  = 2000
	exifDirWalkDept = 8
)

// PhotoTimes GET /fs/photo-times?policyId=&path= → {times: {vp: "2024:05:12 10:30:00"}}
func (h *SiteHandler) PhotoTimes(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	var files []string
	walkPhotos(d, vp, 0, &files)
	if len(files) == 0 {
		dto.OK(c, gin.H{"times": map[string]string{}})
		return
	}
	uid := middleware.CurrentUser(c).ID
	pid := h.policyIDOf(c)
	// 缓存命中即回；miss 的逐个读头解析后落库（缓存键含用户：本地盘虚拟路径按用户隔离）
	var cached []model.PhotoExif
	model.DB.Where("user_id = ? AND policy_id = ? AND path IN ?", uid, pid, files).Find(&cached)
	byPath := map[string]model.PhotoExif{}
	for _, r := range cached {
		byPath[r.Path] = r
	}
	times := map[string]string{}
	var fresh []model.PhotoExif
	for _, f := range files {
		e, err := d.Stat(f)
		if err != nil || e.IsDir {
			continue
		}
		if r, hit := byPath[f]; hit && r.Size == e.Size && r.ModTime == e.ModTime {
			if r.ShotTime != "" {
				times[f] = r.ShotTime
			}
			continue
		}
		rc, oerr := d.Open(f)
		if oerr != nil {
			continue
		}
		head := make([]byte, exifReadLimit)
		n, _ := readAtLeast(rc, head)
		rc.Close()
		shot := extractExifTime(head[:n])
		fresh = append(fresh, model.PhotoExif{UserID: uid, PolicyID: pid, Path: f, Size: e.Size, ModTime: e.ModTime, ShotTime: shot})
		if shot != "" {
			times[f] = shot
		}
	}
	if len(fresh) > 0 {
		// 重读（改名/重摄）覆盖旧行
		model.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "policy_id"}, {Name: "path"}},
			DoUpdates: clause.AssignmentColumns([]string{"size", "mod_time", "shot_time"}),
		}).CreateInBatches(&fresh, 500)
	}
	dto.OK(c, gin.H{"times": times})
}

// policyIDOf 从查询参数取 policyId（resolve 已校验，这里只为落缓存键）
func (h *SiteHandler) policyIDOf(c *gin.Context) uint {
	var in struct {
		PolicyID uint `form:"policyId"`
	}
	_ = c.ShouldBindQuery(&in)
	return in.PolicyID
}

// walkPhotos 递归收集照片（与图库前端的遍历上限对齐）
func walkPhotos(d fscore.Driver, dir string, depth int, out *[]string) {
	if depth > exifWalkDepth || len(*out) >= exifWalkMax {
		return
	}
	entries, err := d.List(dir)
	if err != nil {
		return
	}
	dirs := 0
	for _, e := range entries {
		if len(*out) >= exifWalkMax {
			return
		}
		full, _ := fscore.Join(dir, e.Name)
		if e.IsDir {
			dirs++
			if dirs <= exifDirWalkMax {
				walkPhotos(d, full, depth+1, out)
			}
		} else if exifImgExts[strings.ToLower(strings.TrimPrefix(path.Ext(e.Name), "."))] {
			*out = append(*out, full)
		}
	}
}

// readAtLeast 填满 buf（或 EOF），返回读取字节数
func readAtLeast(rc interface{ Read([]byte) (int, error) }, buf []byte) (int, error) {
	total := 0
	for total < len(buf) {
		n, err := rc.Read(buf[total:])
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// ---- EXIF 提取 ----

// extractExifTime 按容器定位 EXIF TIFF 块 → DateTimeOriginal（回退 DateTime）。
// 支持 JPEG（APP1 Exif）、PNG（eXIf chunk）、WEBP（EXIF chunk）、裸 TIFF。
func extractExifTime(b []byte) string {
	switch {
	case len(b) > 4 && b[0] == 0xFF && b[1] == 0xD8: // JPEG
		return exifFromJPEG(b)
	case len(b) > 8 && string(b[1:4]) == "PNG": // PNG
		return exifFromPNG(b)
	case len(b) > 12 && string(b[0:4]) == "RIFF" && string(b[8:12]) == "WEBP": // WEBP
		if i := indexOf(b, []byte("EXIF")); i >= 0 && i+8 <= len(b) {
			return exifFromTIFF(b[i+8:])
		}
	case len(b) > 8 && (string(b[0:2]) == "II" || string(b[0:2]) == "MM"): // TIFF
		return exifFromTIFF(b)
	}
	return ""
}

func indexOf(b []byte, pat []byte) int {
	for i := 0; i+len(pat) <= len(b); i++ {
		ok := true
		for j := range pat {
			if b[i+j] != pat[j] {
				ok = false
				break
			}
		}
		if ok {
			return i
		}
	}
	return -1
}

func exifFromJPEG(b []byte) string {
	i := 2
	for i+4 <= len(b) {
		if b[i] != 0xFF {
			i++
			continue
		}
		marker := b[i+1]
		// 独立标记（无长度域）
		if marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7) {
			i += 2
			continue
		}
		if marker == 0xD9 { // EOI
			break
		}
		segLen := int(binary.BigEndian.Uint16(b[i+2 : i+4]))
		if segLen < 2 || i+2+segLen > len(b) {
			break
		}
		if marker == 0xE1 { // APP1
			seg := b[i+4 : i+2+segLen]
			if len(seg) > 6 && string(seg[0:6]) == "Exif\x00\x00" {
				return exifFromTIFF(seg[6:])
			}
		}
		i += 2 + segLen
	}
	return ""
}

func exifFromPNG(b []byte) string {
	i := 8
	for i+8 <= len(b) {
		segLen := int(binary.BigEndian.Uint32(b[i : i+4]))
		typ := string(b[i+4 : i+8])
		if segLen < 0 || i+8+segLen > len(b) {
			break
		}
		if typ == "eXIf" {
			return exifFromTIFF(b[i+8 : i+8+segLen])
		}
		if typ == "IDAT" { // 图像数据开始，EXIF 必在其前
			break
		}
		i += 12 + segLen
	}
	return ""
}

// exifFromTIFF 迷你 TIFF：IFD0 → ExifIFD(0x8769) → DateTimeOriginal(0x9003)，回退 IFD0 DateTime(0x0132)
func exifFromTIFF(t []byte) string {
	if len(t) < 8 {
		return ""
	}
	var bo binary.ByteOrder
	if t[0] == 'I' && t[1] == 'I' {
		bo = binary.LittleEndian
	} else if t[0] == 'M' && t[1] == 'M' {
		bo = binary.BigEndian
	} else {
		return ""
	}
	at := func(o int, n int) (int, bool) {
		if o < 0 || o+n > len(t) {
			return 0, false
		}
		if n == 4 {
			return int(bo.Uint32(t[o : o+4])), true
		}
		return int(bo.Uint16(t[o : o+2])), true
	}
	ifd0, ok := at(4, 4)
	if !ok {
		return ""
	}
	exifIfdOff := 0
	dateTime := ""
	parseIFD := func(off int) {
		n, ok := at(off, 2)
		if !ok {
			return
		}
		for i := 0; i < n; i++ {
			e := off + 2 + i*12
			if e+12 > len(t) {
				return
			}
			tag := int(bo.Uint16(t[e : e+2]))
			typ := int(bo.Uint16(t[e+2 : e+4]))
			cnt, _ := at(e+4, 4)
			switch tag {
			case 0x8769: // ExifIFD 指针
				if v, ok := at(e+8, 4); ok {
					exifIfdOff = v
				}
			case 0x0132: // DateTime（IFD0）
				dateTime = asciiValue(t, bo, e+8, typ, cnt)
			}
		}
	}
	parseIFD(ifd0)
	if exifIfdOff > 0 {
		nn, ok := at(exifIfdOff, 2)
		if ok {
			for i := 0; i < nn; i++ {
				e := exifIfdOff + 2 + i*12
				if e+12 > len(t) {
					break
				}
				tag := int(bo.Uint16(t[e : e+2]))
				if tag == 0x9003 || tag == 0x9004 { // DateTimeOriginal / DateTimeDigitized
					cnt := int(bo.Uint32(t[e+4 : e+8]))
					if v := asciiValue(t, bo, e+8, int(bo.Uint16(t[e+2:e+4])), cnt); v != "" {
						return v
					}
				}
			}
		}
	}
	return dateTime
}

// asciiValue 读 ASCII 型 IFD 值：≤4 字节内联，否则按偏移读；去掉 NUL 终止符
func asciiValue(t []byte, bo binary.ByteOrder, entry8 int, typ, cnt int) string {
	if typ != 2 || cnt <= 0 {
		return ""
	}
	if cnt <= 4 {
		end := entry8 + cnt
		if end > len(t) {
			return ""
		}
		return strings.TrimSpace(strings.TrimRight(string(t[entry8:end]), "\x00"))
	}
	off := int(bo.Uint32(t[entry8 : entry8+4]))
	if off < 0 || off+cnt > len(t) {
		return ""
	}
	return strings.TrimSpace(strings.TrimRight(string(t[off:off+cnt]), "\x00"))
}
