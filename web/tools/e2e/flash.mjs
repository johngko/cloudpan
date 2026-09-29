import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';

// 测试账号口令从环境变量读取（不要提交口令字面量到仓库）
if (!process.env.E2E_PASS) { console.error('[e2e] 未设置 E2E_PASS 环境变量（测试账号口令）'); process.exit(2) }

const BASE = 'http://127.0.0.1:18322';
const EV = '/www/wwwhdd/cloudpan/docs/test-evidence';
const log = (...a) => console.log('[V]', ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => log('PAGEERROR:', e.message.slice(0, 200)));

// 记录桌面图标数量随时间的变化（刷新后首帧是否即完整）
await page.addInitScript(() => {
  window.__iconLog = [];
  const record = (tag) => {
    const n = document.querySelectorAll('.desktop-icons .desk-icon').length;
    const arr = window.__iconLog;
    if (!arr.length || arr[arr.length - 1].n !== n) arr.push({ t: Math.round(performance.now()), n, tag });
  };
  const start = () => {
    new MutationObserver(() => record('mut')).observe(document.documentElement, { childList: true, subtree: true });
    record('DCL');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
});

// 登录 cptest
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill(process.env.E2E_PASS);
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(2500);
const finalCount = await page.evaluate(() => document.querySelectorAll('.desktop-icons .desk-icon').length);
log('登录后桌面图标数(final):', finalCount);
await page.evaluate(() => { window.__iconLog = []; });
await page.screenshot({ path: EV + '/t27-1-user-desktop.png' });

// 统计刷新期间的 /api/apps 请求数
let appsReqs = 0;
page.on('request', r => { if (r.url().includes('/api/apps')) appsReqs++; });

// 刷新桌面（核心场景）
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => location.hash.includes('desktop') && document.querySelectorAll('.desktop-icons .desk-icon').length > 0, null, { timeout: 20000 });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({ final: document.querySelectorAll('.desktop-icons .desk-icon').length, log: window.__iconLog }));
log('刷新后图标数:', after.final, '/apps 请求数:', appsReqs);
log('图标数变化轨迹:', JSON.stringify(after.log));
const nz = after.log.filter(e => e.n > 0);
console.log('ICONS_STABLE=' + (nz.length === 1 && nz[0].n === after.final && after.final === finalCount));
console.log('APPS_REQ_ONCE=' + (appsReqs === 1));
await page.screenshot({ path: EV + '/t27-2-user-desktop-refresh.png' });

// 独立应用模式：刷新 #/app/photos（已安装可选应用，修复前会误判未安装）
await page.goto(BASE + '/#/app/photos', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const body = await page.locator('body').innerText();
const blocked = body.includes('应用未安装');
log('独立模式 #/app/photos 是否误判未安装:', blocked);
console.log('STANDALONE_OK=' + (!blocked));
await page.screenshot({ path: EV + '/t27-3-standalone-photos.png' });

// 游客流程：退出 → 游客登录 → 刷新 → 同样断言
await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByText('游客登录', { exact: true }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(2000);
const gFinal = await page.evaluate(() => document.querySelectorAll('.desktop-icons .desk-icon').length);
log('游客桌面图标数(final):', gFinal);
await page.evaluate(() => { window.__iconLog = []; });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => location.hash.includes('desktop') && document.querySelectorAll('.desktop-icons .desk-icon').length > 0, null, { timeout: 20000 });
await page.waitForTimeout(2000);
const g = await page.evaluate(() => ({ final: document.querySelectorAll('.desktop-icons .desk-icon').length, log: window.__iconLog }));
const gnz = g.log.filter(e => e.n > 0);
log('游客刷新轨迹:', JSON.stringify(g.log));
console.log('GUEST_ICONS_STABLE=' + (gnz.length === 1 && gnz[0].n === g.final && g.final === gFinal));
await page.screenshot({ path: EV + '/t27-4-guest-desktop.png' });

await browser.close();
process.exit(0);
