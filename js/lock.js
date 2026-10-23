/* ============================================================
   提瓦特观测站 // ACCESS GATE
   公网访问密码门（客户端校验）
   —— 作用：挡住"随手点开"的人；不构成真正的安全边界
      （密码在 JS 里，看源码即可获得）
   真正的访问控制要靠服务器端（Cloudflare Access / 平台密码保护）
   ============================================================ */
const LOCK = (() => {
  /* ★ 公网访问口令（4 位数字）★
     —— 改这里就能换口令。改完记得同步 index.html 里的提示文案（可选）。
     —— 安全边界：这是客户端校验，口令写在 JS 里，看源码即可获得。
        它的作用是挡住「随手点开 / 链接被随手转发」的人，
        真正要防技术手段，得靠服务器端访问控制（Cloudflare Access 等）。 */
  const PASS = '0928';
  const LEN = 4;
  const KEY = 'lock' + 'tevat';

  const el = () => document.getElementById('lock');
  const inputEl = () => document.getElementById('lock-input');
  const msgEl = () => document.getElementById('lock-msg');
  const dotsEl = () => document.getElementById('lock-dots');

  let unlocked = false;

  function showDots(n) {
    const d = dotsEl();
    if (d) d.textContent = '█'.repeat(n) + '·'.repeat(Math.max(0, LEN - n));
  }

  function fail(text) {
    const m = msgEl();
    if (m) { m.className = 'bad'; m.textContent = text; }
    const g = el();
    if (g) { g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); }
    const i = inputEl();
    if (i) { i.value = ''; }
    showDots(0);
    try { SFX.bad(); } catch (e) { /* 音效未就绪，忽略 */ }
  }

  function unlock() {
    unlocked = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 隐私模式忽略 */ }
    const g = el();
    const m = msgEl();
    if (m) { m.className = 'ok'; m.textContent = 'ACCESS GRANTED · 正在进入…'; }
    if (g) {
      g.style.transition = 'opacity .45s';
      g.style.opacity = '0';
      setTimeout(() => { g.style.display = 'none'; }, 460);
    }
    // 放行开场流程
    setTimeout(() => { try { window.__LOCK_OPEN && window.__LOCK_OPEN(); } catch (e) { } }, 420);
  }

  function tryPass(v) {
    if (unlocked) return;
    if (!v) { fail('请输入访问口令'); return; }
    if (v === PASS) { unlock(); return; }
    fail('ACCESS DENIED · 口令不正确');
  }

  function init() {
    // 本次会话已解锁 → 直接放行
    let had = false;
    try { had = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
    if (had) { unlocked = true; const g = el(); if (g) g.style.display = 'none'; return true; }

    const g = el();
    if (g) g.style.display = 'flex';

    // 首次交互时解锁音频（必须在用户手势内调用）
    const wake = () => {
      try { SFX.ensure(); SFX.unlock(); } catch (e) { /* 忽略 */ }
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
    window.addEventListener('pointerdown', wake, { once: false });
    window.addEventListener('keydown', wake, { once: false });

    const i = inputEl();
    if (i) {
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); tryPass(i.value.trim()); }
        else if (e.key === 'Escape') { i.value = ''; showDots(0); }
        else {
          setTimeout(() => { showDots(i.value.length); }, 0);
        }
      });
      i.addEventListener('input', () => { showDots(i.value.length); });
    }

    // 屏上数字/字母键盘
    document.querySelectorAll('#lock-keys button').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'ok') { tryPass(i ? i.value.trim() : ''); return; }
        if (k === 'del') { if (i) { i.value = i.value.slice(0, -1); showDots(i.value.length); } return; }
        if (i && i.value.length < LEN) { i.value += k; showDots(i.value.length); }
      });
    });

    showDots(0);
    return false;
  }

  return { init, tryPass, isUnlocked: () => unlocked };
})();
window.LOCK = LOCK;
