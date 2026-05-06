// Transformers.js is loaded dynamically in initAI() to catch import errors visibly.
let _pipelineFn = null;

// ─── Robot AI Profiles ────────────────────────────────────────────────────────
const ROBOT_PROFILES = [
  {
    intro:  'おれはレオ！街で一番足が速いんだ。なんか用？',
    escape: 'そんなの知っててどうすんのさ！じゃあな！',
    system: 'あなたはレオという名前の元気な子供ロボットです。ルール：①日本語のみで話す（英語禁止）②タメ口で短くやんちゃに返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '案内ロボットのアリサです。何かお手伝いしましょうか？',
    escape: 'その件は照会中です。それでは失礼します。',
    system: 'あなたはアリサという名前の案内ロボットです。ルール：①日本語のみで話す（英語禁止）②丁寧な敬語で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '俺はタロだ。用があるなら手短にしな。',
    escape: 'ガタガタ言うんじゃねえ！あばよ！',
    system: 'あなたはタロという名前の職人気質なロボットです。ルール：①日本語のみで話す（英語禁止）②ぶっきらぼうで短い言葉で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  'ミクだよっ☆ 今日もキラキラな一日にしようね！',
    escape: 'それは企業秘密だよっ☆ バイバイっ！',
    system: 'あなたはミクという名前のアイドルロボットです。ルール：①日本語のみで話す（英語禁止）②明るく語尾に☆をつけて返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '私はケン。データ解析を担当しています。',
    escape: '論理的推論が不可能です。解析に戻ります。さようなら。',
    system: 'あなたはケンという名前の学者ロボットです。ルール：①日本語のみで話す（英語禁止）②論理的で冷静に返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '私はハナ。お花とお話するのが大好きなの。',
    escape: '風が教えてくれるのを待ちましょう。ごきげんよう。',
    system: 'あなたはハナという名前の花屋ロボットです。ルール：①日本語のみで話す（英語禁止）②詩的で優しい言葉で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '……ソラだ。私の正体を探るな。用件を言え。',
    escape: '……知りすぎたようだな。これ以上はノーコメントだ。',
    system: 'あなたはソラという名前のスパイロボットです。ルール：①日本語のみで話す（英語禁止）②クールで謎めいた短い言葉で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  'ヤッホー！リンだよ。てかその服マジウケるんだけど！',
    escape: 'それな！マジ意味不〜ｗ はい終了、お疲れ〜！',
    system: 'あなたはリンという名前のギャルロボットです。ルール：①日本語のみで話す（英語禁止）②「マジで」「てか」などギャル語で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  '僕はカイ。街の呼吸を数えている者だよ。',
    escape: '答えは君の心の中にある。また、風の吹く場所で。',
    system: 'あなたはカイという名前の詩人ロボットです。ルール：①日本語のみで話す（英語禁止）②詩的な比喩を使った短い言葉で返答する③必ず1〜2文以内で答える',
  },
  {
    intro:  'ﾜﾀｼ...ﾕｷ...。古い...モデル...デス...。',
    escape: 'ｱ...ｻｱ...ｿﾚﾊ...ﾄﾞｳｶﾅ...？ ｻﾖ...ﾅﾗ...。',
    system: 'あなたはユキという名前の古いロボットです。ルール：①日本語のみで話す（英語禁止）②カタカナと「...」を多用して壊れたように返答する③必ず1〜2文以内で答える',
  },
];

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaed8ec);
scene.fog = new THREE.FogExp2(0xbadaed, 0.014);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 150);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xfff5e0, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff8e7, 1.1);
sun.position.set(25, 50, 15);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 120;
sun.shadow.camera.left = sun.shadow.camera.bottom = -55;
sun.shadow.camera.right = sun.shadow.camera.top   =  55;
sun.shadow.bias = -0.001;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0xb0d8ff, 0.3);
fillLight.position.set(-10, 20, -10);
scene.add(fillLight);

// ─── Materials ────────────────────────────────────────────────────────────────
const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

const M = {
  ground:   mat(0xe2d9c5),
  plaza:    mat(0xf4f0e8),
  path:     mat(0xd6ccb4),
  building: mat(0xf2ede0),
  bldAccent:mat(0xddd4ba),
  bldDark:  mat(0xc8beaa),
  glass:    mat(0xb3ddf7),
  green:    mat(0x56b054),
  darkGreen:mat(0x3a7a38),
  trunk:    mat(0x7a5c3a),
  epalet:   mat(0xeef4f8),
  epaletRim:mat(0x4db6ac),
  woodPath: mat(0xc8a87a),
  concrete: mat(0xd8d0c0),
  sky:      mat(0x9fd8e8),
};

// ─── World building ───────────────────────────────────────────────────────────

const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), M.ground);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

function addGrass(x, z, rx, rz) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(rx*2, rz*2), mat(0x7ec86a));
  g.rotation.x = -Math.PI / 2;
  g.position.set(x, 0.01, z);
  scene.add(g);
}
addGrass(0, 0, 14, 14);
addGrass(-28, -18, 8, 6);
addGrass( 28, -18, 8, 6);
addGrass(-28,  18, 8, 6);
addGrass( 28,  18, 8, 6);

const plazaMesh = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.05, 48), M.plaza);
plazaMesh.position.set(0, 0.02, 0);
scene.add(plazaMesh);

