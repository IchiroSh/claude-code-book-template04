'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = 480;
const H = 640;
canvas.width = W;
canvas.height = H;

// ─── State ────────────────────────────────────────────────────────────────────
let gameState = 'title'; // 'title' | 'playing' | 'gameover'
let score = 0;
let hiScore = 0;
let lives = 3;
let level = 1;
let frame = 0;
let waveIndex = 0;
let waveTimer = 0;

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') {
    if (gameState === 'title') startGame();
    else if (gameState === 'gameover') startGame();
  }
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Starfield ────────────────────────────────────────────────────────────────
const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 1.5 + 0.3,
  speed: Math.random() * 2.5 + 0.5,
  alpha: Math.random() * 0.6 + 0.3,
}));

function updateStars() {
  for (const s of stars) {
    s.y += s.speed;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  }
}
function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Nebula (slow drifting clouds) ───────────────────────────────────────────
const nebulas = Array.from({ length: 6 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  rx: 80 + Math.random() * 120,
  ry: 50 + Math.random() * 80,
  speed: 0.2 + Math.random() * 0.3,
  hue: [270, 210, 130][Math.floor(Math.random() * 3)],
}));

function updateNebulas() {
  for (const n of nebulas) {
    n.y += n.speed;
    if (n.y > H + 100) { n.y = -100; n.x = Math.random() * W; }
  }
}
function drawNebulas() {
  for (const n of nebulas) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rx);
    g.addColorStop(0, `hsla(${n.hue},80%,30%,0.18)`);
    g.addColorStop(1, `hsla(${n.hue},80%,10%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(n.x, n.y, n.rx, n.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────
let particles = [];

function spawnExplosion(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = Math.random() * 5 + 1;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 30 + Math.random() * 25,
      maxLife: 55,
      size: Math.random() * 4 + 1,
      color,
    });
  }
}
function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--; }
  particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ─── Player ───────────────────────────────────────────────────────────────────
let player;
function createPlayer() {
  return {
    x: W / 2, y: H - 80,
    w: 28, h: 28,
    speed: 4.5,
    shotCooldown: 0,
    shotRate: 8,
    power: 0,    // 0–3
    shield: 0,   // 0–3
    invincible: 0,
  };
}

function updatePlayer() {
  const p = player;
  const dx = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
  const dy = (keys['ArrowDown']  || keys['KeyS'] ? 1 : 0) - (keys['ArrowUp']   || keys['KeyW'] ? 1 : 0);
  p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x + dx * p.speed));
  p.y = Math.max(p.h / 2, Math.min(H - p.h / 2, p.y + dy * p.speed));
  if (p.shotCooldown > 0) p.shotCooldown--;
  if (p.invincible > 0) p.invincible--;
  if (keys['Space'] || keys['KeyZ']) playerShoot();
}

function drawPlayer() {
  const p = player;
  if (p.invincible > 0 && frame % 6 < 3) return;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Engine flame
  const fl = 10 + Math.sin(frame * 0.4) * 4;
  const grad = ctx.createLinearGradient(0, 8, 0, 8 + fl);
  grad.addColorStop(0, 'rgba(255,180,60,0.9)');
  grad.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 10 + fl);
  ctx.closePath(); ctx.fill();

  // Wing left
  ctx.fillStyle = '#2a8cdd';
  ctx.beginPath();
  ctx.moveTo(-4, 6); ctx.lineTo(-16, 14); ctx.lineTo(-10, -2);
  ctx.closePath(); ctx.fill();

  // Wing right
  ctx.beginPath();
  ctx.moveTo(4, 6); ctx.lineTo(16, 14); ctx.lineTo(10, -2);
  ctx.closePath(); ctx.fill();

  // Body
  ctx.fillStyle = '#4ab8ff';
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(-8, 10); ctx.lineTo(8, 10);
  ctx.closePath(); ctx.fill();

  // Cockpit
  ctx.fillStyle = '#c8f0ff';
  ctx.beginPath();
  ctx.ellipse(0, -4, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shield ring
  if (p.shield > 0) {
    const alpha = 0.25 + Math.sin(frame * 0.12) * 0.15;
    ctx.strokeStyle = `rgba(100,210,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Player bullets ───────────────────────────────────────────────────────────
let bullets = [];

function playerShoot() {
  const p = player;
  if (p.shotCooldown > 0) return;
  p.shotCooldown = p.shotRate;
  const cx = p.x, cy = p.y - 14;

  const configs = [
    // power 0: single
    [{ x: 0, y: 0, vx: 0, vy: -12, w: 3, h: 14, dmg: 1 }],
    // power 1: double
    [{ x: -9, y: 4, vx: 0, vy: -12, w: 3, h: 14, dmg: 1 },
     { x:  9, y: 4, vx: 0, vy: -12, w: 3, h: 14, dmg: 1 }],
    // power 2: triple
    [{ x: 0, y: 0, vx: 0, vy: -13, w: 4, h: 16, dmg: 2 },
     { x:-12, y: 4, vx:-0.8, vy:-11, w: 3, h: 13, dmg: 1 },
     { x: 12, y: 4, vx: 0.8, vy:-11, w: 3, h: 13, dmg: 1 }],
    // power 3: five-way
    [{ x: 0, y: 0, vx: 0, vy: -14, w: 5, h: 18, dmg: 3 },
     { x:-12, y: 4, vx:-1, vy:-12, w: 3, h: 13, dmg: 2 },
     { x: 12, y: 4, vx: 1, vy:-12, w: 3, h: 13, dmg: 2 },
     { x:-20, y: 8, vx:-2.5, vy: -9, w: 3, h: 11, dmg: 1 },
     { x: 20, y: 8, vx: 2.5, vy: -9, w: 3, h: 11, dmg: 1 }],
  ];
  const cfg = configs[Math.min(p.power, 3)];
  for (const c of cfg) {
    bullets.push({ x: cx + c.x, y: cy + c.y, vx: c.vx, vy: c.vy, w: c.w, h: c.h, dmg: c.dmg });
  }
}

function updateBullets() {
  for (const b of bullets) { b.x += b.vx; b.y += b.vy; }
  bullets = bullets.filter(b => b.y > -20 && b.x > -20 && b.x < W + 20);
}

function drawBullets() {
  ctx.shadowColor = '#ffe040';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffe040';
  for (const b of bullets) {
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  ctx.shadowBlur = 0;
}

// ─── Enemy bullets ────────────────────────────────────────────────────────────
let eBullets = [];

function updateEBullets() {
  for (const b of eBullets) { b.x += b.vx; b.y += b.vy; }
  eBullets = eBullets.filter(b => b.y < H + 20 && b.y > -20 && b.x > -20 && b.x < W + 20);
}

function drawEBullets() {
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff4444';
  for (const b of eBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
const ETYPE = {
  scout:  { hp: 1,  score: 100,  w: 22, h: 22, speed: 2.2, shotRate: 0,   color: '#f8a040' },
  speeder:{ hp: 1,  score: 150,  w: 18, h: 18, speed: 4.0, shotRate: 0,   color: '#60f080' },
  gunner: { hp: 3,  score: 350,  w: 30, h: 30, speed: 1.2, shotRate: 55,  color: '#d060ff' },
  tank:   { hp: 6,  score: 600,  w: 38, h: 38, speed: 0.8, shotRate: 45,  color: '#ff6060' },
  boss:   { hp: 80, score: 8000, w: 72, h: 72, speed: 0.6, shotRate: 25,  color: '#ff3030' },
};

let enemies = [];
let bossActive = false;

function spawnEnemy(type, x, y, pattern = 'down', extra = {}) {
  const t = ETYPE[type];
  const hpScale = 1 + (level - 1) * 0.25;
  enemies.push({
    type, x, y, w: t.w, h: t.h,
    hp: Math.ceil(t.hp * hpScale),
    maxHp: Math.ceil(t.hp * hpScale),
    speed: t.speed,
    score: t.score,
    color: t.color,
    pattern,
    baseX: x,
    timer: 0,
    shotCooldown: 20 + Math.random() * t.shotRate,
    shotRate: t.shotRate,
    ...extra,
  });
}

function spawnWave() {
  const w = waveIndex;
  // Every 8th wave is a boss wave
  if (w > 0 && w % 8 === 0) {
    spawnEnemy('boss', W / 2, -80, 'boss');
    bossActive = true;
    return;
  }
  const patterns = [
    // Straight line
    () => { for (let i = 0; i < 5; i++) spawnEnemy('scout', 60 + i * 80, -30 - i * 60); },
    // V-shape
    () => { for (let i = 0; i < 5; i++) spawnEnemy('scout', 70 + i * 70, -30 - Math.abs(i-2) * 50); },
    // Speeder rush
    () => { for (let i = 0; i < 4; i++) spawnEnemy('speeder', 80 + i * 100, -30 - i * 40, 'down'); },
    // Zigzag gunners
    () => { spawnEnemy('gunner', 120, -40, 'zigzag'); spawnEnemy('gunner', 360, -80, 'zigzag'); },
    // Diamond formation
    () => {
      spawnEnemy('scout', W/2, -30);
      spawnEnemy('scout', W/2 - 80, -80); spawnEnemy('scout', W/2 + 80, -80);
      spawnEnemy('scout', W/2 - 160, -130); spawnEnemy('scout', W/2 + 160, -130);
    },
    // Tanks
    () => { spawnEnemy('tank', 120, -50, 'zigzag'); spawnEnemy('tank', W/2, -30, 'down'); spawnEnemy('tank', 360, -50, 'zigzag'); },
    // Mixed assault
    () => {
      for (let i = 0; i < 3; i++) spawnEnemy('speeder', 80 + i * 140, -30, 'down');
      spawnEnemy('gunner', W/2 - 60, -100, 'zigzag');
      spawnEnemy('gunner', W/2 + 60, -100, 'zigzag');
    },
  ];
  patterns[w % patterns.length]();
}

function updateEnemies() {
  for (const e of enemies) {
    e.timer++;
    switch (e.pattern) {
      case 'down':
        e.y += e.speed;
        break;
      case 'zigzag':
        e.y += e.speed;
        e.x = e.baseX + Math.sin(e.timer * 0.045) * 70;
        break;
      case 'circle':
        e.y += e.speed * 0.5;
        e.x = e.baseX + Math.cos(e.timer * 0.04) * 90;
        break;
      case 'boss':
        // Boss enters from top, then oscillates
        if (e.y < 90) { e.y += e.speed * 1.5; }
        else {
          e.x = W / 2 + Math.sin(e.timer * 0.02) * (W / 2 - e.w / 2 - 10);
        }
        break;
    }

    // Shoot at player
    if (e.shotRate > 0 && player) {
      e.shotCooldown--;
      if (e.shotCooldown <= 0) {
        e.shotCooldown = e.shotRate + Math.random() * 20;
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        const spd = e.type === 'boss' ? 5 : 3.5;
        if (e.type === 'boss') {
          // Boss shoots 3 bullets in a spread
          for (let d = -1; d <= 1; d++) {
            const a = angle + d * 0.25;
            eBullets.push({ x: e.x, y: e.y + e.h / 4, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 5 });
          }
        } else {
          eBullets.push({ x: e.x, y: e.y + e.h / 4, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, r: 4 });
        }
      }
    }

    if (e.y > H + 60) e._dead = true;
  }
  if (bossActive && enemies.every(e => e.type !== 'boss')) bossActive = false;
  enemies = enemies.filter(e => !e._dead);
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'boss') drawBoss(e);
  else drawRegularEnemy(e);

  // HP bar (only for tougher enemies)
  if ((e.type === 'tank' || e.type === 'gunner') && e.hp < e.maxHp) {
    const bw = e.w + 8;
    ctx.fillStyle = '#600';
    ctx.fillRect(-bw / 2, -e.h / 2 - 10, bw, 5);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(-bw / 2, -e.h / 2 - 10, bw * (e.hp / e.maxHp), 5);
  }

  ctx.restore();
}

function drawRegularEnemy(e) {
  const hw = e.w / 2, hh = e.h / 2;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.moveTo(0, hh);
  ctx.lineTo(-hw, -hh * 0.4);
  ctx.lineTo(-hw * 0.5, -hh);
  ctx.lineTo(hw * 0.5, -hh);
  ctx.lineTo(hw, -hh * 0.4);
  ctx.closePath();
  ctx.fill();
  // Engine dots
  ctx.fillStyle = '#fff8';
  ctx.beginPath(); ctx.arc(-hw * 0.35, hh * 0.3, hw * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( hw * 0.35, hh * 0.3, hw * 0.2, 0, Math.PI * 2); ctx.fill();
}

function drawBoss(e) {
  const hw = e.w / 2, hh = e.h / 2;
  // Main body
  ctx.fillStyle = '#aa1111';
  ctx.beginPath();
  ctx.moveTo(0, hh);
  ctx.lineTo(-hw, hh * 0.3);
  ctx.lineTo(-hw * 0.7, -hh * 0.2);
  ctx.lineTo(-hw * 0.3, -hh);
  ctx.lineTo(hw * 0.3, -hh);
  ctx.lineTo(hw * 0.7, -hh * 0.2);
  ctx.lineTo(hw, hh * 0.3);
  ctx.closePath();
  ctx.fill();

  // Core
  const pulse = 0.7 + Math.sin(frame * 0.12) * 0.3;
  ctx.fillStyle = `rgba(255,80,80,${pulse})`;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  // Wing accents
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-hw + 5, -4, hw * 0.5, 8);
  ctx.fillRect(hw * 0.45, -4, hw * 0.5, 8);

  // HP bar above boss
  const bw = 140;
  const ratio = e.hp / e.maxHp;
  ctx.fillStyle = '#400';
  ctx.fillRect(-bw / 2, -hh - 18, bw, 8);
  ctx.fillStyle = ratio > 0.5 ? '#0f0' : ratio > 0.25 ? '#ff0' : '#f00';
  ctx.fillRect(-bw / 2, -hh - 18, bw * ratio, 8);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(-bw / 2, -hh - 18, bw, 8);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('BOSS', 0, -hh - 18);
}

// ─── Power-ups ────────────────────────────────────────────────────────────────
let powerups = [];

function maybeSpawnPowerup(x, y, forceType) {
  if (!forceType && Math.random() > 0.22) return;
  const types = ['power', 'shield', 'life', 'power', 'power']; // power more common
  const type = forceType || types[Math.floor(Math.random() * types.length)];
  powerups.push({ x, y, type, vy: 1.8, timer: 0 });
}

function updatePowerups() {
  for (const p of powerups) { p.y += p.vy; p.timer++; }
  powerups = powerups.filter(p => p.y < H + 20);
}

function drawPowerup(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.timer * 0.04);
  const info = {
    power:  { color: '#ffd700', label: 'P', shadow: '#ffd700' },
    shield: { color: '#40c8ff', label: 'S', shadow: '#40c8ff' },
    life:   { color: '#ff6080', label: '♥', shadow: '#ff6080' },
  }[p.type];
  ctx.shadowColor = info.shadow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = info.color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 7;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.label, 0, 0);
  ctx.restore();
}

// ─── Collision helpers ────────────────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax - aw / 2 < bx + bw / 2 &&
         ax + aw / 2 > bx - bw / 2 &&
         ay - ah / 2 < by + bh / 2 &&
         ay + ah / 2 > by - bh / 2;
}

function circRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
  const nearY = Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

function checkCollisions() {
  const p = player;

  // ── Player bullets vs enemies ──
  for (const b of bullets) {
    for (const e of enemies) {
      if (e._dead) continue;
      if (!rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
      b._dead = true;
      e.hp -= b.dmg;
      spawnExplosion(b.x, b.y, 4, '#ffe0a0');
      if (e.hp <= 0) {
        e._dead = true;
        score += e.score;
        const big = e.type === 'boss' || e.type === 'tank';
        spawnExplosion(e.x, e.y, big ? 50 : 20, e.color);
        maybeSpawnPowerup(e.x, e.y, e.type === 'boss' ? 'power' : null);
      }
      break;
    }
  }
  bullets  = bullets.filter(b => !b._dead);
  enemies  = enemies.filter(e => !e._dead);

  if (p.invincible > 0) return;

  // ── Enemy bullets vs player ──
  for (const b of eBullets) {
    if (b._dead) continue;
    if (!circRect(b.x, b.y, b.r, p.x, p.y, p.w - 6, p.h - 6)) continue;
    b._dead = true;
    if (p.shield > 0) {
      p.shield--;
      spawnExplosion(b.x, b.y, 10, '#40c8ff');
    } else {
      hitPlayer();
    }
  }
  eBullets = eBullets.filter(b => !b._dead);

  // ── Enemy bodies vs player ──
  for (const e of enemies) {
    if (!rectsOverlap(p.x, p.y, p.w - 6, p.h - 6, e.x, e.y, e.w - 6, e.h - 6)) continue;
    e._dead = true;
    spawnExplosion(e.x, e.y, 20, e.color);
    if (p.shield > 0) {
      p.shield = 0;
      spawnExplosion(p.x, p.y, 15, '#40c8ff');
      p.invincible = 60;
    } else {
      hitPlayer();
    }
  }
  enemies = enemies.filter(e => !e._dead);

  // ── Powerups vs player ──
  for (const pu of powerups) {
    if (pu._dead) continue;
    if (!rectsOverlap(p.x, p.y, p.w + 10, p.h + 10, pu.x, pu.y, 26, 26)) continue;
    pu._dead = true;
    if (pu.type === 'power') {
      p.power = Math.min(3, p.power + 1);
      p.shotRate = Math.max(4, 8 - p.power * 1.5 | 0);
    } else if (pu.type === 'shield') {
      p.shield = Math.min(3, p.shield + 1);
    } else if (pu.type === 'life') {
      lives = Math.min(5, lives + 1);
    }
  }
  powerups = powerups.filter(pu => !pu._dead);
}

function hitPlayer() {
  lives--;
  player.invincible = 150;
  player.power = Math.max(0, player.power - 1);
  player.shotRate = Math.max(4, 8 - player.power * 1.5 | 0);
  spawnExplosion(player.x, player.y, 30, '#ff8040');
  if (lives <= 0) {
    spawnExplosion(player.x, player.y, 60, '#ff4020');
    gameState = 'gameover';
    if (score > hiScore) hiScore = score;
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD() {
  const p = player;
  ctx.font = '14px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${String(score).padStart(8, '0')}`, 10, 20);
  ctx.textAlign = 'right';
  ctx.fillText(`HI  ${String(hiScore).padStart(8, '0')}`, W - 10, 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#aaccff';
  ctx.fillText(`LEVEL ${level}`, W / 2, 20);

  // Lives (mini ships)
  for (let i = 0; i < lives; i++) {
    ctx.save();
    ctx.translate(14 + i * 22, H - 22);
    ctx.scale(0.5, 0.5);
    ctx.fillStyle = '#4ab8ff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(-8, 10); ctx.lineTo(8, 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Power stars
  ctx.fillStyle = '#ffd700';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('PWR ' + '★'.repeat(p.power + 1) + '☆'.repeat(3 - p.power), W - 10, H - 24);

  // Shield squares
  if (p.shield > 0) {
    ctx.fillStyle = '#40c8ff';
    ctx.fillText('SHD ' + '■'.repeat(p.shield) + '□'.repeat(3 - p.shield), W - 10, H - 8);
  }

  // Boss warning
  if (bossActive) {
    const alpha = 0.5 + Math.sin(frame * 0.2) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!! BOSS !!' , W / 2, H - 10);
    ctx.globalAlpha = 1;
  }
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.shadowColor = '#4ab8ff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#4ab8ff';
  ctx.font = 'bold 42px monospace';
  ctx.fillText('SPACE', W / 2, H / 2 - 80);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('SHOOTER', W / 2, H / 2 - 30);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '14px monospace';
  ctx.fillText(`HI-SCORE  ${String(hiScore).padStart(8, '0')}`, W / 2, H / 2 + 20);

  if (frame % 70 < 50) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE / ENTER', W / 2, H / 2 + 60);
  }

  ctx.fillStyle = '#888888';
  ctx.font = '12px monospace';
  ctx.fillText('移動: 矢印 / WASD', W / 2, H / 2 + 100);
  ctx.fillText('射撃: Space / Z', W / 2, H / 2 + 118);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px monospace';
  ctx.fillText(`SCORE  ${String(score).padStart(8, '0')}`, W / 2, H / 2);

  if (score > 0 && score === hiScore) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '16px monospace';
    ctx.fillText('✦ NEW RECORD ✦', W / 2, H / 2 + 30);
  }

  if (frame % 70 < 50) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px monospace';
    ctx.fillText('PRESS SPACE / ENTER', W / 2, H / 2 + 70);
  }
}

// ─── Game control ─────────────────────────────────────────────────────────────
function startGame() {
  score = 0; lives = 3; level = 1; frame = 0;
  waveIndex = 0; waveTimer = 0; bossActive = false;
  enemies = []; bullets = []; eBullets = [];
  particles = []; powerups = [];
  player = createPlayer();
  gameState = 'playing';
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function update() {
  frame++;
  updateStars();
  updateNebulas();

  if (gameState !== 'playing') return;

  updatePlayer();
  updateBullets();
  updateEBullets();
  updateEnemies();
  updateParticles();
  updatePowerups();

  // Wave spawning: wait until the screen is clear (or timeout)
  waveTimer--;
  if (waveTimer <= 0 && enemies.length === 0) {
    spawnWave();
    waveIndex++;
    waveTimer = 90;
    // Level up every 4 waves
    if (waveIndex > 0 && waveIndex % 4 === 0) level++;
  }

  checkCollisions();
}

function draw() {
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, W, H);

  drawNebulas();
  drawStars();

  if (gameState === 'title') { drawTitle(); return; }

  for (const e of enemies) drawEnemy(e);
  for (const pu of powerups) drawPowerup(pu);
  drawBullets();
  drawEBullets();
  drawParticles();

  if (lives > 0) drawPlayer();
  drawHUD();

  if (gameState === 'gameover') drawGameOver();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
