import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';

// 测试账号口令从环境变量读取（不要提交口令字面量到仓库）
if (!process.env.E2E_PASS) { console.error('[e2e] 未设置 E2E_PASS 环境变量（测试账号口令）'); process.exit(2) }
const BASE = 'http://127.0.0.1:18322';
const log = (...a) => console.log('[S]', ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 登录
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill(process.env.E2E_PASS);
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(2000);

const names = await page.evaluate(() => Array.from(document.querySelectorAll('.desktop-icons .desk-icon .lbl')).map(e => e.textContent.trim()));
log('桌面图标:', JSON.stringify(names));
await page.screenshot({ path: '/tmp/sweep/00-desktop.png' });

const skip = new Set(['此电脑', '回收站']);
const results = [];
for (const name of names) {
  if (skip.has(name)) continue;
  const errs = [];
  const onErr = e => errs.push('PAGEERROR: ' + e.message.slice(0, 150));
  const onC = m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 150)); };
  const onR = r => { if (r.status() >= 400) errs.push('HTTP' + r.status() + ': ' + r.url().replace(BASE, '').slice(0, 90)); };
  page.on('pageerror', onErr); page.on('console', onC); page.on('response', onR);
  const icon = page.locator('.desk-icon', { hasText: name }).first();
  try {
    await icon.dblclick({ timeout: 5000 });
  } catch { log('双击失败', name); results.push({ name, ok: false, note: 'dblclick-fail' }); continue; }
  const wait = name === '在线PS' ? 20000 : name === 'CAD 看图' ? 12000 : 7000;
  await page.waitForTimeout(wait);
  const fn = name.replace(/[\/\\?%*:|"<>]/g, '_');
  await page.screenshot({ path: `/tmp/sweep/${fn}.png` });
  // 窗口是否存在
  const winCount = await page.locator('.window').count();
  // 关闭所有窗口
  for (let i = 0; i < 12; i++) {
    const c = page.locator('.window .win-ctrl.close').last();
    if (!(await c.count())) break;
    await c.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const after = await page.locator('.window').count();
  results.push({ name, windows: winCount, closed: after === 0, errors: errs.slice(0, 6) });
  log(name, '| win:', winCount, '| closed:', after === 0, '| errs:', errs.length);
  if (errs.length) errs.slice(0, 6).forEach(e => console.log('   ', e));
  page.off('pageerror', onErr); page.off('console', onC); page.off('response', onR);
}
console.log('\n==== SUMMARY ====');
for (const r of results) console.log(JSON.stringify(r));
await browser.close();
process.exit(0);
