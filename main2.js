'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 480, H = 400;
canvas.width = W; canvas.height = H;

// ─── Constants ────────────────────────────────────────────────────────────────
const TILE  = 32;
const COLS  = Math.ceil(W / TILE) + 2;  // visible columns + buffer
const ROWS  = 12;  // 地面 row11 → y=352、画面内に収まる
const GRAVITY    = 0.55;
const MAX_FALL   = 14;
const JUMP_VY    = -12.5;
const WALK_SPD   = 3.2;
const RUN_SPD    = 5.2;

// Tile IDs
const T = { EMPTY:0, GROUND:1, BRICK:2, QBLOCK:3, QUSED:4, COIN:5,
            PIPE_T:6, PIPE_B:7, SOLID:8, GOAL:9 };

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if ((e.code === 'Space' || e.code === 'Enter') && gameState !== 'playing') startGame();
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Level builder ────────────────────────────────────────────────────────────
const LW = 110; // total level columns

function buildLevel() {
  const m = Array.from({length: ROWS}, () => new Uint8Array(LW));

  const ground = (c) => { m[ROWS-1][c] = T.GROUND; };
  const block  = (r, c, t) => { m[r][c] = t; };

  // Ground with gaps (穴は2マス幅に縮小し、出現位置を後半にずらす)
  for (let c = 0; c < LW; c++) ground(c);
  [45,46, 68,69, 82,83].forEach(c => { m[ROWS-1][c] = T.EMPTY; });

  // Early platforms
  [5,6,7].forEach(c => block(9, c, T.BRICK));
  block(9, 6, T.QBLOCK);
  [10,11,12].forEach(c => block(7, c, T.BRICK));
  block(7, 11, T.QBLOCK);
  [15,16,17].forEach(c => block(9, c, T.BRICK));

  // Coins row
  [8,9,25,26,27,28].forEach(c => block(8, c, T.COIN));

  // Pipes
  block(ROWS-2, 31, T.PIPE_T); block(ROWS-1, 31, T.PIPE_B);
  block(ROWS-3, 36, T.PIPE_T); block(ROWS-2, 36, T.PIPE_T); block(ROWS-1, 36, T.PIPE_B);

  // Mid platforms
  [38,39,40,41].forEach(c => block(8, c, T.BRICK));
  block(8, 39, T.QBLOCK); block(8, 40, T.QBLOCK);
  [44,45,46,47].forEach(c => block(6, c, T.BRICK));
  block(6, 45, T.QBLOCK); block(6, 46, T.QBLOCK);
  [55,56,57,58,59,60].forEach(c => block(7, c, T.COIN));
  [57,58,59,60].forEach(c => block(10, c, T.BRICK));
  [63,64,65,66,67].forEach(c => block(8, c, T.BRICK));
  block(8, 65, T.QBLOCK);

  // Solid stacks
  [70,71,72,73].forEach(c => block(9, c, T.SOLID));
  [72,73,74,75,76].forEach(c => block(7, c, T.SOLID));
  [74,75,76,77,78].forEach(c => block(5, c, T.SOLID));

  // Coins on solids
  [72,73,74].forEach(c => block(6, c, T.COIN));

  // Staircase
  for (let s = 0; s < 7; s++)
    for (let r = ROWS-1-s; r < ROWS; r++)
      block(r, 88+s, T.GROUND);

  // Goal
  block(ROWS-4, 100, T.GOAL);
  block(ROWS-3, 100, T.PIPE_T);
  block(ROWS-2, 100, T.PIPE_T);
  block(ROWS-1, 100, T.PIPE_B);

  return m;
}

