<template>
  <!-- Win12 主题：优先使用 Windows 风格原版图标（/icons/win12/） -->
  <img v-if="imgSrc" :src="imgSrc" :width="size" :height="size" style="display: block" draggable="false" alt="" />
  <svg v-else :width="size" :height="size" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
    :style="{ display: 'block' }" v-html="path"></svg>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'
import { useSession } from '../stores/session'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 24 })

// Win12 主题图标映射（应用/文件类型用 Windows 风格 SVG/PNG；
// 未列出的名字回落自绘 tile/线条图标，其他主题不受影响）
const WIN12_ICONS: Record<string, string> = {
  explorer: 'explorer.svg',
  thispc: 'apps/explorer/thispc.svg',
  drive: 'apps/explorer/disk.svg',
  folder: 'apps/explorer/folder.svg',
  notepad: 'notepad.svg',
  terminal: 'terminal.svg',
  calculator: 'calc.svg',
  settings: 'setting.svg',
  appstore: 'msstore.svg',
  admin: 'defender.svg',
  office: 'office.png',
  media: 'files/music.png',
  image: 'files/img.png',
  video: 'files/vidio.png',
  music: 'files/music.png',
  user: 'user.svg',
  cloud: 'logo.svg',
  windows12: 'windows12.svg',
  // 文件类型（Explorer iconOf 在 win12 主题下按扩展名返回）
  fileFolder: 'apps/explorer/folder.svg',
  fileWord: 'files/word.png',
  fileExcel: 'files/excel.png',
  filePpt: 'files/ppt.png',
  filePdf: 'files/pdf.svg',
  fileMindmap: 'files/mindmap.svg',
  fileWhiteboard: 'files/whiteboard.svg',
  fileFlowchart: 'files/flowchart.svg',
  fileTxt: 'files/txt.png',
  fileImg: 'files/img.png',
  fileMusic: 'files/music.png',
  fileVidio: 'files/vidio.png',
  fileExe: 'files/exefile.png'
}
const session = useSession()
const imgSrc = computed(() =>
  session.osTheme === 'win12' && WIN12_ICONS[props.name] ? '/icons/win12/' + WIN12_ICONS[props.name] : undefined)

// 渐变 id 必须每个组件实例唯一（同页 20+ 图标共享 id 时，所有 url(#g*) 会解析到
// 文档中第一个渐变 → 全部 tile 变成第一个图标的颜色）。用 Vue 实例 uid：
// 每实例唯一、同实例重渲染稳定（不能放 computed 里自增）。
let seq = 0
const uid = String(getCurrentInstance()?.uid ?? ++seq)

// ---- 应用图标：鲜艳品牌色 tile + 白色 glyph（真实 OS 的通用形态）----
// tile 模板：21×21 圆角方块（rx 5）+ 高饱和对角渐变底 + 光泽层（顶部白色高光 → 底部微暗，
// 模拟真实 OS 图标的立体感）+ 居中加粗白色线条 glyph（stroke 2.1，小尺寸也清晰）。
// 渐变 id 用占位 __G__/__H__，渲染时替换为实例唯一 id（uid 见文件顶部）。
const tile = (c1: string, c2: string, glyph: string, extra = '') =>
  `<defs><linearGradient id="__G__" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
  `<linearGradient id="__H__" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#000000" stop-opacity="0.14"/></linearGradient></defs>` +
  `<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="url(#__G__)"${extra}/>` +
  `<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="url(#__H__)"/>` +
  `<g stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none">${glyph}</g>`