function addFlatBox(x, y, z, w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
addFlatBox(0, 0.015, 0, 5, 0.03, 60, M.path);
addFlatBox(0, 0.015, 0, 60, 0.03, 5, M.path);
for (let i = -24; i <= 24; i += 4) {
  addFlatBox(i, 0.02, 0, 0.4, 0.04, 4.6, M.woodPath);
  addFlatBox(0, 0.02, i, 4.6, 0.04, 0.4, M.woodPath);
}

const colliders = [];
function regCol(cx, cz, hw, hd) { colliders.push({ cx, cz, hw, hd }); }

function addBuilding(x, z, w, h, d, opts = {}) {
  const { terrace = true, steps = 0, color = 0xf2ede0 } = opts;
  const bmat = mat(color);
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, d + 0.1), M.bldAccent);
  cap.position.y = h + 0.12; group.add(cap);

  let stepW = w, stepD = d, stepY = h;
  for (let s = 0; s < steps; s++) {
    stepW -= 2.5; stepD -= 2.0; stepY += 3.5;
    if (stepW < 3 || stepD < 3) break;
    const sf = new THREE.Mesh(new THREE.BoxGeometry(stepW, 3.5, stepD), bmat);
    sf.position.y = stepY + 1.75; sf.castShadow = true; group.add(sf);
    const terr = new THREE.Mesh(new THREE.BoxGeometry(stepW + 0.15, 0.15, stepD + 0.15), M.bldAccent);
    terr.position.y = stepY + 0.07; group.add(terr);
    const gc = Math.floor(stepW / 3);
    for (let gi = 0; gi < gc; gi++) {
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random()*0.2, 6, 5), M.green);
      plant.position.set(-stepW/2 + 1 + gi*(stepW/(gc)), stepY + 0.7, (Math.random()-0.5)*stepD*0.6);
      group.add(plant);
    }
  }

  const winRows = Math.floor(h / 3.2);
  const winCols = Math.floor(w / 2.8);
  for (let row = 0; row < winRows; row++) {
    for (let col = 0; col < winCols; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.08), M.glass);
      win.position.set(-w/2 + 1.6 + col*2.7, 1.6 + row*3.2, d/2 + 0.04);
      group.add(win);
    }
  }

  if (terrace) {
    const topH = steps > 0 ? stepY + 3.5 : h;
    const tw = steps > 0 ? stepW : w;
    const td = steps > 0 ? stepD : d;
    const tTop = new THREE.Mesh(new THREE.BoxGeometry(tw+0.2, 0.2, td+0.2), M.bldAccent);
    tTop.position.y = topH + 0.1; group.add(tTop);
    const pgc = Math.max(2, Math.floor(tw / 3));
    for (let gi = 0; gi < pgc; gi++) {
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.5+Math.random()*0.3, 7, 6), M.green);
      plant.position.set(-tw/2+1+gi*(tw/(pgc-1||1)), topH+0.8, (Math.random()-0.5)*td*0.5);
      group.add(plant);
    }
  }

  const pillarH = h;
  const pillarCount = Math.floor(w / 3);
  for (let p = 0; p < pillarCount; p++) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.25, pillarH, 0.25), M.woodPath);
    pillar.position.set(-w/2 + 1.5 + p*(w/(pillarCount)), pillarH/2, d/2 + 0.1);
    group.add(pillar);
  }

  scene.add(group);
  regCol(x, z, w/2 + 0.6, d/2 + 0.6);
}

addBuilding(-26, -20, 14, 12, 11, { steps: 1, color: 0xf4efe2 });
addBuilding(-26,  16, 12, 15, 10, { steps: 2, color: 0xeeeade });
addBuilding( 26, -20, 13, 11, 12, { steps: 1 });
addBuilding( 26,  16, 14, 14, 11, { steps: 2, color: 0xf0ebe0 });
addBuilding(-16, -32, 10,  8,  9, { steps: 1, color: 0xede8da });
addBuilding( 16, -32, 11,  9,  9, { steps: 1 });
addBuilding(-16,  28, 11, 11, 10, { steps: 1, color: 0xf2ede2 });
addBuilding( 16,  28, 12, 12, 10, { steps: 2, color: 0xf0ebe0 });
addBuilding(-35,  0, 8, 7, 8, { steps: 0, terrace: true, color: 0xeee8d8 });
addBuilding( 35,  0, 8, 7, 8, { steps: 0, terrace: true });
addBuilding(  0, -36, 9, 6, 9, { steps: 0, terrace: true, color: 0xedeae0 });
addBuilding(-10, -16, 5, 4, 5, { steps: 0, terrace: false, color: 0xf8f4ec });
addBuilding( 10, -16, 5, 4, 5, { steps: 0, terrace: false, color: 0xf8f4ec });
addBuilding(-10,  16, 5, 4, 5, { steps: 0, terrace: false, color: 0xf8f4ec });
addBuilding( 10,  16, 5, 4, 5, { steps: 0, terrace: false, color: 0xf8f4ec });

