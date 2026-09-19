import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';
const BASE = 'http://127.0.0.1:18322';
const EV = '/www/wwwhdd/cloudpan/docs/test-evidence';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill('cptest-temp-2026');
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.getByText('此电脑', { exact: true }).first().dblclick();
await page.waitForTimeout(2000);
await page.getByText('测试磁盘', { exact: true }).first().click();
await page.waitForTimeout(2500);

// EML 空态回归（无报错）+ 双击测试邮件
// 关闭资源管理器窗口，避免遮挡桌面图标
for (let i = 0; i < 10; i++) { const c = page.locator('.window .win-ctrl.close').last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(350); }
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
await page.locator('.desk-icon', { hasText: 'EML 查看器' }).first().dblclick();
await page.waitForTimeout(3500);
const emptyErrs = errs.length;
await page.screenshot({ path: EV + '/t31-1-eml-empty.png' });
for (let i = 0; i < 10; i++) { const c = page.locator('.window .win-ctrl.close').last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(350); }
// 重新打开资源管理器进测试磁盘
await page.getByText('此电脑', { exact: true }).first().dblclick();
await page.waitForTimeout(2000);
await page.getByText('测试磁盘', { exact: true }).first().click();
await page.waitForTimeout(2500);
await page.locator('.file-item', { hasText: '测试邮件.eml' }).first().dblclick();
await page.waitForTimeout(6000);
const st = await page.evaluate(() => {
  const f = document.querySelector('iframe[src*="/webapps/eml_viewer/"]');
  return { subject: f ? (f.contentDocument.querySelector('#subject') || {}).textContent : 'no-frame', body: f ? (f.contentDocument.querySelector('#relust') || {textContent:''}).textContent.trim().slice(0, 60) : '' };
});
console.log('EML_OPEN=' + JSON.stringify(st), '| 空态报错数:', emptyErrs);
await page.screenshot({ path: EV + '/t31-2-eml-open.png' });

// 白板字体回归
for (let i = 0; i < 12; i++) { const c = page.locator('.window .win-ctrl.close').last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(350); }
const fontBlocked = [];
page.on('console', m => { if (m.text().includes('esm.sh') || m.text().includes('Content Sec')) fontBlocked.push(m.text().slice(0, 120)); });
await page.locator('.desk-icon', { hasText: '白板' }).first().dblclick();
await page.waitForTimeout(10000);
await page.waitForTimeout(3000);
await page.screenshot({ path: EV + '/t31-3-whiteboard.png' });
console.log('WHITEBOARD_FONT_VIOLATIONS=' + fontBlocked.length);
await browser.close();
process.exit(0);