const apps: Record<string, string> = {
  // 开始按钮 = 平涂四格（accent 色，由使用处 CSS color 决定；真实 Win11 开始按钮即 accent 单色）
  windows: `<g fill="currentColor"><rect x="3.2" y="3.2" width="8.2" height="8.2" rx="0.6"/><rect x="12.6" y="3.2" width="8.2" height="8.2" rx="0.6"/><rect x="3.2" y="12.6" width="8.2" height="8.2" rx="0.6"/><rect x="12.6" y="12.6" width="8.2" height="8.2" rx="0.6"/></g>`,

  folder: tile('#ffd95e', '#ff9d00',
    `<path d="M6.6 16.4v-6a1 1 0 0 1 1-1h3.1l1.5 1.8h4.2a1 1 0 0 1 1 1v4.2a1 1 0 0 1-1 1H7.6a1 1 0 0 1-1-1z"/>`),
  explorer: tile('#55b9ff', '#2478e8',
    `<rect x="6.8" y="7.8" width="10.4" height="8.4" rx="1.1"/><path d="M6.8 10.6h10.4"/><path d="M8.6 8.7h.01M10.4 8.7h.01" stroke-width="1.6"/>`),
  thispc: tile('#9fd4ff', '#4a8fe0',
    `<rect x="6.4" y="7.4" width="11.2" height="7.6" rx="1.1"/><path d="M12 15v2.4M9.2 17.4h5.6"/>`),
  recycle: tile('#a8b8cc', '#5f7291',
    `<path d="M7.4 9.2h9.2M10.6 9.2V8a1 1 0 0 1 1-1h.8a1 1 0 0 1 1 1v1.2M8.6 9.2l.5 7a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.5-7"/><path d="M10.9 11.6v3.2M13.1 11.6v3.2" stroke-width="1.8"/>`),
  notepad: tile('#ffe06e', '#ffab00',
    `<rect x="7.8" y="6.8" width="8.4" height="10.4" rx="1.1"/><path d="M10.1 10.2h3.8M10.1 12.6h3.8M10.1 15h2.2" stroke-width="1.8"/>`),
  terminal: tile('#4a5d92', '#202c52',
    `<path d="M8 9.2l3.1 2.8-3.1 2.8"/><path d="M12.8 15.4H16"/>`),
  calculator: tile('#ffffff', '#dfeaf8',
    `<circle cx="9.6" cy="9.6" r="1.5" fill="#5a6b84" stroke="none"/><circle cx="14.4" cy="9.6" r="1.5" fill="#5a6b84" stroke="none"/><circle cx="9.6" cy="14.4" r="1.5" fill="#5a6b84" stroke="none"/><circle cx="14.4" cy="14.4" r="1.5" fill="#f59e0b" stroke="none"/>`,
    ` stroke="rgba(15,30,55,0.22)" stroke-width="1"`),
  settings: tile('#c3cfdd', '#7e90a8',
    `<circle cx="12" cy="12" r="3.3"/><path d="M12 6.4v1.8M12 15.8v1.8M6.4 12h1.8M15.8 12h1.8M8 8l1.3 1.3M14.7 14.7L16 16M16 8l-1.3 1.3M9.3 14.7L8 16" stroke-width="1.9"/>`),
  admin: tile('#8b8ff8', '#4348e0',
    `<path d="M12 6.6l4.7 1.9v3.4c0 3-2 5.4-4.7 6.2-2.7-.8-4.7-3.2-4.7-6.2V8.5L12 6.6z"/><path d="M10 11.9l1.5 1.5 2.7-3.1" stroke-width="1.9"/>`),
  image: tile('#58e6c8', '#12b08f',
    `<rect x="6.8" y="7.8" width="10.4" height="8.4" rx="1.1"/><circle cx="9.9" cy="10.7" r="1" stroke-width="1.7"/><path d="M7.4 15.2l2.9-2.7 2 1.9 1.8-1.7 2.5 2.3" stroke-width="1.9"/>`),
  media: tile('#ff95cc', '#a06cf8',
    `<path d="M10.2 8.6l5.2 3.4-5.2 3.4V8.6z" fill="#ffffff" stroke="none"/>`),
  office: tile('#6fc0ff', '#2f7ce8',
    `<path d="M8.4 6.8H13l3 3v7.1a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1V7.8a1 1 0 0 1 1-1z"/><path d="M13 6.8v3h3"/><path d="M10.2 13.4h3.6M10.2 15.6h2.4" stroke-width="1.8"/>`),
  share: tile('#6ee88f', '#1fa84f',
    `<circle cx="8.9" cy="12" r="1.7"/><circle cx="15.2" cy="8.4" r="1.7"/><circle cx="15.2" cy="15.6" r="1.7"/><path d="M10.4 11.1l3.3-2M10.4 12.9l3.3 2" stroke-width="1.8"/>`),
  drive: tile('#4f7fd9', '#27479c',
    `<rect x="6.6" y="9" width="10.8" height="6" rx="1.2"/><path d="M8.8 12h3" stroke-width="1.8"/><circle cx="14.6" cy="12" r="0.9" fill="#ffffff" stroke="none"/>`),
  video: tile('#ffb457', '#f4511e',
    `<path d="M10.2 8.6l5.2 3.4-5.2 3.4V8.6z" fill="#ffffff" stroke="none"/>`),
  music: tile('#6ec9ff', '#5a6cf5',
    `<path d="M10.2 15.4V8.8l4.6-1.1v5.9"/><circle cx="8.5" cy="15.4" r="1.7"/><circle cx="13.1" cy="13.6" r="1.7"/>`),
  appstore: tile('#5ac8fa', '#0a84ff',
    `<path d="M8.3 16.6L12 7.4l3.7 9.2"/><path d="M9.5 13.3h5"/>`),
  speedtest: tile('#22d3ee', '#2563eb',
    `<path d="M6.6 15.6a6.2 6.2 0 1 1 10.8 0"/><path d="M12 14l3.4-4"/><circle cx="12" cy="14" r="1.2" fill="#ffffff" stroke="none"/>`),
  tasks: tile('#ffb457', '#f0662e',
    `<path d="M7 7.6l1.2 1.2L10.4 6.4"/><path d="M7 12.6l1.2 1.2L10.4 11.4"/><path d="M7 17.6l1.2 1.2L10.4 16.4" stroke-width="1.8"/><path d="M12.8 8h4M12.8 13h4M12.8 18h4" stroke-width="1.8"/>`),
  wallpapers: tile('#7ee0c3', '#1e88e5',
    `<rect x="5.6" y="6.4" width="12.8" height="11.2" rx="1.4"/><circle cx="9.4" cy="9.8" r="1.1" stroke-width="1.7"/><path d="M6.4 15.8l3.6-3.4 2.6 2.4 2.6-2.6 3.4 3.4" stroke-width="1.9"/>`),
  browser: tile('#4aa3ff', '#1d4ed8',
    `<circle cx="12" cy="12" r="5.7" stroke-width="1.8"/><path d="M6.3 12h11.4M12 6.3c1.8 1.6 2.7 3.5 2.7 5.7s-.9 4.1-2.7 5.7c-1.8-1.6-2.7-3.5-2.7-5.7s.9-4.1 2.7-5.7z" stroke-width="1.8"/>`),
  archive: tile('#ffd36e', '#e8890c',
    `<rect x="6.4" y="5.6" width="11.2" height="4.6" rx="1.1"/><path d="M7.4 10.2v6.4a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4v-6.4"/><path d="M10.3 12.8h3.4M12 10.2v2.6" stroke-width="1.7"/>`),
  mindmap: tile('#c79bff', '#7c3aed',
    `<rect x="9.6" y="10.4" width="4.8" height="3.2" rx="1.6" fill="#ffffff" stroke="none"/><circle cx="7" cy="8" r="1.6" fill="#ffffff" stroke="none"/><circle cx="17" cy="8" r="1.6" fill="#ffffff" stroke="none"/><circle cx="7" cy="16" r="1.6" fill="#ffffff" stroke="none"/><circle cx="17" cy="16" r="1.6" fill="#ffffff" stroke="none"/><path d="M8.6 8.8L10.8 10.4M15.4 8.8L13.2 10.4M8.6 15.2l2.2-1.6M15.4 15.2l-2.2-1.6" stroke-width="1.6"/>`),
  whiteboard: tile('#7ee8fa', '#0891b2',
    `<rect x="5.8" y="6.8" width="12.4" height="9" rx="1.2"/><path d="M8.4 12.6l2.2-2.4 1.7 1.7 2.4-3 2.4 3" stroke-width="1.7"/><path d="M9.4 17.6l2.2-2.4" stroke-width="1.7"/><circle cx="15.8" cy="17.9" r="0.9" fill="#ffffff" stroke="none"/>`),
  flowchart: tile('#ffb457', '#ea580c',
    `<rect x="8.4" y="5.8" width="7.2" height="3.2" rx="0.8"/><path d="M12 9v2" stroke-width="1.7"/><path d="M12 11l2.7 2.7L12 16.4l-2.7-2.7L12 11z"/><path d="M12 16.4v1.4" stroke-width="1.7"/><rect x="8.4" y="17.8" width="7.2" height="2.6" rx="0.8"/>`),
  imageedit: tile('#6ee88f', '#15803d',
    `<rect x="5.8" y="6.8" width="12.4" height="9" rx="1.2"/><circle cx="9" cy="10" r="1" stroke-width="1.6"/><path d="M6.6 14.6l2.6-2.5 1.9 1.8 1.7-1.6 2.2 2" stroke-width="1.7"/><path d="M8 18.4h8" stroke-width="1.7"/><circle cx="10.4" cy="18.4" r="1.1" fill="#ffffff" stroke="none"/>`),
  pdfreader: tile('#ff9a8a', '#dc2626',
    `<path d="M8 6.4h5l3 3v8.2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1z"/><path d="M13 6.4v3h3"/><circle cx="10.6" cy="12.6" r="1.9" stroke-width="1.7"/><path d="M12 14l1.6 1.6" stroke-width="1.7"/>`),

  // 品牌 logo（开机/登录/菜单栏）：自由形态云朵，非 tile
  cloud: `<defs><linearGradient id="__G__" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#2f86d6"/></linearGradient></defs><path d="M7 18.6a4.4 4.4 0 0 1-.6-8.7 5.7 5.7 0 0 1 11.2 1.2 3.8 3.8 0 0 1-.4 7.5H7z" fill="url(#__G__)"/>`,
}