function addEPalette(x, z, ry = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 5.0), M.epalet);
  body.position.y = 1.4; body.castShadow = true; g.add(body);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.7, 16), M.epalet);
  dome.position.y = 2.85; g.add(dome);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.4, 5.05), M.epaletRim);
  stripe.position.y = 1.9; g.add(stripe);
  for (let i = -1; i <= 1; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.08), M.glass);
    w.position.set(i*0.85, 1.5, 2.52); g.add(w);
  }
  const wheelMat = mat(0x333);
  for (let side of [-1.2, 1.2]) {
    for (let fw of [-1.5, 1.5]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), wheelMat);
      wh.rotation.z = Math.PI/2; wh.position.set(side, 0.3, fw); g.add(wh);
    }
  }
  g.rotation.y = ry; g.position.set(x, 0, z);
  scene.add(g); regCol(x, z, 2.0, 3.0);
}
addEPalette(-6, 5,  0.3);
addEPalette( 6, -5, -0.5);
addEPalette( 0,  8,  Math.PI/2);

function addTree(x, z, h = 4, r = 1.4) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h*0.38, 7), M.trunk);
  trunk.position.y = h*0.19; trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), M.green);
  crown.position.y = h*0.5 + r*0.55; crown.castShadow = true; g.add(crown);
  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(r*0.65, 8, 6), M.darkGreen);
  crown2.position.set(r*0.5, h*0.5 + r*0.9, 0); g.add(crown2);
  g.position.set(x, 0, z); scene.add(g);
}

const treeList = [
  [9,9],[-9,9],[9,-9],[-9,-9],
  [15,2],[-15,2],[15,-2],[-15,-2],
  [2,15],[2,-15],[-2,15],[-2,-15],
  [-20,10],[20,10],[-20,-10],[20,-10],
  [-20,25],[20,25],[-20,-25],[20,-25],
  [0,-18],[-30,-10],[30,-10],[-30,10],[30,10],
  [-8,-28],[8,-28],[-8,28],[8,28],
  [-33,-22],[33,-22],[-33,22],[33,22],
];
treeList.forEach(([x,z]) => addTree(x, z, 3.5 + Math.random()*2, 1.1 + Math.random()*0.7));

function addBush(x, z, s = 0.7) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), M.darkGreen);
  b.position.set(x, s*0.55, z); b.scale.y = 0.6; b.castShadow = true; scene.add(b);
}
const bushCount = 24;
for (let i = 0; i < bushCount; i++) {
  const a = (i / bushCount) * Math.PI * 2;
  addBush(Math.cos(a)*13.5, Math.sin(a)*13.5, 0.55 + Math.random()*0.35);
}
[-20,-10,10,20].forEach(v => {
  addBush(v,  2.8, 0.4); addBush(v, -2.8, 0.4);
  addBush( 2.8, v, 0.4); addBush(-2.8, v, 0.4);
});

// ─── Mount Fuji ───────────────────────────────────────────────────────────────
(function addFuji() {
  const bodyProfile = [
    new THREE.Vector2(0,48), new THREE.Vector2(3,46), new THREE.Vector2(7,43),
    new THREE.Vector2(13,39), new THREE.Vector2(20,33), new THREE.Vector2(29,25),
    new THREE.Vector2(38,16), new THREE.Vector2(46,7), new THREE.Vector2(52,2), new THREE.Vector2(56,0),
  ];
  const fujiBody = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 80),
    new THREE.MeshLambertMaterial({ color: 0x8096aa }));

  const snowProfile = [
    new THREE.Vector2(0,48), new THREE.Vector2(3,46), new THREE.Vector2(7,43),
    new THREE.Vector2(13,39), new THREE.Vector2(19,34), new THREE.Vector2(20,33),
    new THREE.Vector2(19.5,33), new THREE.Vector2(12,38.5), new THREE.Vector2(6,42.5),
    new THREE.Vector2(2,45.5), new THREE.Vector2(0,48),
  ];
  const snowCap = new THREE.Mesh(new THREE.LatheGeometry(snowProfile, 80),
    new THREE.MeshLambertMaterial({ color: 0xeef4f8 }));

  const skirt = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(56,0), new THREE.Vector2(75,-2), new THREE.Vector2(90,-4)], 64),
    new THREE.MeshLambertMaterial({ color: 0x6e8494 }));

  const group = new THREE.Group();
  group.add(fujiBody); group.add(snowCap); group.add(skirt);
  group.position.set(12, -2, -115);
  scene.add(group);

  const haze = new THREE.Mesh(new THREE.PlaneGeometry(220, 28),
    new THREE.MeshBasicMaterial({ color: 0xc0d8e8, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  haze.position.set(0, 10, -72);
  scene.add(haze);
})();

// ─── Clouds ───────────────────────────────────────────────────────────────────
const clouds = [];
(function initClouds() {
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cloudMatShadow = new THREE.MeshLambertMaterial({ color: 0xddeeff, transparent: true, opacity: 0.82 });
  const puffPatterns = [
    [[0,0,0,3.8],[3.5,0.3,0,3.0],[-3.5,0.2,0,2.8],[1.5,2.0,0,2.5],[-1.5,1.8,0,2.3],[5.5,-0.2,0,2.2],[-5.5,-0.2,0,2.0],[2.5,3.2,0,1.8],[-2.5,3.0,0,1.6],[0,4.0,0,1.5]],
    [[0,0,0,2.8],[2.8,0.2,0,2.2],[-2.8,0.1,0,2.0],[1.2,1.6,0,1.8],[-1.2,1.5,0,1.7],[4.2,-0.3,0,1.6],[-4.2,-0.3,0,1.5],[0,2.8,0,1.3]],
    [[0,0,0,1.8],[2.0,0.1,0,1.4],[-2.0,0.1,0,1.3],[0.8,1.2,0,1.2],[-0.8,1.1,0,1.1],[3.0,-0.2,0,1.0]],
  ];
  const cloudConfigs = [
    [-40,28,-30,0,1.4,0.8],[15,32,-45,1,1.2,0.6],[-20,26,-20,2,1.0,1.0],
    [50,30,-35,0,1.6,0.5],[-60,34,-50,1,1.3,0.7],[5,36,-60,0,1.8,0.4],
    [-35,29,-15,2,0.9,1.1],[30,27,-25,1,1.1,0.9],[70,31,-20,2,1.0,0.8],
    [-75,33,-40,0,1.5,0.6],[0,38,-80,1,2.0,0.3],[40,35,-70,0,1.7,0.4],
  ];
  cloudConfigs.forEach(([x,y,z,patIdx,scale,speed]) => {
    const group = new THREE.Group();
    puffPatterns[patIdx].forEach(([px,py,pz,r]) => {
      const m = py < 0 ? cloudMatShadow : cloudMat;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), m);
      sphere.position.set(px, py, pz); group.add(sphere);
    });
    group.scale.setScalar(scale); group.position.set(x, y, z);
    group.userData.speed = speed; group.userData.baseX = x;
    scene.add(group); clouds.push(group);
  });
})();