// ─── Tile rendering ───────────────────────────────────────────────────────────
function drawTile(t, px, py, frame) {
  switch (t) {
    case T.GROUND:
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#5A8A2A';
      ctx.fillRect(px, py, TILE, 6);
      ctx.fillStyle = '#6FAF35';
      ctx.fillRect(px+2, py, TILE-4, 4);
      break;
    case T.BRICK:
      ctx.fillStyle = '#C8703A';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = '#8B4020';
      ctx.lineWidth = 2;
      ctx.strokeRect(px+1, py+1, TILE-2, TILE-2);
      ctx.beginPath();
      ctx.moveTo(px, py+TILE/2); ctx.lineTo(px+TILE, py+TILE/2);
      ctx.moveTo(px+TILE/2, py); ctx.lineTo(px+TILE/2, py+TILE/2);
      ctx.moveTo(px+TILE/4, py+TILE/2); ctx.lineTo(px+TILE/4, py+TILE);
      ctx.moveTo(px+TILE*3/4, py+TILE/2); ctx.lineTo(px+TILE*3/4, py+TILE);
      ctx.strokeStyle = '#9B5028'; ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case T.QBLOCK:
    case T.QUSED: {
      const used = t === T.QUSED;
      ctx.fillStyle = used ? '#888' : '#F0C000';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = used ? '#666' : '#C89000';
      ctx.fillRect(px+2, py+TILE-4, TILE-4, 4);
      ctx.fillRect(px, py+2, 4, TILE-4);
      ctx.fillStyle = used ? '#999' : '#FFE060';
      ctx.fillRect(px+4, py+2, TILE-6, 4);
      ctx.fillRect(px+TILE-6, py+2, 4, TILE-4);
      if (!used) {
        ctx.fillStyle = '#FFF';
        const blink = Math.floor(frame / 8) % 2 === 0;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(blink ? '?' : '?', px + TILE/2, py + TILE/2 + 1);
      }
      break;
    }
    case T.COIN: {
      const bob = Math.sin(frame * 0.1) * 3;
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(px+TILE/2, py+TILE/2+bob, 7, 9, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFF8';
      ctx.beginPath();
      ctx.ellipse(px+TILE/2-2, py+TILE/2+bob-2, 3, 4, -0.5, 0, Math.PI*2);
      ctx.fill();
      break;
    }
    case T.SOLID:
      ctx.fillStyle = '#557';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#778';
      ctx.fillRect(px+1, py+1, TILE-2, 4);
      ctx.fillRect(px+1, py+1, 4, TILE-2);
      ctx.fillStyle = '#334';
      ctx.fillRect(px+TILE-4, py+4, 3, TILE-5);
      ctx.fillRect(px+4, py+TILE-4, TILE-5, 3);
      break;
    case T.PIPE_T:
      ctx.fillStyle = '#1A9A1A';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#30CC30';
      ctx.fillRect(px+2, py+2, TILE/2-2, TILE-4);
      ctx.fillStyle = '#0D6E0D';
      ctx.fillRect(px+TILE-4, py, 4, TILE);
      if (t === T.PIPE_T) {
        ctx.fillStyle = '#30CC30';
        ctx.fillRect(px-4, py, TILE+8, 10);
        ctx.fillStyle = '#1A9A1A';
        ctx.fillRect(px-2, py, TILE+4, 10);
      }
      break;
    case T.PIPE_B:
      ctx.fillStyle = '#1A9A1A';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#30CC30';
      ctx.fillRect(px+2, py, TILE/2-2, TILE);
      ctx.fillStyle = '#0D6E0D';
      ctx.fillRect(px+TILE-4, py, 4, TILE);
      break;
    case T.GOAL:
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 15;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', px+TILE/2, py+TILE/2);
      ctx.shadowBlur = 0;
      break;
  }
}

function isSolid(t) {
  return t === T.GROUND || t === T.BRICK || t === T.QBLOCK ||
         t === T.QUSED  || t === T.SOLID || t === T.PIPE_T || t === T.PIPE_B;
}

// ─── Particles ────────────────────────────────────────────────────────────────
let particles = [];
function spawnParticles(wx, wy, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 4 + 1;
    particles.push({ x:wx, y:wy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2,
                     life:30+Math.random()*20, max:50, size:4+Math.random()*4, color });
  }
}
function spawnCoinPop(wx, wy) {
  particles.push({ x:wx, y:wy, vx:0, vy:-6, life:40, max:40, size:10, color:'#FFD700', type:'coin' });
}

