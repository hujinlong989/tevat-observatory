// 分镜截图：把整条故事线按关卡截一遍，用于人工验收
// 用 405x720 @2.667 的竖版视口（=1080x1920 整数倍，也是手机窄屏版式）
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');

const URL = process.env.SITE_URL || 'http://127.0.0.1:8900/index.html';
const OUT = 'E:/xxjz/tevat-archive/_dev/shots';
const LOCK_PASS = '0928';

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2.667 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('  📷 ' + name);
  };
  const panelVisible = () => page.evaluate(() => {
    const w = document.getElementById('pw-wrap');
    return !!w && !w.classList.contains('hidden');
  });
  const waitPanel = async () => {
    for (let i = 0; i < 240; i++) {
      if (await panelVisible()) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await shot('01-lock');

  await page.fill('#lock-input', LOCK_PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await shot('02-prologue');

  // L1
  if (!await waitPanel()) { console.log('L1 面板未出现'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500);
  await shot('03-level1-card');

  for (const ch of '0715') { await page.keyboard.press(ch); await page.waitForTimeout(70); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  await shot('04-level2-calendar');

  if (!await waitPanel()) { console.log('L2 面板未出现'); await browser.close(); process.exit(1); }
  for (const ch of '1231') { await page.keyboard.press(ch); await page.waitForTimeout(70); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000);
  await shot('05-level3-monitor');

  if (!await waitPanel()) { console.log('L3 面板未出现'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1200);
  await shot('06-level3-card');
  for (const ch of '0626') { await page.keyboard.press(ch); await page.waitForTimeout(70); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(17000);          // 终局文案依次浮现，最后一条 4.4s
  await shot('07-finale');

  // 放一发烟花看看（粒子寿命只有 1.5~2.4s，要立刻拍）
  await page.mouse.click(200, 260);
  await page.waitForTimeout(700);
  await shot('08-fireworks');

  console.log(errs.length ? 'JS 错误: ' + errs.slice(0, 5).join(' | ') : '无 JS 错误');
  await browser.close();
})();