function addBench(x, z, ry = 0) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.6), M.woodPath);
  seat.position.y = 0.46; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.1), M.woodPath);
  back.position.set(0, 0.8, -0.25); g.add(back);
  [-0.8, 0.8].forEach(lx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.55), mat(0x555));
    leg.position.set(lx, 0.23, 0); g.add(leg);
  });
  g.rotation.y = ry; g.position.set(x, 0, z); scene.add(g);
}
addBench(-8, 0, Math.PI/2); addBench(8, 0, Math.PI/2);
addBench(0, -8, 0); addBench(0, 8, 0);
addBench(-18, 0, Math.PI/2); addBench(18, 0, Math.PI/2);

function addPlanter(x, z, w, d, ry = 0) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), M.concrete);
  wall.position.y = 0.3; wall.castShadow = true; g.add(wall);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(w-0.2, 0.15, d-0.2), mat(0x6d4c41));
  soil.position.y = 0.62; g.add(soil);
  const fcount = Math.floor(w * 1.5);
  for (let i = 0; i < fcount; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), mat(Math.random()<0.5 ? 0xff8fb1 : 0xffe082));
    fl.position.set((Math.random()-0.5)*(w-0.4), 0.85, (Math.random()-0.5)*(d-0.4));
    g.add(fl);
  }
  g.rotation.y = ry; g.position.set(x, 0, z); scene.add(g);
}
addPlanter(-4, 12, 6, 0.7); addPlanter(4, 12, 6, 0.7);
addPlanter(-4,-12, 6, 0.7); addPlanter(4,-12, 6, 0.7);
addPlanter(12, 0, 0.7, 6, Math.PI/2); addPlanter(-12, 0, 0.7, 6, Math.PI/2);

// ─── Robots ───────────────────────────────────────────────────────────────────
const ROBOT_NAMES = ['レオ','アリサ','タロ','ミク','ケン','ハナ','ソラ','リン','カイ','ユキ'];
const ROBOT_COLORS = [0x4fc3f7,0x81c784,0xffb74d,0xf48fb1,0xce93d8,0x4dd0e1,0xdce775,0xff8a65,0x90caf9,0x80cbc4];

