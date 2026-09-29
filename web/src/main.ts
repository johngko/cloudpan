import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useSession } from './stores/session'
import { ensureBootData } from './stores/boot'
import { getToken } from './api/http'
import './assets/base.css'
import './themes/registry' // 各主题包 CSS 随注册表静态加载
// 手机样式表：必须排在主题 CSS 之后（registry 会静态加载三主题 CSS），
// 使 [data-mobile] 作用域的规则能覆盖主题默认值（见 assets/mobile.css 顶部说明）
import './assets/mobile.css'
import { useViewport } from './stores/viewport'

const app = createApp(App)
app.use(createPinia())
// 尽早应用主题，避免闪烁；随后异步拉取站点信息，把管理员设置的站点主题尽早套上
// （开机/登录页即按管理员设置渲染，游客与普通用户看到同一主题）
const session = useSession()
// 移动态判定要在首次渲染前生效，避免先闪一下桌面布局；
// 用户偏好依赖登录态，放到下面按有无令牌决定是否读取
const viewport = useViewport()
viewport.bindMedia()
session.initTheme()
session.loadSite()
// 功能清单/已安装应用依赖登录态：无令牌（首访/登录页）直接跳过，避免 /apps、/settings
// 打出无意义的 401。有令牌（如刷新时停在 #/desktop）走统一数据门 ensureBootData——
// 与 ShellHost 桌面就绪门/App.vue 身份 watcher 共享去重 promise，整次刷新只打一组请求
if (getToken()) { ensureBootData(); viewport.loadPref() }
app.use(router)
app.mount('#app')