// ---- 单色 UI 图标：描边宽度由 CSS .i-sw { stroke-width: var(--icon-sw) } 按主题控制 ----
// 子元素自带的 stroke-width 属性（如 info/pause 的加粗笔画）优先于继承，保留强调
const S = (inner: string) =>
  `<g class="i-sw" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none">${inner}</g>`

const ui: Record<string, string> = {
  link: S(`<path d="M9.5 14.5l5-5"/><path d="M11 6.5l1.8-1.8a4 4 0 0 1 5.6 5.6L16.5 12"/><path d="M13 17.5l-1.8 1.8a4 4 0 0 1-5.6-5.6L7.5 12"/>`),
  search: S(`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>`),
  power: S(`<path d="M12 3v8"/><path d="M7.2 6.2a7.5 7.5 0 1 0 9.6 0"/>`),
  wifi: S(`<path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.4a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="0.8" fill="currentColor"/>`),
  volume: S(`<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" opacity="0.9"/>`),
  bell: S(`<path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>`),
  back: S(`<path d="M15 5l-7 7 7 7"/>`),
  fwd: S(`<path d="M9 5l7 7-7 7"/>`),
  up: S(`<path d="M5 11l7-7 7 7M12 4.5V20"/>`),
  down: S(`<path d="M5 13l7 7 7-7M12 19.5v-16"/>`),
  refresh: S(`<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4"/>`),
  upload: S(`<path d="M12 16V4.5M7 9.5l5-5 5 5"/><path d="M4.5 20h15"/>`),
  download: S(`<path d="M12 4v11.5M7 11l5 5 5-5"/><path d="M4.5 20h15"/>`),
  share2: S(`<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="M8.2 10.9l7-3.8M8.2 13.1l7 3.8"/>`),
  star: S(`<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>`),
  starFill: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" fill="#f7c948" stroke="#e8a823" stroke-width="0.8" stroke-linejoin="round"/>`,
  cut: S(`<circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M8.5 16.2L17 4M15.5 16.2L7 4"/>`),
  copy: S(`<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"/>`),
  paste: S(`<rect x="5" y="5" width="14" height="15.5" rx="1.5"/><rect x="9" y="3" width="6" height="4" rx="1"/>`),
  rename: S(`<path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5z"/><path d="M12.5 7.5l4 4"/>`),
  trash: S(`<path d="M5 7h14M10 4h4M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>`),
  grid: S(`<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>`),
  list: S(`<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="0.9" fill="currentColor"/><circle cx="5" cy="12" r="0.9" fill="currentColor"/><circle cx="5" cy="18" r="0.9" fill="currentColor"/>`),
  preview: S(`<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3.5 15.5l4.2-4.2 3.3 3.2 4.3-4.3 4.7 4.6"/><circle cx="9" cy="9" r="1.7"/>`),
  folderPlain: S(`<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17V7.5z"/>`),
  file: S(`<path d="M6.5 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13 3.5V8h4.5"/>`),
  close: S(`<path d="M6 6l12 12M18 6L6 18"/>`),
  min: S(`<path d="M5 12h14"/>`),
  max: S(`<rect x="6" y="6" width="12" height="12" rx="1"/>`),
  plus: S(`<path d="M12 5v14M5 12h14"/>`),
  check: S(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`),
  user: S(`<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>`),
  lock: S(`<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`),
  info: S(`<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8h.01" stroke-width="1.8"/>`),
  play: S(`<path d="M8 6l10 6-10 6V6z" fill="currentColor" stroke="none"/>`),
  openwith: S(`<rect x="4.5" y="4.5" width="7" height="7" rx="1.2"/><rect x="12.5" y="12.5" width="7" height="7" rx="1.2"/><path d="M11 8h3a2 2 0 0 1 2 2v3"/>`),
  pause: S(`<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.4"/>`),
  edit: S(`<path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5z"/>`),
  archive: S(`<rect x="4" y="4" width="16" height="5" rx="1"/><path d="M5.5 9v9.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>`),
  logout: S(`<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M10.5 12H20M17 8.5L20.5 12 17 15.5"/>`),
  sun: S(`<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>`),
  rotate2: S(`<path d="M4 12a8 8 0 1 1 2.5 5.8M4 20v-4h4"/>`),
  rotate: S(`<path d="M20 12a8 8 0 1 0-2.3 5.6M20 20v-4.5h-4.5"/><path d="M9 12l2.4 2.4L16 9.8" stroke-width="1.8"/>`),
  rotateR: S(`<path d="M4 12a8 8 0 1 1 2.3 5.6M4 20v-4.5h4.5"/><path d="M15 12l-2.4 2.4L8 9.8" stroke-width="1.8"/>`),
  flip: S(`<path d="M12 3.5v17M8 7.5L4.5 12 8 16.5M16 7.5L19.5 12 16 16.5"/>`),
  flipH: S(`<path d="M12 4v16" stroke-dasharray="2.4 2.2"/><path d="M9 8.5L5.5 12 9 15.5z" fill="currentColor" stroke="none"/><path d="M15 8.5L18.5 12 15 15.5z"/>`),
  flipV: S(`<path d="M4 12h16" stroke-dasharray="2.4 2.2"/><path d="M8.5 9L12 5.5 15.5 9z" fill="currentColor" stroke="none"/><path d="M8.5 15L12 18.5 15.5 15z"/>`),
  expand: S(`<path d="M4 9V4.5h5M15 4.5h5V9M20 15v4.5h-5M9 19.5H4V15"/>`)
}

const path = computed(() => {
  const raw = apps[props.name] || ui[props.name] || ui.file
  if (raw.includes('__G__') || raw.includes('__H__')) {
    return raw.replaceAll('__G__', 'g' + uid).replaceAll('__H__', 'h' + uid)
  }
  return raw
})
</script>
