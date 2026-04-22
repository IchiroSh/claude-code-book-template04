'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 640, H = 400;
canvas.width = W; canvas.height = H;

// ─── Map  (0=empty 1=concrete 2=metal 3=alarm 4=pillar 9=exit) ───────────────
const MW = 24, MH = 24;
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,1,1,0,1,1,1,1,1,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,1],
  [1,0,4,0,0,0,0,2,0,0,0,0,0,2,0,0,4,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,1],
  [1,0,4,0,0,0,0,2,2,0,0,0,2,2,0,0,4,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,1],
  [1,0,3,3,0,0,4,0,0,0,0,0,0,4,0,0,3,3,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,9,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// wall colors [light side, dark side]
const WC = {
  1: ['#7a7a7a','#484848'], 2: ['#3a6a90','#1e3a55'],
  3: ['#903030','#551818'], 4: ['#6a5830','#3a3018'],
  9: ['#30904a','#185528'],
};

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') && gameState !== 'playing') startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('click', () => { if (gameState === 'playing') tryShoot(); });

// Mouse look
let mouseX = W / 2;  // 中央で初期化
let mouseMoved = false;
canvas.addEventListener('mousemove', e => {
  if (gameState !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) / rect.width * W;
  mouseMoved = true;
});

// ─── State ────────────────────────────────────────────────────────────────────
let gameState = 'title';
let player, enemies, zbuf, frame;
zbuf = new Float32Array(W);

// ─── Player ───────────────────────────────────────────────────────────────────
function createPlayer() {
  return {
    x: 2.5, y: 2.5,
    dirX: 1, dirY: 0,
    planeX: 0, planeY: 0.66,
    health: 100, ammo: 30, score: 0,
    shootTimer: 0, hurtFlash: 0,
    bobPhase: 0, moving: false,
  };
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
const EPOS = [
  [5.5,2.5],[19.5,3.5],[3.5,10.5],[17.5,10.5],
  [5.5,18.5],[15.5,18.5],[10.5,21.5],[20.5,20.5],
];
function createEnemies() {
  return EPOS.map((p, i) => ({
    x: p[0], y: p[1],
    hp: 2, state: 'patrol',
    angle: i * Math.PI / 4,
    shootTimer: 80 + i * 15,
    patrolTimer: 60 + i * 30,
    dir: i % 2 === 0 ? 1 : -1,
    alive: true, deadTimer: 0,
  }));
}

function startGame() {
  player   = createPlayer();
  enemies  = createEnemies();
  frame    = 0;
  gameState = 'playing';
}

// ─── Raycasting ───────────────────────────────────────────────────────────────
function castRays() {
  // Ceiling
  ctx.fillStyle = '#111520';
  ctx.fillRect(0, 0, W, H / 2);
  // Floor
  const fg = ctx.createLinearGradient(0, H/2, 0, H);
  fg.addColorStop(0, '#1c1510'); fg.addColorStop(1, '#2e2418');
  ctx.fillStyle = fg; ctx.fillRect(0, H/2, W, H/2);

  const { x: px, y: py, dirX, dirY, planeX, planeY } = player;

  for (let sx = 0; sx < W; sx++) {
    const camX  = 2 * sx / W - 1;
    const rdx   = dirX + planeX * camX;
    const rdy   = dirY + planeY * camX;
    let mx = px | 0, my = py | 0;
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let sdx, sdy, stepx, stepy;
    if (rdx < 0) { stepx = -1; sdx = (px - mx) * ddx; }
    else         { stepx =  1; sdx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { stepy = -1; sdy = (py - my) * ddy; }
    else         { stepy =  1; sdy = (my + 1 - py) * ddy; }

    let side = 0, wt = 0;
    for (let i = 0; i < 64; i++) {
      if (sdx < sdy) { sdx += ddx; mx += stepx; side = 0; }
      else           { sdy += ddy; my += stepy; side = 1; }
      if (mx >= 0 && mx < MW && my >= 0 && my < MH) {
        wt = MAP[my][mx];
        if (wt > 0) break;
      }
    }

    const dist = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[sx] = dist;

    const lh  = (H / dist) | 0;
    const y0  = Math.max(0, ((H - lh) >> 1));
    const y1  = Math.min(H - 1, ((H + lh) >> 1));
    const col = (WC[wt] || WC[1])[side];
    ctx.fillStyle = col;
    ctx.fillRect(sx, y0, 1, y1 - y0);

    const fog = Math.min(0.88, dist * 0.08);
    if (fog > 0.03) {
      ctx.fillStyle = `rgba(0,0,0,${fog.toFixed(2)})`;
      ctx.fillRect(sx, y0, 1, y1 - y0);
    }
  }
}

// ─── Sprite rendering ─────────────────────────────────────────────────────────
function renderSprites() {
  const { x: px, y: py, dirX, dirY, planeX, planeY } = player;
  const invDet = 1 / (planeX * dirY - dirX * planeY);

  const visible = enemies
    .filter(e => e.alive)
    .map(e => {
      const sx = e.x - px, sy = e.y - py;
      const tX = invDet * (dirY * sx - dirX * sy);
      const tY = invDet * (-planeY * sx + planeX * sy);
      return { e, tX, tY };
    })
    .filter(s => s.tY > 0.2)
    .sort((a, b) => b.tY - a.tY);

  for (const { e, tX, tY } of visible) {
    const screenCX = ((W / 2) * (1 + tX / tY)) | 0;
    const sh = Math.min(H * 1.5, Math.abs((H / tY) | 0));
    const sw = sh * 0.6 | 0;
    const sx0 = Math.max(0, screenCX - sw / 2 | 0);
    const sx1 = Math.min(W - 1, screenCX + sw / 2 | 0);
    const sy0 = ((H / 2) - sh / 2) | 0;
    const sy1 = ((H / 2) + sh / 2) | 0;
    if (sx1 < 0 || sx0 >= W) continue;

    const fog = Math.min(0.85, tY * 0.08);
    const alpha = (1 - fog).toFixed(2);

    // head bounds (top 20%)
    const headY0 = Math.max(0, sy0);
    const headY1 = Math.min(H - 1, (sy0 + sh * 0.22) | 0);
    // torso (20-58%)
    const torsoY0 = headY1;
    const torsoY1 = Math.min(H - 1, (sy0 + sh * 0.58) | 0);
    // legs (58-100%)
    const legY0 = torsoY1;
    const legY1 = Math.min(H - 1, sy1);

    const isDead   = e.state === 'dead';
    const isAttack = e.state === 'attack';

    for (let cx = sx0; cx <= sx1; cx++) {
      if (zbuf[cx] <= tY) continue;
      const tx = (cx - (screenCX - sw / 2)) / sw; // 0-1

      if (isDead) {
        // slumped body — only draw near floor
        const slumpY0 = Math.max(0, legY0);
        const slumpY1 = legY1;
        if (slumpY1 > slumpY0 && tx > 0.1 && tx < 0.9) {
          ctx.fillStyle = `rgba(35,20,10,${alpha})`;
          ctx.fillRect(cx, slumpY0, 1, slumpY1 - slumpY0);
        }
        continue;
      }

      // Head
      if (headY1 > headY0 && tx > 0.2 && tx < 0.8) {
        const isHair = tx > 0.22 && tx < 0.78 && tx < 0.25 || tx > 0.75;
        ctx.fillStyle = isHair
          ? `rgba(15,10,5,${alpha})`
          : `rgba(220,175,120,${alpha})`;
        ctx.fillRect(cx, headY0, 1, headY1 - headY0);
      }
      // Torso
      if (torsoY1 > torsoY0 && tx > 0.1 && tx < 0.9) {
        const isTie = tx > 0.44 && tx < 0.56;
        const r = isAttack ? 90 : 28;
        const g = isAttack ? 15 : 28;
        const b = isAttack ? 15 : 38;
        ctx.fillStyle = isTie
          ? `rgba(180,180,180,${alpha})`
          : `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(cx, torsoY0, 1, torsoY1 - torsoY0);
      }
      // Legs
      if (legY1 > legY0) {
        const lLeg = tx > 0.15 && tx < 0.45;
        const rLeg = tx > 0.55 && tx < 0.85;
        if (lLeg || rLeg) {
          ctx.fillStyle = `rgba(18,18,28,${alpha})`;
          ctx.fillRect(cx, legY0, 1, legY1 - legY0);
        }
      }
    }
  }
}

// ─── Weapon ───────────────────────────────────────────────────────────────────
function renderWeapon() {
  const p = player;
  const bob = p.moving ? Math.sin(p.bobPhase * 0.18) * 6 : 0;
  const recoil = p.shootTimer > 0 ? (10 - p.shootTimer) * 3 : 0;
  const bx = W / 2 + 60;
  const by = H - 80 + bob + recoil;

  // Gun body
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(bx - 10, by, 50, 22);      // slide
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx - 4, by + 22, 22, 28);  // grip
  ctx.fillStyle = '#333';
  ctx.fillRect(bx - 14, by + 4, 12, 10);  // barrel end
  ctx.fillStyle = '#444';
  ctx.fillRect(bx + 36, by + 3, 8, 8);    // rear sight
  ctx.fillRect(bx - 16, by + 3, 4, 6);    // front sight
  ctx.fillStyle = '#555';
  ctx.fillRect(bx + 2, by + 6, 28, 6);    // slide detail

  // Trigger guard
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx + 8, by + 22, 8, 0, Math.PI);
  ctx.stroke();

  // Muzzle flash
  if (p.shootTimer > 6) {
    const fl = (p.shootTimer - 6) / 4;
    ctx.save();
    ctx.globalAlpha = fl;
    ctx.fillStyle = '#ffe080';
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(bx - 14, by + 9, 10 * fl, 0, Math.PI * 2);
    ctx.fill();
    // Rays
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(bx - 14, by + 9);
      ctx.lineTo(bx - 14 + Math.cos(a) * 20 * fl, by + 9 + Math.sin(a) * 20 * fl);
      ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function renderHUD() {
  const p = player;

  // Top bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, 38);

  // Health bar
  ctx.fillStyle = '#333'; ctx.fillRect(10, 8, 150, 18);
  const hpRatio = p.health / 100;
  const hpColor = hpRatio > 0.5 ? '#00cc44' : hpRatio > 0.25 ? '#ffaa00' : '#ff2222';
  ctx.fillStyle = hpColor;
  ctx.fillRect(10, 8, 150 * hpRatio, 18);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(10, 8, 150, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`HP ${p.health}`, 16, 17);

  // Ammo
  ctx.fillStyle = '#aaa'; ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AMMO', W / 2, 14);
  ctx.fillStyle = p.ammo > 5 ? '#fff' : '#ff4444';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`${p.ammo}`, W / 2, 28);

  // Score
  ctx.fillStyle = '#aaa'; ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('SCORE', W - 10, 14);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 15px monospace';
  ctx.fillText(String(p.score).padStart(6, '0'), W - 10, 28);

  // Enemies remaining
  const alive = enemies.filter(e => e.alive).length;
  ctx.fillStyle = alive > 0 ? '#ff8888' : '#88ff88';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`TARGETS: ${alive}`, 10, H - 10);

  // Crosshair
  const cx = W / 2, cy = H / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4,  cy); ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
  ctx.moveTo(cx, cy + 4);  ctx.lineTo(cx, cy + 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();

  // Hurt flash overlay
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${(p.hurtFlash / 20) * 0.5})`;
    ctx.fillRect(0, 0, W, H);
    p.hurtFlash--;
  }

  // Minimap
  renderMinimap();
}

function renderMinimap() {
  const ms = 5, ox = W - MW * ms - 8, oy = H - MH * ms - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(ox - 2, oy - 2, MW * ms + 4, MH * ms + 4);
  for (let my = 0; my < MH; my++) {
    for (let mx = 0; mx < MW; mx++) {
      const t = MAP[my][mx];
      if (t === 0) continue;
      const colors = { 1:'#666',2:'#369',3:'#933',4:'#765',9:'#393' };
      ctx.fillStyle = colors[t] || '#666';
      ctx.fillRect(ox + mx * ms, oy + my * ms, ms - 1, ms - 1);
    }
  }
  // Enemies on minimap
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = '#f44';
    ctx.fillRect(ox + e.x * ms - 2, oy + e.y * ms - 2, 4, 4);
  }
  // Player on minimap
  ctx.fillStyle = '#4df';
  ctx.fillRect(ox + player.x * ms - 3, oy + player.y * ms - 3, 6, 6);
  // Player direction indicator
  ctx.strokeStyle = '#4df'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox + player.x * ms, oy + player.y * ms);
  ctx.lineTo(ox + (player.x + player.dirX * 1.5) * ms,
             oy + (player.y + player.dirY * 1.5) * ms);
  ctx.stroke();
}

// ─── Shooting ─────────────────────────────────────────────────────────────────
function tryShoot() {
  const p = player;
  if (p.shootTimer > 0) return;
  if (p.ammo <= 0) { return; }
  p.ammo--;
  p.shootTimer = 10;

  // Raycast for hit
  let bestDist = 12, bestEnemy = null;
  for (const e of enemies) {
    if (!e.alive || e.state === 'dead') continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > bestDist) continue;
    // Check if enemy is near center of screen
    const invDet = 1 / (p.planeX * p.dirY - p.dirX * p.planeY);
    const tY = invDet * (-p.planeY * dx + p.planeX * dy);
    if (tY <= 0) continue;
    const tX = invDet * (p.dirY * dx - p.dirX * dy);
    const screenX = (W / 2) * (1 + tX / tY);
    if (Math.abs(screenX - W / 2) < W * 0.12) {
      bestDist = dist;
      bestEnemy = e;
    }
  }
  if (bestEnemy) {
    bestEnemy.hp--;
    bestEnemy.state = 'attack';
    if (bestEnemy.hp <= 0) {
      bestEnemy.state = 'dead';
      p.score += 500;
      setTimeout(() => { bestEnemy.alive = false; }, 2000);
    } else {
      p.score += 50;
    }
  }
}

// ─── Enemy AI ────────────────────────────────────────────────────────────────
function canSeePlayer(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 9) return false;
  // Simple line-of-sight: step along ray
  const steps = Math.ceil(dist * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const mx = (e.x + dx * t) | 0;
    const my = (e.y + dy * t) | 0;
    if (mx >= 0 && mx < MW && my >= 0 && my < MH && MAP[my][mx] > 0) return false;
  }
  return true;
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.alive || e.state === 'dead') continue;

    const sees = canSeePlayer(e);
    if (sees) e.state = 'attack';
    else if (e.state === 'attack') { e.state = 'patrol'; e.patrolTimer = 120; }

    if (e.state === 'patrol') {
      e.patrolTimer--;
      // Walk back and forth
      const nx = e.x + Math.cos(e.angle) * 0.025 * e.dir;
      const ny = e.y + Math.sin(e.angle) * 0.025 * e.dir;
      const mx = nx | 0, my = ny | 0;
      if (mx >= 0 && mx < MW && my >= 0 && my < MH && MAP[my][mx] === 0) {
        e.x = nx; e.y = ny;
      } else {
        e.dir *= -1;
      }
      if (e.patrolTimer <= 0) {
        e.angle += (Math.random() - 0.5) * Math.PI * 0.5;
        e.patrolTimer = 60 + Math.random() * 80 | 0;
      }
    } else if (e.state === 'attack') {
      // Move toward player slowly
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 2.5) {
        const nx = e.x + (dx / d) * 0.018;
        const ny = e.y + (dy / d) * 0.018;
        if ((nx | 0) >= 0 && (nx | 0) < MW && (ny | 0) >= 0 && (ny | 0) < MH) {
          if (MAP[ny | 0][nx | 0] === 0) { e.x = nx; e.y = ny; }
        }
      }
      // Shoot at player
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        e.shootTimer = 70 + Math.random() * 40 | 0;
        if (d < 8) {
          player.health -= 10 + (Math.random() * 8 | 0);
          player.hurtFlash = 20;
          if (player.health <= 0) {
            player.health = 0;
            gameState = 'gameover';
          }
        }
      }
    }
  }
}

