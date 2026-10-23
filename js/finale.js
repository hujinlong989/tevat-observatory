/* ============================================================
   FINALE — three.js 终局
   清晰照片 + 流动极光 + 多形态粒子烟花（拖尾 / 冲击波 / 升空礼花）
   ============================================================ */
const FINALE = (() => {
  const canvas = document.getElementById('gl');
  const layer = document.getElementById('finale');
  const term = document.getElementById('term');
  let renderer, scene, camera, started = false;
  let fireworkSys = null, bgMat = null, sprites = [], stripEl = null, starMat = null;
  let mouseX = 0, mouseY = 0, tX = 0, tY = 0, clock = null, raf = 0, diagFrame = 0;

  const PALETTE = [
    [1.00, 0.23, 0.30], [1.00, 0.70, 0.28], [1.00, 0.93, 0.55],
    [0.35, 0.91, 0.61], [0.34, 0.91, 1.00], [0.58, 0.45, 1.00],
    [1.00, 0.45, 0.80], [1.00, 1.00, 1.00], [1.00, 0.50, 0.10]
  ];
  const WARM = [
    [1.00, 0.35, 0.18], [1.00, 0.62, 0.20], [1.00, 0.86, 0.42],
    [1.00, 0.96, 0.72], [1.00, 0.78, 0.32], [1.00, 0.46, 0.62]
  ];

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (started) return;
    started = true;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x03040a, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 0, 14);

    stripEl = document.getElementById('fin-strip');

    buildBackground();
    buildStars();
    buildFloating();
    fireworkSys = new Fireworks(scene, 8000);
    resize();               // 必须在对象都建好之后：粒子/星星尺寸依赖缓冲区高度

    clock = new THREE.Clock();
    loop();

    document.addEventListener('pointermove', (e) => {
      tX = (e.clientX / window.innerWidth - 0.5) * 2;
      tY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    // 点哪里就在哪里炸
    canvas.addEventListener('pointerdown', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 13;
      const ny = -(e.clientY / window.innerHeight - 0.5) * 8.5 + 1.2;
      fireworkSys.burst(nx, ny, 2.6 + Math.random());
      fireworkSys.burst(nx + (Math.random() - 0.5) * 2, ny + (Math.random() - 0.5) * 1.5, 2.0 + Math.random() * 0.8, 'ring');
      SFX.boom(fireworkSys.n % 6);
    });

    // 自动放烟花（混合形态）
    setInterval(() => {
      if (!started) return;
      const x = (Math.random() - 0.5) * 15;
      const y = (Math.random() - 0.35) * 7 + 1.2;
      const roll = Math.random();
      const type = roll < 0.42 ? 'sphere' : roll < 0.62 ? 'ring' : roll < 0.82 ? 'willow' : 'palm';
      fireworkSys.burst(x, y, 2.2 + Math.random() * 1.2, type);
      SFX.boom(fireworkSys.n % 6);
    }, 950);

    // 偶尔来一发升空礼花
    setInterval(() => {
      if (!started) return;
      fireworkSys.launch((Math.random() - 0.5) * 11, 1.5 + Math.random() * 4);
    }, 2600);
  }

  function resize() {
    if (!renderer) return;
    const W = window.innerWidth, H = window.innerHeight;
    // 画质上限：既要"绚烂"，也不能把手机 GPU 压垮
    const MAXPIX = 1500000;
    let res = Math.min(window.devicePixelRatio || 1, 1.75);
    if (W * H * res * res > MAXPIX) res = Math.sqrt(MAXPIX / (W * H));
    let bw = Math.max(280, Math.round(W * res));
    let bh = Math.max(200, Math.round(H * res));
    // 缓冲区比例必须 == 相机比例，否则画面被横向拉伸
    const want = W / H;
    if (Math.abs(bw / bh - want) > 0.005) {
      if (bw / bh > want) bh = Math.round(bw / want);
      else bw = Math.round(bh * want);
    }
    renderer.setSize(bw, bh, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    // 粒子/星星按缓冲区高度换算，保持"世界尺寸"恒定（否则高分辨率下会变成大色块）
    if (fireworkSys) fireworkSys.mat.uniforms.uScale.value = bh * 0.5;
    if (starMat) starMat.size = (2.4 * 44) / bh;
    layoutFloating();      // 视口比例变了，照片带位置要跟着重排
  }
  window.addEventListener('resize', resize);

  /* ---------------- 背景：流动极光 ---------------- */
  function buildBackground() {
    const geo = new THREE.PlaneGeometry(120, 70);
    bgMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uFlash: { value: 0 } },
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uT; uniform float uFlash; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 uv = vUv;
          float t = uT*0.05;
          float a = n(vec2(uv.x*3.0 + t, uv.y*2.0))*0.6 + n(vec2(uv.x*7.0-t*1.7, uv.y*4.0))*0.4;
          float band = smoothstep(0.15,0.55, a*0.6 + (1.0-uv.y)*0.55);
          vec3 c1 = vec3(0.16,0.05,0.32);
          vec3 c2 = vec3(0.42,0.10,0.45);
          vec3 c3 = vec3(0.10,0.30,0.45);
          vec3 col = mix(c1, c2, smoothstep(0.1,0.6,band));
          col = mix(col, c3, smoothstep(0.55,0.95,band*0.8+0.2*uv.y));
          float g = pow(max(0.0,1.0-abs(uv.y-0.42)*2.2), 2.2);
          col += vec3(0.30,0.12,0.35)*g*(0.5+0.5*sin(uT*0.6+uv.x*4.0));
          col *= 0.95;
          col += vec3(0.20,0.15,0.11) * uFlash;          // 爆炸瞬间整屏轻微打亮
          gl_FragColor = vec4(col,1.0);
        }`
    });
    const m = new THREE.Mesh(geo, bgMat);
    m.position.z = -40;
    m.frustumCulled = false;
    scene.add(m);
  }

  /* ---------------- 星空 ---------------- */
  function buildStars() {
    const N = 1200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 55;
      pos[i * 3 + 2] = -8 - Math.random() * 28;
      const p = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const b = 0.35 + Math.random() * 0.65;
      col[i * 3] = p[0] * b; col[i * 3 + 1] = p[1] * b; col[i * 3 + 2] = p[2] * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
    starMat = m.material;
    m.frustumCulled = false;
    scene.add(m);
  }

  /* ---------------- 漂浮立绘（角色 sprite） ----------------
     自适应布局：
       · 先用真实 DOM 占位量出"立绘带"（祈愿结果条下缘 → 文案区上缘）
       · 竖屏：带内排 3+3 两行星座；带太窄自动退化成单行胶片条
       · 宽屏：左右两列（左右有空白，不挡中间的结果条）
     位置用屏幕像素算出，再按相机投影换算成世界坐标。 */
  const FLOAT_ITEMS = [
    { src: 'assets/sprite/hutao.png',   key: 'hutao',   rel: 1.00, z: -6.0 },
    { src: 'assets/sprite/zhongli.png', key: 'zhongli', rel: 0.95, z: -5.4 },
    { src: 'assets/sprite/raiden.png',  key: 'raiden',  rel: 0.99, z: -6.6 },
    { src: 'assets/sprite/ganyu.png',   key: 'ganyu',   rel: 0.93, z: -7.0 },
    { src: 'assets/sprite/nahida.png',  key: 'nahida',  rel: 0.95, z: -5.8 },
    { src: 'assets/sprite/furina.png',  key: 'furina',  rel: 0.97, z: -6.3 }
  ];
  const FLOAT_ORDER = ['hutao', 'zhongli', 'raiden', 'ganyu', 'nahida', 'furina'];

  function buildFloating() {
    const loader = new THREE.TextureLoader();
    FLOAT_ITEMS.forEach(item => {
      loader.load(item.src, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        const img = tex.image;
        const ar = (img && img.height && img.width) ? (img.height / img.width) : 1;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 }));
        s.position.set(0, 0, item.z);
        s.userData = {
          item, z: item.z, ar: ar,
          base: new THREE.Vector3(0, 0, item.z),
          driftX: 0.2, driftY: 0.16,
          ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.3
        };
        s.frustumCulled = false;
        scene.add(s);
        sprites.push(s);
        layoutFloating();     // 贴图就位后立刻定位
      });
    });
  }

  /* 按真实 DOM 占位 + 相机投影，算出每张立绘的屏幕像素位置与高度
     竖屏：祈愿结果条与文案之间的"立绘带"里排 3+3 两行网格
     宽屏：左右两列空白
     全部用屏幕像素定位，再按相机投影换算成世界坐标，任何视口比例都成立 */
  function layoutFloating() {
    if (!sprites.length || !camera) return;
    const W = window.innerWidth, H = window.innerHeight;

    /* 1. 量出立绘带：祈愿结果条下缘 → 文案区上缘 */
    const stripW = (stripEl && stripEl.offsetWidth) ? stripEl.offsetWidth : Math.min(W * 0.9, 560);
    let stripBottom = H * 0.30;
    if (stripEl && stripEl.offsetHeight) stripBottom = stripEl.offsetTop + stripEl.offsetHeight;
    let textTop = H * 0.76;
    const titleEl = document.getElementById('fin-title');
    if (titleEl && titleEl.offsetTop) textTop = titleEl.offsetTop;

    const bandTop = stripBottom + 10;                 // 与结果条留安全距离
    const bandBottom = Math.max(bandTop + 36, textTop - 12);
    const bandH = bandBottom - bandTop;
    const marginL = (W - stripW) / 2;
    const wide = marginL >= 120;

    /* 2. 排位置（像素）—— ps = 立绘高度，宽度按每张贴图真实比例算
          贴图高宽比 ar = 高/宽 → 实际像素宽 = ps * rel / ar（不是统一比例）
          两行三列；宽屏把三列铺开成星座带；带太矮退化成单行六连 */
    const MAP = {};
    const SIZES = {};
    const DEF_AR = 1.62;                  // 贴图没加载完时的兜底比例
    const margin = 12;                    // 视口左右安全边
    const gap = 10;
    const rowH = bandH / 2;
    const row1 = ['hutao', 'zhongli', 'raiden'];
    const row2 = ['ganyu', 'nahida', 'furina'];

    // 每个 key 的宽度系数（相对 ps）：w = ps * rel / ar
    const REL = {};
    FLOAT_ITEMS.forEach(it => { REL[it.key] = it.rel; });
    const coef = {};
    sprites.forEach(s => {
      const u = s.userData;
      coef[u.item.key] = u.item.rel / (u.ar || DEF_AR);
    });
    const coefOf = k => (coef[k] !== undefined ? coef[k] : 0.62);

    // 一行铺开需要的最小 ps（宽度约束）
    function maxPsFor(keys, availW) {
      let sum = 0;
      keys.forEach(k => { sum += coefOf(k); });
      return (availW - gap * (keys.length - 1)) / Math.max(0.001, sum);
    }

    let ps = Math.min(maxPsFor(row1, W - 2 * margin), rowH - 12, 140);
    let single = false;
    if (ps < 48) {                        // 带太矮：退化成单行六连
      single = true;
      ps = Math.min(maxPsFor(FLOAT_ORDER, W - 2 * margin), bandH - 12, 140);
    }
    ps = Math.max(26, ps);

    // 逐行摆放：按各自真实宽度顺序排，居中；宽屏时把余量摊进列间距
    function placeRow(keys, centerY, spread) {
      const ws = keys.map(k => ps * coefOf(k));
      const sum = ws.reduce((a, b) => a + b, 0);
      let g = gap;
      if (spread) {
        const avail = W - 2 * margin;
        g = gap + Math.max(0, avail - (sum + gap * (keys.length - 1))) / (keys.length - 1);
      }
      const total = sum + g * (keys.length - 1);
      let x = (W - total) / 2;
      keys.forEach((k, i) => {
        MAP[k] = [x + ws[i] / 2, centerY];
        SIZES[k] = [Math.round(ws[i]), Math.round(ps * REL[k])];
        x += ws[i] + g;
      });
    }

    if (single) {
      placeRow(FLOAT_ORDER, bandTop + bandH / 2, false);
    } else {
      placeRow(row1, bandTop + rowH * 0.5, wide);
      placeRow(row2, bandTop + bandH - rowH * 0.5, wide);
    }

    /* 3. 像素 → 世界坐标（相机 fov 垂直、aspect 水平） */
    const halfFov = camera.fov * Math.PI / 360;
    sprites.forEach(s => {
      const u = s.userData;
      const item = u.item;
      const pos = MAP[item.key] || [W / 2, bandTop + bandH / 2];
      const px = pos[0], py = pos[1];

      const d = camera.position.z - u.z;
      const halfH = d * Math.tan(halfFov);
      const halfW = halfH * camera.aspect;
      const worldPerPx = (2 * halfH) / H;
      const world = ps * item.rel * worldPerPx;      // 立绘高度（世界单位）

      u.base.set((px / W - 0.5) * 2 * halfW, (0.5 - py / H) * 2 * halfH, u.z);
      s.scale.set(world / u.ar, world, 1);            // 按贴图真实比例，避免被拉扁
      u.driftX = world * 0.05;
      u.driftY = world * 0.04;
    });

    window.__layoutInfo = { bandTop: Math.round(bandTop), bandBottom: Math.round(bandBottom),
                            ps: Math.round(ps), stripBottom: Math.round(stripBottom),
                            textTop: Math.round(textTop), map: MAP, sizes: SIZES };
  }

  /* ============================================================
     粒子烟花：球爆 / 环形 / 柳条 / 棕榈 + 拖尾 + 冲击波 + 升空礼花
     ============================================================ */
  const TYPES = {
    sphere: { n: [150, 240], life: [1.5, 2.4], size: [0.16, 0.30], grav: 1.35, drag: 0.30, ring: false },
    ring:   { n: [130, 190], life: [1.6, 2.5], size: [0.18, 0.32], grav: 0.85, drag: 0.16, ring: true },
    willow: { n: [120, 170], life: [2.6, 4.0], size: [0.20, 0.36], grav: 2.70, drag: 0.44, ring: false, warm: true },
    palm:   { n: [60, 95],   life: [2.2, 3.2], size: [0.24, 0.40], grav: 1.10, drag: 0.20, ring: false, warm: true }
  };

  class Fireworks {
    constructor(sc, max) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3);
      this.prev = new Float32Array(max * 3);
      this.vel = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.siz = new Float32Array(max);
      this.alp = new Float32Array(max);
      this.life = new Float32Array(max);
      this.lifeMax = new Float32Array(max);
      this.grav = new Float32Array(max);
      this.drag = new Float32Array(max);
      this.twPh = new Float32Array(max);
      this.twSp = new Float32Array(max);
      this.rockets = [];
      this.flash = 0;
      this.tt = 0;

      /* 粒子 */
      this.g = new THREE.BufferGeometry();
      this.g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      this.g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
      this.g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 600 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float uScale;
          attribute float size; attribute float alpha; attribute vec3 color;
          varying vec3 vC; varying float vA; varying float vS;
          void main(){
            vC = color; vA = alpha; vS = size;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = size * (uScale / max(0.001,-mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vC; varying float vA; varying float vS;
          void main(){
            vec2 d = gl_PointCoord - vec2(0.5);
            float r = length(d);
            if (r > 0.5) discard;
            float body = smoothstep(0.5, 0.04, r);
            // 亮核半径随粒子大小反向变化：大颗粒不会糊成实心白团
            float cr = clamp(0.055 / max(0.03, vS), 0.05, 0.30);
            float core = smoothstep(cr, 0.0, r) * 0.8;
            vec3 c = mix(vC, vec3(1.0), core * 0.6);
            gl_FragColor = vec4(c * (0.5 + core * 1.35), vA * body);
          }`
      });
      this.points = new THREE.Points(this.g, this.mat);
      this.points.frustumCulled = false;
      sc.add(this.points);

      /* 拖尾 */
      this.lpos = new Float32Array(max * 6);
      this.lcol = new Float32Array(max * 6);
      this.lalp = new Float32Array(max * 2);
      this.lg = new THREE.BufferGeometry();
      this.lg.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3).setUsage(THREE.DynamicDrawUsage));
      this.lg.setAttribute('color', new THREE.BufferAttribute(this.lcol, 3).setUsage(THREE.DynamicDrawUsage));
      this.lg.setAttribute('alpha', new THREE.BufferAttribute(this.lalp, 1).setUsage(THREE.DynamicDrawUsage));
      this.lmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute float alpha; attribute vec3 color;
          varying vec3 vC; varying float vA;
          void main(){ vC = color; vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vC; varying float vA;
          void main(){ gl_FragColor = vec4(vC, vA); }`
      });
      this.lines = new THREE.LineSegments(this.lg, this.lmat);
      this.lines.frustumCulled = false;
      sc.add(this.lines);

      /* 冲击波环 */
      this.rings = [];
      const ringGeo = new THREE.RingGeometry(0.90, 1.0, 72);
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false, blending: THREE.AdditiveBlending
        }));
        m.visible = false; m.frustumCulled = false;
        sc.add(m);
        this.rings.push({ mesh: m, t: 0, dur: 1, s0: 0.2, s1: 8 });
      }
    }

    burst(x, y, power = 2, type = null) {
      const T = TYPES[type] || TYPES.sphere;
      const count = Math.round((T.n[0] + Math.random() * (T.n[1] - T.n[0])) * (0.75 + power * 0.2));
      const base = T.warm ? WARM : PALETTE;
      const main = base[(Math.random() * base.length) | 0];
      for (let k = 0; k < count; k++) {
        const i = this.n % this.max; this.n++;
        const o = i * 3;
        let dx, dy, dz;
        if (T.ring) {
          const a = Math.random() * Math.PI * 2;
          dx = Math.cos(a); dy = Math.sin(a) * 0.86; dz = (Math.random() - 0.5) * 0.18;
        } else {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.max(0, 1 - u * u));
          dx = r * Math.cos(th); dy = r * Math.sin(th) * 0.82 + 0.34; dz = u;
        }
        const sp = (0.85 + Math.random() * 0.65) * power;
        // 初始就有一点散开量，避免所有粒子叠在一点变成实心白团
        this.pos[o] = x + (Math.random() - 0.5) * 0.5;
        this.pos[o + 1] = y + (Math.random() - 0.5) * 0.5;
        this.pos[o + 2] = (Math.random() - 0.5) * 0.7;
        this.prev[o] = this.pos[o]; this.prev[o + 1] = this.pos[o + 1]; this.prev[o + 2] = this.pos[o + 2];
        this.vel[o] = dx * sp; this.vel[o + 1] = dy * sp; this.vel[o + 2] = dz * sp * 0.45;
        const c = Math.random() < 0.26 ? base[(Math.random() * base.length) | 0] : main;
        this.col[o] = c[0]; this.col[o + 1] = c[1]; this.col[o + 2] = c[2];
        this.siz[i] = T.size[0] + Math.random() * (T.size[1] - T.size[0]);
        this.life[i] = this.lifeMax[i] = T.life[0] + Math.random() * (T.life[1] - T.life[0]);
        this.grav[i] = T.grav;
        this.drag[i] = T.drag;
        this.twPh[i] = Math.random() * 6.283;
        this.twSp[i] = 6 + Math.random() * 11;
        this.alp[i] = 0;
      }
      this.shock(x, y, power, main);
      this.flash = Math.min(0.55, this.flash + 0.16 + power * 0.035);
    }

    /* 升空礼花：从底部窜上去，到顶炸开 */
    launch(tx, ty) {
      this.rockets.push({
        x: (Math.random() - 0.5) * 4, y: -7.2,
        vx: (tx - (Math.random() - 0.5) * 4) * 0.12, vy: 6.2 + Math.random() * 1.4,
        tx, ty, trail: 0
      });
    }

    shock(x, y, power, c) {
      let r = this.rings.find(k => !k.mesh.visible);
      if (!r) { r = this.rings[0]; }
      r.mesh.visible = true;
      r.mesh.position.set(x, y, 0.5);
      r.mesh.material.color.setRGB(c[0], c[1], c[2]);
      r.t = 0; r.dur = 0.8; r.s0 = 0.25; r.s1 = 1.5 + power * 0.45;
      r.mesh.scale.setScalar(r.s0);
      r.mesh.material.opacity = 0.30;
    }

    update(dt) {
      this.tt += dt;
      const { pos, prev, vel, col, siz, alp, life, lifeMax, grav, drag, twPh, twSp, max, lpos, lcol, lalp } = this;

      /* 升空礼花 */
      for (let k = this.rockets.length - 1; k >= 0; k--) {
        const r = this.rockets[k];
        r.vy -= 1.1 * dt;
        r.x += r.vx * dt; r.y += r.vy * dt;
        r.trail -= dt;
        if (r.trail <= 0) {
          r.trail = 0.02;
          const i = this.n % this.max; this.n++;
          const o = i * 3;
          pos[o] = r.x; pos[o + 1] = r.y; pos[o + 2] = 0;
          prev[o] = r.x; prev[o + 1] = r.y; prev[o + 2] = 0;
          vel[o] = 0; vel[o + 1] = 0; vel[o + 2] = 0;
          col[o] = 1.0; col[o + 1] = 0.82; col[o + 2] = 0.45;
          siz[i] = 0.30; life[i] = lifeMax[i] = 0.55;
          grav[i] = 0; drag[i] = 0.02;
          twPh[i] = Math.random() * 6.283; twSp[i] = 18;
        }
        if (r.vy <= 0.35 || r.y >= r.ty) {
          this.burst(r.x, Math.min(r.ty, r.y), 2.8, 'willow');
          this.rockets.splice(k, 1);
        }
      }

      for (let i = 0; i < max; i++) {
        const o = i * 3;
        if (life[i] <= 0) {
          if (alp[i] !== 0) {
            alp[i] = 0;
            lalp[i * 2] = 0; lalp[i * 2 + 1] = 0;
          }
          continue;
        }
        life[i] -= dt;
        prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
        vel[o + 1] -= grav[i] * dt;
        const damp = Math.max(0, 1 - drag[i] * dt);
        vel[o] *= damp; vel[o + 1] *= damp; vel[o + 2] *= damp;
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;

        const lf = Math.max(0, life[i] / lifeMax[i]);
        const tw = 0.70 + 0.30 * Math.sin(this.tt * twSp[i] + twPh[i]);
        // 起爆后 0.12 秒内渐亮，避免一上来就是一团实心白
        const ramp = Math.min(1, (lifeMax[i] - life[i]) / 0.12);
        const a = Math.pow(lf, 0.7) * tw * ramp;
        alp[i] = a;
        siz[i] *= (1 - 0.18 * dt);

        const lo = i * 6;
        // 拖尾按速度反推，形成流光（而不是只有一帧长度的短线）
        const TL = 0.11;
        lpos[lo] = pos[o] - vel[o] * TL; lpos[lo + 1] = pos[o + 1] - vel[o + 1] * TL; lpos[lo + 2] = pos[o + 2] - vel[o + 2] * TL;
        lpos[lo + 3] = pos[o]; lpos[lo + 4] = pos[o + 1]; lpos[lo + 5] = pos[o + 2];
        lcol[lo] = col[o] * 0.25; lcol[lo + 1] = col[o + 1] * 0.25; lcol[lo + 2] = col[o + 2] * 0.25;
        lcol[lo + 3] = col[o] * 0.95; lcol[lo + 4] = col[o + 1] * 0.95; lcol[lo + 5] = col[o + 2] * 0.95;
        lalp[i * 2] = 0; lalp[i * 2 + 1] = a * 0.85;
      }

      /* 冲击波 */
      for (const r of this.rings) {
        if (!r.mesh.visible) continue;
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        const e = 1 - Math.pow(1 - k, 3);
        r.mesh.scale.setScalar(r.s0 + (r.s1 - r.s0) * e);
        r.mesh.material.opacity = 0.30 * Math.pow(1 - k, 2);
        if (k >= 1) { r.mesh.visible = false; r.mesh.material.opacity = 0; }
      }

      this.flash *= Math.max(0, 1 - dt * 3.2);

      this.g.attributes.position.needsUpdate = true;
      this.g.attributes.color.needsUpdate = true;
      this.g.attributes.size.needsUpdate = true;
      this.g.attributes.alpha.needsUpdate = true;
      this.lg.attributes.position.needsUpdate = true;
      this.lg.attributes.color.needsUpdate = true;
      this.lg.attributes.alpha.needsUpdate = true;
    }
  }

  /* ---------------- 主循环 ---------------- */
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    if (bgMat) {
      bgMat.uniforms.uT.value = t;
      bgMat.uniforms.uFlash.value = fireworkSys ? fireworkSys.flash : 0;
    }

    /* 漂浮照片 */
    sprites.forEach(s => {
      const u = s.userData;
      s.position.x = u.base.x + Math.sin(t * u.sp + u.ph) * u.driftX;
      s.position.y = u.base.y + Math.cos(t * u.sp * 0.8 + u.ph) * u.driftY;
      s.material.opacity = 0.62 + 0.34 * (0.5 + 0.5 * Math.sin(t * 1.3 + u.ph));
    });

    fireworkSys.update(dt);

    /* 相机视差 */
    mouseX += (tX - mouseX) * 0.045;
    mouseY += (tY - mouseY) * 0.045;
    camera.position.x = mouseX * 1.5;
    camera.position.y = -mouseY * 1.0 + Math.sin(t * 0.3) * 0.15;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if ((diagFrame++ % 20) === 0) {
      const d = document.getElementById('diag');
      if (d) {
        const sizes = renderer.getSize(new THREE.Vector2());
        const _v = new THREE.Vector3();
        let _sp = '';
        sprites.forEach(s2 => {
          _v.copy(s2.position).project(camera);
          _sp += ' ' + s2.userData.item.key + ':' +
            Math.round((_v.x * 0.5 + 0.5) * window.innerWidth) + ',' +
            Math.round((-_v.y * 0.5 + 0.5) * window.innerHeight);
        });
        d.textContent = 'ch=' + scene.children.length +
          ' sprites=' + sprites.length +
          ' asp=' + camera.aspect.toFixed(2) +
          ' vw=' + window.innerWidth + 'x' + window.innerHeight +
          ' cv=' + sizes.x + 'x' + sizes.y +
          ' calls=' + renderer.info.render.calls +
                    ' tri=' + renderer.info.render.triangles +
          ' ' + (window.__band || '') + '|' + _sp;
      }
    }
  }

  /* ---------------- 启动 ---------------- */
  function start() {
    term.classList.add('hidden');
    layer.classList.add('on');
    const bg = document.getElementById('bgfx');
    if (bg) bg.classList.add('hidden');      // 终局隐藏字符雨背景

    /* 淡入（JS 驱动，不依赖 CSS 动画时钟） */
    let fo = 0;
    const ffade = setInterval(() => {
      fo = Math.min(1, fo + 0.06);
      layer.style.opacity = fo;
      if (fo >= 1) clearInterval(ffade);
    }, 45);

    /* 祈愿结果条：三个人从模糊到锐利地浮现 */
    if (stripEl) {
      setTimeout(() => {
        let o = 0;
        const t = setInterval(() => {
          o = Math.min(1, o + 0.055);
          stripEl.style.opacity = o;
          stripEl.style.filter = 'saturate(1.05) blur(' + (6 * (1 - o)).toFixed(2) + 'px)';
          stripEl.style.transform = 'translateX(-50%) scale(' + (0.94 + 0.06 * o).toFixed(3) + ')';
          if (o >= 1) {
            clearInterval(t);
            stripEl.style.filter = 'saturate(1.05)';
            stripEl.style.transform = 'translateX(-50%) scale(1)';
          }
        }, 45);
      }, 520);
    }

    /* 文字依次浮现 */
    const seq = [
      ['fin-title', 1250], ['fin-sub', 2100], ['fin-sign', 2800], ['fin-gift', 3500], ['fin-hint', 4400]
    ];
    seq.forEach(([id, delay]) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        let o = 0;
        const t = setInterval(() => {
          o = Math.min(1, o + 0.07);
          el.style.opacity = o;
          el.style.transform = 'translateY(' + (14 * (1 - o)).toFixed(1) + 'px)';
          if (o >= 1) clearInterval(t);
        }, 45);
      }, delay);
    });

    SFX.ensure();
    setTimeout(() => { SFX.startPad(); SFX.birthdaySong(); }, 400);

    /* 开场礼花：三连爆 + 一发升空 */
    setTimeout(() => { fireworkSys.burst(0, 2.4, 3.4, 'sphere'); SFX.boom(0); }, 700);
    setTimeout(() => { fireworkSys.burst(-6.2, 1.4, 2.8, 'ring'); SFX.boom(1); }, 1000);
    setTimeout(() => { fireworkSys.burst(6.2, 1.8, 2.8, 'sphere'); SFX.boom(2); }, 1300);
    setTimeout(() => { fireworkSys.burst(-2.6, 4.4, 2.4, 'willow'); SFX.boom(3); }, 1750);
    setTimeout(() => { fireworkSys.burst(3.4, 4.0, 2.4, 'palm'); SFX.boom(4); }, 2150);
    setTimeout(() => { fireworkSys.launch(0, 5.2); }, 2600);
  }

  return { start, init };
})();
// 顶层 const 不会挂到 window 上，显式导出一次，避免其他脚本 window.FINALE 取不到
window.FINALE = FINALE;
