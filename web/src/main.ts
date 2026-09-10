import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useSession } from './stores/session'
import { useAppState } from './stores/appstate'
import './assets/base.css'
import './themes/registry' // 各主题包 CSS 随注册表静态加载

const app = createApp(App)
app.use(createPinia())
// 尽早应用主题，避免闪烁；随后异步拉取站点信息，把管理员设置的站点主题尽早套上
// （开机/登录页即按管理员设置渲染，游客与普通用户看到同一主题）
const session = useSession()
session.initTheme()
session.loadSite()
// 站点功能开关（应用中心）：加载后启动器/Dock 按启用态过滤
useAppState().load()
// 用户已安装的应用（可安装应用入口过滤）
useAppState().loadInstalled()
app.use(router)
app.mount('#app')
