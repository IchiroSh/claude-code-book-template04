'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 480, H = 640;
canvas.width = W; canvas.height = H;

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const PADDLE_W   = 80;
const PADDLE_H   = 12;
const PADDLE_Y   = H - 50;
const PADDLE_SPD = 6;
const BALL_R     = 7;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 7;
const BLOCK_W    = 42;
const BLOCK_H    = 18;
const BLOCK_PAD  = 3;
const BLOCK_OX   = (W - (BLOCK_COLS * (BLOCK_W + BLOCK_PAD) - BLOCK_PAD)) / 2;
const BLOCK_OY   = 70;

// ブロックの行ごとの色・強度・スコア
const ROW_CONFIG = [
  { color: '#ff4081', strength: 3, score: 30, label: '★' },
  { color: '#ff6e40', strength: 2, score: 20, label: '' },
  { color: '#ffca28', strength: 2, score: 20, label: '' },
  { color: '#69f0ae', strength: 1, score: 10, label: '' },
  { color: '#40c4ff', strength: 1, score: 10, label: '' },
  { color: '#b388ff', strength: 1, score: 10, label: '' },
  { color: '#80deea', strength: 1, score:  5, label: '' },
];

// パワーアップ種類
const PU_TYPES = ['wide', 'multi', 'slow', 'fast'];

// ─── 入力 ─────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// マウス/タッチ操作
let mouseX = W / 2;
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (W / rect.width);
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width);
}, { passive: false });

// ─── ゲーム状態 ──────────────────────────────────────────────────────────────
let gameState = 'title'; // 'title' | 'playing' | 'clear' | 'gameover'
let score = 0, hiScore = 0, lives = 3, level = 1;
let frame = 0;

let paddle, balls, blocks, powerups, particles;

// ─── 初期化 ───────────────────────────────────────────────────────────────────
function initLevel() {
  paddle = {
    x: W / 2 - PADDLE_W / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    wide: 0,   // 残フレーム数
  };

  balls = [{
    x: W / 2, y: PADDLE_Y - BALL_R - 1,
    vx: (Math.random() < 0.5 ? 1 : -1) * 3.5,
    vy: -(3.5 + level * 0.3),
    stuck: true,
  }];

  blocks = [];
  const rows = Math.min(BLOCK_ROWS, 4 + level);
  for (let r = 0; r < rows; r++) {
    const cfg = ROW_CONFIG[r % ROW_CONFIG.length];
    for (let c = 0; c < BLOCK_COLS; c++) {
      // レベルに応じてランダムに強いブロックを混ぜる
      const bonus = level >= 3 && Math.random() < 0.15 ? 1 : 0;
      blocks.push({
        x: BLOCK_OX + c * (BLOCK_W + BLOCK_PAD),
        y: BLOCK_OY + r * (BLOCK_H + BLOCK_PAD),
        w: BLOCK_W, h: BLOCK_H,
        hp: cfg.strength + bonus,
        maxHp: cfg.strength + bonus,
        score: cfg.score,
        color: cfg.color,
        alive: true,
        puChance: 0.12,
      });
    }
  }

  powerups  = [];
  particles = [];
}

function startGame() {
  score = 0; lives = 3; level = 1;
  initLevel();
  gameState = 'playing';
}

