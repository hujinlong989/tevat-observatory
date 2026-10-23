// 端到端通关测试（提瓦特观测站 · 清版）
// 真实键盘输入，按关卡标签推进（不等固定时长）
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');

const URL = process.env.SITE_URL || 'http://127.0.0.1:8900/index.html';
const CODES = { 1: '0715', 2: '1231', 3: '0626' };
const LOCK_PASS = '0928';

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.mouse.click(196, 300);

  const panelVisible = () => page.evaluate(() => {
    const w = document.getElementById('pw-wrap');
    return !!w && !w.classList.contains('hidden');
  });
  const level = () => page.evaluate(() => document.body.dataset.level);

  // 先过访问密码门
  await page.fill('#lock-input', LOCK_PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const unlocked = await page.evaluate(() => {
    const l = document.getElementById('lock');
    return !!l && getComputedStyle(l).display === 'none';
  });
  console.log('访问密码门: ' + (unlocked ? '已解锁 ✓' : '未解锁 ✗'));
  if (!unlocked) { console.log('RESULT: LOCK_NOT_PASSED'); await browser.close(); process.exit(1); }

  for (const lv of [1, 2, 3]) {
    let ready = false;
    for (let i = 0; i < 240; i++) {
      if (await panelVisible()) { ready = true; break; }
      await page.waitForTimeout(250);
    }
    if (!ready) { console.log('L' + lv + ' 面板未出现，停在 level=' + (await level())); break; }

    for (const ch of CODES[lv]) { await page.keyboard.press(ch); await page.waitForTimeout(70); }
    const dots = await page.evaluate(() => document.getElementById('pw-dots').textContent);
    await page.keyboard.press('Enter');

    let ok = false;
    for (let i = 0; i < 240; i++) {
      const cur = await level();
      if (cur === String(lv + 1) || await page.evaluate(() => document.getElementById('finale').classList.contains('on'))) { ok = true; break; }
      await page.waitForTimeout(250);
    }
    const msg = await page.evaluate(() => document.getElementById('pw-msg').textContent);
    console.log('L' + lv + ' 输入 ' + CODES[lv] + ' (dots=' + dots + ') → ' +
                (ok ? '通过' : '未推进') + '  level=' + (await level()) + '  msg="' + msg + '"');
    if (!ok) break;
  }

  await page.waitForTimeout(7000);
  const final = await page.evaluate(() => ({
    finaleOn: document.getElementById('finale').classList.contains('on'),
    sprites: window.__layoutInfo ? Object.keys(window.__layoutInfo.map).length : null,
    stripOpacity: getComputedStyle(document.getElementById('fin-strip')).opacity,
    titleOpacity: getComputedStyle(document.getElementById('fin-title')).opacity,
    stripImgs: document.querySelectorAll('#fin-strip .pull img').length,
    errlog: document.getElementById('errlog') ? document.getElementById('errlog').textContent : null,
  }));
  console.log('\nRESULT:', final.finaleOn ? 'FINALE_REACHED' : 'FINALE_NOT_REACHED');
  console.log(' 漂浮sprite数:', final.sprites, ' 祈愿条opacity:', final.stripOpacity,
              ' 标题opacity:', final.titleOpacity, ' 祈愿条角色卡:', final.stripImgs);
  if (final.errlog) console.log(' ERRLOG:', final.errlog.slice(0, 300));
  if (errs.length) console.log(' JS错误:', errs.slice(0, 5));
  await page.screenshot({ path: 'E:/xxjz/tevat-archive/_dev/shots/e2e_finale.png' });
  await browser.close();
  process.exit(final.finaleOn ? 0 : 1);
})();
