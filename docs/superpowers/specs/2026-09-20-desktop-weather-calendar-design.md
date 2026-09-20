# 日历增强 + 桌面天气组件 设计

- 日期：2026-09-20
- 状态：已与用户确认（形态=中等卡片；范围=win12 + macOS + Deepin 三主题；方案=共享 weather store）
- 背景：用户反馈任务栏日历面板（`WinDateBox`，win12 独有）"没有天气、没有农历、没有国家公休假日"；并要求在桌面右上角加一个天气预报组件。

## 1. 现状

| 项 | 现状 |
|---|---|
| `WinDateBox.vue` | 任务栏时钟弹层（350×450），纯公历：时间 + 日期行 + 周一始日历，无农历/节假日/天气 |
| `utils/lunar.ts` | 已有 `dayInfo()`：农历短名、干支生肖年、法定节假日（含调休，`lunar-typescript` 内置数据，2026 可用、2027 暂无→静默降级）、传统节日、节气，带 `labelKind`（holiday/work/fest/jieqi） |
| `widgets/CalendarCard.vue` | 小组件面板里的日历，已按上述规则渲染副标签（可参照其配色/优先级规则） |
| `widgets/WxCard.vue` | Open-Meteo 天气卡（当前+逐时 8 格+15 天+AQI），8 个硬编码城市、`localStorage cp_wx_city`、WMO 映射、离线降级；目前只在小组件面板出现 |
| CSP | `connect-src` 已放行 `api.open-meteo.com` / `air-quality-api.open-meteo.com`，后端零改动 |
| 桌面右上角 | win12 / macOS / Deepin 三主题均空闲；挂载点为各主题 `.desktop` 根 div；geometry：win12 底 50、macOS 顶 24 底 78、Deepin 底 48 |

## 2. 架构

```
Open-Meteo (forecast + air-quality)
        │  fetch（10s / 8s 超时，30min TTL 缓存）
        ▼
stores/weather.ts  ──city──▶ localStorage cp_wx_city（沿用现有 8 城）
        │
        ├──▶ shell/WeatherWidget.vue（三主题桌面右上角天气卡）
        ├──▶ themes/windows/WinDateBox.vue（日历天气条）
        └──▶ themes/windows/widgets/WxCard.vue（小组件面板天气卡，重构接入）

utils/lunar.ts dayInfo() ──▶ WinDateBox 日历格副标签（农历/节假日/节气）
```

## 3. 详细设计

### 3.1 共享 weather store —— 新增 `web/src/stores/weather.ts`

- 状态：`city`、`status: 'idle'|'loading'|'ok'|'error'`、`err`、`current`（temp/feels/desc/icon/wind/windDir/humidity/aqi/high/low）、`hours`（未来 8 格 `{t,d,icon}`）、`days`（15 天 `{date,label,icon,p,lo,hi}`）、`updatedAt`。
- `load(force?)`：`status==='ok' && now-updatedAt<30min && !force` 时直接返回；否则 fetch forecast（URL 与现 WxCard 相同）→ 成功后独立 fetch air-quality（失败仅 `aqi=-1`）。失败置 `status='error'` + `err` 文案。用请求序号防竞态（沿用 WxCard 的 `reqSeq` 手法）。
- `setCity(name)`：写 `localStorage cp_wx_city` + `load(true)`。
- `refresh()`：`load(true)`。
- 无后台定时器；各消费方在挂载/面板打开时调 `load()`（TTL 命中则无网络开销）。

### 3.2 共享工具 —— 新增 `web/src/utils/weather.ts`

从 WxCard 抽出：8 城表（name/lat/lon）、`WMO` 码→中文、`wmoIcon(code, hour?)`、`WIND8` 风向换算。WxCard / WeatherWidget / WinDateBox 天气条共用。

### 3.3 日历增强 —— 改 `WinDateBox.vue` + `win.css` + `WinTaskBar.vue`

- 宽度 350 → **380px**；`WinTaskBar.positionPanel` 按面板取宽度（ctrl=350、datebox=380）。
- 头部自上而下：时间（35px，不变）→ 日期行 → **天气条** → 分隔线 → 日历格。
- 日期行追加农历（`dayInfo`）：`2026 年 9 月 20 日 星期日` 同行或下方一行小字 `丙午（马）年 八月初五`（今日 `label` 有节假日时一并显示，配色同 ClockCard 的 `clk-fest` 规则）。
- **天气条**：`{icon} {temp}° {desc} {low}~{high}° · {city}`；`status=loading` 显示"获取天气中…"，`error` 显示"天气暂不可用"。数据来自 store，面板打开时 `load()`（TTL 命中无请求）。
- 日历格加副标签：每格 `dayInfo(该日)`；优先级与 CalendarCard 一致——`labelKind=holiday` 红（节日名）/ `work` 蓝（"班"）/ `fest` 橙 / `jieqi` 绿 / 否则 `lunarShort` 灰；跨月格（out）只显示农历灰字。副标签字号 ~10px。
- 仅显示当月（现状无月份切换，不新增）；今日渐变高亮、周一始表头保持现状。

