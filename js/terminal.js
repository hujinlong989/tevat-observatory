/* ============================================================
   TERMINAL — 提瓦特观测站 / 三层解谜 / 三次反转
   三段密钥 = 三位角色的生日（月+日，4 位）
     L1  0715  往生堂的堂主
     L2  1231  岩王帝君
     L3  0626  稻妻的雷神
   ============================================================ */
const T = (() => {
  const $ = (s) => document.querySelector(s);
  const out = $('#out'), stage = $('#stage'), body = $('#term-body');
  const pwWrap = $('#pw-wrap'), pwLabel = $('#pw-label'), pwDots = $('#pw-dots');
  const pwMsg = $('#pw-msg'), keys = $('#keys'), countEl = $('#count'), alertbar = $('#alertbar');

  let phase = 0, input = '', resolver = null;
  let lockT = null, cdT = null, deadline = 0, replayFn = null;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  /* 状态栏 */
  const footR = document.getElementById('foot-r');
  const footL = document.getElementById('foot-l');
  const foot = document.getElementById('term-foot');
  function setLevel(n, label) { if (footR) footR.textContent = 'LEVEL ' + n + '/3 · ' + label; document.body.dataset.level = String(n); }
  function setFootAlert(txt) { if (footR) footR.textContent = txt; if (foot) foot.classList.add('lock'); }
  function clearFootAlert() { if (foot) foot.classList.remove('lock'); }

  /* ---------------- 输出 ---------------- */
  function mk(cls = '') { const d = document.createElement('div'); d.className = 'line ' + cls; out.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
  const escChar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  async function print(text, cls = '', speed = 24) {
    const d = mk(cls);
    // 行内 <b> 要渲染成真标签：用 textContent 会把 <b>xxx</b> 直接显示成字面量
    let html = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '<' && text.startsWith('<b>', i)) { html += '<b>'; i += 2; continue; }
      if (ch === '<' && text.startsWith('</b>', i)) { html += '</b>'; i += 3; continue; }
      html += escChar(ch);
      d.innerHTML = html;
      body.scrollTop = body.scrollHeight;
      if (ch !== ' ' && ch !== '·') { SFX.type(); await sleep(speed + Math.random() * 24); }
      else await sleep(speed * 0.4);
    }
    await sleep(80);
    return d;
  }
  function gap() { mk('gap'); }
  function shake() { document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 340); }

  /* ---------------- 密码面板 ---------------- */
  function renderDots(len) { pwDots.textContent = '█'.repeat(input.length) + '·'.repeat(Math.max(0, len - input.length)); }
  function showPanel(label, len) {
    pwWrap.classList.remove('hidden', 'locked');
    pwLabel.innerHTML = label; pwLabel.dataset.len = len;
    input = ''; renderDots(len);
    keys.classList.remove('hidden'); SFX.tick();
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }
  function hidePanel() { pwWrap.classList.add('hidden'); keys.classList.add('hidden'); }

  const kbd = document.getElementById('kbd');

  function press(d) {
    if (lockT || !resolver) return;
    const snd = document.getElementById('pw-sound');
    if (snd) snd.classList.add('off');
    const len = +pwLabel.dataset.len || 4;
    if (d === 'del') { if (input.length) { input = input.slice(0, -1); SFX.del(); } }
    else if (d === 'ok') { SFX.click(); submit(); return; }
    else if (/^[0-9]$/.test(d)) { if (input.length >= len) return; input += d; SFX.key(); }
    else return;
    renderDots(len);
    if (kbd) kbd.value = input;
  }
  function submit() {
    if (!resolver) return;
    const len = +pwLabel.dataset.len || 4;
    if (input.length !== len) {
      pwMsg.textContent = `序列长度错误 · 需要 ${len} 位`; pwMsg.className = 'bad';
      SFX.bad(); shake(); input = ''; renderDots(len); return;
    }
    const r = resolver; resolver = null; r(input);
  }
  function buildKeys() {
    keys.innerHTML = '';
    ['1','2','3','4','5','6','7','8','9'].forEach(k => {
      const b = document.createElement('button'); b.textContent = k; b.onclick = () => press(k); keys.appendChild(b);
    });
    let b = document.createElement('button'); b.textContent = 'DEL'; b.className = 'go'; b.onclick = () => press('del'); keys.appendChild(b);
    b = document.createElement('button'); b.textContent = '0'; b.onclick = () => press('0'); keys.appendChild(b);
    b = document.createElement('button'); b.textContent = 'ENTER'; b.className = 'go'; b.onclick = () => press('ok'); keys.appendChild(b);
  }
  const ask = (label, len) => {
    showPanel(label, len);
    if (kbd) {
      kbd.value = '';
      kbd.maxLength = len;
      kbd.oninput = () => {
        const v = (kbd.value || '').replace(/[^0-9]/g, '').slice(0, len);
        if (v !== input) { input = v; SFX.key(); renderDots(len); }
      };
      kbd.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      // 不自动聚焦隐藏输入框：避免手机软键盘弹出顶掉 8bit 键盘
    }
    return new Promise(res => { resolver = res; });
  };

  /* ---------------- 锁定 / 倒计时 ---------------- */
  function lockFor(sec) {
    return new Promise(res => {
      pwWrap.classList.add('locked');
      let left = sec;
      const step = () => {
        pwMsg.className = 'bad';
        pwMsg.textContent = `SYSTEM LOCKDOWN · ${String(left).padStart(2,'0')}s`;
        SFX.tick();
        if (left <= 0) { clearInterval(lockT); lockT = null; pwWrap.classList.remove('locked'); pwMsg.textContent = ''; pwMsg.className = ''; res(); }
        else left--;
      };
      step(); lockT = setInterval(step, 1000);
    });
  }
  function startCountdown(sec) {
    deadline = Date.now() + sec * 1000;
    countEl.classList.add('on'); alertbar.classList.add('on');
    cdT = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      countEl.textContent = 'DECRYPT ' + String(left).padStart(2, '0');
      if (footR) footR.textContent = 'SELF-DESTRUCT ' + left + 's';
      if (left <= 0) {
        clearInterval(cdT); cdT = null;
        countEl.textContent = 'ARCHIVE FROZEN';
        if (footR) footR.textContent = 'ARCHIVE FROZEN';
        pwMsg.className = 'warn';
        pwMsg.textContent = '自毁倒计时结束 · 档案已冻结 · 最后一把钥匙仍然有效';
        SFX.bad();
        setTimeout(() => { countEl.classList.remove('on'); alertbar.classList.remove('on'); }, 1600);
      }
    }, 200);
  }
  const stopCountdown = () => { if (cdT) { clearInterval(cdT); cdT = null; } countEl.classList.remove('on'); alertbar.classList.remove('on'); };

  /* ---------------- 通用密码闸门 ---------------- */
  async function gate(label, len, answer, opt = {}) {
    const { tries = 3, lock = 30, cd = false } = opt;
    let t = 0, attempt = 0;
    pwMsg.textContent = ''; pwMsg.className = '';
    while (true) {
      const lbl = attempt === 0 ? label : (cd ? label + ' · <b>再次尝试</b>' : label + ' · <b>重试</b>');
      const a = await ask(lbl, len);
      if (a === answer) {
        SFX.unlock();
        pwMsg.className = 'ok';
        pwMsg.textContent = 'ACCESS GRANTED · 密钥已接受';
        await sleep(800);
        hidePanel();
        return;
      }
      t++; attempt++;
      SFX.bad(); shake();
      pwMsg.className = 'bad';
      pwMsg.textContent = cd ? 'ACCESS DENIED · 自毁倒计时 −10s'
                             : (t >= tries ? `ACCESS DENIED · 即将锁定` : 'ACCESS DENIED · 密钥无效');
      if (cd) { deadline -= 10000; await lockFor(8); }
      else if (t >= tries) { SFX.lock(); await lockFor(lock); t = 0; await sleep(200); }
      else await sleep(350);
    }
  }

  /* ---------------- 日历（level 2 线索） ---------------- */
  async function calendar() {
    stage.className = 'on';
    stage.innerHTML = `
      <div class="calwrap"><div class="cal" id="cal">
        <div class="top">TIME INDEX</div>
        <div class="flip"><div class="m" id="cm">---</div><div class="d" id="cd">--</div><div class="y" id="cy">----</div></div>
        <div class="noise"></div>
      </div></div>
      <div class="replay" id="replay"></div>`;
    const cm = $('#cm'), cd = $('#cd'), cy = $('#cy'), cal = $('#cal'), rp = $('#replay');

    const flipRun = async () => {
      for (let i = 0; i < 46; i++) {
        cm.textContent = MON[rnd(0, 11)];
        cd.textContent = String(rnd(1, 28)).padStart(2, '0');
        cy.textContent = '20' + rnd(19, 26);
        SFX.flip();
        cal.style.transform = 'scaleX(.94)';
        await sleep(26);
        cal.style.transform = 'scaleX(1)';
        await sleep(50);
      }
      cm.textContent = 'DEC'; cd.textContent = '31'; cy.textContent = '—';
      SFX.ok(); await sleep(350);
      rp.innerHTML = '已停在一页 · <span>点此或按 R 重播</span>';
    };
    await flipRun();
    rp.onclick = () => { if (!lockT) { rp.innerHTML = '重播中 ...'; flipRun(); } };
    replayFn = () => { rp.onclick(); };
  }

  /* ---------------- 观测胶片（level 3 线索） ---------------- */
  function monitor() {
    stage.className = 'on';
    stage.innerHTML = `
      <div class="mon">
        <div class="bar"><span>CAM_02 · SECTOR_B</span><span class="rec">● REC</span></div>
        <div class="pic">
          <img id="monimg" src="assets/sprite/raiden.png" alt="">
          <div class="scanl"></div>
          <div class="stime" id="mtime">06-26 20:26:07</div>
        </div>
      </div>
      <div class="replay" id="replay2"></div>`;
    const mi = $('#monimg'), mt = $('#mtime');
    let t = 7, timer = null;
    const run = () => {
      clearInterval(timer);
      mi.src = 'assets/sprite/raiden.png';
      mt.textContent = '06-26 20:26:07';
      timer = setInterval(() => {
        t -= 1;
        mt.textContent = `06-26 20:26:${String(7 - t).padStart(2, '0')}`;
        if (t <= 0) { clearInterval(timer); mt.textContent = '06-26 20:26:07'; }
      }, 620);
    };
    run();
    $('#replay2').innerHTML = '<span>点此或按 R 重播胶片</span>';
    $('#replay2').onclick = run;
    replayFn = run;
    return run;
  }

  /* ---------------- 序章：接入 ---------------- */
  async function prologue() {
    setLevel(0, 'RECONNECT');
    await print('…连接中 …', 'dim', 12);
    await sleep(300);
    await print('这里是提瓦特观测站，第七号终端。', 'big', 26);
    gap();
    await print('三小时前，观测站与外界断联。', 'zh', 16);
    await print('提瓦特的「星图」暗了下去。', 'zh', 16);
    gap();
    await print('你在控制台前醒来。屏幕上只有一行字：', 'zh', 16);
    gap();
    await print('「找回三段密钥，星图就会重新亮起。」', 'big', 18);
    await print('「密钥不在武器里，也不在圣遗物里。」', 'big', 16);
    await print('「密钥在每一个人的那一天里。」', 'big', 16);
    gap();
    await print('> 接入终端 ...', 'dim', 20);
    await sleep(700);
  }

  /* ---------------- 阶段 ---------------- */
  async function phase1() {
    phase = 1;
    setLevel(1, 'BIRTH-KEY');
    document.body.classList.remove('redmode', 'ambermode');
    await print('提瓦特观测站 // ARCHIVE TERMINAL v1.0', 'big');
    await sleep(200);
    await print('> SOURCE: OBSERVATION NODE / TEVAT', 'dim');
    await print('> MOUNTING BIRTHSIGNATURE CACHE ...', 'dim');
    await sleep(350);
    await print('> 3 TARGETS DETECTED', 'warn');
    await print('> 三份生命档案，全被标记成「已遗忘」。', 'zh dim', 16);
    gap();
    stage.className = 'on';
    stage.innerHTML = `
      <div class="card"><div class="row">
        <img src="assets/sprite/hutao.png" alt="">
        <div class="meta">
          <b>SUBJECT_01</b> · SIGNATURE A<br>
          优先级 <b>MAX</b> · 状态 <b>已遗忘</b><br>
          备注：<b>她掌管生与死，却比谁都爱笑</b><br>
          记录次数 <b>每年一次</b>
        </div>
      </div></div>`;
    await sleep(450);
    await print('> TARGET RESOLVED: 1 OF 3', 'dim');
    await print('> 第一份，就是她的。', 'zh dim', 16);
    gap();
    await print('> 需要第一段密钥才能读取档案。', 'zh');
    await print('> 提示：写下她出生的那一天 —— 档案从她的生日开始记，每年一次。', 'zh dim');
    await gate('> 输入 <b>4 位</b> 序列', 4, '0715', { tries: 3, lock: 30 });
    await print('> KEY ACCEPTED · 0715', 'big');
    await sleep(350);
    await print('> 「往生堂的第七十七代堂主，好像终于想起今天是自己的生日了。」', 'zh big');
    await print('> 「记录已恢复。」', 'zh big');
    gap();
    await print('> 正在校验档案完整性 ...', 'dim');
    await sleep(600);
    await print('> INTEGRITY CHECK FAILED', 'err');
    await print('> 原因：这不是档案。这是一段记忆。', 'warn');
    await sleep(400);
    document.body.classList.add('ambermode', 'glitch');
    SFX.glitch(); await sleep(800);
    document.body.classList.remove('glitch');
    await print('> 递归进入记忆层 · LEVEL 2', 'warn');
  }

  async function phase2() {
    phase = 2;
    setLevel(2, 'TIME-INDEX');
    await print('> LEVEL 2 · 检索时间索引', 'dim');
    await print('> 索引正在翻页 —— 请记住它停在哪一天', 'zh');
    await print('> 索引里存着的，全是本该被记住的日子。', 'zh dim', 16);
    gap();
    await calendar();
    await print('> 索引已锁定 · 需要 4 位日序列', 'dim');
    await print('> 提示：写下那一天 —— 他们称他「岩王帝君」，却很少有人知道他的名字。', 'zh dim');
    await gate('> 输入 <b>4 位</b> 序列', 4, '1231', { tries: 3, lock: 20 });
    await print('> KEY ACCEPTED · 1231', 'big');
    await sleep(300);
    await print('> 「岩王帝君的日历，停在一年的最后一天。」', 'zh big');
    await print('> 「他大概会说，这只是巧合。」', 'zh big');
    gap();
    await print('> 载入观测胶片 ...', 'dim');
    await sleep(400);
    monitor();
    await sleep(1000);
    await print('> 胶片时间戳：<b>06-26 20:26:07</b>', 'warn');
    await print('> 「一年一度的那一天。你还是老样子。」', 'zh big');
    await print('> 档案里那行「每年一次」，记的就是这一天。', 'zh dim', 16);
    gap();
    await print('> 警告：检测到第三段密钥要求', 'err');
    await print('> 档案即将自毁 · 剩余时间有限', 'warn');
    await print('> 倒计时归零，星图将永久熄灭。', 'zh dim', 16);
  }

  async function phase3() {
    phase = 3;
    setLevel(3, 'FINAL-DECRYPT');
    setFootAlert('SELF-DESTRUCT 60s');
    document.body.classList.add('redmode');
    SFX.alert();
    startCountdown(60);
    await print('> LEVEL 3 · FINAL DECRYPT', 'err');
    await print('> 自毁倒计时 60 秒 · 输错扣 10 秒', 'err');
    await print('> 三段密钥凑齐，星图就会重启。', 'zh dim', 16);
    stage.className = 'on';
    stage.innerHTML = `
      <div class="card"><div class="row">
        <img src="assets/sprite/raiden.png" alt="">
        <div class="meta">
          <b>THIRD KEY</b><br>
          线索在 <b>胶片时间戳</b> 里<br>
          那一行是 <b>画面中那个人</b> 的 <b>生日</b><br>
          格式：<b>月 + 日</b>（4 位，月份不足两位补 0）
        </div>
      </div></div>
      <div class="replay" id="replay3"></div>`;
    $('#replay3').innerHTML = '<span>点此或按 R 回看胶片</span>';
    $('#replay3').onclick = () => { monitor(); };
    replayFn = () => { monitor(); };
    await sleep(350);
    await print('> 提示：那是她的生日 —— 从胶片时间戳里取出月和日，写满四位。', 'zh dim');
    await gate('> 输入 <b>4 位</b> 序列', 4, '0626', { tries: 99, lock: 8, cd: true });
    stopCountdown();
    clearFootAlert();
    setLevel(3, 'UNLOCKED');
    await print('> KEY ACCEPTED · 0626', 'big');
    await sleep(450);
    await print('> DECRYPTING 100%', 'big');
    await sleep(650);
    document.body.classList.add('glitch');
    SFX.glitch(); await sleep(850);
    document.body.classList.remove('glitch');
    document.body.classList.remove('redmode');
    await print('> 正在打开最终记录 ...', 'dim');
    await sleep(550);
    stage.className = 'on';
    stage.innerHTML = `
      <div class="card"><div class="row">
        <img src="assets/sprite/nahida.png" alt="">
        <div class="meta">
          <b>FINAL ENTRY</b><br>
          写入者 <b>观测站</b><br>
          写入时机 <b>三段密钥凑齐时</b><br>
          长度 <b>很短的</b>
        </div>
      </div></div>`;
    gap();
    await print('> 「你找回了三个日期。」', 'zh big');
    await print('> 「但日期从来不是密码。」', 'zh big');
    await print('> 「密码是他们的名字。」', 'zh big');
    await print('> 「他们一直都在。」', 'zh big');
    await print('> 「只是太久，没人再叫他们的名字。」', 'zh big');
    gap();
    await print('> 星图重启中 ...', 'dim');
    await sleep(800);
    hidePanel();
    return true;
  }

  async function run() {
    buildKeys();
    out.innerHTML = ''; stage.innerHTML = ''; stage.className = '';
    await prologue();
    await phase1(); await phase2(); await phase3();
    FINALE.start();
  }

  async function runFrom(n) {
    buildKeys();
    out.innerHTML = ''; stage.innerHTML = ''; stage.className = '';
    if (n <= 2) { await phase2(); } else { await phase3(); }
    FINALE.start();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') { press(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
    else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
    else if ((e.key === 'r' || e.key === 'R') && replayFn) { if (!lockT) replayFn(); }
  });

  return { run, runFrom, buildKeys };
})();