// ─── Float texts ──────────────────────────────────────────────────────────────
let floats = [];
function spawnFloat(wx, wy, text, color='#FFD700') {
  floats.push({ x:wx, y:wy, vy:-1.5, life:50, text, color });
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
let enemies = [];
function spawnEnemies(map) {
  const positions = [
    {c:13, t:'goomba'}, {c:18, t:'goomba'}, {c:27, t:'goomba'},
    {c:29, t:'koopa'},  {c:40, t:'goomba'}, {c:43, t:'koopa'},
    {c:58, t:'goomba'}, {c:61, t:'koopa'},  {c:66, t:'goomba'},
    {c:71, t:'koopa'},  {c:84, t:'goomba'}, {c:86, t:'goomba'},
    {c:90, t:'koopa'},
  ];
  for (const p of positions) {
    // Find ground row for this column
    let row = ROWS - 1;
    for (let r = 0; r < ROWS; r++) {
      if (isSolid(map[r][p.c])) { row = r; break; }
    }
    const w = p.t === 'koopa' ? 28 : 26;
    const h = p.t === 'koopa' ? 34 : 26;
    enemies.push({
      type: p.t,
      x: p.c * TILE + (TILE - w) / 2,
      y: row * TILE - h,
      w, h,
      vx: -1.2,
      vy: 0,
      onGround: false,
      alive: true,
      dead: false,       // stomped but not removed yet
      deadTimer: 0,
      shell: false,      // koopa in shell
      shellVx: 0,
      animFrame: 0,
    });
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────
let player;
function createPlayer() {
  return {
    x: 2 * TILE, y: (ROWS - 3) * TILE,
    w: 24, h: 32,
    vx: 0, vy: 0,
    onGround: false,
    dir: 1,      // 1=right, -1=left
    animFrame: 0,
    animTimer: 0,
    big: false,  // powered up
    invincible: 0,
    jumpHeld: false,
  };
}

// ─── Camera ───────────────────────────────────────────────────────────────────
let camX = 0;

// ─── Game state ───────────────────────────────────────────────────────────────
let gameState = 'title'; // title | playing | dead | win | gameover
let map, score, coins, lives, frame, level, deadTimer, winTimer;

function startGame() {
  map       = buildLevel();
  score     = 0;
  coins     = 0;
  lives     = 3;
  frame     = 0;
  level     = 1;
  deadTimer = 0;
  winTimer  = 0;
  camX      = 0;
  particles = [];
  floats    = [];
  player    = createPlayer();
  enemies   = [];
  spawnEnemies(map);
  gameState = 'playing';
}

function respawn() {
  camX      = 0;
  particles = [];
  floats    = [];
  player    = createPlayer();
  enemies   = [];
  spawnEnemies(map);
  gameState = 'playing';
}

// ─── Physics helpers ─────────────────────────────────────────────────────────
function tileAt(col, row) {
  if (col < 0 || col >= LW || row < 0 || row >= ROWS) return T.EMPTY;
  return map[row][col];
}

function moveEntity(ent, vx, vy) {
  // X movement
  ent.x += vx;
  const left  = Math.floor(ent.x / TILE);
  const right = Math.floor((ent.x + ent.w - 1) / TILE);
  const top   = Math.floor(ent.y / TILE);
  const bot   = Math.floor((ent.y + ent.h - 1) / TILE);

  if (vx > 0) {
    for (let r = top; r <= bot; r++) {
      if (isSolid(tileAt(right, r))) {
        ent.x = right * TILE - ent.w;
        ent.vx = 0; break;
      }
    }
  } else if (vx < 0) {
    for (let r = top; r <= bot; r++) {
      if (isSolid(tileAt(left, r))) {
        ent.x = (left + 1) * TILE;
        ent.vx = 0; break;
      }
    }
  }

  // Y movement
  ent.y += vy;
  const left2  = Math.floor(ent.x / TILE);
  const right2 = Math.floor((ent.x + ent.w - 1) / TILE);
  const top2   = Math.floor(ent.y / TILE);
  const bot2   = Math.floor((ent.y + ent.h - 1) / TILE);

  ent.onGround = false;
  if (vy > 0) {
    for (let c = left2; c <= right2; c++) {
      if (isSolid(tileAt(c, bot2))) {
        ent.y = bot2 * TILE - ent.h;
        ent.vy = 0;
        ent.onGround = true;
        break;
      }
    }
  } else if (vy < 0) {
    for (let c = left2; c <= right2; c++) {
      if (isSolid(tileAt(c, top2))) {
        ent.y = (top2 + 1) * TILE;
        hitBlock(c, top2);
        ent.vy = 0;
        break;
      }
    }
  }
}

function hitBlock(col, row) {
  const t = map[row][col];
  if (t === T.QBLOCK) {
    map[row][col] = T.QUSED;
    score += 200;
    spawnFloat(col * TILE + TILE/2 - camX, row * TILE - 8, '+200');
    spawnParticles((col + 0.5) * TILE, row * TILE, '#FFD700', 6);
    spawnCoinPop((col + 0.5) * TILE, row * TILE);
    coins++;
    score += 100;
  } else if (t === T.BRICK) {
    if (player.big) {
      map[row][col] = T.EMPTY;
      spawnParticles((col+0.5)*TILE, row*TILE, '#C8703A', 12);
      score += 50;
    } else {
      spawnParticles((col+0.5)*TILE, row*TILE, '#C8703A', 4);
    }
  }
}

// ─── Update player ────────────────────────────────────────────────────────────
function updatePlayer() {
  const p = player;
  const run = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyX'];
  const spd = run ? RUN_SPD : WALK_SPD;

  // Horizontal
  if (keys['ArrowLeft'] || keys['KeyA']) {
    p.vx = Math.max(p.vx - 0.8, -spd);
    p.dir = -1;
  } else if (keys['ArrowRight'] || keys['KeyD']) {
    p.vx = Math.min(p.vx + 0.8, spd);
    p.dir = 1;
  } else {
    p.vx *= 0.75;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
  }

  // Jump
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || keys['KeyZ']) && p.onGround && !p.jumpHeld) {
    p.vy = JUMP_VY;
    p.jumpHeld = true;
  }
  if (!(keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || keys['KeyZ'])) {
    p.jumpHeld = false;
    if (p.vy < -4) p.vy = Math.max(p.vy + 1.5, -4); // variable jump height
  }

  // Gravity
  p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);

  moveEntity(p, p.vx, p.vy);

  // Animate
  if (p.onGround && Math.abs(p.vx) > 0.3) {
    p.animTimer++;
    if (p.animTimer > (run ? 5 : 8)) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4; }
  } else if (!p.onGround) {
    p.animFrame = 2;
  } else {
    p.animFrame = 0;
  }

  if (p.invincible > 0) p.invincible--;

  // Fell off map
  if (p.y > H + 40) {
    playerDie();
  }

  // Goal
  const px = Math.floor((p.x + p.w/2) / TILE);
  const py = Math.floor((p.y + p.h/2) / TILE);
  if (tileAt(px, py) === T.GOAL || tileAt(px, py-1) === T.GOAL) {
    gameState = 'win';
    winTimer = 180;
  }

  // Collect coins from map
  for (let c = Math.floor(p.x/TILE); c <= Math.floor((p.x+p.w)/TILE); c++) {
    for (let r = Math.floor(p.y/TILE); r <= Math.floor((p.y+p.h)/TILE); r++) {
      if (tileAt(c, r) === T.COIN) {
        map[r][c] = T.EMPTY;
        coins++;
        score += 100;
        spawnFloat(c*TILE+TILE/2 - camX, r*TILE, '+100');
      }
    }
  }
}

