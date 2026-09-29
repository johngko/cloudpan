import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';

// 测试账号口令从环境变量读取（不要提交口令字面量到仓库）
if (!process.env.E2E_PASS) { console.error('[e2e] 未设置 E2E_PASS 环境变量（测试账号口令）'); process.exit(2) }
const BASE = 'http://127.0.0.1:18322';
const EV = '/www/wwwhdd/cloudpan/docs/test-evidence';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const closeAll = async () => { for (let i = 0; i < 12; i++) { const c = page.locator('.window .win-ctrl.close').last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(300); } };

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill(process.env.E2E_PASS);
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.locator('.desk-icon', { hasText: '此电脑' }).first().dblclick();
await page.waitForTimeout(2000);
await page.getByText('测试磁盘', { exact: true }).first().click();
await page.waitForTimeout(2500);

// 新建 → 文件夹 → 自动进重命名对话框 → 命名
await page.locator('.window.foc').getByText('新建', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByText('文件夹', { exact: true }).first().click();
await page.waitForTimeout(900);
const rnInput = page.locator('.dialog input:visible').last();
await rnInput.fill('重命名目录');
await rnInput.press('Enter');
await page.waitForTimeout(1800);
const mk = (await page.locator('.file-item', { hasText: '重命名目录' }).count()) > 0;
console.log('MKDIR_RENAME_OK=' + mk);
await page.screenshot({ path: EV + '/t32-2-fileops.png' });

// 右键删除
await page.locator('.file-item', { hasText: '重命名目录' }).first().click({ button: 'right' });
await page.waitForTimeout(600);
await page.locator('.ctx-menu-item, .menu-item').filter({ hasText: '删除' }).last().click().catch(async () => {
  await page.getByText('删除', { exact: true }).last().click();
});
await page.waitForTimeout(700);
await page.locator('.dlg-host .btn.danger, .dlg-host .btn.primary').last().click().catch(() => page.keyboard.press('Enter'));
await page.waitForTimeout(1800);
console.log('DELETE_OK=' + ((await page.locator('.file-item', { hasText: '重命名目录' }).count()) === 0));
await closeAll();
await browser.close();
process.exit(0);