// ─── Player movement ─────────────────────────────────────────────────────────
function updatePlayer() {
  const p = player;
  const ms = 0.055, rs = 0.042;

  // Rotation: arrow keys or mouse position
  const rotLeft  = keys['ArrowLeft']  || keys['KeyQ'];
  const rotRight = keys['ArrowRight'] || keys['KeyE'];
  let rot = 0;
  if (rotLeft)  rot = -rs;
  if (rotRight) rot =  rs;
  // Mouse steering (マウスが動いた場合のみ適用)
  if (mouseMoved) {
    const mouseOffset = (mouseX - W / 2) / W;
    if (Math.abs(mouseOffset) > 0.02) rot += mouseOffset * 0.06;
  }

  if (rot !== 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const odx = p.dirX, ody = p.dirY;
    p.dirX = odx * c - ody * s;
    p.dirY = odx * s + ody * c;
    const opx = p.planeX, opy = p.planeY;
    p.planeX = opx * c - opy * s;
    p.planeY = opx * s + opy * c;
  }

  // Movement
  const fwd  = keys['ArrowUp']   || keys['KeyW'];
  const back = keys['ArrowDown']  || keys['KeyS'];
  const strafeL = keys['KeyA'];
  const strafeR = keys['KeyD'];
  p.moving = fwd || back || strafeL || strafeR;

  const tryMove = (nx, ny) => {
    const mx = nx | 0, my = ny | 0;
    if (mx >= 0 && mx < MW && my >= 0 && my < MH && MAP[my][mx] === 0) {
      p.x = nx; p.y = ny;
    }
  };

  if (fwd)     { tryMove(p.x + p.dirX * ms,  p.y + p.dirY * ms); }
  if (back)    { tryMove(p.x - p.dirX * ms,  p.y - p.dirY * ms); }
  if (strafeL) { tryMove(p.x + p.dirY * ms,  p.y - p.dirX * ms); }
  if (strafeR) { tryMove(p.x - p.dirY * ms,  p.y + p.dirX * ms); }

  if (p.moving) p.bobPhase++;
  if (p.shootTimer > 0) p.shootTimer--;

  // Space/Z to shoot
  if ((keys['Space'] || keys['KeyZ'] || keys['KeyF']) && p.shootTimer === 0) tryShoot();

  // Check exit
  const mx = p.x | 0, my = p.y | 0;
  if (mx >= 0 && mx < MW && my >= 0 && my < MH && MAP[my][mx] === 9) {
    if (enemies.filter(e => e.alive).length === 0) gameState = 'win';
  }
}