// ─── パーティクル ─────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 4 + 1;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1,
      life: 24 + Math.random() * 16,
      max: 40,
      r: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles() {
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── パワーアップ ─────────────────────────────────────────────────────────────
function spawnPowerup(x, y) {
  const type = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
  const colors = { wide: '#69f0ae', multi: '#ff80ab', slow: '#40c4ff', fast: '#ffca28' };
  const labels = { wide: 'WIDE', multi: '×3', slow: 'SLOW', fast: 'FAST' };
  powerups.push({ x, y, vy: 2.2, w: 44, h: 18, type, color: colors[type], label: labels[type], alive: true });
}

function updatePowerups() {
  powerups.forEach(p => {
    if (!p.alive) return;
    p.y += p.vy;
    if (p.y > H) { p.alive = false; return; }

    // パドルに当たる
    if (p.y + p.h/2 >= paddle.y &&
        p.y - p.h/2 <= paddle.y + PADDLE_H &&
        p.x + p.w/2 >= paddle.x &&
        p.x - p.w/2 <= paddle.x + paddle.w) {
      applyPowerup(p.type);
      spawnParticles(p.x, p.y, p.color, 14);
      p.alive = false;
    }
  });
  powerups = powerups.filter(p => p.alive);
}

function applyPowerup(type) {
  if (type === 'wide') {
    paddle.wide = 300;
  } else if (type === 'multi') {
    // ボールを3倍に（最大6個）
    const newBalls = [];
    balls.forEach(b => {
      if (balls.length + newBalls.length >= 6) return;
      const angles = [-0.35, 0.35];
      angles.forEach(da => {
        const spd = Math.hypot(b.vx, b.vy);
        const a   = Math.atan2(b.vy, b.vx) + da;
        newBalls.push({ x: b.x, y: b.y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, stuck: false });
      });
    });
    balls.push(...newBalls);
  } else if (type === 'slow') {
    balls.forEach(b => {
      const spd = Math.hypot(b.vx, b.vy);
      const a   = Math.atan2(b.vy, b.vx);
      const ns  = Math.max(2.5, spd * 0.65);
      b.vx = Math.cos(a) * ns; b.vy = Math.sin(a) * ns;
    });
  } else if (type === 'fast') {
    balls.forEach(b => {
      const spd = Math.hypot(b.vx, b.vy);
      const a   = Math.atan2(b.vy, b.vx);
      const ns  = Math.min(10, spd * 1.4);
      b.vx = Math.cos(a) * ns; b.vy = Math.sin(a) * ns;
    });
  }
}

function drawPowerups() {
  powerups.forEach(p => {
    // グロー
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.roundRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#000';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x, p.y);
  });
}

// ─── ボール更新 ───────────────────────────────────────────────────────────────
function updateBalls() {
  const pw = paddle.wide > 0 ? PADDLE_W * 1.6 : PADDLE_W;

  balls.forEach(ball => {
    if (ball.stuck) {
      ball.x = paddle.x + pw / 2;
      ball.y = paddle.y - BALL_R - 1;
      return;
    }

    // サブステップで高速ボールの貫通を防ぐ
    const steps = Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / BALL_R);
    for (let s = 0; s < steps; s++) {
      ball.x += ball.vx / steps;
      ball.y += ball.vy / steps;

      // 壁反射
      if (ball.x - BALL_R < 0)  { ball.x = BALL_R;     ball.vx = Math.abs(ball.vx); }
      if (ball.x + BALL_R > W)  { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - BALL_R < 0)  { ball.y = BALL_R;     ball.vy = Math.abs(ball.vy); }

      // パドルに当たる
      if (ball.vy > 0 &&
          ball.y + BALL_R >= paddle.y &&
          ball.y - BALL_R <= paddle.y + PADDLE_H &&
          ball.x >= paddle.x - 2 &&
          ball.x <= paddle.x + pw + 2) {
        ball.y = paddle.y - BALL_R;
        // パドル中心からの距離でvxを調整
        const rel  = (ball.x - (paddle.x + pw / 2)) / (pw / 2);
        const spd  = Math.hypot(ball.vx, ball.vy);
        const minSpd = 3.5 + level * 0.3;
        const finalSpd = Math.max(minSpd, spd);
        const angle = rel * (Math.PI / 3); // 最大60°
        ball.vx = Math.sin(angle) * finalSpd;
        ball.vy = -Math.abs(Math.cos(angle) * finalSpd);
      }

      // ブロック衝突
      for (const b of blocks) {
        if (!b.alive) continue;
        if (ball.x + BALL_R < b.x || ball.x - BALL_R > b.x + b.w) continue;
        if (ball.y + BALL_R < b.y || ball.y - BALL_R > b.y + b.h) continue;

        // どの面に当たったか
        const overlapL = (ball.x + BALL_R) - b.x;
        const overlapR = (b.x + b.w) - (ball.x - BALL_R);
        const overlapT = (ball.y + BALL_R) - b.y;
        const overlapB = (b.y + b.h) - (ball.y - BALL_R);
        const minOL = Math.min(overlapL, overlapR, overlapT, overlapB);

        if (minOL === overlapL || minOL === overlapR) ball.vx *= -1;
        else                                           ball.vy *= -1;

        b.hp--;
        score += b.score;
        spawnParticles(ball.x, ball.y, b.color, 7);

        if (b.hp <= 0) {
          b.alive = false;
          score += b.score * 2; // ブロック破壊ボーナス
          spawnParticles(b.x + b.w/2, b.y + b.h/2, b.color, 18);
          if (Math.random() < b.puChance) spawnPowerup(b.x + b.w/2, b.y + b.h/2);
        }
        break;
      }
    }
  });

  // 画面下に出たボールを除去
  balls = balls.filter(b => b.y - BALL_R < H + 20);
}

