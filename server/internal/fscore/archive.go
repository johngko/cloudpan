package fscore

import (
	"archive/tar"
	"archive/zip"
	"compress/bzip2"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/bodgit/sevenzip"
	"github.com/mholt/archives"
	"github.com/ulikunitz/xz"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

// ArchEntry 归档内单个条目（扁平列表，目录树由前端本地推导）
type ArchEntry struct {
	Name  string `json:"name"`  // 包内相对路径（斜杠分隔、无前导 /，无尾斜杠）
	Size  int64  `json:"size"`  // 未压缩字节数
	Mtime int64  `json:"mtime"` // unix 秒
	IsDir bool   `json:"isDir"`
}

// ArchMeta 归档元信息
type ArchMeta struct {
	Format   string `json:"format"` // zip | 7z | tar
	Compress string `json:"compress"` // "" | gzip | bzip2 | xz（仅 tar）
}

// ZipEncodings zip 文件名编码（hdr.NonUTF8 时按所选编码解码；空 = 不转码）
var ZipEncodings = map[string]encoding.Encoding{
	"gbk":          simplifiedchinese.GBK,
	"gb18030":      simplifiedchinese.GB18030,
	"big5":         traditionalchinese.Big5,
	"shiftjis":     japanese.ShiftJIS,
	"euckr":        korean.EUCKR,
	"cp936":        simplifiedchinese.GBK,
	"windows-1252": charmap.Windows1252,
	"iso-8859-1":   charmap.ISO8859_1,
}

// ArchiveKindOf 按扩展名判定归档族：zip | 7z | rar | tar（含 tar.gz/tgz/tar.bz2/tbz2/tar.xz/txz）| ""
func ArchiveKindOf(vp string) string {
	low := strings.ToLower(vp)
	switch {
	case strings.HasSuffix(low, ".zip"):
		return "zip"
	case strings.HasSuffix(low, ".7z"):
		return "7z"
	case strings.HasSuffix(low, ".rar"):
		return "rar"
	case strings.HasSuffix(low, ".tar") || strings.HasSuffix(low, ".tar.gz") || strings.HasSuffix(low, ".tgz") ||
		strings.HasSuffix(low, ".tar.bz2") || strings.HasSuffix(low, ".tbz2") ||
		strings.HasSuffix(low, ".tar.xz") || strings.HasSuffix(low, ".txz"):
		return "tar"
	}
	return ""
}

// ArchiveCheckPath 归档条目路径安全校验：拒绝绝对路径 / .. 段 / NUL / 反斜杠
// （允许 "a..b.txt" 这类合法文件名；与 ExtractZip/ExtractTar 的既有校验一致）
func ArchiveCheckPath(name string) error {
	if strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\x00\\") {
		return errors.New("归档内包含非法路径")
	}
	for _, seg := range strings.Split(name, "/") {
		if seg == ".." {
			return errors.New("归档内包含非法路径")
		}
	}
	return nil
}

// normalizeArchiveName 归档条目名规整：反斜杠转正斜杠、去 "./" 前缀与尾斜杠
func normalizeArchiveName(name string) string {
	name = filepath.ToSlash(name)
	name = strings.TrimPrefix(name, "./")
	name = strings.TrimSuffix(name, "/")
	return name
}

// matchMask 条目匹配：mask 空 = 全部；尾 "/" = 该目录子树（含目录本身）；否则 = 精确文件
func matchMask(name, mask string) bool {
	if mask == "" {
		return true
	}
	if strings.HasSuffix(mask, "/") {
		return name == strings.TrimSuffix(mask, "/") || strings.HasPrefix(name, mask)
	}
	return name == mask
}

// extractRootOf 默认解压根目录：归档所在目录下的同名文件夹（剥离全部归档后缀）
func extractRootOf(arcVP string) (string, error) {
	parent := arcVP[:strings.LastIndex(arcVP, "/")]
	if parent == "" {
		parent = "/"
	}
	rootName := path.Base(arcVP)
	for _, suf := range []string{".tar.gz", ".tar.bz2", ".tar.xz", ".tgz", ".tbz2", ".txz", ".zip", ".7z", ".rar", ".tar"} {
		rootName = strings.TrimSuffix(rootName, suf)
	}
	if rootName == "" || rootName == "." {
		rootName = "extracted"
	}
	return Join(parent, rootName)
}