// ─── Title screen ─────────────────────────────────────────────────────────────
function drawTitle() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // Bond gun barrel
  const cx = W / 2, cy = H / 2 - 30;
  const rOuter = frame < 60 ? (frame / 60) * 160 + 20 : 180;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.clip();
  // Inside barrel: concentric rings
  for (let r = rOuter; r > 0; r -= 18) {
    ctx.strokeStyle = `rgba(${60 + r},${60 + r},${60 + r},0.6)`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Vignette around barrel
  const vg = ctx.createRadialGradient(cx, cy, rOuter * 0.6, cx, cy, rOuter * 1.2);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Blood trail
  if (frame > 30) {
    const prog = Math.min(1, (frame - 30) / 60);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cx, cy + rOuter * 0.4, W - cx, 4 * prog);
    const dropH = Math.min(H - cy - rOuter * 0.4 - 4, (frame - 30) * 2);
    if (dropH > 0) {
      ctx.fillStyle = '#aa0000';
      ctx.fillRect(W - 24, cy + rOuter * 0.4 + 4, 20, dropH);
    }
  }

  // Title text
  ctx.shadowColor = '#c8a000'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 52px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('AGENT 007', W / 2, H / 2 + 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#888';
  ctx.font = '16px monospace';
  ctx.fillText('OPERATION ZERO', W / 2, H / 2 + 72);

  ctx.fillStyle = '#ccc'; ctx.font = '13px monospace';
  const blink = frame % 70 < 48;
  if (blink) ctx.fillText('PRESS SPACE / ENTER', W / 2, H - 60);

  ctx.fillStyle = '#666'; ctx.font = '11px monospace';
  ctx.fillText('移動: WASD / 矢印  射撃: Space / Z / クリック  視点: QE / マウス', W / 2, H - 30);
}