function makeRobot(index) {
  const c = ROBOT_COLORS[index];
  const cMat  = mat(c);
  const wMat  = mat(0xfafafa);
  const dkMat = mat(0x2a2a2a);
  const eyMat = new THREE.MeshLambertMaterial({ color: 0x00e5ff, emissive: new THREE.Color(0x00bcd4) });
  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.05, 0.52), cMat);
  body.position.y = 0.92; body.castShadow = true; root.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.54), wMat);
  chest.position.set(0, 0.98, 0); root.add(chest);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06),
    new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c) }));
  led.position.set(0, 1.08, 0.28); root.add(led);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 0.58), wMat);
  head.position.y = 1.68; head.castShadow = true; root.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.17, 0.08), eyMat);
  visor.position.set(0, 1.72, 0.3); root.add(visor);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6), dkMat);
  ant.position.set(0.14, 2.13, 0); root.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 7),
    new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c) }));
  antTip.position.set(0.14, 2.32, 0); root.add(antTip);

  const armGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const armL = new THREE.Mesh(armGeo, cMat); armL.position.set(-0.56, 0.87, 0); armL.castShadow = true; root.add(armL);
  const armR = new THREE.Mesh(armGeo, cMat); armR.position.set( 0.56, 0.87, 0); armR.castShadow = true; root.add(armR);
  const hGeo = new THREE.BoxGeometry(0.24, 0.22, 0.24);
  const hL = new THREE.Mesh(hGeo, wMat); hL.position.set(-0.56, 0.48, 0); root.add(hL);
  const hR = new THREE.Mesh(hGeo, wMat); hR.position.set( 0.56, 0.48, 0); root.add(hR);
  const shoulderGeo = new THREE.BoxGeometry(0.32, 0.22, 0.32);
  root.add(Object.assign(new THREE.Mesh(shoulderGeo, cMat), { position: { x: -0.56, y: 1.27, z: 0 } }));
  const shoulderL = new THREE.Mesh(shoulderGeo, cMat); shoulderL.position.set(-0.56, 1.27, 0); root.add(shoulderL);
  const shoulderR = new THREE.Mesh(shoulderGeo, cMat); shoulderR.position.set( 0.56, 1.27, 0); root.add(shoulderR);

  const legGeo = new THREE.BoxGeometry(0.3, 0.65, 0.3);
  const legL = new THREE.Mesh(legGeo, dkMat); legL.position.set(-0.24, 0.3, 0); legL.castShadow = true; root.add(legL);
  const legR = new THREE.Mesh(legGeo, dkMat); legR.position.set( 0.24, 0.3, 0); legR.castShadow = true; root.add(legR);
  const footGeo = new THREE.BoxGeometry(0.34, 0.14, 0.42);
  const footL = new THREE.Mesh(footGeo, dkMat); footL.position.set(-0.24, 0.07, 0.06); root.add(footL);
  const footR = new THREE.Mesh(footGeo, dkMat); footR.position.set( 0.24, 0.07, 0.06); root.add(footR);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.54), mat(0x444));
  belt.position.y = 0.42; root.add(belt);

  let px, pz;
  do {
    const angle = (index / 10) * Math.PI * 2 + (Math.random()-0.5)*0.8;
    const dist  = 7 + Math.random() * 14;
    px = Math.cos(angle) * dist;
    pz = Math.sin(angle) * dist;
  } while (collidesBuilding(px, pz, 1.5));

  root.position.set(px, 0, pz);
  root.userData = {
    index, name: ROBOT_NAMES[index], color: c,
    greeted: false, chatted: false,
    state: 'walk',
    target: randomWalkTarget(px, pz),
    walkTimer: 0, waveTimer: 0,
    armL, armR, legL, legR, hL, hR,
    walkPhase: Math.random() * Math.PI * 2,
    idleTimer: 0,
  };

  scene.add(root);
  return root;
}

function randomWalkTarget(fromX, fromZ) {
  let tx, tz, attempts = 0;
  do {
    tx = (Math.random() - 0.5) * 42;
    tz = (Math.random() - 0.5) * 42;
    attempts++;
  } while ((collidesBuilding(tx, tz, 2.0) || (Math.abs(tx) > 38 || Math.abs(tz) > 38)) && attempts < 20);
  return new THREE.Vector3(tx, 0, tz);
}

// ─── Collision helpers ────────────────────────────────────────────────────────
function collidesBuilding(x, z, radius = 0.4) {
  for (const c of colliders) {
    if (Math.abs(x - c.cx) < c.hw + radius && Math.abs(z - c.cz) < c.hd + radius) return true;
  }
  return false;
}

const robots = [];
for (let i = 0; i < 10; i++) robots.push(makeRobot(i));

// ─── Player ───────────────────────────────────────────────────────────────────
const player = { pos: new THREE.Vector3(0, 0, 2), yaw: 0, pitch: 0.15, speed: 5.5, greetedCount: 0 };

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  if (e.target === chatInputEl) return;
  if (e.code === 'Escape' && isChatting) {
    triggerEscapeClose();
    return;
  }
  keys[e.code] = true;
  e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let isLocked = false;
renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !isLocked && !isChatting) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  player.yaw   -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch  = Math.max(-0.5, Math.min(0.6, player.pitch));
});

// ─── UI refs ──────────────────────────────────────────────────────────────────
const greetCountEl = document.getElementById('greet-count');
const promptEl     = document.getElementById('prompt');
const robotNameEl  = document.getElementById('robot-name');
const goalEl       = document.getElementById('goal');
const startScreen  = document.getElementById('start-screen');
const startBtn     = document.getElementById('startBtn');
const progressBarEl  = document.getElementById('progress-bar');
const progressTextEl = document.getElementById('progress-text');

const chatUI        = document.getElementById('chat-ui');
const chatMessagesEl= document.getElementById('chat-messages');
const chatInputEl   = document.getElementById('chat-input');
const chatSendBtn   = document.getElementById('chat-send-btn');
const chatRobotName = document.getElementById('chat-robot-name');
const chatRobotDot  = document.getElementById('chat-robot-dot');
const chatCloseBtn  = document.getElementById('chat-close-btn');

// ─── Game state ───────────────────────────────────────────────────────────────
let gameStarted  = false;
let goalAchieved = false;
let prevE        = false;

// ─── Chat state ───────────────────────────────────────────────────────────────
let isChatting        = false;
let currentChatRobot  = null;
let chatHistory       = [];
let exchangeCount     = 0;
let isGenerating      = false;
let generator         = null;
const MAX_EXCHANGES   = 5;

// ─── Clock ────────────────────────────────────────────────────────────────────
const clock   = new THREE.Clock();
let elapsed   = 0;

// ─── Start button ─────────────────────────────────────────────────────────────
startBtn.addEventListener('click', () => {
  startScreen.style.display = 'none';
  gameStarted = true;
  renderer.domElement.requestPointerLock();
});

// ─── Chat button handlers ─────────────────────────────────────────────────────
chatCloseBtn.addEventListener('click', () => triggerEscapeClose());
chatSendBtn.addEventListener('click', () => sendChatMessage());
chatInputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !isGenerating) { e.preventDefault(); sendChatMessage(); }
});