// copyToTmp 把归档完整复制到临时区（zip/7z 需要可寻址读取）；返回临时文件路径，调用方负责删除
func (s *Service) copyToTmp(d Driver, vp, pattern string) (string, error) {
	rc, err := d.Open(vp)
	if err != nil {
		return "", err
	}
	defer rc.Close()
	if err := os.MkdirAll(s.ZipTmp, 0o755); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(s.ZipTmp, pattern)
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	if err := copyArchiveInput(rc, tmp); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return "", err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return "", err
	}
	return tmpPath, nil
}

// decodeZipName 按所选编码解码 zip 非 UTF-8 文件名（解码失败保留原名）
func decodeZipName(name string, nonUTF8 bool, enc encoding.Encoding) string {
	if nonUTF8 && enc != nil {
		if s, err := enc.NewDecoder().String(name); err == nil {
			return s
		}
	}
	return name
}

// openZipReader 打开归档的 zip 读取器（经临时区）；返回 (reader, 关闭函数)
func (s *Service) openZipReader(d Driver, vp string) (*zip.Reader, func(), error) {
	tmpPath, err := s.copyToTmp(d, vp, "archive-*.zip")
	if err != nil {
		return nil, nil, err
	}
	zf, err := os.Open(tmpPath)
	if err != nil {
		os.Remove(tmpPath)
		return nil, nil, err
	}
	fi, err := zf.Stat()
	if err != nil {
		zf.Close()
		os.Remove(tmpPath)
		return nil, nil, err
	}
	zr, err := zip.NewReader(zf, fi.Size())
	if err != nil {
		zf.Close()
		os.Remove(tmpPath)
		return nil, nil, errors.New("不是有效的 zip 文件")
	}
	closeFn := func() {
		zf.Close()
		os.Remove(tmpPath)
	}
	return zr, closeFn, nil
}

// open7zReader 打开归档的 7z 读取器（经临时区，支持密码）
func (s *Service) open7zReader(d Driver, vp, password string) (*sevenzip.Reader, func(), error) {
	tmpPath, err := s.copyToTmp(d, vp, "archive-*.7z")
	if err != nil {
		return nil, nil, err
	}
	zf, err := os.Open(tmpPath)
	if err != nil {
		os.Remove(tmpPath)
		return nil, nil, err
	}
	fi, err := zf.Stat()
	if err != nil {
		zf.Close()
		os.Remove(tmpPath)
		return nil, nil, err
	}
	var r *sevenzip.Reader
	if password != "" {
		r, err = sevenzip.NewReaderWithPassword(zf, fi.Size(), password)
	} else {
		r, err = sevenzip.NewReader(zf, fi.Size())
	}
	if err != nil {
		zf.Close()
		os.Remove(tmpPath)
		return nil, nil, errors.New("不是有效的 7z 文件（若加密请提供密码）")
	}
	closeFn := func() {
		zf.Close()
		os.Remove(tmpPath)
	}
	return r, closeFn, nil
}

// openTarReader 按魔数打开 tar 族读取器（plain/gzip/bzip2/xz），返回 (tarReader, 压缩类型, 底层关闭函数)
func openTarReader(rc ReadSeekCloser) (*tar.Reader, string, error) {
	head := make([]byte, 6)
	if _, err := io.ReadFull(rc, head); err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return nil, "", errors.New("归档文件不可读")
	}
	if _, err := rc.Seek(0, io.SeekStart); err != nil {
		return nil, "", errors.New("归档文件不支持定位")
	}
	var reader io.Reader = rc
	compress := ""
	switch {
	case len(head) >= 2 && head[0] == 0x1f && head[1] == 0x8b:
		gz, err := gzip.NewReader(rc)
		if err != nil {
			return nil, "", errors.New("不是有效的 tar.gz 文件")
		}
		// 注意：不能在此 defer gz.Close()——gz 的生命周期必须覆盖整个 tar 读取过程，
		// 由调用方关闭外层 rc 即可（gz 持有 rc 引用）
		reader, compress = gz, "gzip"
	case len(head) >= 3 && head[0] == 'B' && head[1] == 'Z' && head[2] == 'h':
		reader, compress = bzip2.NewReader(rc), "bzip2"
	case len(head) == 6 && head[0] == 0xfd && head[1] == '7' && head[2] == 'z' && head[3] == 'X' && head[4] == 'Z' && head[5] == 0:
		xr, err := xz.NewReader(rc)
		if err != nil {
			return nil, "", errors.New("不是有效的 tar.xz 文件")
		}
		reader, compress = xr, "xz"
	}
	return tar.NewReader(reader), compress, nil
}

