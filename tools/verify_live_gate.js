// 线上站点的访问门验证：确认调试直达在生产环境确实关闭
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');
const URL = process.env.SITE_URL || 'https://7jjawzgi9d6hp.space.mcode.cn/index.html';
const PASS = '0928';
const SHOTS = 'E:/xxjz/预告/tevat/work/_live';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405 });
  const page = await ctx.newPage();
  let fails = 0;
  const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

  const lockVisible = () => page.evaluate(() => {
    const el = document.getElementById('lock');
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  });
  const finaleOn = () => page.evaluate(() => {
    const f = document.getElementById('finale');
    return !!(f && f.classList.contains('on'));
  });
  const outText = (t) => page.waitForFunction(
    (s) => { const o = document.getElementById('out'); return o && o.textContent.includes(s); }, t, { timeout: 60000 });

  console.log('\n[1] 首次访问：口令门应出现');
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  ok(await lockVisible(), '口令门可见');
  ok(!(await finaleOn()), '终局未启动');
  await page.screenshot({ path: SHOTS + '_lock.png' });

  console.log('\n[2] 带 ?finale 访问：仍必须过口令门（生产版调试直达应关闭）');
  await page.goto(URL + '?finale', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  ok(await lockVisible(), '口令门依然可见（没被 ?finale 绕过）');
  ok(!(await finaleOn()), '终局未启动');

  console.log('\n[3] 过口令后仍走正常流程，不跳关');
  await page.fill('#lock-input', PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  ok(!(await finaleOn()), '进的是第一关，不是终局（没跳关）');
  await outText('找回三段密钥');
  ok(true, '序章正常开始');

  console.log('\n[4] 正常通关到终局');
  const CODES = { 1: '0715', 2: '1231', 3: '0626' };
  const panelVisible = () => page.evaluate(() => {
    const w = document.getElementById('pw-wrap');
    return !!w && !w.classList.contains('hidden');
  });
  const level = () => page.evaluate(() => document.body.dataset.level);

  for (const lv of [1, 2, 3]) {
    let ready = false;
    for (let i = 0; i < 240; i++) {
      if (await panelVisible()) { ready = true; break; }
      await page.waitForTimeout(250);
    }
    ok(ready, 'L' + lv + ' 面板出现');
    if (!ready) break;
    for (const ch of CODES[lv]) { await page.keyboard.press(ch); await page.waitForTimeout(70); }
    await page.keyboard.press('Enter');
    let advanced = false;
    for (let i = 0; i < 240; i++) {
      const cur = await level();
      if (cur === String(lv + 1) || await page.evaluate(() => document.getElementById('finale').classList.contains('on'))) { advanced = true; break; }
      await page.waitForTimeout(250);
    }
    ok(advanced, 'L' + lv + ' 输入 ' + CODES[lv] + ' → 推进到下一关');
    if (!advanced) break;
  }

  await page.waitForFunction(() => { const f = document.getElementById('finale'); return f && f.classList.contains('on'); }, { timeout: 60000 });
  ok(true, '终局已点亮');
  await page.waitForTimeout(5200);
  const st = await page.evaluate(() => ({
    sprites: window.__layoutInfo ? Object.keys(window.__layoutInfo.map).length : null,
    strip: getComputedStyle(document.getElementById('fin-strip')).opacity,
    cards: document.querySelectorAll('#fin-strip .pull img').length,
    errlog: (document.getElementById('errlog') || {}).textContent || null,
  }));
  console.log('  终局 sprite 数:', st.sprites, ' 祈愿条 opacity:', st.strip, ' 角色卡:', st.cards);
  if (st.errlog) console.log('  !! ERRLOG:', st.errlog.slice(0, 300));
  await page.screenshot({ path: SHOTS + '_finale.png' });

  await browser.close();
  console.log('\n' + (fails ? `✗ ${fails} 项不通过` : '✓ 线上访问门行为符合预期'));
  process.exit(fails ? 1 : 0);
})();