function playerDie() {
  if (player.invincible > 0) return;
  lives--;
  spawnParticles(player.x + player.w/2, player.y + player.h/2, '#FF4040', 20);
  if (lives <= 0) {
    gameState = 'gameover';
  } else {
    gameState = 'dead';
    deadTimer = 120;
  }
}

// ─── Update enemies ───────────────────────────────────────────────────────────
function updateEnemies() {
  const p = player;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.dead) {
      e.deadTimer--;
      if (e.deadTimer <= 0) e.alive = false;
      continue;
    }

    // Shell sliding
    if (e.shell && e.shellVx !== 0) {
      e.vx = e.shellVx;
    }

    // Gravity
    e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
    moveEntity(e, e.vx, e.vy);

    // Reverse at walls / edges
    const col  = Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / TILE);
    const rowB = Math.floor((e.y + e.h + 2) / TILE);
    const rowG = Math.floor((e.y + e.h - 1) / TILE);
    if (e.onGround) {
      // Wall check
      if (isSolid(tileAt(col, rowG))) e.vx *= -1;
      // Cliff check (don't walk off)
      if (!e.shell) {
        const ahead = Math.floor((e.x + (e.vx > 0 ? e.w + 2 : -2)) / TILE);
        if (!isSolid(tileAt(ahead, rowB))) e.vx *= -1;
      }
    }

    // Enemy animFrame
    e.animFrame = Math.floor(frame / 12) % 2;

    // Player collision
    if (p.invincible > 0) continue;
    const pw = p.x + p.w, ph = p.y + p.h;
    const ew = e.x + e.w, eh = e.y + e.h;
    if (p.x < ew && pw > e.x && p.y < eh && ph > e.y) {
      // Stomp?
      const stomped = p.vy > 0 && ph <= e.y + 12 && ph >= e.y;
      if (stomped) {
        if (e.type === 'koopa' && !e.shell) {
          e.shell = true;
          e.shellVx = 0;
          e.h = 22;
          e.y += 12;
          e.vx = 0;
          score += 400;
          spawnFloat(e.x + e.w/2 - camX, e.y, '+400');
        } else if (e.type === 'koopa' && e.shell) {
          // Kick shell
          e.shellVx = p.x < e.x ? 7 : -7;
          score += 100;
        } else {
          e.dead = true;
          e.deadTimer = 30;
          score += 200;
          spawnParticles(e.x + e.w/2, e.y + e.h/2, '#A06030', 10);
          spawnFloat(e.x + e.w/2 - camX, e.y, '+200');
        }
        p.vy = -7; // bounce
      } else {
        playerDie();
      }
    }

    // Shell hits enemies
    if (e.shell && Math.abs(e.shellVx) > 0) {
      for (const e2 of enemies) {
        if (e2 === e || !e2.alive || e2.dead) continue;
        const e2w = e2.x + e2.w, e2h = e2.y + e2.h;
        if (e.x < e2w && ew > e2.x && e.y < e2h && eh > e2.y) {
          e2.dead = true; e2.deadTimer = 30;
          score += 500;
          spawnParticles(e2.x+e2.w/2, e2.y+e2.h/2, '#A06030', 10);
          spawnFloat(e2.x+e2.w/2 - camX, e2.y, '+500');
        }
      }
    }
  }
  enemies = enemies.filter(e => e.alive);
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function updateCamera() {
  const target = player.x - W * 0.35;
  camX += (target - camX) * 0.15;
  camX = Math.max(0, Math.min(camX, LW * TILE - W));
}