// ListArchive 列出归档内容（只读、不落盘）：zip（可选文件名编码）/ 7z（可选密码）/ tar 族
func (s *Service) ListArchive(d Driver, vp, encodingName, password string) (*ArchMeta, []ArchEntry, error) {
	switch ArchiveKindOf(vp) {
	case "zip":
		return s.listZip(d, vp, encodingName)
	case "7z":
		return s.list7z(d, vp, password)
	case "tar":
		return s.listTar(d, vp)
	}
	return nil, nil, errors.New("不支持的归档格式")
}

func (s *Service) listZip(d Driver, vp, encodingName string) (*ArchMeta, []ArchEntry, error) {
	var enc encoding.Encoding
	if encodingName != "" {
		var ok bool
		enc, ok = ZipEncodings[strings.ToLower(encodingName)]
		if !ok {
			return nil, nil, fmt.Errorf("不支持的文件名编码 %s", encodingName)
		}
	}
	zr, closeFn, err := s.openZipReader(d, vp)
	if err != nil {
		return nil, nil, err
	}
	defer closeFn()
	if len(zr.File) > extractMaxEntries {
		return nil, nil, errors.New("归档条目数超过 10 万，已拒绝列出")
	}
	entries := make([]ArchEntry, 0, len(zr.File))
	for _, f := range zr.File {
		name := normalizeArchiveName(f.Name)
		if name == "" {
			continue
		}
		name = decodeZipName(name, f.NonUTF8, enc)
		if err := ArchiveCheckPath(name); err != nil {
			continue // 非法条目跳过（解压时整体拒绝）
		}
		isDir := strings.HasSuffix(f.Name, "/") || f.FileInfo().IsDir()
		entries = append(entries, ArchEntry{
			Name:  name,
			Size:  int64(f.UncompressedSize64),
			Mtime: f.Modified.Unix(),
			IsDir: isDir,
		})
	}
	return &ArchMeta{Format: "zip"}, entries, nil
}

func (s *Service) list7z(d Driver, vp, password string) (*ArchMeta, []ArchEntry, error) {
	r, closeFn, err := s.open7zReader(d, vp, password)
	if err != nil {
		return nil, nil, err
	}
	defer closeFn()
	entries := []ArchEntry{}
	// sevenzip 无全量列表 API，按 fs.FS 语义从根目录递归遍历
	var walk func(dir string) error
	walk = func(dir string) error {
		f, err := r.Open(dir)
		if err != nil {
			return err
		}
		rd, ok := f.(fs.ReadDirFile)
		if !ok {
			f.Close()
			return errors.New("7z 目录不可读")
		}
		dirents, err := rd.ReadDir(-1)
		f.Close()
		if err != nil {
			return err
		}
		for _, de := range dirents {
			name := de.Name()
			if dir != "." {
				name = dir + "/" + name
			}
			if err := ArchiveCheckPath(name); err != nil {
				continue
			}
			info, err := de.Info()
			if err != nil {
				continue
			}
			if de.IsDir() {
				entries = append(entries, ArchEntry{Name: name, Mtime: info.ModTime().Unix(), IsDir: true})
				if len(entries) > extractMaxEntries {
					return errors.New("归档条目数超过 10 万，已拒绝列出")
				}
				if err := walk(name); err != nil {
					return err
				}
			} else {
				entries = append(entries, ArchEntry{Name: name, Size: info.Size(), Mtime: info.ModTime().Unix()})
				if len(entries) > extractMaxEntries {
					return errors.New("归档条目数超过 10 万，已拒绝列出")
				}
			}
		}
		return nil
	}
	if err := walk("."); err != nil {
		return nil, nil, err
	}
	return &ArchMeta{Format: "7z"}, entries, nil
}

