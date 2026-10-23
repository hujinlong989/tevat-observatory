// 终局布局验收（提瓦特观测站 · 清版）
// 精确视口 + 自动判定（出界 / 真实矩形相交 / 重叠）
const { chromium } = require('D:/repository/npm-repository/global/node_modules/playwright');

const URL = (process.env.SITE_URL || 'http://127.0.0.1:8900/index.html') + '#finale';
const LOCK_PASS = '0928';

const VIEWS = [
  { name: 'iphone-393x852', w: 393, h: 852 },
  { name: 'se-375x667', w: 375, h: 667 },
  { name: 'android-360x800', w: 360, h: 800 },
  { name: 'tablet-768x1024', w: 768, h: 1024 },
  { name: 'desktop-1280x800', w: 1280, h: 800 },
];

(async () => {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  let fail = 0;
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h },
      deviceScaleFactor: 1,
      isMobile: v.w < 600,
      hasTouch: v.w < 600,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.fill('#lock-input', LOCK_PASS);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(7000);

    const info = await page.evaluate(() => {
      const L = window.__layoutInfo || null;
      const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }; };
      const strip = document.getElementById('fin-strip');
      const ids = ['fin-title', 'fin-sub', 'fin-sign', 'fin-gift'];
      const rs = ids.map(i => rect(document.getElementById(i))).filter(Boolean);
      let textRect = null;
      if (rs.length) {
        textRect = {
          x1: Math.min(...rs.map(r => r.x1)), y1: Math.min(...rs.map(r => r.y1)),
          x2: Math.max(...rs.map(r => r.x2)), y2: Math.max(...rs.map(r => r.y2)),
        };
      }
      return {
        L,
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        stripRect: rect(strip),
        textRect,
        stripImgs: document.querySelectorAll('#fin-strip .pull img').length,
        brokenImgs: Array.from(document.querySelectorAll('#fin-strip .pull img'))
          .filter(i => !i.complete || i.naturalWidth === 0).length,
        title: document.title,
        errlog: document.getElementById('errlog') ? document.getElementById('errlog').textContent : null,
      };
    });

    console.log('\n===== ' + v.name + ' (' + v.w + 'x' + v.h + ') =====');
    if (!info.L) { console.log('  !! 无 __layoutInfo'); fail++; await ctx.close(); continue; }
    const L = info.L;
    console.log('  band', L.bandTop, '-', L.bandBottom, ' ps=' + L.ps);

    const half = L.ps / 2;
    const boxes = Object.entries(L.map).map(([k, [x, y]]) => {
      const s = (L.sizes && L.sizes[k]) ? L.sizes[k] : [L.ps, L.ps];
      return { k, x1: x - s[0] / 2, y1: y - s[1] / 2, x2: x + s[0] / 2, y2: y + s[1] / 2 };
    });

    const inter = (a, b) => {
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      return (ox > 1 && oy > 1) ? { ox, oy } : null;
    };

    const bad = [];
    for (const b of boxes) {
      if (b.x1 < -0.5 || b.x2 > info.innerW + 0.5) bad.push(b.k + ' 横向出界 [' + b.x1.toFixed(0) + ',' + b.x2.toFixed(0) + ']');
      if (b.y1 < -0.5 || b.y2 > info.innerH + 0.5) bad.push(b.k + ' 纵向出界 [' + b.y1.toFixed(0) + ',' + b.y2.toFixed(0) + ']');
      if (info.stripRect) {
        const it = inter(b, info.stripRect);
        if (it) bad.push(b.k + ' 与祈愿条重叠 ' + it.ox.toFixed(0) + '×' + it.oy.toFixed(0));
      }
      if (info.textRect) {
        const it = inter(b, info.textRect);
        if (it) bad.push(b.k + ' 与文案重叠 ' + it.ox.toFixed(0) + '×' + it.oy.toFixed(0));
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const it = inter(boxes[i], boxes[j]);
        if (it) bad.push(boxes[i].k + '×' + boxes[j].k + ' 互相重叠 ' + it.ox.toFixed(0) + '×' + it.oy.toFixed(0));
      }
    }
    if (info.stripImgs !== 3) bad.push('祈愿条角色卡数异常: ' + info.stripImgs);
    if (info.brokenImgs > 0) bad.push('祈愿条有 ' + info.brokenImgs + ' 张图加载失败');
    if (info.title && info.title.indexOf('MAP') === 0) bad.push('document.title 被污染: ' + info.title);
    if (info.errlog) bad.push('errlog: ' + info.errlog.slice(0, 200));
    if (errs.length) bad.push('JS 错误: ' + errs.slice(0, 3).join(' | '));

    if (bad.length) { console.log('  ✗ ' + bad.join('\n  ✗ ')); fail++; }
    else console.log('  ✓ ' + boxes.length + ' 个 sprite 在界内 / 不压祈愿条 / 不压文案 / 互不重叠');

    await page.screenshot({ path: `E:/xxjz/tevat-archive/_dev/shots/finale_${v.name}.png` });
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (fail ? '✗ 有 ' + fail + ' 个视口未通过' : '✓ 全部视口通过'));
  process.exit(fail ? 1 : 0);
})();