// ─── Game Over / Win ─────────────────────────────────────────────────────────
function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff2020'; ctx.font = 'bold 52px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('MISSION FAILED', W / 2, H / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#888'; ctx.font = '15px monospace';
  ctx.fillText(`SCORE: ${String(player.score).padStart(6,'0')}`, W / 2, H / 2 + 10);
  if (frame % 70 < 48) { ctx.fillStyle='#fff'; ctx.fillText('PRESS SPACE TO RETRY', W/2, H/2+50); }
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#d4af37'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#d4af37'; ctx.font = 'bold 44px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('MISSION COMPLETE', W / 2, H / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aaa'; ctx.font = '15px monospace';
  ctx.fillText(`FINAL SCORE: ${String(player.score).padStart(6,'0')}`, W / 2, H / 2 + 10);
  ctx.fillStyle = '#4df'; ctx.font = '13px monospace';
  ctx.fillText('All targets eliminated. Extraction complete.', W / 2, H / 2 + 35);
  if (frame % 70 < 48) { ctx.fillStyle='#fff'; ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, H/2+70); }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  frame++;

  if (gameState === 'title') {
    drawTitle();
    requestAnimationFrame(loop);
    return;
  }
  if (gameState === 'gameover') {
    castRays(); renderSprites();
    renderWeapon(); renderHUD();
    drawGameOver();
    requestAnimationFrame(loop);
    return;
  }
  if (gameState === 'win') {
    castRays(); renderSprites();
    renderWeapon(); renderHUD();
    drawWin();
    requestAnimationFrame(loop);
    return;
  }

  updatePlayer();
  updateEnemies();
  castRays();
  renderSprites();
  renderWeapon();
  renderHUD();

  requestAnimationFrame(loop);
}

loop();
