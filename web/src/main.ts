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
// 尽早应用主题，避免闪烁
useSession().initTheme()
// 站点功能开关（应用中心）：加载后启动器/Dock 按启用态过滤
useAppState().load()
// 用户已安装的应用（可安装应用入口过滤）
useAppState().loadInstalled()
app.use(router)
app.mount('#app')