### 3.4 桌面天气卡 —— 新增 `web/src/shell/WeatherWidget.vue`

- 尺寸 ~300×210px；各主题 `.desktop` 内 `position:absolute; top: calc(var(--shell-top) + 12px); right: 12px`（`--shell-top` 三主题已定义：win12 0px / macOS 24px / Deepin 0px）。
- **层级**：三主题的 `.window` 均未设 z-index（按 DOM 顺序叠放）。因此组件模板中把 `<WeatherWidget />` 插在 `.desktop-icons` 之后、窗口 `TransitionGroup` 之前，且**不给组件设 z-index**——图标(auto, 更靠前) < 天气卡(auto) < 窗口(auto, 更靠后)，即卡片盖住图标、被窗口盖住。不要为此给窗口或卡片加 z-index，避免破坏现有叠放。
- `@mousedown.stop @contextmenu.stop` 不触发桌面选中/右键菜单。
- 内容（中等卡片）：
  - 头部：城市名 + 刷新按钮 + 城市下拉（8 城，`v-model` 绑 `store.city`，变更走 `setCity`）。
  - 当前区：大图标（~40px）+ 温度（~30px 细体）+ 高低温 + 状况描述 + 体感/风/湿度一行。
  - 5 天预报列表：`days[0..4]`，行=今天/明天/周X + 图标 + 降水%（可空）+ 低~高。
- 降级：`loading` 显示"获取中…"占位；`error` 显示"暂无法获取天气（离线或网络不可达）" + 重试按钮（`store.refresh()`）。
- 样式：组件 scoped 基础玻璃拟态（`backdrop-filter: blur` + 半透明背景 + 明暗自适应，参考 w12-panel 观感）；三个主题 css 各加少量覆写（win12 浅玻璃、macOS 振动模糊、Deepin 深色玻璃）。
- 挂载：`WinDesktop.vue` / `MacDesktop.vue` / `DeepinDesktop.vue` 模板内引入 `<WeatherWidget />`；三处各自 `onMounted(() => weather.load())` 由组件自身完成，桌面组件只负责放置。

### 3.5 WxCard 重构 —— 改 `widgets/WxCard.vue`

- 删除自带城市表 / WMO 映射 / fetch / reqSeq 逻辑，改读 store：`current/days/hours`、`city`（下拉绑 `store.setCity`）、刷新 → `store.refresh()`、降级文案取 `store.err`。
- 布局与观感保持不变（逐时 8 格 + 15 天 + AQI 徽章）。
- 收益：城市全局同步（桌面卡切的城市在小组件里生效），多组件同屏不重复请求。

## 4. 边界与红线

- 后端零改动；不动 `middleware/security.go` CSP。
- AQI 请求失败 → `aqi=-1` 隐藏徽章，不阻塞主数据。
- 2027+ 无内置节假日数据 → `dayInfo` 返回空 label，日历格显示农历（现有降级行为，不报错）。
- 不做 IP 定位（需新增外部域名 + CSP 变更，YAGNI）；城市列表维持现有 8 城。
- 天气卡不得遮挡左侧图标流（图标在左、卡在右，无重叠）；窗口最大化时可盖住天气卡（层级在窗口之下，符合桌面挂件语义）。

## 5. 文件清单

新增：
- `web/src/stores/weather.ts`
- `web/src/utils/weather.ts`
- `web/src/shell/WeatherWidget.vue`

修改：
- `web/src/themes/windows/WinDateBox.vue`
- `web/src/themes/windows/win.css`（datebox 宽度、天气条、副标签样式）
- `web/src/themes/windows/WinTaskBar.vue`（`positionPanel` 按面板区分宽度）
- `web/src/themes/windows/WinDesktop.vue`（挂载 WeatherWidget）
- `web/src/themes/macos/MacDesktop.vue` + `mac.css`（挂载 + 覆写样式）
- `web/src/themes/deepin/DeepinDesktop.vue` + `deepin.css`（挂载 + 覆写样式）
- `web/src/themes/windows/widgets/WxCard.vue`（接入 store）

## 6. 验证

1. `./build.sh`（npm build → dist 同步 → go build 嵌入）→ `./start.sh restart` → `curl -s -o /dev/null -w "%{http_code}" https://yun.johngko.com/` 预期 200。
2. browser-use 实测（win12 默认主题）：
   - 点任务栏时钟：日历出现天气条、日期行农历、日期格农历副标签；翻到 10 月：10-01 红色"国庆"，调休工作日蓝色"班"。
   - 桌面右上角天气卡：当前天气 + 5 天预报；切城市（如杭州）→ 数据更新且 `cp_wx_city` 持久化；点刷新。
   - 打开小组件面板：WxCard 城市与桌面卡一致。
   - 切 macOS / Deepin 主题：天气卡位置（macOS 在菜单栏下方）与风格正确。
3. 截图存 `docs/test-evidence/tNN-*.png`（NN 递增），写入汇报。
4. 断网降级（可选）：失败时日历天气条与桌面卡显示降级文案 + 重试。
