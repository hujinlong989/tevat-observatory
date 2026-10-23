/* ============================================================
   SFX — 全部 WebAudio 实时合成，无任何音频文件
   ============================================================ */
const SFX = (() => {
  let ctx = null, master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function now() { return ctx.currentTime; }

  /** 单音：方波/三角波，带 ADSR */
  function tone(freq, dur = 0.08, opt = {}) {
    if (!ensure()) return;
    const { type = 'square', vol = 0.08, delay = 0, slide = 0, attack = 0.004 } = opt;
    const t0 = now() + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** 白噪声脉冲（警报、静电） */
  function noise(dur = 0.25, opt = {}) {
    if (!ensure()) return;
    const { vol = 0.06, delay = 0, hp = 400, lp = 6000 } = opt;
    const t0 = now() + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.7;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(hpf); hpf.connect(bp); bp.connect(lpf); lpf.connect(g); g.connect(master);
    src.start(t0);
  }

  /* ---------- 语义化音效 ---------- */
  const type  = () => tone(1400 + Math.random() * 200, 0.018, { vol: 0.035, type: 'square' });
  const key   = () => tone(660, 0.045, { vol: 0.07 });
  const del   = () => tone(220, 0.07, { vol: 0.07, slide: -120 });
  const ok    = () => { tone(880, 0.09, { vol: 0.09 }); tone(1320, 0.13, { vol: 0.09, delay: 0.09 }); };
  const bad   = () => { tone(180, 0.16, { vol: 0.11, type: 'sawtooth', slide: -90 }); noise(0.2, { vol: 0.07 }); };
  const tick  = () => tone(2200, 0.012, { vol: 0.02 });
  const click = () => { tone(500, 0.03, { vol: 0.05 }); tone(300, 0.04, { vol: 0.05, delay: 0.03 }); };
  const unlock = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { vol: 0.09, delay: i * 0.075, type: 'square' })); };
  const glitch = () => { noise(0.35, { vol: 0.1, lp: 12000 }); tone(90, 0.3, { vol: 0.09, type: 'sawtooth', slide: 260 }); };
  const alert = () => {
    for (let i = 0; i < 3; i++) { tone(740, 0.14, { vol: 0.1, delay: i * 0.22, type: 'square' }); tone(560, 0.14, { vol: 0.1, delay: i * 0.22 + 0.11, type: 'square' }); }
  };
  const lock = () => { tone(300, 0.5, { vol: 0.12, type: 'sawtooth', slide: -220 }); noise(0.5, { vol: 0.09 }); };
  const flip = () => tone(900 + Math.random() * 500, 0.03, { vol: 0.045 });

  /* ---------- chiptune 生日歌 ---------- */
  const N = { C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
              C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99 };
  const MELODY = [
    ['G4',.5],['G4',.5],['A4',1],['G4',1],['C5',1],['B4',1],
    ['G4',.5],['G4',.5],['A4',1],['G4',1],['D5',1],['C5',1],
    ['G4',.5],['G4',.5],['G5',1],['E5',1],['C5',1],['B4',1],['A4',1],
    ['F4',1],['F4',1],['E5',1],['C5',1],['D5',1],['C5',1]
  ];
  let musicTimer = null, musicIdx = 0, beat = 0.34;

  function birthdaySong() {
    if (!ensure()) return;
    stopMusic();
    const play = () => {
      const [name, len] = MELODY[musicIdx % MELODY.length];
      const dur = len * beat;
      const f = N[name];
      tone(f, dur * 0.92, { vol: 0.10, type: 'square' });
      tone(f / 2, dur * 0.92, { vol: 0.045, type: 'triangle' });   // 低八度衬底
      if (musicIdx % 2 === 0) noise(0.02, { vol: 0.012, hp: 5000 }); // 轻微打击
      musicIdx++;
      if (musicIdx % MELODY.length === 0) beat = 0.34;
    };
    play();
    musicTimer = setInterval(play, beat * 1000);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  /** 终局：和声垫底（三和弦循环） */
  let padTimer = null;
  function startPad() {
    if (!ensure()) return;
    stopPad();
    const chords = [[130.81,164.81,196.00],[146.83,185.00,220.00],[110.00,138.59,164.81],[174.61,220.00,261.63]];
    let i = 0;
    const play = () => {
      chords[i % chords.length].forEach((f, k) => {
        tone(f, 2.2, { vol: 0.035, type: 'triangle', delay: k * 0.06 });
        tone(f * 2, 2.0, { vol: 0.018, type: 'sine', delay: k * 0.06 });
      });
      i++;
    };
    play();
    padTimer = setInterval(play, 2400);
  }
  function stopPad() { if (padTimer) { clearInterval(padTimer); padTimer = null; } }

  /** 终局烟花：噪声爆裂 + 低频 thump */
  function boom(i = 0) {
    if (!ensure()) return;
    noise(0.45, { vol: 0.09, lp: 3000 + i * 500, delay: 0 });
    tone(70 + i * 10, 0.3, { vol: 0.11, type: 'sine', slide: -35 });
  }
  /** 烟花上升的 whistle */
  function whistle() {
    if (!ensure()) return;
    tone(600, 0.45, { vol: 0.04, type: 'sine', slide: 900 });
  }

  return { ensure, tone, noise, type, key, del, ok, bad, tick, click, unlock, glitch, alert, lock,
           flip, birthdaySong, stopMusic, startPad, stopPad, boom, whistle };
})();