// ─── Draw player ──────────────────────────────────────────────────────────────
function drawPlayer() {
  const p = player;
  if (p.invincible > 0 && frame % 6 < 3) return;
  const sx = p.x - camX;
  const sy = p.y;

  ctx.save();
  ctx.translate(sx + p.w/2, sy + p.h/2);
  if (p.dir === -1) ctx.scale(-1, 1);

  const h = p.h, hw = p.w / 2;

  // Legs (animated)
  const legOff = [0,4,0,-4][p.animFrame] * (p.onGround ? 1 : 0);
  ctx.fillStyle = '#1a5fcb';
  ctx.fillRect(-hw, h/2 - 4 + legOff, hw - 2, h/2 + 4 - legOff);
  ctx.fillRect(2, h/2 - 4 - legOff, hw - 2, h/2 + 4 + legOff);

  // Body
  ctx.fillStyle = '#e03020';
  ctx.fillRect(-hw, -h/2, p.w, h * 0.65);

  // Face skin
  ctx.fillStyle = '#f8c880';
  ctx.fillRect(-hw + 4, -h/2 + 2, p.w - 8, h * 0.35);

  // Hat
  ctx.fillStyle = '#e03020';
  ctx.fillRect(-hw, -h/2 - 6, p.w, 8);
  ctx.fillRect(-hw + 2, -h/2 - 10, p.w - 6, 6);

  // Eye
  ctx.fillStyle = '#000';
  ctx.fillRect(hw - 8, -h/2 + 6, 5, 5);

  // Mustache
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(-hw + 4, -h/2 + h*0.22, p.w - 6, 4);

  // Shoes
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(-hw, h/2, hw-1, 6);
  ctx.fillRect(3, h/2 - legOff, hw-1, 6);

  ctx.restore();
}

