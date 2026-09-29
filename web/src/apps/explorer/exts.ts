// Explorer 使用的扩展名清单（单一事实来源：图标映射与预览判定共用同一份）

/**
 * 可在线浏览/解压的压缩包格式（含目录表）。
 * 单独 .gz/.bz2/.xz（非 tar 族）无目录表不可浏览，仍走下载/解压。
 */
export const ARCHIVE_EXTS = ['zip', '7z', 'rar', 'tar', 'tgz', 'tbz2', 'txz']

/** 可生成缩略图的图片格式（svg 除外由服务端按类型处理） */
export const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']