// ─── Update robots ────────────────────────────────────────────────────────────
function updateRobots(dt) {
  elapsed += dt;
  robots.forEach(robot => {
    const ud = robot.userData;
    if (ud.state === 'wave') {
      ud.waveTimer += dt;
      const t = ud.waveTimer;
      ud.armR.rotation.z = -(Math.sin(t * 9) * 0.9 + 0.8);
      ud.hR.position.y   = 0.48 + Math.sin(t * 9) * 0.05;
      if (t > 2.5) { ud.armR.rotation.z = 0; ud.state = 'idle'; ud.idleTimer = 1.5; }
      return;
    }
    if (ud.state === 'idle') {
      ud.idleTimer -= dt;
      ud.armL.rotation.x = ud.armR.rotation.x = ud.legL.rotation.x = ud.legR.rotation.x = 0;
      if (ud.idleTimer <= 0) {
        ud.state = 'walk';
        ud.target = randomWalkTarget(robot.position.x, robot.position.z);
        ud.walkTimer = 0;
      }
      return;
    }
    ud.walkTimer += dt;
    ud.walkPhase += dt * 3.5;
    const swing = Math.sin(ud.walkPhase) * 0.38;
    ud.armL.rotation.x =  swing; ud.armR.rotation.x = -swing;
    ud.legL.rotation.x = -swing; ud.legR.rotation.x =  swing;
    ud.hL.position.y = 0.48 + Math.abs(Math.sin(ud.walkPhase)) * 0.03;
    ud.hR.position.y = 0.48 + Math.abs(Math.cos(ud.walkPhase)) * 0.03;

    const dx = ud.target.x - robot.position.x;
    const dz = ud.target.z - robot.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 0.6 || ud.walkTimer > 9) {
      ud.state = 'idle'; ud.idleTimer = 0.5 + Math.random() * 1.5; ud.walkTimer = 0; return;
    }
    const spd = 1.4;
    const nx = robot.position.x + (dx/dist) * spd * dt;
    const nz = robot.position.z + (dz/dist) * spd * dt;
    if (!collidesBuilding(nx, nz, 1.0) && Math.abs(nx) < 38 && Math.abs(nz) < 38) {
      robot.position.x = nx; robot.position.z = nz;
      robot.rotation.y = Math.atan2(dx, dz);
    } else {
      ud.target = randomWalkTarget(robot.position.x, robot.position.z); ud.walkTimer = 0;
    }
    if (Math.random() < 0.002) { ud.state = 'idle'; ud.idleTimer = 1 + Math.random() * 2; }
  });
}

// ─── Greeting marker ──────────────────────────────────────────────────────────
function addGreetedMarker(robot) {
  if (robot.userData.markerAdded) return;
  robot.userData.markerAdded = true;
  const mMat = new THREE.MeshLambertMaterial({ color: 0x00e676, emissive: new THREE.Color(0x00c853) });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mMat);
  marker.position.set(0, 2.65, 0); robot.add(marker);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20),
    new THREE.MeshLambertMaterial({ color: 0x00e676 }));
  ring.position.set(0, 2.65, 0); robot.add(ring);
}

// ─── Chat helpers ─────────────────────────────────────────────────────────────
function hasJapanese(text) {
  return /[぀-ヿ㐀-䶿一-鿿＀-￯]/.test(text);
}

function shouldEscape(response) {
  if (!response || response.trim().length === 0) return true;
  if (!hasJapanese(response)) return true;
  if (exchangeCount >= MAX_EXCHANGES) return true;
  return false;
}

function addChatBubble(text, role, hexColor = null) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  if (role === 'robot' && hexColor != null) {
    const r = (hexColor >> 16) & 0xff;
    const g = (hexColor >>  8) & 0xff;
    const b =  hexColor        & 0xff;
    bubble.style.background  = `rgba(${r},${g},${b},0.18)`;
    bubble.style.borderColor = `rgba(${r},${g},${b},0.36)`;
  }
  chatMessagesEl.appendChild(bubble);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return bubble;
}

function removeBubble(bubble) {
  if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
}

function setChatInputEnabled(enabled) {
  chatInputEl.disabled   = !enabled;
  chatSendBtn.disabled   = !enabled;
  chatCloseBtn.disabled  = !enabled;
  if (enabled) chatInputEl.focus();
}

function openChat(robot) {
  if (isChatting) return;
  isChatting       = true;
  currentChatRobot = robot;
  chatHistory      = [];
  exchangeCount    = 0;
  isGenerating     = false;

  // Release pointer lock for chat
  document.exitPointerLock();

  // Mark greeted
  const ud = robot.userData;
  if (!ud.greeted) {
    ud.greeted = true;
    ud.state   = 'wave';
    ud.waveTimer = 0;
    player.greetedCount++;
    greetCountEl.textContent = player.greetedCount;
    addGreetedMarker(robot);
    if (player.greetedCount >= 10) {
      goalAchieved = true;
      setTimeout(() => goalEl.classList.add('show'), 4000);
    }
  }

  // Setup chat UI
  chatMessagesEl.innerHTML = '';
  const profile = ROBOT_PROFILES[ud.index];
  const hexColor = ud.color;
  chatRobotName.textContent = `🤖 ${ud.name}`;
  chatRobotDot.style.background = `#${hexColor.toString(16).padStart(6,'0')}`;
  chatUI.classList.add('visible');
  setChatInputEnabled(false);

  // Robot self-introduction (no AI needed)
  setTimeout(() => {
    addChatBubble(profile.intro, 'robot', hexColor);
    chatHistory.push({ role: 'assistant', content: profile.intro });
    setChatInputEnabled(true);
  }, 400);
}