// ─── Draw enemy ───────────────────────────────────────────────────────────────
function drawEnemy(e) {
  const sx = e.x - camX;
  if (sx > W + 32 || sx + e.w < -32) return;
  ctx.save();
  ctx.translate(sx + e.w/2, e.y + e.h/2);

  if (e.dead) {
    // Flattened
    ctx.fillStyle = e.type === 'koopa' ? '#3a8a3a' : '#a06030';
    ctx.fillRect(-e.w/2, -4, e.w, 8);
    ctx.restore(); return;
  }

  if (e.type === 'goomba') {
    const bob = e.animFrame === 1 ? 2 : 0;
    // Feet
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(-e.w/2, e.h/2 - 4 + bob, 10, 6);
    ctx.fillRect(e.w/2 - 10, e.h/2 - 4 - bob, 10, 6);
    // Body
    ctx.fillStyle = '#a06030';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.w/2, e.h/2, 0, 0, Math.PI*2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-10, -8, 8, 7); ctx.fillRect(3, -8, 8, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(-8, -7, 5, 5);  ctx.fillRect(4, -7, 5, 5);
    // Eyebrows (angry)
    ctx.fillStyle = '#5a3010';
    ctx.save(); ctx.rotate(0.3);
    ctx.fillRect(-13, -15, 10, 3);
    ctx.restore(); ctx.save(); ctx.rotate(-0.3);
    ctx.fillRect(4, -16, 10, 3);
    ctx.restore();
  } else {
    // Koopa
    if (e.shell) {
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.ellipse(0, 2, e.w/2, e.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(0, 2, e.w/2 - 6, e.h/2 - 6, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#3a8a3a';
      // Shell lines
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i*8, -e.h/2+4); ctx.lineTo(i*6, e.h/2-2);
        ctx.strokeStyle='#2a6a2a'; ctx.lineWidth=2; ctx.stroke();
      }
    } else {
      const dir = e.vx > 0 ? 1 : -1;
      ctx.scale(dir, 1);
      // Shell/back
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.w/2-2, e.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#f8c040';
      ctx.beginPath();
      ctx.ellipse(e.w/2 - 4, -e.h/4, 9, 9, 0, 0, Math.PI*2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e.w/2, -e.h/4 - 2, 3, 0, Math.PI*2); ctx.fill();
      // Feet
      const bob = e.animFrame === 1 ? 2 : 0;
      ctx.fillStyle = '#f8c040';
      ctx.fillRect(-e.w/2 + 2, e.h/2 - 4 + bob, 9, 7);
      ctx.fillRect(2, e.h/2 - 4 - bob, 9, 7);
    }
  }
  ctx.restore();
}

// ─── Draw level ───────────────────────────────────────────────────────────────
// 穴の列を事前収集
const HOLE_COLS = new Set([45,46, 68,69, 82,83]);

function drawLevel() {
  const startCol = Math.floor(camX / TILE);
  const endCol   = Math.min(startCol + COLS + 1, LW);
  for (let r = 0; r < ROWS; r++) {
    for (let c = startCol; c < endCol; c++) {
      const t = map[r][c];
      if (t === T.EMPTY) continue;
      drawTile(t, c * TILE - camX, r * TILE, frame);
    }
  }
  // 穴の手前2マスに警告矢印を描画
  for (const hc of HOLE_COLS) {
    const warnCol = hc - 1;
    if (warnCol < startCol || warnCol >= endCol) continue;
    if (map[ROWS-1][warnCol] === T.EMPTY) continue; // 穴自体はスキップ
    const px = warnCol * TILE - camX;
    const py = (ROWS - 1) * TILE;
    // 点滅
    const alpha = 0.5 + Math.sin(frame * 0.2) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▼', px + TILE / 2, py + TILE / 2 - 2);
    ctx.globalAlpha = 1;
  }
}

