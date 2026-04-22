'use strict';

// ─── Canvas / responsive setup ────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const LW = 400;   // logical width
const LH = 600;   // logical height
let   dpr   = 1;
let   scale = 1;  // CSS display scale (logical → CSS px)

function resizeCanvas() {
  const wrap  = document.getElementById('canvas-wrap');
  const maxW  = Math.min(wrap.clientWidth,  LW);
  const maxH  = Math.min(wrap.clientHeight, LH);
  scale       = Math.min(maxW / LW, maxH / LH);

  const dispW = Math.floor(LW * scale);
  const dispH = Math.floor(LH * scale);

  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width        = dispW * dpr;
  canvas.height       = dispH * dpr;
  canvas.style.width  = dispW + 'px';
  canvas.style.height = dispH + 'px';

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS     = 10;
const BH       = 15;   // block height
const BGAP     = 3;    // block gap
const BW       = Math.floor((LW - 24 - BGAP * (COLS - 1)) / COLS);  // ~35
const BOX      = Math.round((LW - (COLS * BW + BGAP * (COLS - 1))) / 2);
const BOY      = 58;
const PAD_H    = 10;
const PAD_Y    = LH - 36;
const BALL_R   = 7;
const MAX_BALL = 8;

// Row palette: color, highlight, max-hp, score
const PALETTE = [
  { c: '#ff3d71', h: '#ff80a8', hp: 3, sc: 50 },
  { c: '#ff6d00', h: '#ff9e40', hp: 2, sc: 30 },
  { c: '#ffd600', h: '#ffe57f', hp: 2, sc: 22 },
  { c: '#00c853', h: '#69f0ae', hp: 1, sc: 14 },
  { c: '#00b0ff', h: '#80d8ff', hp: 1, sc: 10 },
  { c: '#aa00ff', h: '#ea80fc', hp: 1, sc: 8  },
  { c: '#00bcd4', h: '#84ffff', hp: 1, sc: 6  },
  { c: '#546e7a', h: '#90a4ae', hp: 1, sc: 4  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let gameState  = 'title';
let score      = 0;
let hiScore    = 0;
let lives      = 3;
let level      = 1;
let frame      = 0;
let shakeTimer = 0;
let shakeAmt   = 0;
let combo      = 0;
let comboTimer = 0;

let paddle, balls, blocks, powerups, particles;

// ─── HUD DOM refs ─────────────────────────────────────────────────────────────
const scoreEl  = document.getElementById('score-val');
const levelEl  = document.getElementById('level-val');
const livesEl  = document.getElementById('lives-val');
const hiEl     = document.getElementById('hi-val');
const hint     = document.getElementById('launch-hint');

function updateHUD() {
  scoreEl.textContent = String(score).padStart(7, '0');
  levelEl.textContent = level;
  livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  hiEl.textContent    = String(hiScore).padStart(7, '0');
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ─── Round-rect helper (safe fallback) ───────────────────────────────────────
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnParts(x, y, color, n = 10, fast = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (fast ? 3 : 1.5) + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (fast ? 2 : 0.5),
      life: 18 + Math.random() * 20,
      max: 38,
      r: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

function updateParts() {
  for (const p of particles) {
    p.x  += p.vx; p.y += p.vy;
    p.vy += 0.14;
    p.life--;
  }
  particles = particles.filter(p => p.life > 0);
}

function drawParts() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Power-ups ────────────────────────────────────────────────────────────────
const PU_DEF = {
  wide:  { label: 'WIDE',   color: '#00e676', bg: '#003320' },
  multi: { label: '×3 BALL',color: '#ff80ab', bg: '#330020' },
  slow:  { label: 'SLOW',   color: '#80d8ff', bg: '#001830' },
  plus:  { label: '+BALL',  color: '#ffd740', bg: '#302000' },
};

function spawnPU(x, y) {
  const types = Object.keys(PU_DEF);
  const type  = types[Math.floor(Math.random() * types.length)];
  powerups.push({ x, y, type, vy: 2.0, alive: true });
}

function updatePU() {
  for (const p of powerups) {
    if (!p.alive) continue;
    p.y += p.vy;
    if (p.y > LH + 10) { p.alive = false; continue; }

    const pw = paddle.w;
    if (p.y + 9  >= paddle.y &&
        p.y - 9  <= paddle.y + PAD_H &&
        p.x + 22 >= paddle.x &&
        p.x - 22 <= paddle.x + pw) {
      applyPU(p.type);
      spawnParts(p.x, p.y, PU_DEF[p.type].color, 14, true);
      p.alive = false;

      // CSS toast
      const toast = document.createElement('div');
      toast.className = 'pu-toast';
      toast.textContent = PU_DEF[p.type].label;
      toast.style.color = PU_DEF[p.type].color;
      toast.style.background = PU_DEF[p.type].bg;
      document.getElementById('canvas-wrap').appendChild(toast);
      setTimeout(() => toast.remove(), 1200);
    }
  }
  powerups = powerups.filter(p => p.alive);
}

function applyPU(type) {
  if (type === 'wide') {
    paddle.wideTimer = 420;
  } else if (type === 'multi') {
    const add = [];
    for (const b of balls) {
      if (balls.length + add.length >= MAX_BALL) break;
      const spd = Math.hypot(b.vx, b.vy);
      const a   = Math.atan2(b.vy, b.vx);
      for (const da of [-0.38, 0.38]) {
        if (balls.length + add.length >= MAX_BALL) break;
        add.push({ x: b.x, y: b.y, vx: Math.cos(a+da)*spd, vy: Math.sin(a+da)*spd, trail: [] });
      }
    }
    balls.push(...add);
  } else if (type === 'slow') {
    for (const b of balls) {
      const spd = Math.hypot(b.vx, b.vy);
      const a   = Math.atan2(b.vy, b.vx);
      const ns  = Math.max(2.8, spd * 0.6);
      b.vx = Math.cos(a) * ns; b.vy = Math.sin(a) * ns;
    }
  } else if (type === 'plus') {
    if (balls.length < MAX_BALL) {
      const ref = balls[0];
      balls.push({ x: ref.x, y: ref.y, vx: -ref.vx, vy: ref.vy, trail: [] });
    }
  }
}

function drawPU() {
  for (const p of powerups) {
    if (!p.alive) continue;
    const d = PU_DEF[p.type];
    ctx.save();
    ctx.shadowColor = d.color;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = d.bg;
    rrect(p.x - 24, p.y - 10, 48, 20, 5);
    ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = d.color;
    ctx.font        = 'bold 10px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, p.x, p.y);
    ctx.restore();
  }
}

// ─── Level init ───────────────────────────────────────────────────────────────
function baseSpeed() { return 3.8 + (level - 1) * 0.28; }

function initLevel() {
  const rows = Math.min(PALETTE.length, 3 + Math.ceil(level * 0.6));
  blocks = [];
  for (let r = 0; r < rows; r++) {
    const pal = PALETTE[r % PALETTE.length];
    for (let c = 0; c < COLS; c++) {
      const bonus = level >= 3 && Math.random() < 0.18 ? 1 : 0;
      blocks.push({
        x: BOX + c * (BW + BGAP), y: BOY + r * (BH + BGAP),
        hp: pal.hp + bonus, maxHp: pal.hp + bonus,
        score: pal.sc, color: pal.c, hl: pal.h, alive: true,
      });
    }
  }

  const spd = baseSpeed();
  balls = [{
    x: LW / 2, y: PAD_Y - BALL_R - 1,
    vx: (Math.random() < .5 ? 1 : -1) * spd * 0.7,
    vy: -spd,
    stuck: true,
    trail: [],
  }];

  paddle = {
    x: LW / 2 - 35,
    w: 70,
    wideTimer: 0,
  };

  powerups  = [];
  particles = [];
  combo     = 0;
  comboTimer = 0;
  hint.classList.add('show');
}

function startGame() {
  score = 0; lives = 3; level = 1;
  initLevel();
  gameState = 'playing';
  showOverlay(null);
  updateHUD();
}

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let pointerX = LW / 2;
let pointerDown = false;

function clientToGameX(cx) {
  const rect = canvas.getBoundingClientRect();
  return (cx - rect.left) * (LW / rect.width);
}

canvas.addEventListener('mousemove', e => { pointerX = clientToGameX(e.clientX); });
canvas.addEventListener('mousedown', e => {
  pointerX = clientToGameX(e.clientX);
  pointerDown = true;
});
canvas.addEventListener('mouseup',   () => { pointerDown = false; });

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  pointerX    = clientToGameX(e.touches[0].clientX);
  pointerDown = true;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  pointerX = clientToGameX(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchend', () => { pointerDown = false; });

// ─── Paddle update ────────────────────────────────────────────────────────────
function updatePaddle() {
  const pw = paddle.w;
  const spd = 7;

  if (keys['ArrowLeft'])  paddle.x -= spd;
  if (keys['ArrowRight']) paddle.x += spd;

  // Pointer follow (mouse/touch)
  if (!keys['ArrowLeft'] && !keys['ArrowRight']) {
    paddle.x = pointerX - pw / 2;
  }

  paddle.x = Math.max(0, Math.min(LW - pw, paddle.x));

  if (paddle.wideTimer > 0) {
    paddle.w = 112;
    paddle.wideTimer--;
    if (paddle.wideTimer === 0) paddle.w = 70;
  }

  // Launch on Space or pointer tap
  const launching = (keys['Space'] && !keys['_spc']) || (pointerDown && !keys['_ptr']);
  keys['_spc'] = keys['Space'];
  keys['_ptr'] = pointerDown;

  if (launching && gameState === 'playing') {
    let launched = false;
    balls.forEach(b => { if (b.stuck) { b.stuck = false; launched = true; } });
    if (launched) hint.classList.remove('show');
  }
}

// ─── Ball update ──────────────────────────────────────────────────────────────
function updateBalls() {
  const pw = paddle.w;

  for (const ball of balls) {
    // Trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 6) ball.trail.shift();

    if (ball.stuck) {
      ball.x = paddle.x + pw / 2;
      ball.y = PAD_Y - BALL_R - 1;
      continue;
    }

    // Sub-step to prevent tunnelling
    const substeps = Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / (BALL_R * 0.9));
    for (let s = 0; s < substeps; s++) {
      ball.x += ball.vx / substeps;
      ball.y += ball.vy / substeps;

      // Wall collisions
      if (ball.x - BALL_R < 0)  { ball.x = BALL_R;      ball.vx =  Math.abs(ball.vx); }
      if (ball.x + BALL_R > LW) { ball.x = LW - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - BALL_R < 0)  { ball.y = BALL_R;      ball.vy =  Math.abs(ball.vy); }

      // Paddle
      if (ball.vy > 0 &&
          ball.y + BALL_R >= paddle.y &&
          ball.y - BALL_R <= paddle.y + PAD_H &&
          ball.x          >= paddle.x - 2 &&
          ball.x          <= paddle.x + pw + 2) {
        ball.y  = paddle.y - BALL_R;
        const rel   = (ball.x - (paddle.x + pw / 2)) / (pw / 2);  // -1 .. +1
        const spd   = Math.max(baseSpeed(), Math.hypot(ball.vx, ball.vy));
        const angle = rel * (Math.PI / 2.8);
        ball.vx = Math.sin(angle) * spd;
        ball.vy = -Math.abs(Math.cos(angle) * spd);
        spawnParts(ball.x, ball.y, '#a080ff', 5);
        combo = 0;
      }

      // Block collisions
      for (const blk of blocks) {
        if (!blk.alive) continue;
        if (ball.x + BALL_R < blk.x      || ball.x - BALL_R > blk.x + BW) continue;
        if (ball.y + BALL_R < blk.y      || ball.y - BALL_R > blk.y + BH) continue;

        // Which side?
        const ol = (ball.x + BALL_R) - blk.x;
        const or2 = (blk.x + BW) - (ball.x - BALL_R);
        const ot = (ball.y + BALL_R) - blk.y;
        const ob = (blk.y + BH) - (ball.y - BALL_R);
        const mn = Math.min(ol, or2, ot, ob);
        if (mn === ol || mn === or2) ball.vx *= -1;
        else                        ball.vy *= -1;

        blk.hp--;
        combo++;
        comboTimer = 80;
        const pts = blk.score * (combo >= 5 ? 3 : combo >= 3 ? 2 : 1);
        score += pts;
        shakeTimer = 5; shakeAmt = combo >= 5 ? 4 : 2;
        spawnParts(ball.x, ball.y, blk.color, 7);

        if (blk.hp <= 0) {
          blk.alive = false;
          score += blk.score;
          spawnParts(blk.x + BW/2, blk.y + BH/2, blk.color, 18, true);
          if (Math.random() < 0.13) spawnPU(blk.x + BW/2, blk.y + BH/2);
        }

        updateHUD();
        break;
      }
    }
  }

  // Remove out-of-bounds balls
  balls = balls.filter(b => b.y - BALL_R < LH + 20);
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawBG() {
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, '#0a0020');
  g.addColorStop(1, '#060010');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);

  // subtle grid
  ctx.strokeStyle = 'rgba(80,40,160,0.12)';
  ctx.lineWidth   = 1;
  for (let x = 0; x <= LW; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LH); ctx.stroke();
  }
  for (let y = 0; y <= LH; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke();
  }
}

function drawBlocks() {
  for (const b of blocks) {
    if (!b.alive) continue;
    const ratio = b.hp / b.maxHp;

    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur  = 6 * ratio;

    // Body
    ctx.globalAlpha = 0.45 + 0.55 * ratio;
    ctx.fillStyle   = b.color;
    rrect(b.x + 1, b.y + 1, BW - 2, BH - 2, 3);
    ctx.fill();

    // Shine gradient
    const sg = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BH);
    sg.addColorStop(0, 'rgba(255,255,255,0.45)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle   = sg;
    rrect(b.x + 1, b.y + 1, BW - 2, BH - 2, 3);
    ctx.fill();

    // HP dots for multi-hit blocks
    if (b.maxHp > 1) {
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      const dotR = 3;
      const gap  = 7;
      const total = b.maxHp;
      const startX = b.x + BW/2 - ((total-1)*gap)/2;
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i < b.hp ? b.hl : 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(startX + i*gap, b.y + BH/2, dotR, 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawPaddle() {
  const pw  = paddle.w;
  const isWide = paddle.wideTimer > 0;
  const col1 = isWide ? '#b9f6ca' : '#b388ff';
  const col2 = isWide ? '#00c853' : '#6200ea';
  const glow = isWide ? '#00e676' : '#7c4dff';

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur  = 20;

  const g = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + PAD_H);
  g.addColorStop(0, col1);
  g.addColorStop(1, col2);
  ctx.fillStyle = g;
  rrect(paddle.x, paddle.y, pw, PAD_H, 5);
  ctx.fill();

  // Shine
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = 'rgba(255,255,255,0.35)';
  rrect(paddle.x + 3, paddle.y + 2, pw - 6, 4, 2);
  ctx.fill();

  ctx.restore();
}

function drawBalls() {
  for (const ball of balls) {
    // Trail
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const a = (i + 1) / (ball.trail.length + 1) * 0.4;
      ctx.globalAlpha = a;
      ctx.fillStyle   = '#c0aaff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * 0.55 * (i / ball.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ball glow
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 18;
    const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#99aaff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCombo() {
  if (combo < 2 || comboTimer <= 0) return;
  const alpha = Math.min(1, comboTimer / 30);
  ctx.save();
  ctx.globalAlpha  = alpha;
  ctx.font         = `bold ${14 + combo * 2}px monospace`;
  ctx.fillStyle    = combo >= 5 ? '#ffd740' : '#ff80ab';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.shadowColor  = ctx.fillStyle;
  ctx.shadowBlur   = 10;
  ctx.fillText(`${combo} COMBO!`, LW - 8, 60);
  ctx.restore();
}

// ─── Screen shake ─────────────────────────────────────────────────────────────
function applyShake() {
  if (shakeTimer <= 0) return;
  shakeTimer--;
  const dx = (Math.random() - 0.5) * shakeAmt * 2;
  const dy = (Math.random() - 0.5) * shakeAmt * 2;
  ctx.translate(dx, dy);
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  frame++;

  if (comboTimer > 0) comboTimer--;

  ctx.save();
  applyShake();

  if (gameState === 'playing') {
    updatePaddle();
    updateBalls();
    updatePU();
    updateParts();

    // All blocks cleared
    if (blocks.every(b => !b.alive)) {
      hiScore = Math.max(hiScore, score);
      document.getElementById('clear-sub').textContent = `LEVEL ${level} COMPLETE`;
      document.getElementById('clear-score').textContent = `SCORE  ${String(score).padStart(7,'0')}`;
      showOverlay('ov-clear');
      gameState = 'clear';
      updateHUD();
    }

    // All balls lost
    if (balls.length === 0) {
      lives--;
      updateHUD();
      if (lives <= 0) {
        hiScore = Math.max(hiScore, score);
        document.getElementById('go-sub').textContent =
          score >= hiScore ? 'NEW RECORD! 🏆' : 'SCORE';
        document.getElementById('go-score').textContent = String(score).padStart(7, '0');
        showOverlay('ov-gameover');
        gameState = 'gameover';
        updateHUD();
      } else {
        // Respawn single ball
        const spd = baseSpeed();
        balls = [{
          x: paddle.x + paddle.w / 2,
          y: PAD_Y - BALL_R - 1,
          vx: (Math.random() < .5 ? 1 : -1) * spd * 0.7,
          vy: -spd,
          stuck: true,
          trail: [],
        }];
        hint.classList.add('show');
      }
    }
  }

  // Draw
  drawBG();
  drawBlocks();
  drawPU();
  drawParts();
  drawPaddle();
  drawBalls();
  drawCombo();

  ctx.restore();
}

// ─── Button handlers ──────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startGame);

document.getElementById('btn-next').addEventListener('click', () => {
  level++;
  initLevel();
  gameState = 'playing';
  showOverlay(null);
  updateHUD();
});

document.getElementById('btn-retry').addEventListener('click', startGame);

// Space also triggers overlays
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (gameState === 'title')    { startGame(); return; }
  if (gameState === 'gameover') { startGame(); return; }
  if (gameState === 'clear')    {
    level++;
    initLevel();
    gameState = 'playing';
    showOverlay(null);
    updateHUD();
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
showOverlay('ov-title');
updateHUD();
initLevel();   // pre-init so title screen shows a game scene behind overlay
loop();
