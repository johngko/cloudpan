// Explorer 路径纯逻辑：虚拟路径拼接 / 共享虚拟盘路径解析
// （从 Explorer.vue 抽出，便于单测与复用）

/** 拼接父目录与子名（父恒以 / 开头；父为根时不产生双斜杠） */
export function joinPath(a: string, b: string): string { return (a === '/' ? '' : a) + '/' + b }

/**
 * 共享虚拟盘路径编码（与 Explorer 的 SHARED_POLICY 约定一致）：
 *   '/'        = 共享根（共享给我列表）
 *   '/s{id}'   = 某共享的根
 *   '/s{id}/x' = 共享内相对路径 x
 * 非共享路径返回 null（调用方据此判断是否走 /shared/:id/* 端点）
 */
export function sharedPathParse(p: string): { shareId: number; rel: string } | null {
  const m = /^\/s(\d+)(?:\/(.*))?$/.exec(p)
  return m ? { shareId: Number(m[1]), rel: m[2] || '' } : null
}