// ─── Draw sky background ─────────────────────────────────────────────────────
function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#5BA8FF');
  grad.addColorStop(1, '#A8D8FF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Clouds (parallax at 0.3x)
  const cx = camX * 0.3;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const cloudData = [100,60, 240,40, 380,70, 520,50, 660,55, 800,45, 940,65];
  for (let i = 0; i < cloudData.length; i += 2) {
    const x = ((cloudData[i] - cx) % (LW * TILE * 0.3 + W)) + (cx < 0 ? W : 0);
    const y = cloudData[i+1];
    ctx.beginPath();
    ctx.arc(x,      y,    28, 0, Math.PI*2);
    ctx.arc(x+28,   y-12, 22, 0, Math.PI*2);
    ctx.arc(x+52,   y,    24, 0, Math.PI*2);
    ctx.fill();
  }

  // Hills (parallax at 0.5x)
  const hx = camX * 0.5;
  ctx.fillStyle = '#6abf69';
  for (const [hcx, r] of [[80,60],[230,45],[420,70],[600,55],[780,65]]) {
    const xx = ((hcx - hx) % (LW * TILE * 0.5 + W * 2));
    ctx.beginPath();
    ctx.arc(xx, H - 20, r, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function drawHUD() {
  // 背景帯
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, 40);
  // 枠線
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, 40);

  ctx.font = 'bold 15px monospace';
  ctx.textBaseline = 'middle';

  // SCORE
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 10, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(score).padStart(7,'0'), 10, 30);

  // COINS
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText('COIN', W/2, 14);
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`×${String(coins).padStart(2,'0')}`, W/2, 30);

  // LIVES
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'right';
  ctx.fillText('LIVES', W - 10, 14);
  ctx.fillStyle = '#ff8888';
  ctx.fillText(`×${lives}`, W - 10, 30);

  ctx.textBaseline = 'alphabetic';
}

// ─── Float texts draw ────────────────────────────────────────────────────────
function updateAndDrawFloats() {
  floats = floats.filter(f => f.life > 0);
  for (const f of floats) {
    ctx.globalAlpha = f.life / 50;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
    f.y += f.vy; f.life--;
  }
  ctx.globalAlpha = 1;
}

// ─── Particles draw ──────────────────────────────────────────────────────────
function updateAndDrawParticles() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    const a = p.life / p.max;
    ctx.globalAlpha = a;
    if (p.type === 'coin') {
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor='#FFD700'; ctx.shadowBlur=8;
      ctx.beginPath();
      ctx.ellipse(p.x - camX, p.y, 7, 9, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur=0;
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
  }
  ctx.globalAlpha = 1;
}

// ─── Screens ─────────────────────────────────────────────────────────────────
function drawTitle() {
  drawBackground();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 38px monospace';
  ctx.fillText('SUPER', W/2, H/2 - 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('PLATFORMER', W/2, H/2 - 28);
  ctx.shadowBlur = 0;

  if (frame % 70 < 50) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE / ENTER', W/2, H/2 + 30);
  }
  ctx.fillStyle = '#ccc';
  ctx.font = '12px monospace';
  ctx.fillText('移動: 矢印/WASD  ジャンプ: Space/Z', W/2, H/2 + 65);
  ctx.fillText('ダッシュ: Shift/X  敵: 踏みつけ', W/2, H/2 + 83);
}

function drawDeadScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MISS...', W/2, H/2);
  ctx.font = '16px monospace';
  ctx.fillText(`残り ${lives} 機`, W/2, H/2 + 36);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W/2, H/2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText(`SCORE: ${String(score).padStart(7,'0')}`, W/2, H/2 + 20);
  if (frame % 70 < 50) ctx.fillText('PRESS SPACE / ENTER', W/2, H/2 + 60);
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=20;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE CLEAR!', W/2, H/2 - 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(`SCORE: ${String(score).padStart(7,'0')}`, W/2, H/2 + 10);
  ctx.fillText(`COINS: ${coins}`, W/2, H/2 + 38);
  if (frame % 70 < 50) {
    ctx.font = '15px monospace';
    ctx.fillText('PRESS SPACE / ENTER', W/2, H/2 + 80);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function update() {
  frame++;

  if (gameState === 'playing') {
    updatePlayer();
    updateEnemies();
    updateCamera();
  } else if (gameState === 'dead') {
    deadTimer--;
    if (deadTimer <= 0) respawn();
  } else if (gameState === 'win') {
    winTimer--;
    score += 10;
    if (winTimer <= 0 && (keys['Space'] || keys['Enter'])) startGame();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  if (gameState === 'title') { drawTitle(); return; }
  if (gameState === 'gameover') {
    drawBackground();
    drawGameOver();
    return;
  }

  drawBackground();
  drawLevel();

  for (const e of enemies) drawEnemy(e);
  drawPlayer();
  updateAndDrawParticles();
  updateAndDrawFloats();
  drawHUD();

  if (gameState === 'dead') drawDeadScreen();
  if (gameState === 'win')  drawWin();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