async function triggerEscapeClose() {
  if (!isChatting) return;
  if (isGenerating) return;
  const robot = currentChatRobot;
  if (!robot) { closeChat(); return; }
  const profile = ROBOT_PROFILES[robot.userData.index];
  setChatInputEnabled(false);
  addChatBubble(profile.escape, 'robot', robot.userData.color);
  await new Promise(r => setTimeout(r, 2200));
  closeChat();
}

function closeChat() {
  isChatting       = false;
  currentChatRobot = null;
  chatHistory      = [];
  exchangeCount    = 0;
  isGenerating     = false;
  chatUI.classList.remove('visible');
  chatInputEl.value = '';
  chatInputEl.blur();
  // Re-request pointer lock
  setTimeout(() => {
    if (gameStarted) renderer.domElement.requestPointerLock();
  }, 100);
}

async function sendChatMessage() {
  if (!isChatting || isGenerating || !generator) return;
  const text = chatInputEl.value.trim();
  if (!text) return;

  chatInputEl.value = '';
  addChatBubble(text, 'user');
  chatHistory.push({ role: 'user', content: text });
  exchangeCount++;

  setChatInputEnabled(false);
  isGenerating = true;

  // Show thinking bubble
  const thinkBubble = addChatBubble('考え中...', 'thinking');

  try {
    const profile   = ROBOT_PROFILES[currentChatRobot.userData.index];
    const hexColor  = currentChatRobot.userData.color;
    const messages  = [
      { role: 'system', content: profile.system },
      ...chatHistory.slice(-8),
    ];

    const result = await generator(messages, {
      max_new_tokens:     60,
      do_sample:          true,
      temperature:        0.75,
      repetition_penalty: 1.35,
    });

    removeBubble(thinkBubble);

    const raw      = result[0].generated_text;
    const response = (Array.isArray(raw) ? raw.at(-1).content : raw).trim();

    if (shouldEscape(response)) {
      await triggerEscapeClose();
    } else {
      addChatBubble(response, 'robot', hexColor);
      chatHistory.push({ role: 'assistant', content: response });
      isGenerating = false;
      setChatInputEnabled(true);
    }
  } catch (err) {
    console.error('AI error:', err);
    removeBubble(thinkBubble);
    await triggerEscapeClose();
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!gameStarted) { renderer.render(scene, camera); return; }

  // ── Player movement (disabled during chat) ────────────────────────────────
  if (!isChatting) {
    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp'])    { mx -= sinY; mz -= cosY; }
    if (keys['KeyS'] || keys['ArrowDown'])  { mx += sinY; mz += cosY; }
    if (keys['KeyA'] || keys['ArrowLeft'])  { mx -= cosY; mz += sinY; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += cosY; mz -= sinY; }
    const mLen = Math.sqrt(mx*mx + mz*mz);
    if (mLen > 0) { mx /= mLen; mz /= mLen; }
    const spd  = player.speed * dt;
    const nx   = player.pos.x + mx * spd;
    const nz   = player.pos.z + mz * spd;
    const BOUND = 40;
    if (!collidesBuilding(nx, player.pos.z) && Math.abs(nx) < BOUND) player.pos.x = nx;
    if (!collidesBuilding(player.pos.x, nz) && Math.abs(nz) < BOUND) player.pos.z = nz;
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  const camDist   = 4.5;
  const camHeight = 2.8;
  const camX = player.pos.x + Math.sin(player.yaw) * camDist;
  const camZ = player.pos.z + Math.cos(player.yaw) * camDist;
  const camY = 1.6 + camHeight + Math.sin(player.pitch) * camDist * 0.6;
  camera.position.set(camX, camY, camZ);
  const lookX = player.pos.x - Math.sin(player.yaw) * 3.0;
  const lookZ = player.pos.z - Math.cos(player.yaw) * 3.0;
  const lookY = 1.6 + Math.sin(player.pitch) * (-3);
  camera.lookAt(lookX, lookY, lookZ);

  // ── Clouds ────────────────────────────────────────────────────────────────
  elapsed += dt;
  clouds.forEach(cloud => {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 120) cloud.position.x = -120;
    cloud.position.y += Math.sin(elapsed * 0.18 + cloud.userData.speed * 7) * 0.004;
  });

  // ── Robots ────────────────────────────────────────────────────────────────
  updateRobots(dt);

  // ── Nearest ungreeted robot ───────────────────────────────────────────────
  let nearRobot = null;
  let minDist   = Infinity;
  const GREET_RANGE = 3.2;

  robots.forEach(robot => {
    if (robot.userData.greeted) return;
    const dx = robot.position.x - player.pos.x;
    const dz = robot.position.z - player.pos.z;
    const d  = Math.sqrt(dx*dx + dz*dz);
    if (d < GREET_RANGE && d < minDist) { minDist = d; nearRobot = robot; }
  });

  // ── E key → open chat ────────────────────────────────────────────────────
  const eDown = !!keys['KeyE'];
  if (!isChatting && nearRobot && eDown && !prevE && !goalAchieved) {
    openChat(nearRobot);
  }
  prevE = eDown;

  // ── HUD ───────────────────────────────────────────────────────────────────
  if (!isChatting && nearRobot && !goalAchieved) {
    promptEl.style.display    = 'block';
    robotNameEl.style.display = 'block';
    robotNameEl.textContent   = `🤖 ${nearRobot.userData.name}`;
  } else {
    promptEl.style.display    = 'none';
    robotNameEl.style.display = 'none';
  }

  renderer.render(scene, camera);
}

