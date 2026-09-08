import { createRouter, createWebHashHistory } from 'vue-router'
import ShellHost from '../shell/ShellHost.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/boot' },
    { path: '/boot', component: ShellHost, props: { screen: 'Boot' } },
    { path: '/login', component: ShellHost, props: { screen: 'Login' } },
    { path: '/register', component: ShellHost, props: { screen: 'Register' } },
    { path: '/desktop', component: ShellHost, props: { screen: 'Desktop' } },
    { path: '/s/:token', component: () => import('../shell/SharePage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/boot' }
  ]
})

export default router