func (s *Service) listTar(d Driver, vp string) (*ArchMeta, []ArchEntry, error) {
	rc, err := d.Open(vp)
	if err != nil {
		return nil, nil, err
	}
	defer rc.Close()
	tr, compress, err := openTarReader(rc)
	if err != nil {
		return nil, nil, err
	}
	entries := []ArchEntry{}
	n := 0
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, fmt.Errorf("tar 解析失败: %v", err)
		}
		name := normalizeArchiveName(hdr.Name)
		if name == "" {
			continue
		}
		if err := ArchiveCheckPath(name); err != nil {
			continue
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			entries = append(entries, ArchEntry{Name: name, Mtime: hdr.ModTime.Unix(), IsDir: true})
		case tar.TypeReg:
			n++
			if n > extractMaxEntries {
				return nil, nil, errors.New("归档条目数超过 10 万，已拒绝列出")
			}
			entries = append(entries, ArchEntry{Name: name, Size: hdr.Size, Mtime: hdr.ModTime.Unix()})
		}
	}
	return &ArchMeta{Format: "tar", Compress: compress}, entries, nil
}

// OpenArchiveEntry 流式打开归档内单个文件条目（在线预览/单文件下载用）。
// 返回 (读取器, 文件名, 未压缩大小)，调用方负责 Close。目录/不存在条目返回错误。
func (s *Service) OpenArchiveEntry(d Driver, vp, entryName, encodingName, password string) (ReadSeekCloser, string, int64, error) {
	entryName = normalizeArchiveName(entryName)
	if entryName == "" || entryName == "." {
		return nil, "", 0, errors.New("请指定归档条目")
	}
	if err := ArchiveCheckPath(entryName); err != nil {
		return nil, "", 0, err
	}
	base := path.Base(entryName)
	switch ArchiveKindOf(vp) {
	case "zip":
		var enc encoding.Encoding
		if encodingName != "" {
			var ok bool
			enc, ok = ZipEncodings[strings.ToLower(encodingName)]
			if !ok {
				return nil, "", 0, fmt.Errorf("不支持的文件名编码 %s", encodingName)
			}
		}
		zr, closeFn, err := s.openZipReader(d, vp)
		if err != nil {
			return nil, "", 0, err
		}
		for _, f := range zr.File {
			name := decodeZipName(normalizeArchiveName(f.Name), f.NonUTF8, enc)
			if name == entryName {
				if strings.HasSuffix(f.Name, "/") || f.FileInfo().IsDir() {
					closeFn()
					return nil, "", 0, errors.New("目录不能预览")
				}
				fr, err := f.Open()
				if err != nil {
					closeFn()
					return nil, "", 0, err
				}
				return &zipEntryReader{fr: fr, closeFn: closeFn}, base, int64(f.UncompressedSize64), nil
			}
		}
		closeFn()
		return nil, "", 0, os.ErrNotExist
	case "7z":
		r, closeFn, err := s.open7zReader(d, vp, password)
		if err != nil {
			return nil, "", 0, err
		}
		f, err := r.Open(entryName)
		if err != nil {
			closeFn()
			return nil, "", 0, os.ErrNotExist
		}
		info, err := f.Stat()
		if err != nil || info.IsDir() {
			f.Close()
			closeFn()
			return nil, "", 0, errors.New("目录不能预览")
		}
		return &sevenzipEntryReader{fr: f, closeFn: closeFn}, base, info.Size(), nil
	case "tar":
		rc, err := d.Open(vp)
		if err != nil {
			return nil, "", 0, err
		}
		tr, _, err := openTarReader(rc)
		if err != nil {
			rc.Close()
			return nil, "", 0, err
		}
		for {
			hdr, err := tr.Next()
			if err == io.EOF {
				rc.Close()
				return nil, "", 0, os.ErrNotExist
			}
			if err != nil {
				rc.Close()
				return nil, "", 0, fmt.Errorf("tar 解析失败: %v", err)
			}
			name := normalizeArchiveName(hdr.Name)
			if name == entryName && hdr.Typeflag == tar.TypeReg {
				return &tarEntryReader{tr: tr, left: hdr.Size, rc: rc}, base, hdr.Size, nil
			}
		}
	}
	return nil, "", 0, errors.New("不支持的归档格式")
}

// zipEntryReader zip 单条目流（Close 时连带关闭底层归档）
type zipEntryReader struct {
	fr      io.ReadCloser
	closeFn func()
}

func (r *zipEntryReader) Read(p []byte) (int, error) { return r.fr.Read(p) }
func (r *zipEntryReader) Seek(int64, int) (int64, error) {
	return 0, errors.New("归档条目流不支持定位")
}
func (r *zipEntryReader) Close() error {
	r.fr.Close()
	r.closeFn()
	return nil
}