// ─── パドル更新 ──────────────────────────────────────────────────────────────
function updatePaddle() {
  const pw = paddle.wide > 0 ? PADDLE_W * 1.6 : PADDLE_W;
  if (paddle.wide > 0) paddle.wide--;

  // キーボード
  if (keys['ArrowLeft'])  paddle.x -= PADDLE_SPD;
  if (keys['ArrowRight']) paddle.x += PADDLE_SPD;

  // マウス追従
  if (!keys['ArrowLeft'] && !keys['ArrowRight']) {
    paddle.x = mouseX - pw / 2;
  }

  paddle.x = Math.max(0, Math.min(W - pw, paddle.x));
}

// ─── 描画ヘルパー ─────────────────────────────────────────────────────────────
function drawBackground() {
  // グラデーション背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0018');
  bg.addColorStop(1, '#0d0030');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // グリッドライン
  ctx.strokeStyle = 'rgba(80, 40, 160, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawBlocks() {
  blocks.forEach(b => {
    if (!b.alive) return;

    // ダメージによる明度変化
    const ratio = b.hp / b.maxHp;
    ctx.shadowColor = b.color;
    ctx.shadowBlur  = 8 * ratio;

    // ブロック本体
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.4 + 0.6 * ratio;
    ctx.beginPath();
    ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3);
    ctx.fill();

    // ハイライト（上辺）
    ctx.globalAlpha = 0.5 * ratio;
    const hl = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    hl.addColorStop(0, 'rgba(255,255,255,0.5)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3);
    ctx.fill();

    // HP表示（複数HPのブロック）
    if (b.maxHp > 1) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = ratio < 0.5 ? '#ff8a65' : '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('■'.repeat(b.hp), b.x + b.w / 2, b.y + b.h / 2);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  });
}

function drawPaddle() {
  const pw = paddle.wide > 0 ? PADDLE_W * 1.6 : PADDLE_W;
  const px = paddle.x;
  const py = paddle.y;

  // グロー
  ctx.shadowColor = paddle.wide > 0 ? '#69f0ae' : '#7c4dff';
  ctx.shadowBlur  = 16;

  const grad = ctx.createLinearGradient(px, py, px, py + PADDLE_H);
  grad.addColorStop(0, paddle.wide > 0 ? '#b9f6ca' : '#b388ff');
  grad.addColorStop(1, paddle.wide > 0 ? '#00e676' : '#6200ea');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, PADDLE_H, 6);
  ctx.fill();

  // 上辺ハイライト
  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.roundRect(px + 2, py + 2, pw - 4, 4, 3);
  ctx.fill();
}

function drawBalls() {
  balls.forEach(ball => {
    // グロー
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 14;
    const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#aaccff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawHUD() {
  // 上部帯
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, 52);

  // スコア
  ctx.fillStyle = '#e0d0ff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE', 12, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(score).padStart(7, '0'), 12, 22);

  // ハイスコア
  ctx.fillStyle = '#b0a0d0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HI-SCORE', W/2, 8);
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(hiScore).padStart(7, '0'), W/2, 22);

  // ライフ
  ctx.fillStyle = '#b0a0d0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('LIFE', W - 12, 8);
  for (let i = 0; i < lives; i++) {
    ctx.fillStyle = '#ff80ab';
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(W - 18 - i * 18, 32, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // レベル
  ctx.fillStyle = '#80deea';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`LEVEL ${level}`, 12, 46);

  // 残ブロック数
  const alive = blocks.filter(b => b.alive).length;
  ctx.fillStyle = '#80deea';
  ctx.textAlign = 'right';
  ctx.fillText(`BLOCKS ${alive}`, W - 12, 46);
}

