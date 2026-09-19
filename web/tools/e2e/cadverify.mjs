import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';
const BASE = 'http://127.0.0.1:18322';
const EV = '/www/wwwhdd/cloudpan/docs/test-evidence';
const log = (...a) => console.log('[V]', ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => log('PAGEERROR:', e.message.slice(0, 200)));
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 110)); });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill('cptest-temp-2026');
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.locator('.desk-icon', { hasText: 'CAD 看图' }).count().then(n => log('桌面 CAD 看图 图标:', n));
await page.getByText('此电脑', { exact: true }).first().dblclick();
await page.waitForTimeout(2000);
await page.getByText('测试磁盘', { exact: true }).first().click();
await page.waitForTimeout(2500);

// 双击 DXF（默认打开方式 = CAD 看图）
await page.locator('.file-item', { hasText: 'cad-test.dxf' }).first().dblclick();
await page.waitForSelector('iframe[src*="/webapps/cad/"]', { timeout: 20000 });
log('cad iframe 出现');
await page.waitForTimeout(15000); // 等引擎初始化 + DXF 解析渲染
await page.screenshot({ path: EV + '/t30-1-cad-dxf.png' });
const st = await page.evaluate(() => {
  const f = document.querySelector('iframe[src*="/webapps/cad/"]');
  const doc = f.contentDocument, win = f.contentWindow;
  const canvas = doc.querySelector('#cad-container canvas');
  const popup = doc.querySelector('.popup-message');
  return { canvasFound: !!canvas, canvasW: canvas ? canvas.clientWidth : 0, popup: popup ? popup.textContent.trim().slice(0, 60) : '', webgl: (() => { try { const g = doc.createElement('canvas').getContext('webgl2') || doc.createElement('canvas').getContext('webgl'); return !!g; } catch { return false; } })() };
});
log('DXF 状态:', JSON.stringify(st));
console.log('DXF_OPEN=' + st.canvasFound);

// 打开 DWG（右键 → 打开方式 → CAD 看图；先关闭当前窗口）
await page.keyboard.press('Escape');
const dxfWinClose = page.locator('.window.foc .win-close').first();
await dxfWinClose.click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('.file-item', { hasText: 'canteen.dwg' }).first().click({ button: 'right' });
await page.waitForTimeout(800);
await page.getByText('打开方式', { exact: false }).first().hover().catch(() => {});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('*'));
  const el = els.filter(e => e.children.length === 0 && (e.textContent || '').trim() === 'CAD 看图').pop();
  if (el) { let t = el; while (t && t.tagName !== 'LI' && !(t.className || '').toString().match(/item|mi/)) t = t.parentElement; (t || el).click(); }
});
log('已右键打开 DWG');
await page.waitForTimeout(25000); // DWG wasm 解析较慢
await page.screenshot({ path: EV + '/t30-2-cad-dwg.png' });
const st2 = await page.evaluate(() => {
  const f = document.querySelector('iframe[src*="/webapps/cad/"]');
  if (!f) return { err: 'no frame' };
  const popup = f.contentDocument.querySelector('.popup-message');
  return { popup: popup ? popup.textContent.trim().slice(0, 80) : '', title: f.contentDocument.title };
});
log('DWG 状态:', JSON.stringify(st2));
console.log('--- http>=400 ---'); bad.slice(0, 8).forEach(e => console.log(e));
await browser.close();
process.exit(0);
