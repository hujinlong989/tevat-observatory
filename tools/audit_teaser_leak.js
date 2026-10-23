// 预告泄密审计：重放同一条流程，逐帧取「页面可见文本」，与密钥串对撞
// 任何一次命中都视为 FAIL
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');

const URL = process.env.SITE_URL || 'http://127.0.0.1:8900/index.html';
const LOCK_PASS = '0928';
// 密钥本体 + 可反推密钥的表述
const SECRETS = ['0928', '0715', '1231', '0626'];
// 只盯「值」和「等价表述」，不盯指引性文字
// （线索卡上写「线索在胶片时间戳里」是指路，不是泄露；泄露的是那一行的值）
const HINTS = [
  'KEY ACCEPTED',
  '岩王帝君的日历', '一年的最后一天',      // 指向 12/31
  '06-26', '20:26', '6月26', '6/26',       // 指向 06/26
  '12-31', '12/31', '12月31', 'DEC 31',     // 指向 12/31
  '07-15', '07/15', '7月15', 'JUL 15',      // 指向 07/15
];

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405 });
  const page = await ctx.newPage();

  const outText = (s) => page.waitForFunction(
    (t) => { const o = document.getElementById('out'); return o && o.textContent.includes(t); },
    s, { timeout: 90000 });
  const stageText = (s) => page.waitForFunction(
    (t) => { const st = document.getElementById('stage'); return st && st.textContent.includes(t); },
    s, { timeout: 90000 });

  // 与 capture_teaser.js 完全一致的 scrub
  const scrub = () => page.evaluate((SECRETS) => {
    document.querySelectorAll('#out .line').forEach(el => {
      const t = el.textContent || '';
      if (t.includes('KEY ACCEPTED') || t.includes('胶片时间戳') ||
          t.includes('岩王帝君的日历') || SECRETS.some(s => t.includes(s))) el.remove();
    });
    document.querySelectorAll('.stime').forEach(el => el.style.display = 'none');
    const cm = document.getElementById('cm'), cd = document.getElementById('cd');
    if (cm && cd && cm.textContent === 'DEC' && cd.textContent === '31') { cm.textContent = 'NOV'; cd.textContent = '29'; }
    document.querySelectorAll('#stage *, #term-foot *').forEach(el => {
      if (el.children.length === 0 && SECRETS.some(s => (el.textContent || '').includes(s))) el.textContent = '••••';
    });
  }, SECRETS);

  const waitPanel = () => page.waitForFunction(() => {
    const w = document.getElementById('pw-wrap');
    return w && !w.classList.contains('hidden') && !w.classList.contains('locked');
  }, { timeout: 90000 });

  const typeCode = async (code) => {
    await waitPanel();
    for (const ch of code) { await page.keyboard.press(ch); await page.waitForTimeout(90); }
    await page.keyboard.press('Enter');
  };

  let fails = 0;
  const check = async (label) => {
    await scrub();
    // 取可见文本：终端输出 + 舞台 + 可见的覆盖层文本
    const txt = await page.evaluate(() => {
      const parts = [];
      const grab = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;      // 隐藏元素不算可见
        parts.push(el.innerText || el.textContent || '');
      };
      grab('#out'); grab('#stage'); grab('#term-head'); grab('#term-foot');
      grab('#fin-ui'); grab('#lock'); grab('#lock-dots'); grab('#lock-msg');
      // 画面上任何可见文本节点
      document.querySelectorAll('body *').forEach(el => {
        if (el.children.length !== 0) return;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        parts.push(el.textContent || '');
      });
      return parts.join('\n');
    });
    const hits = [];
    SECRETS.forEach(s => { if (txt.includes(s)) hits.push('密钥 ' + s); });
    HINTS.forEach(h => { if (txt.includes(h)) hits.push('可反推线索 "' + h + '"'); });
    // 日历是一对元素（月份/日期分列），单独再判一次
    const cal = await page.evaluate(() => {
      const m = document.getElementById('cm'), d = document.getElementById('cd');
      if (!m || !d) return null;
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      if (!vis(m) || !vis(d)) return null;
      return m.textContent + '/' + d.textContent;
    });
    if (cal === 'DEC/31') hits.push('日历停在 12/31');
    if (hits.length) {
      fails++;
      console.log('  ✗ ' + label + ' → ' + hits.join(' | '));
      // 打印命中上下文，便于定位
      hits.forEach(() => {});
      const lines = txt.split('\n').filter(l => SECRETS.some(s => l.includes(s)) || HINTS.some(h => l.includes(h)));
      lines.slice(0, 5).forEach(l => console.log('       > ' + l.trim()));
    } else {
      console.log('  ✓ ' + label);
    }
  };

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await check('01_lock');

  await page.fill('#lock-input', LOCK_PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);

  await outText('提瓦特的「星图」暗了下去');
  await page.waitForTimeout(300); await check('02_prologue_a');
  await outText('密钥不在武器里');
  await page.waitForTimeout(300); await check('03_prologue_b');
  await outText('密钥在每一个人的那一天里');
  await page.waitForTimeout(300); await check('04_prologue_c');

  await stageText('SUBJECT_01');
  await page.waitForTimeout(400); await check('05_l1_card');

  await typeCode('0715');
  await outText('原因：这不是档案。这是一段记忆。');
  await page.waitForTimeout(300); await check('06_l1_mood');

  await page.waitForFunction(() => {
    const m = document.getElementById('cm'), d = document.getElementById('cd');
    if (!m || !d || m.textContent === '---') return false;
    return !(m.textContent === 'DEC' && d.textContent === '31');
  }, { timeout: 90000 });
  await check('07_l2_cal');

  await typeCode('1231');
  await outText('档案里那行「每年一次」，记的就是这一天。');
  await page.waitForTimeout(300); await check('08_l2_mood');

  await stageText('THIRD KEY');
  await page.waitForTimeout(700); await check('09_l3_card');

  await typeCode('0626');
  await outText('DECRYPTING 100%');
  await page.waitForTimeout(300); await check('10_l3_ok');

  await stageText('FINAL ENTRY');
  await page.waitForTimeout(400); await check('11_final_entry');

  await outText('只是太久，没人再叫他们的名字');
  await page.waitForTimeout(400); await check('12_reveal');

  await page.waitForFunction(() => {
    const f = document.getElementById('finale');
    return f && f.classList.contains('on');
  }, { timeout: 60000 });
  await page.waitForTimeout(4800); await check('13_finale');
  await page.mouse.click(202, 360);
  await page.waitForTimeout(1800); await check('14_finale_fw');
  await page.waitForTimeout(1400); await check('15_finale_fw2');

  await browser.close();
  console.log('\n' + (fails ? '✗ 有 ' + fails + ' 帧存在泄密' : '✓ 15 帧全部无泄密'));
  process.exit(fails ? 1 : 0);
})();
