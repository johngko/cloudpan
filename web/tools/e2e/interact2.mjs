import { chromium } from '/www/wwwhdd/www.johngko.com/multimedia-platform/node_modules/playwright-core/index.mjs';
const BASE = 'http://127.0.0.1:18322';
const EV = '/www/wwwhdd/cloudpan/docs/test-evidence';
const log = (...a) => console.log('[V]', ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const closeAll = async () => { for (let i = 0; i < 12; i++) { const c = page.locator('.window .win-ctrl.close').last(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(300); } };

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => location.hash.includes('login') || location.hash.includes('desktop'), null, { timeout: 30000 });
await page.getByText('使用账号登录').first().click();
await page.waitForTimeout(800);
await page.locator('input').first().fill('cptest');
await page.locator('input[type="password"]').first().fill('cptest-temp-2026');
await page.getByRole('button', { name: /登录|登 录/ }).first().click();
await page.waitForFunction(() => location.hash.includes('desktop'), null, { timeout: 20000 });
await page.waitForTimeout(1500);

// 记事本
await page.locator('.desk-icon', { hasText: '记事本' }).first().dblclick();
await page.waitForTimeout(1500);
await page.locator('.window.foc textarea').first().click();
await page.keyboard.type('交互测试内容 ABC123');
await page.waitForTimeout(500);
const np = await page.locator('.window.foc textarea').first().inputValue();
console.log('NOTEPAD_INPUT_OK=' + /ABC123/.test(np));
await page.screenshot({ path: EV + '/t32-1-notepad.png' });
await closeAll();

// 文件管理：新建/重命名/删除
await page.locator('.desk-icon', { hasText: '此电脑' }).first().dblclick();
await page.waitForTimeout(2000);
await page.getByText('测试磁盘', { exact: true }).first().click();
await page.waitForTimeout(2500);
// 新建 → 新建文件夹（工具栏下拉）
await page.locator('.window.foc').getByText('新建', { exact: true }).first().click();
await page.waitForTimeout(500);
const mi = page.locator('.context-menu, [class*="context"]').getByText('新建文件夹', { exact: true }).first();
if (await mi.count()) await mi.click(); else await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.locator('.dlg-input:visible').fill('新建测试目录');
await page.locator('.dlg-host .btn.primary').click();
await page.waitForTimeout(1500);
console.log('MKDIR_OK=' + ((await page.locator('.file-item', { hasText: '新建测试目录' }).count()) > 0));
// 重命名（右键菜单）
await page.locator('.file-item', { hasText: '新建测试目录' }).first().click({ button: 'right' });
await page.waitForTimeout(600);
await page.locator('.context-item, [class*="context"] *').filter({ hasText: '重命名' }).last().click().catch(async () => { await page.getByText('重命名', { exact: true }).first().click(); });
await page.waitForTimeout(700);
const rnInput = page.locator('.dlg-input:visible, .dialog input:visible').last();
await rnInput.fill('重命名目录');
await rnInput.press('Enter');
await page.waitForTimeout(1500);
console.log('RENAME_OK=' + ((await page.locator('.file-item', { hasText: '重命名目录' }).count()) > 0));
// 删除（右键 → 删除 → 确认）
await page.locator('.file-item', { hasText: '重命名目录' }).first().click({ button: 'right' });
await page.waitForTimeout(600);
await page.locator('[class*="context"] *').filter({ hasText: '删除' }).last().click().catch(() => {});
await page.waitForTimeout(700);
const okBtn = page.locator('.dlg-host .btn.danger, .dlg-host .btn.primary').last();
await okBtn.click().catch(() => page.keyboard.press('Enter'));
await page.waitForTimeout(1800);
console.log('DELETE_OK=' + ((await page.locator('.file-item', { hasText: '重命名目录' }).count()) === 0));
await page.screenshot({ path: EV + '/t32-2-fileops.png' });
await closeAll();

// 开始菜单 + 小组件 + 控制中心
await page.locator('.taskbar-start, [class*="start"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: EV + '/t32-3-startmenu.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await browser.close();
process.exit(0);