// sevenzipEntryReader 7z 单条目流
type sevenzipEntryReader struct {
	fr      io.ReadCloser
	closeFn func()
}

func (r *sevenzipEntryReader) Read(p []byte) (int, error) { return r.fr.Read(p) }
func (r *sevenzipEntryReader) Seek(int64, int) (int64, error) {
	return 0, errors.New("归档条目流不支持定位")
}
func (r *sevenzipEntryReader) Close() error {
	r.fr.Close()
	r.closeFn()
	return nil
}

// tarEntryReader tar 单条目流（只读到该条目长度为止）
type tarEntryReader struct {
	tr   *tar.Reader
	left int64
	rc   io.Closer
}

func (r *tarEntryReader) Read(p []byte) (int, error) {
	if r.left <= 0 {
		return 0, io.EOF
	}
	if int64(len(p)) > r.left {
		p = p[:r.left]
	}
	n, err := r.tr.Read(p)
	r.left -= int64(n)
	return n, err
}
func (r *tarEntryReader) Seek(int64, int) (int64, error) {
	return 0, errors.New("归档条目流不支持定位")
}
func (r *tarEntryReader) Close() error { return r.rc.Close() }

// Extract7zOrRar 用 mholt/archives（纯 Go）解压 7z/rar，支持密码；
// 与 zip/tar 同一套资源上限、路径安全校验与 mask/dst 语义。返回写入总字节数。
func (s *Service) Extract7zOrRar(d Driver, arcVP, mask, dst, password string, onFile ZipEntryProgress) (int64, error) {
	tmpPath, err := s.copyToTmp(d, arcVP, "archive-extract-*")
	if err != nil {
		return 0, err
	}
	defer os.Remove(tmpPath)
	zf, err := os.Open(tmpPath)
	if err != nil {
		return 0, err
	}
	defer zf.Close()
	ctx := context.Background()
	format, readStream, err := archives.Identify(ctx, arcVP, zf)
	if err != nil {
		return 0, errors.New("无法识别的归档格式")
	}
	extractor, ok := format.(archives.Extractor)
	if !ok {
		return 0, errors.New("该归档格式不支持在线解压")
	}
	if sevenZip, ok := extractor.(archives.SevenZip); ok && password != "" {
		sevenZip.Password = password
		extractor = sevenZip
	}
	if rar, ok := extractor.(archives.Rar); ok && password != "" {
		rar.Password = password
		extractor = rar
	}
	rootVP := dst
	if rootVP == "" {
		rootVP, err = extractRootOf(arcVP)
		if err != nil {
			return 0, err
		}
	}
	flatMask := ""
	if mask != "" && !strings.HasSuffix(mask, "/") {
		flatMask = mask
	}
	_ = d.Mkdir(rootVP)
	var written int64
	n := 0
	err = extractor.Extract(ctx, readStream, func(_ context.Context, f archives.FileInfo) error {
		if n >= extractMaxEntries {
			return errors.New("归档条目数超过 10 万，已拒绝解压")
		}
		name := normalizeArchiveName(f.NameInArchive)
		if name == "" {
			return nil
		}
		if err := ArchiveCheckPath(name); err != nil {
			return err
		}
		var vp string
		if flatMask != "" {
			// 单文件平铺解压：只取该文件，直接落到目标目录
			if f.FileInfo.IsDir() || name != flatMask {
				return nil
			}
			vp, err = Clean(rootVP + "/" + path.Base(flatMask))
		} else {
			if !matchMask(name, mask) {
				return nil
			}
			vp, err = Clean(rootVP + "/" + name)
		}
		if err != nil {
			return nil
		}
		if !strings.HasPrefix(vp, rootVP+"/") {
			return nil // 路径逃逸兜底
		}
		if f.FileInfo.IsDir() {
			_ = d.Mkdir(vp)
			return nil
		}
		size := f.FileInfo.Size()
		if written+size > extractTotalCap {
			return fmt.Errorf("解压后总大小超过 20GB 上限，已拒绝")
		}
		fr, err := f.Open()
		if err != nil {
			return err
		}
		defer fr.Close()
		if err := d.CreateFile(vp, io.LimitReader(fr, size)); err != nil {
			return err
		}
		written += size
		n++
		if onFile != nil {
			return onFile(n, 0) // 总数未知：total 传 0（前端按「处理中」显示）
		}
		return nil
	})
	return written, err
}