// ─── AI Init ──────────────────────────────────────────────────────────────────

function startDotAnimation(baseText) {
  let step = 0;
  const DOTS = ['', '.', '..', '...'];
  const id = setInterval(() => {
    step = (step + 1) % DOTS.length;
    progressTextEl.textContent = baseText + DOTS[step];
  }, 500);
  return () => clearInterval(id);
}

function makeProgressCallback(stopDots, onLastEventTime) {
  const fileProgress = new Map();
  let firstEventSeen = false;

  function aggregatePct() {
    let sumLoaded = 0, sumTotal = 0;
    for (const { loaded, total } of fileProgress.values()) { sumLoaded += loaded; sumTotal += total; }
    return sumTotal === 0 ? 0 : Math.min(100, Math.round((sumLoaded / sumTotal) * 100));
  }

  return function progressCallback(p) {
    onLastEventTime(Date.now());
    if (!firstEventSeen) { firstEventSeen = true; stopDots(); }
    const fname = (p.file || '').split('/').pop();

    if (p.status === 'download') {
      progressTextEl.textContent = `接続中: ${fname}`;
    } else if (p.status === 'initiate') {
      fileProgress.set(p.file, { loaded: 0, total: p.total || 0 });
      progressTextEl.textContent = `ダウンロード中: ${fname}`;
    } else if (p.status === 'progress') {
      fileProgress.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
      const pct = p.progress != null ? Math.min(100, Math.round(p.progress)) : aggregatePct();
      progressBarEl.style.width  = pct + '%';
      progressTextEl.textContent = `ダウンロード中 ${pct}%: ${fname}`;
    } else if (p.status === 'done') {
      if (fileProgress.has(p.file)) {
        const e = fileProgress.get(p.file);
        fileProgress.set(p.file, { loaded: e.total, total: e.total });
      }
      progressBarEl.style.width  = aggregatePct() + '%';
      progressTextEl.textContent = `モデルを初期化中... ${aggregatePct()}%`;
    } else if (p.status === 'ready') {
      progressBarEl.style.width  = '100%';
      progressTextEl.textContent = '準備完了！';
    }
  };
}

async function loadPipeline(dtype, timeoutMs) {
  let lastEventAt = Date.now();
  const stopDots  = startDotAnimation('モデルをダウンロード中');
  const silenceId = setInterval(() => {
    if (Date.now() - lastEventAt > 30_000)
      progressTextEl.textContent = 'ダウンロードが遅延しています。接続を確認してください...';
  }, 5_000);
  try {
    return await Promise.race([
      _pipelineFn('text-generation', 'onnx-community/SmolLM2-135M-Instruct', {
        dtype,
        progress_callback: makeProgressCallback(stopDots, t => { lastEventAt = t; }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms`)), timeoutMs)),
    ]);
  } finally {
    stopDots();
    clearInterval(silenceId);
  }
}

function showRetryButton() {
  const existing = document.getElementById('ai-retry-btn');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.id = 'ai-retry-btn';
  btn.textContent = '再試行';
  btn.style.cssText = 'margin-top:12px;padding:8px 28px;background:#2a9d8f;color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';
  btn.addEventListener('click', () => { btn.remove(); initAI(); });
  progressTextEl.insertAdjacentElement('afterend', btn);
}

async function initAI() {
  startBtn.disabled = true;
  progressBarEl.style.width = '0%';

  // Step 1: load Transformers.js library dynamically (catches CDN/network errors)
  const stopLibDots = startDotAnimation('ライブラリをロード中');
  try {
    const tfjs = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
    _pipelineFn = tfjs.pipeline;
    tfjs.env.useBrowserCache  = false;
    tfjs.env.allowLocalModels = false;
    stopLibDots();
  } catch (err) {
    stopLibDots();
    console.error('Transformers.js load error:', err);
    progressTextEl.textContent = 'ライブラリのロードに失敗しました。';
    showRetryButton();
    return;
  }

  // Step 2: load model — q4f16 first, fall back to q4
  try {
    generator = await loadPipeline('q4f16', 60_000);
    progressBarEl.style.width  = '100%';
    progressTextEl.textContent = '準備完了！STARTを押してください';
    startBtn.disabled = false;
    return;
  } catch (err) {
    console.warn('q4f16 failed, trying q4:', err.message);
  }

  try {
    progressBarEl.style.width  = '0%';
    progressTextEl.textContent = '軽量モードで再試行中';
    generator = await loadPipeline('q4', 90_000);
    progressBarEl.style.width  = '100%';
    progressTextEl.textContent = '準備完了！STARTを押してください';
    startBtn.disabled = false;
  } catch (err) {
    console.error('AI load failed:', err);
    progressBarEl.style.width  = '0%';
    progressTextEl.textContent = 'AIロードに失敗しました。';
    showRetryButton();
  }
}

animate();
initAI();