// ─── タイトル画面 ─────────────────────────────────────────────────────────────
function drawTitle() {
  drawBackground();

  // タイトルロゴ
  ctx.shadowColor = '#7c4dff';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#ede7f6';
  ctx.font        = 'bold 56px monospace';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BLOCK', W/2, H/2 - 60);
  ctx.shadowColor = '#ff4081';
  ctx.fillStyle   = '#ff80ab';
  ctx.fillText('BREAKER', W/2, H/2 + 10);
  ctx.shadowBlur  = 0;

  // サンプルブロック（デコ）
  const demoColors = ['#ff4081','#ff6e40','#ffca28','#69f0ae','#40c4ff','#b388ff'];
  demoColors.forEach((c, i) => {
    ctx.fillStyle   = c;
    ctx.shadowColor = c;
    ctx.shadowBlur  = 10;
    ctx.globalAlpha = 0.7 + Math.sin(frame * 0.04 + i * 0.8) * 0.15;
    ctx.beginPath();
    ctx.roundRect(W/2 - 135 + i*48, H/2 + 65, 42, 16, 4);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // ハイスコア
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`HI-SCORE  ${String(hiScore).padStart(7,'0')}`, W/2, H/2 + 110);

  // 点滅テキスト
  if (Math.floor(frame / 35) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE / CLICK TO START', W/2, H/2 + 155);
  }

  ctx.fillStyle = '#9090b0';
  ctx.font = '12px monospace';
  ctx.fillText('← → / マウス : パドル移動   SPACE : ボール発射', W/2, H - 20);
}

// ─── クリア画面 ───────────────────────────────────────────────────────────────
function drawClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#ffd740';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#ffd740';
  ctx.font        = 'bold 52px monospace';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CLEAR!', W/2, H/2 - 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`SCORE: ${score}`, W/2, H/2 + 20);

  if (Math.floor(frame / 35) % 2 === 0) {
    ctx.fillStyle = '#b0ffd0';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE - NEXT LEVEL', W/2, H/2 + 70);
  }
}

// ─── ゲームオーバー画面 ───────────────────────────────────────────────────────
function drawGameover() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#ff4081';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#ff80ab';
  ctx.font        = 'bold 48px monospace';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', W/2, H/2 - 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`SCORE: ${score}`, W/2, H/2 + 20);

  if (Math.floor(frame / 35) % 2 === 0) {
    ctx.fillStyle = '#ffcdd2';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE TO RETRY', W/2, H/2 + 70);
  }
}

// ─── メインループ ─────────────────────────────────────────────────────────────
canvas.addEventListener('click', () => {
  if (gameState === 'title')    { startGame(); return; }
  if (gameState === 'gameover') { startGame(); return; }
  if (gameState === 'clear')    { level++; initLevel(); gameState = 'playing'; return; }
  // ゲーム中クリックでボール発射
  balls.forEach(b => { b.stuck = false; });
});

function loop() {
  frame++;

  if (gameState === 'title') {
    drawTitle();
    if (keys['Space'] || keys['Enter']) { startGame(); }
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === 'gameover') {
    drawBackground();
    drawBlocks();
    drawParticles();
    drawGameover();
    if (keys['Space'] || keys['Enter']) { startGame(); }
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === 'clear') {
    drawBackground();
    drawParticles();
    drawClear();
    if (keys['Space'] || keys['Enter']) {
      level++;
      initLevel();
      gameState = 'playing';
    }
    requestAnimationFrame(loop);
    return;
  }

  // ── プレイ中 ──────────────────────────────────────────────────────────────
  // SPACE でボール発射
  if (keys['Space'] && balls.some(b => b.stuck)) {
    balls.forEach(b => { b.stuck = false; });
  }

  updatePaddle();
  updateBalls();
  updatePowerups();
  updateParticles();

  // ボールが全滅 → ライフ減少
  if (balls.length === 0) {
    lives--;
    if (lives <= 0) {
      hiScore = Math.max(hiScore, score);
      gameState = 'gameover';
    } else {
      // ボールを1個リセット
      balls = [{
        x: paddle.x + (paddle.wide > 0 ? PADDLE_W * 0.8 : PADDLE_W / 2),
        y: paddle.y - BALL_R - 1,
        vx: (Math.random() < 0.5 ? 1 : -1) * (3.5 + level * 0.3),
        vy: -(3.5 + level * 0.3),
        stuck: true,
      }];
    }
  }

  // 全ブロック破壊 → クリア
  if (blocks.every(b => !b.alive)) {
    hiScore = Math.max(hiScore, score);
    gameState = 'clear';
    // クリアパーティクル
    for (let i = 0; i < 60; i++) {
      const c = ROW_CONFIG[i % ROW_CONFIG.length].color;
      spawnParticles(Math.random() * W, Math.random() * H / 2, c, 1);
    }
  }

  // 描画
  drawBackground();
  drawBlocks();
  drawPowerups();
  drawParticles();
  drawPaddle();
  drawBalls();
  drawHUD();

  requestAnimationFrame(loop);
}

loop();
