// 预告片素材（提瓦特观测站 · 清版）：在真站点上按分镜抓关键帧
//
// 铁律：预告里绝不能出现任何一段密钥（0928 / 0715 / 1231 / 0626），
//       也不能出现任何可反推出它们的画面。
//       本脚本用四层防护：
//         ① 删掉直接回显密钥的终端行（KEY ACCEPTED / 胶片时间戳 / 岩王帝君的日历）
//         ② 藏掉胶片画面上的时间戳覆盖层 .stime
//         ③ 日历停靠日若为 12/31，改成中性的 11/29
//         ④ 兜底：#out / #stage / #term-foot 里再扫一遍密钥串，命中就抹掉
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');
const fs = require('fs');

const URL = process.env.SITE_URL || 'http://127.0.0.1:8900/index.html';
const LOCK_PASS = '0928';
// 抓帧输出目录（绝对路径由环境变量给，默认用仓库同级的 teaser-work）
const OUT = (process.env.TEASER_WORK || 'E:/xxjz/预告/tevat/work') + '/shots/';
const SECRETS = ['0928', '0715', '1231', '0626'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  // 视口按「真机」比例渲染，再以 2.667 倍设备像素放大到 1080x1920：
  // 站点是给手机窄屏设计的，直接用 1080 宽视口会让文字小到看不清。
  // 405x720 = 9:16 整数倍，405<=430 触发窄屏版式，720<=760 触发矮屏版式。
  const ctx = await browser.newContext({
    viewport: { width: 405, height: 720 },
    deviceScaleFactor: 1080 / 405,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  const outText = (s) => page.waitForFunction(
    (t) => { const o = document.getElementById('out'); return o && o.textContent.includes(t); },
    s, { timeout: 90000 });
  const stageText = (s) => page.waitForFunction(
    (t) => { const st = document.getElementById('stage'); return st && st.textContent.includes(t); },
    s, { timeout: 90000 });

  // ---- 泄密清理：每帧都要跑 ----
  const scrub = () => page.evaluate((SECRETS) => {
    // ① 直接回显密钥 / 泄露答案的终端行，整行删掉
    document.querySelectorAll('#out .line').forEach(el => {
      const t = el.textContent || '';
      if (t.includes('KEY ACCEPTED') ||
          t.includes('胶片时间戳') ||
          t.includes('岩王帝君的日历') ||
          SECRETS.some(s => t.includes(s))) {
        el.remove();
      }
    });
    // ② 胶片画面上的时间戳覆盖层
    document.querySelectorAll('.stime').forEach(el => el.style.display = 'none');
    // ③ 日历停靠日不能是 12/31
    const cm = document.getElementById('cm'), cd = document.getElementById('cd');
    if (cm && cd && cm.textContent === 'DEC' && cd.textContent === '31') {
      cm.textContent = 'NOV'; cd.textContent = '29';
    }
    // ④ 兜底：stage 与页脚再扫一遍
    document.querySelectorAll('#stage *, #term-foot *').forEach(el => {
      if (el.children.length === 0 && SECRETS.some(s => (el.textContent || '').includes(s))) {
        el.textContent = '••••';
      }
    });
  }, SECRETS);

  const waitPanel = () => page.waitForFunction(() => {
    const w = document.getElementById('pw-wrap');
    return w && !w.classList.contains('hidden') && !w.classList.contains('locked');
  }, { timeout: 90000 });

  const typeCode = async (code) => {
    await waitPanel();
    for (const ch of code) { await page.keyboard.press(ch); await page.waitForTimeout(90); }
    const dots = await page.evaluate(() => document.getElementById('pw-dots').textContent);
    if (!/█{4}/.test(dots)) throw new Error('输入未生效: dots=' + dots);
    await page.keyboard.press('Enter');
  };

  const shot = async (name) => {
    await scrub();
    await page.screenshot({ path: OUT + name + '.png' });
    console.log('  shot ' + name);
  };

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // 01 密码门（圆点是打码的，不泄密）
  await shot('01_lock');

  await page.fill('#lock-input', LOCK_PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);

  // 02-04 序章（打字推进，三帧造打字感）
  await outText('提瓦特的「星图」暗了下去');
  await page.waitForTimeout(300);
  await shot('02_prologue_a');
  await outText('密钥不在武器里');
  await page.waitForTimeout(300);
  await shot('03_prologue_b');
  await outText('密钥在每一个人的那一天里');
  await page.waitForTimeout(300);
  await shot('04_prologue_c');

  // 05 L1 档案卡（只有谜面，没有日期）
  await stageText('SUBJECT_01');
  await page.waitForTimeout(400);
  await shot('05_l1_card');

  // 06 L1 之后的反转（抹掉 KEY ACCEPTED 行）
  await typeCode('0715');
  await outText('原因：这不是档案。这是一段记忆。');
  await page.waitForTimeout(300);
  await shot('06_l1_mood');

  // 07 L2 日历：抓翻页中途的帧，避开 12/31
  await page.waitForFunction(() => {
    const m = document.getElementById('cm'), d = document.getElementById('cd');
    if (!m || !d || m.textContent === '---') return false;
    return !(m.textContent === 'DEC' && d.textContent === '31');
  }, { timeout: 90000 });
  await shot('07_l2_cal');

  // 08 L2 之后（抹掉 KEY ACCEPTED / 胶片时间戳 / 岩王帝君的日历 三行）
  await typeCode('1231');
  await outText('档案里那行「每年一次」，记的就是这一天。');
  await page.waitForTimeout(300);
  await shot('08_l2_mood');

  // 09 L3 THIRD KEY 卡（卡上只有「月 + 日」格式，无具体值）
  await stageText('THIRD KEY');
  await page.waitForTimeout(700);
  await shot('09_l3_card');

  // 10 L3 通过后（抹掉 KEY ACCEPTED）
  await typeCode('0626');
  await outText('DECRYPTING 100%');
  await page.waitForTimeout(300);
  await shot('10_l3_ok');

  // 11 FINAL ENTRY 卡
  await stageText('FINAL ENTRY');
  await page.waitForTimeout(400);
  await shot('11_final_entry');

  // 12 反转揭晓
  await outText('只是太久，没人再叫他们的名字');
  await page.waitForTimeout(400);
  await shot('12_reveal');

  // 13-15 终局 + 烟花
  await page.waitForFunction(() => {
    const f = document.getElementById('finale');
    return f && f.classList.contains('on');
  }, { timeout: 60000 });
  await page.waitForTimeout(4800);        // 等终局文案依次浮现完
  await shot('13_finale');
  await page.mouse.click(202, 360);
  await page.waitForTimeout(1800);
  await shot('14_finale_fw');
  await page.waitForTimeout(1400);
  await shot('15_finale_fw2');

  if (errs.length) console.log('JS错误:', errs.slice(0, 5));
  await browser.close();
  console.log('DONE');
})();
