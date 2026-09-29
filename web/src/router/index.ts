import { createRouter, createWebHashHistory } from 'vue-router'
import ShellHost from '../shell/ShellHost.vue'
import { getToken } from '../api/http'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/boot' },
    { path: '/boot', component: ShellHost, props: { screen: 'Boot' } },
    { path: '/login', component: ShellHost, props: { screen: 'Login' } },
    { path: '/register', component: ShellHost, props: { screen: 'Register' } },
    { path: '/desktop', component: ShellHost, props: { screen: 'Desktop' } },
    { path: '/s/:token', component: () => import('../shell/SharePage.vue') },
    // 整页 Office 编辑器（Cloudreve 模式）：登录态 /office，公开分享 /s/:token/office
    { path: '/office', component: () => import('../shell/OfficePage.vue') },
    { path: '/s/:token/office', component: () => import('../shell/OfficePage.vue') },
    // 独立应用模式：#/app/<app> 全屏单应用（无桌面外壳；未登录先走极简登录）
    { path: '/app/:app', component: () => import('../shell/StandaloneApp.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/boot' }
  ]
})

// 需要登录的路由：无令牌时直接去登录页。
// 原先没有守卫，手动把 hash 改成 #/desktop 会先渲染出外壳再被桌面自身踢回登录（闪一下）。
// 分享页 /s/:token、分享 Office /s/:token/office、独立应用 /app/:app 均允许匿名，不做拦截。
const NEED_AUTH = ['/desktop', '/office']
router.beforeEach((to) => {
  if (NEED_AUTH.includes(to.path) && !getToken()) return { path: '/login' }
  return true
})

export default router
