'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 800, H = 450;
canvas.width = W; canvas.height = H;

const GY   = H - 85;   // ground y (feet)
const GRAV = 0.68;
const JVY  = -17;
const WSPD = 3.6;

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true;  e.preventDefault(); });
addEventListener('keyup',   e => { keys[e.code] = false; });

// ─── Attack data ──────────────────────────────────────────────────────────────
// dx/dy = hitbox offset from pivot facing right, active = [startFrame, endFrame]
const ATK = {
  punchL:  { dx:55, dy:-62, w:50, h:26, dmg:8,  hs:18, bs:10, type:'mid',  tot:20, active:[5,10]  },
  punchH:  { dx:62, dy:-68, w:62, h:30, dmg:16, hs:28, bs:16, type:'mid',  tot:32, active:[8,15]  },
  kickL:   { dx:54, dy:-30, w:55, h:26, dmg:10, hs:22, bs:12, type:'low',  tot:26, active:[6,12]  },
  kickH:   { dx:58, dy:-65, w:68, h:32, dmg:19, hs:36, bs:18, type:'high', tot:38, active:[10,18] },
  crouchP: { dx:52, dy:-28, w:46, h:22, dmg:7,  hs:14, bs:8,  type:'low',  tot:18, active:[4,9]   },
  crouchK: { dx:65, dy:-14, w:68, h:22, dmg:13, hs:26, bs:14, type:'low',  tot:28, active:[8,15]  },
  airPunch:{ dx:48, dy:-55, w:50, h:28, dmg:12, hs:22, bs:12, type:'mid',  tot:999, active:[4,20] },
  airKick: { dx:52, dy:-35, w:55, h:28, dmg:14, hs:24, bs:14, type:'mid',  tot:999, active:[5,22] },
  hadouken:{ dx:80, dy:-55, w:20, h:20, dmg:22, hs:30, bs:20, type:'mid',  tot:42, active:[20,42] },
};

// ─── Particles ────────────────────────────────────────────────────────────────
let particles = [];
function spawnHitFX(x, y, type) {
  const colors = type === 'block' ? ['#88ccff','#aaddff','#fff'] : ['#ffcc00','#ff8800','#fff','#ffff60'];
  const count  = type === 'block' ? 8 : 14;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 5 + 2;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s-2,
                     life: 20+Math.random()*12, max:32, size:3+Math.random()*4,
                     color: colors[Math.floor(Math.random()*colors.length)] });
  }
}
function updateParticles() {
  particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life--; });
  particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ─── Projectiles ─────────────────────────────────────────────────────────────
let projectiles = [];
function spawnHadouken(f) {
  projectiles.push({
    x: f.x + f.facing * 40, y: f.y - 55,
    vx: f.facing * 7, owner: f,
    life: 80, hit: false,
  });
}
function updateProjectiles() {
  for (const p of projectiles) { p.x += p.vx; p.life--; }
  projectiles = projectiles.filter(p => p.life > 0 && !p.hit);
}
function drawProjectiles() {
  for (const p of projectiles) {
    const pulse = 0.7 + Math.sin(p.life * 0.4) * 0.3;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#60c0ff'; ctx.shadowBlur = 15;
    ctx.fillStyle = `rgba(60,160,255,${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(180,230,255,${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── Fighter ──────────────────────────────────────────────────────────────────
class Fighter {
  constructor(x, name, isP1) {
    this.x = x; this.y = GY;
    this.vy = 0;
    this.facing = isP1 ? 1 : -1;
    this.hp = 180; this.maxHp = 180;
    this.state = 'idle';
    this.stTimer = 0;   // frames in current state
    this.animTick = 0;
    this.name = name; this.isP1 = isP1;
    this.hitDone = false;   // hit registered this attack
    this.hitstun = 0;
    this.blockstun = 0;
    this.wins = 0;
    this.comboCount = 0;
    this.lastHitFrame = -999;
    this.inputBuf = []; // {dir, f}
    this.hadoukenCooldown = 0;
    this.screenShake = 0;
  }

  get onGround()   { return this.y >= GY; }
  get crouching()  { return ['crouch','crouchP','crouchK','crouchBlock'].includes(this.state); }
  get blocking()   { return ['block','crouchBlock'].includes(this.state); }
  get attacking()  { return Object.keys(ATK).includes(this.state) && this.state !== 'hadouken'; }
  get inHadouken() { return this.state === 'hadouken'; }
  get canAct()     { return this.hitstun <= 0 && this.blockstun <= 0 && !['knockdown','getUp','win'].includes(this.state); }

  setDir(dir) {
    this.inputBuf.push({dir, f: gameFrame});
    if (this.inputBuf.length > 20) this.inputBuf.shift();
  }

  checkQCF() {
    // Quarter-circle forward: down then forward within 30f
    const recent = this.inputBuf.filter(b => gameFrame - b.f < 30);
    return recent.some(b => b.dir === 'D') && recent.some(b => b.dir === 'F');
  }

  setState(s) { this.state = s; this.stTimer = 0; this.hitDone = false; }

  hurtboxH() {
    if (this.state === 'knockdown') return 28;
    if (this.crouching) return 60;
    return 100;
  }

  update(opp) {
    this.stTimer++;
    this.animTick++;
    if (this.hitstun > 0)   this.hitstun--;
    if (this.blockstun > 0) this.blockstun--;
    if (this.hadoukenCooldown > 0) this.hadoukenCooldown--;

    // Gravity
    if (!this.onGround) {
      this.vy += GRAV;
      this.y += this.vy;
      if (this.y >= GY) { this.y = GY; this.vy = 0; if (this.state !== 'knockdown') this.setState('idle'); }
    }

    // Attack active frame → check hit
    const atk = ATK[this.state];
    if (atk && !this.hitDone) {
      const [af, al] = atk.active;
      if (this.stTimer >= af && this.stTimer <= al) {
        this.checkHit(opp, atk);
      }
    }

    // Attack timeout
    if (atk && this.stTimer >= atk.tot) this.setState('idle');

    // Hadouken timeout
    if (this.state === 'hadouken' && this.stTimer >= ATK.hadouken.tot) this.setState('idle');

    // Knockdown/getUp
    if (this.state === 'knockdown' && this.stTimer >= 65) this.setState('getUp');
    if (this.state === 'getUp'     && this.stTimer >= 28) { this.setState('idle'); }

    // Auto-face opponent
    if (this.canAct && this.onGround && !['block','crouchBlock','crouch'].includes(this.state)) {
      if (!this.attacking && !this.inHadouken) {
        this.facing = this.x < opp.x ? 1 : -1;
      }
    }

    // Wall clamp
    const minX = 60, maxX = W - 60;
    if (this.x < minX) this.x = minX;
    if (this.x > maxX) this.x = maxX;

    // Push fighters apart
    const PUSH = 52;
    const dx = this.x - opp.x;
    if (Math.abs(dx) < PUSH) {
      this.x += dx < 0 ? -0.5 : 0.5;
    }
  }

  checkHit(opp, atk) {
    // Hitbox position (mirrored for facing)
    const hx = this.x + this.facing * atk.dx;
    const hy = this.y + atk.dy;
    const ohy = opp.y - opp.hurtboxH();
    const ohx = opp.x - 25;

    if (hx + atk.w/2 < ohx || hx - atk.w/2 > ohx + 50) return;
    if (hy + atk.h/2 < ohy || hy - atk.h/2 > ohy + opp.hurtboxH()) return;

    this.hitDone = true;

    if (opp.blocking) {
      // Check if block is valid
      const validBlock = (atk.type !== 'low' || opp.crouching) && (atk.type !== 'high' || !opp.crouching);
      if (validBlock || atk.type === 'mid') {
        opp.hp -= Math.ceil(atk.dmg * 0.15);
        opp.blockstun = atk.bs;
        spawnHitFX(hx, hy, 'block');
        return;
      }
    }

    // Hit landed
    opp.hp -= atk.dmg;
    if (opp.hp < 0) opp.hp = 0;
    this.lastHitFrame = gameFrame;
    this.comboCount++;

    const heavy = atk.dmg >= 16;
    spawnHitFX(hx, hy, 'hit');
    screenShakeVal = heavy ? 8 : 4;

    if (opp.hp <= 0) {
      opp.setState('knockdown');
      opp.hitstun = 999;
    } else if (heavy && opp.onGround) {
      opp.setState('knockdown');
      opp.hitstun = atk.hs;
      opp.vy = -8;
      opp.y -= 5;
    } else if (!opp.onGround) {
      opp.hitstun = atk.hs;
      opp.setState('hurtAir');
      opp.vy = -4;
    } else {
      opp.hitstun = atk.hs;
      opp.setState(heavy ? 'hurtH' : 'hurt');
    }
  }
}

// ─── AI ──────────────────────────────────────────────────────────────────────
class AI {
  constructor(fighter) {
    this.f = fighter;
    this.state = 'approach';
    this.stTimer = 0;
    this.thinkTimer = 0;
    this.reactionBuf = 0; // delay before reacting
  }

  update(opp) {
    const f = this.f;
    if (!f.canAct) return;
    if (f.state === 'win' || gameState !== 'fight') return;

    this.thinkTimer++;
    this.stTimer++;
    const dist = Math.abs(f.x - opp.x);
    const hp   = f.hp / f.maxHp;

    // React to incoming projectiles
    for (const proj of projectiles) {
      if (proj.owner === opp) {
        const projDist = Math.abs(proj.x - f.x);
        if (projDist < 150 && f.canAct && Math.random() < 0.06) {
          if (Math.random() < 0.5) { f.setState('block'); }
          else { // Jump over
            if (f.onGround) { f.vy = JVY; f.y -= 2; f.setState('jump'); }
          }
          return;
        }
      }
    }

    // State machine
    switch (this.state) {
      case 'approach': {
        const targetDist = 90 + Math.random() * 40;
        if (dist > targetDist) {
          f.x += f.facing * WSPD * 0.85;
        } else {
          this.state = 'attack';
          this.stTimer = 0;
        }
        if (this.stTimer > 40 + Math.random()*30) {
          this.state = Math.random() < 0.3 ? 'defend' : 'attack';
          this.stTimer = 0;
        }
        break;
      }
      case 'attack': {
        if (dist > 200) { this.state = 'approach'; break; }
        if (this.stTimer > 5) {
          const r = Math.random();
          if (dist < 70) {
            if (r < 0.15 && f.hadoukenCooldown === 0 && dist > 120) { f.setState('hadouken'); spawnHadouken(f); f.hadoukenCooldown = 90; }
            else if (r < 0.35) f.setState('crouchK');
            else if (r < 0.55) f.setState('kickH');
            else if (r < 0.7)  f.setState('punchH');
            else if (r < 0.85) f.setState('punchL');
            else f.setState('kickL');
          } else if (dist < 130) {
            if (r < 0.4) f.setState('kickH');
            else if (r < 0.7) f.setState('punchH');
            else f.setState('kickL');
          }
          this.state = 'cooldown';
          this.stTimer = 0;
        }
        break;
      }
      case 'cooldown': {
        const cd = 25 + Math.random() * 35;
        if (this.stTimer > cd) {
          this.state = Math.random() < 0.25 ? 'defend' : (dist > 150 ? 'approach' : 'attack');
          this.stTimer = 0;
        }
        // occasionally walk/back off
        if (this.stTimer % 8 === 0 && Math.random() < 0.4) {
          f.x += f.facing * (Math.random() < 0.5 ? 1 : -1) * WSPD * 0.5;
        }
        break;
      }
      case 'defend': {
        f.setState(Math.random() < 0.4 ? 'crouchBlock' : 'block');
        if (this.stTimer > 30 + Math.random() * 25) {
          this.state = 'attack';
          this.stTimer = 0;
        }
        break;
      }
      case 'jump': {
        if (f.onGround && this.stTimer > 3) { f.vy = JVY; f.y -= 2; f.setState('jump'); }
        if (this.stTimer > 12) { this.state = 'attack'; this.stTimer = 0; }
        break;
      }
    }

    // Random jump attack occasionally
    if (f.onGround && Math.random() < 0.002) {
      f.vy = JVY; f.y -= 2; f.setState('jump');
      this.state = 'attack'; this.stTimer = 0;
    }

    // Crouch randomly
    if (f.onGround && f.state === 'idle' && Math.random() < 0.01) {
      f.setState('crouchP');
    }
  }
}

// ─── Character drawing ────────────────────────────────────────────────────────
function drawFighter(f) {
  if (f.state === 'win' && Math.floor(f.animTick/8)%2===0) return; // blink
  ctx.save();
  ctx.translate(f.x, f.y);
  const flip = f.facing;
  ctx.scale(flip, 1);

  // Hurt flash
  if ((f.hitstun > 0 && f.hitstun % 4 < 2) || f.state === 'hurt' || f.state === 'hurtH') {
    ctx.filter = 'brightness(3) saturate(0)';
  }

  const c1 = f.isP1 ? '#2255cc' : '#cc2222';  // main color
  const c2 = f.isP1 ? '#8899ff' : '#ff8888';  // highlight
  const skin = '#e8c090';

  const st = f.state;

  if (st === 'knockdown' || st === 'hurtAir') {
    drawKnockdown(c1, c2, skin);
  } else if (st === 'crouch' || st === 'crouchBlock') {
    drawCrouch(c1, c2, skin, st === 'crouchBlock');
  } else if (st === 'crouchP' || st === 'crouchK') {
    drawCrouchAttack(c1, c2, skin, st === 'crouchK');
  } else if (st === 'block') {
    drawBlock(c1, c2, skin);
  } else if (st === 'jump' || st === 'hurtAir') {
    drawJump(c1, c2, skin);
  } else if (st === 'punchL') {
    drawPunch(c1, c2, skin, false, f.stTimer);
  } else if (st === 'punchH') {
    drawPunch(c1, c2, skin, true, f.stTimer);
  } else if (st === 'kickL') {
    drawKick(c1, c2, skin, false, f.stTimer);
  } else if (st === 'kickH') {
    drawKick(c1, c2, skin, true, f.stTimer);
  } else if (st === 'airPunch') {
    drawAirAttack(c1, c2, skin, false);
  } else if (st === 'airKick') {
    drawAirAttack(c1, c2, skin, true);
  } else if (st === 'hadouken') {
    drawHadoukenPose(c1, c2, skin, f.stTimer);
  } else if (st === 'win') {
    drawWinPose(c1, c2, skin, f.animTick);
  } else {
    // idle / walk
    const bob = st.startsWith('walk') ? Math.sin(f.animTick * 0.28) * 3 : Math.sin(f.animTick * 0.07) * 1.5;
    drawIdle(c1, c2, skin, bob, f.isP1);
  }

  ctx.filter = 'none';
  ctx.restore();

  // Name tag
  ctx.fillStyle = f.isP1 ? '#88aaff' : '#ff8888';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(f.name, f.x, f.y - 118);
}

// ── Pose drawing helpers ──────────────────────────────────────────────────────
function rr(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circ(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
}
function headband(c, y) {
  ctx.fillStyle = c; ctx.fillRect(-14, y, 28, 5);
}

function drawIdle(c1, c2, skin, bob, isP1) {
  // Legs
  rr(-18, -55+bob, 15, 55+bob, 4, c1);
  rr(3,   -55+bob, 15, 55+bob, 4, c1);
  // Shoes
  rr(-22, -6, 20, 10, 3, '#1a1a1a');
  rr(2,   -6, 20, 10, 3, '#1a1a1a');
  // Body
  rr(-22, -100+bob, 44, 52, 6, c1);
  // Belt
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60+bob, 44, 5);
  // Arms (relaxed)
  rr(-32, -95+bob, 12, 38, 4, c2);
  rr(20,  -95+bob, 12, 38, 4, c2);
  // Glove fists
  circ(-26, -57+bob, 9, c2);
  circ(26,  -57+bob, 9, c2);
  // Torso highlight (chest)
  rr(-16, -96+bob, 32, 20, 4, c2+'88');
  // Head
  circ(0, -112+bob, 16, skin);
  // Hair
  ctx.fillStyle = isP1 ? '#cc8800' : '#1a1a1a';
  ctx.fillRect(-14, -128+bob, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126+bob, 16, Math.PI, 0); ctx.fill();
  // Headband
  headband(isP1 ? '#ff4444' : '#fff', -118+bob);
  // Eyes
  circ(-6, -113+bob, 2.5, '#222');
  circ(6,  -113+bob, 2.5, '#222');
  // Mouth smirk
  ctx.strokeStyle = '#6a3a20'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -108+bob, 5, 0.2, Math.PI-0.2); ctx.stroke();
}

function drawCrouch(c1, c2, skin, blocking) {
  rr(-20, -38, 18, 38, 4, c1);
  rr(2,   -38, 18, 38, 4, c1);
  rr(-24, -58, 48, 26, 6, c1);
  rr(-24, -28, 24, 7, 2, '#fff8');
  if (blocking) {
    rr(-28, -88, 14, 34, 4, c2);
    rr(6,   -86, 14, 34, 4, c2);
    circ(-21, -54, 10, c2);
    circ(18,  -54, 10, c2);
  } else {
    rr(-30, -82, 12, 30, 4, c2);
    rr(18,  -80, 12, 28, 4, c2);
    circ(-24, -52, 9, c2);
    circ(24,  -52, 9, c2);
  }
  circ(0, -76, 15, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-13, -90, 26, 13);
  ctx.beginPath(); ctx.arc(0, -88, 15, Math.PI, 0); ctx.fill();
  headband('#ff4444', -82);
  circ(-5, -77, 2.5, '#222'); circ(5, -77, 2.5, '#222');
}

function drawCrouchAttack(c1, c2, skin, isKick) {
  rr(-20, -38, 18, 38, 4, c1);
  rr(2,   -38, 18, 38, 4, c1);
  rr(-22, -58, 44, 26, 6, c1);
  if (isKick) {
    rr(18, -80, 12, 32, 4, c2);
    rr(16, -46, 68, 14, 4, c2);
    circ(80, -39, 12, c2);
    rr(-28, -82, 12, 30, 4, c2);
    circ(-22, -52, 9, c2);
  } else {
    rr(18, -80, 12, 30, 4, c2);
    rr(16, -52, 52, 12, 4, c2);
    circ(64, -46, 11, c2);
    rr(-28, -82, 12, 30, 4, c2);
    circ(-22, -52, 9, c2);
  }
  circ(0, -76, 15, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-13, -90, 26, 13);
  ctx.beginPath(); ctx.arc(0, -88, 15, Math.PI, 0); ctx.fill();
  headband('#ff4444', -82);
  circ(-5, -77, 2.5, '#222'); circ(5, -77, 2.5, '#222');
}

function drawBlock(c1, c2, skin) {
  rr(-18, -55, 15, 55, 4, c1);
  rr(3,   -55, 15, 55, 4, c1);
  rr(-22, -5, 20, 10, 3, '#1a1a1a');
  rr(2,   -5, 20, 10, 3, '#1a1a1a');
  rr(-22, -100, 44, 52, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60, 44, 5);
  // Arms crossed in front
  rr(-30, -105, 14, 48, 4, c2);
  rr(16,  -100, 14, 44, 4, c2);
  circ(-23, -57, 10, c2);
  circ(22,  -56, 10, c2);
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawJump(c1, c2, skin) {
  // Legs tucked
  rr(-22, -62, 16, 30, 4, c1);
  rr(6,   -60, 16, 30, 4, c1);
  rr(-26, -36, 22, 12, 3, '#1a1a1a');
  rr(4,   -34, 22, 12, 3, '#1a1a1a');
  rr(-22, -100, 44, 44, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -62, 44, 5);
  rr(-32, -98, 12, 36, 4, c2);
  rr(20,  -95, 12, 34, 4, c2);
  circ(-26, -62, 9, c2); circ(26, -61, 9, c2);
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawPunch(c1, c2, skin, heavy, t) {
  const ext = heavy ? Math.min(t*5, 50) : Math.min(t*6, 38);
  rr(-18, -55, 15, 55, 4, c1);
  rr(3,   -55, 15, 55, 4, c1);
  rr(-22, -5, 20, 10, 3, '#1a1a1a');
  rr(2,   -5, 20, 10, 3, '#1a1a1a');
  rr(-22, -100, 44, 52, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60, 44, 5);
  // Back arm
  rr(-32, -95, 12, 36, 4, c2);
  circ(-26, -59, 9, c2);
  // Punching arm extended
  rr(18,  -78, 12+ext, 14, 4, c2);
  circ(18+12+ext, -71, 12, c2);
  // Lean body
  rr(-22, -100, 44, 52, 6, c1+'cc');
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawKick(c1, c2, skin, heavy, t) {
  const ext = heavy ? Math.min(t*5, 58) : Math.min(t*6, 44);
  rr(-18, -55, 15, 55, 4, c1);
  rr(-22, -5, 20, 10, 3, '#1a1a1a');
  rr(-22, -100, 44, 52, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60, 44, 5);
  rr(-32, -95, 12, 38, 4, c2);
  rr(20,  -95, 12, 36, 4, c2);
  circ(-26, -57, 9, c2); circ(26, -59, 9, c2);
  // Kicking leg
  const ky = heavy ? -65 : -35;
  rr(3, ky, 14+ext, 14, 4, c1);
  rr(3+14+ext-6, ky-2, 28, 16, 3, '#1a1a1a');
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawAirAttack(c1, c2, skin, isKick) {
  rr(-22, -62, 16, 30, 4, c1);
  rr(-22, -100, 44, 44, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -62, 44, 5);
  rr(-32, -98, 12, 36, 4, c2);
  if (isKick) {
    rr(6, -60, 14, 14, 4, c1);
    rr(16, -62, 58, 14, 4, c1);
    rr(68, -64, 24, 16, 3, '#1a1a1a');
  } else {
    rr(20, -95, 12, 34, 4, c2);
    rr(18, -72, 54, 14, 4, c2);
    circ(70, -65, 12, c2);
  }
  circ(-26, -62, 9, c2);
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawHadoukenPose(c1, c2, skin, t) {
  const ext = Math.min(t * 3, 30);
  rr(-18, -55, 15, 55, 4, c1);
  rr(3,   -55, 15, 55, 4, c1);
  rr(-22, -5, 20, 10, 3, '#1a1a1a');
  rr(2,   -5, 20, 10, 3, '#1a1a1a');
  rr(-22, -100, 44, 52, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60, 44, 5);
  // Both arms push forward
  rr(-28, -82, 12+ext, 14, 4, c2);
  rr(14,  -74, 12+ext, 14, 4, c2);
  circ(-28+12+ext, -75, 11, c2);
  circ(14+12+ext, -67, 11, c2);
  // Glow on hands
  ctx.shadowColor = '#60c0ff'; ctx.shadowBlur = 14;
  circ(-28+12+ext, -75, 8, '#80d8ff');
  circ(14+12+ext, -67, 8, '#80d8ff');
  ctx.shadowBlur = 0;
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
}

function drawKnockdown(c1, c2, skin) {
  rr(-40, -22, 80, 16, 4, c1);
  rr(-28, -18, 55, 14, 3, '#1a1a1a');
  rr(-10, -32, 50, 16, 4, c1);
  circ(40, -30, 14, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(28, -44, 26, 12);
  headband('#ff4444', -40);
}

function drawWinPose(c1, c2, skin, tick) {
  const arm = Math.sin(tick * 0.12) * 8;
  rr(-18, -55, 15, 55, 4, c1);
  rr(3,   -55, 15, 55, 4, c1);
  rr(-22, -5, 20, 10, 3, '#1a1a1a');
  rr(2,   -5, 20, 10, 3, '#1a1a1a');
  rr(-22, -100, 44, 52, 6, c1);
  ctx.fillStyle = '#fff8'; ctx.fillRect(-22, -60, 44, 5);
  rr(-28, -105+arm, 12, 42, 4, c2);
  rr(16,  -98, 12, 36, 4, c2);
  circ(-22, -63+arm, 10, c2);
  circ(22, -62, 10, c2);
  circ(0, -112, 16, skin);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-14, -128, 28, 14);
  ctx.beginPath(); ctx.arc(0, -126, 16, Math.PI, 0); ctx.fill();
  headband('#ff4444', -118);
  circ(-6, -113, 2.5, '#222'); circ(6, -113, 2.5, '#222');
  // Smile
  ctx.strokeStyle = '#6a3a20'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -108, 6, 0, Math.PI); ctx.stroke();
}

// ─── Background ───────────────────────────────────────────────────────────────
function drawBackground() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#0a0520'); sky.addColorStop(1, '#3a1050');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.6);

  // Moon
  circ(680, 55, 38, '#ffe8c0');
  ctx.fillStyle = '#3a1050';
  circ(695, 48, 35, '#3a1050');

  // Stars
  ctx.fillStyle = '#fffce0';
  const starSeeds = [12,45,78,23,67,90,34,56,89,11,44,77,22,55,88];
  starSeeds.forEach((s,i) => {
    const x = (s*31+i*57)%W, y = (s*19+i*23)%140+10;
    ctx.fillRect(x, y, 1.5, 1.5);
  });

  // Distant city silhouette
  ctx.fillStyle = '#1a0830';
  const buildings = [
    [0,160,60,200],[55,180,40,180],[90,150,50,210],[135,170,35,190],
    [165,145,55,215],[215,175,30,185],[240,155,45,205],[280,185,35,175],
    [310,148,60,212],[365,172,38,188],[398,162,48,198],[440,178,32,182],
    [466,150,52,210],[512,168,40,192],[548,158,45,202],[588,182,30,178],
    [614,146,58,214],[666,174,36,186],[698,160,50,200],[742,180,34,180],
    [770,152,55,208],
  ];
  buildings.forEach(([x,y,w,h]) => ctx.fillRect(x, y, w, H-y));
  // Windows
  ctx.fillStyle = '#ffee8866';
  buildings.forEach(([x,y,w]) => {
    for (let wy = y+8; wy < H-20; wy+=16)
      for (let wx = x+4; wx < x+w-4; wx+=10)
        if (Math.random() < 0.4) ctx.fillRect(wx, wy, 5, 7);
  });

  // Neon signs (static)
  const signs = [['BRAWL', 80, 148, '#ff2255'], ['DOJO', 350, 145, '#00ffcc'],
                 ['FIGHT', 600, 150, '#ffaa00']];
  for (const [txt, x, y, col] of signs) {
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fillStyle = col; ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center'; ctx.fillText(txt, x, y);
  }
  ctx.shadowBlur = 0;

  // Ground platform
  const g = ctx.createLinearGradient(0, H*0.6, 0, H);
  g.addColorStop(0, '#2a2035'); g.addColorStop(1, '#110c1e');
  ctx.fillStyle = g; ctx.fillRect(0, H*0.6, W, H*0.4);

  // Floor tiles
  ctx.strokeStyle = '#3a2a50'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, H*0.6); ctx.lineTo(x+20, H); ctx.stroke();
  }
  for (let y = H*0.6; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Floor reflection glow
  ctx.fillStyle = 'rgba(100,60,160,0.08)';
  ctx.fillRect(0, H*0.6, W, 40);
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function drawHUD(p1, p2) {
  // Top bar background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, 48);

  // P1 health
  const barW = 290;
  const p1hp = Math.max(0, p1.hp / p1.maxHp);
  const p2hp = Math.max(0, p2.hp / p2.maxHp);
  // P1 bar (left)
  ctx.fillStyle = '#222'; ctx.fillRect(10, 10, barW, 20);
  const p1col = p1hp > 0.5 ? '#20dd60' : p1hp > 0.25 ? '#ffcc00' : '#ff2222';
  ctx.fillStyle = p1col;
  ctx.fillRect(10, 10, barW * p1hp, 20);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, barW, 20);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(p1.name, 14, 20);

  // P2 bar (right, mirrored)
  ctx.fillStyle = '#222'; ctx.fillRect(W-10-barW, 10, barW, 20);
  const p2col = p2hp > 0.5 ? '#20dd60' : p2hp > 0.25 ? '#ffcc00' : '#ff2222';
  ctx.fillStyle = p2col;
  ctx.fillRect(W-10-barW*p2hp, 10, barW*p2hp, 20);
  ctx.strokeStyle = '#555'; ctx.strokeRect(W-10-barW, 10, barW, 20);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
  ctx.fillText(p2.name, W-14, 20);

  // Timer
  const secs = Math.ceil(timer);
  ctx.fillStyle = secs <= 10 ? '#ff4444' : '#fff';
  ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(secs).padStart(2,'0'), W/2, 24);

  // Round wins (pips)
  for (let i = 0; i < 2; i++) {
    circ(W/2 - 60 + i*12, 40, 4, i < p1.wins ? '#ffd700' : '#444');
  }
  for (let i = 0; i < 2; i++) {
    circ(W/2 + 52 + i*12, 40, 4, i < p2.wins ? '#ffd700' : '#444');
  }

  // Combo counter
  if (p1.comboCount > 1 && gameFrame - p1.lastHitFrame < 60) {
    ctx.fillStyle = '#ffcc00'; ctx.font = `bold ${18 + p1.comboCount}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`${p1.comboCount} HIT!`, 20, 80);
  }
}

// ─── Screens ─────────────────────────────────────────────────────────────────
let gameFrame = 0;
let screenShakeVal = 0;
let gameState = 'title';
let f1, f2, ai;
let timer = 99, timerTick = 0;

function drawTitle() {
  drawBackground();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#ff2255'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff2255';
  ctx.font = 'bold 62px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('STREET', W/2, H/2-60);
  ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffaa00';
  ctx.fillText('BRAWLER', W/2, H/2+10);
  ctx.shadowBlur = 0;

  if (gameFrame % 70 < 48) {
    ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE / ENTER TO FIGHT', W/2, H/2+75);
  }
  ctx.fillStyle = '#888'; ctx.font = '12px monospace';
  ctx.fillText('← → 移動  ↑ ジャンプ  ↓ しゃがみ  A:弱パンチ  S:強パンチ  Z:弱キック  X:強キック  D:ガード', W/2, H-30);
  ctx.fillText('↓→+A:波動拳  ジャンプ中A/Z:空中攻撃', W/2, H-14);
}

function drawKOScreen(winner) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 40;
  ctx.fillStyle = '#ff3300';
  ctx.font = 'bold 78px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('K.O.', W/2, H/2 - 30);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px monospace';
  ctx.fillText(`${winner.name} WINS!`, W/2, H/2 + 40);
}

function drawMatchWin(winner) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 40;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 50px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('YOU WIN!', W/2, H/2 - 30);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
  if (gameFrame % 70 < 48) ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, H/2 + 50);
}

function drawCPUWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4444'; ctx.font = 'bold 50px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', W/2, H/2 - 30);
  ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
  if (gameFrame % 70 < 48) ctx.fillText('PRESS SPACE TO TRY AGAIN', W/2, H/2 + 50);
}

// ─── Game control ─────────────────────────────────────────────────────────────
let koTimer = 0, koWinner = null;
let winState = ''; // '' | 'p1win' | 'p2win'

function startFight() {
  f1 = new Fighter(200, 'KAI', true);
  f2 = new Fighter(600, 'REN', false);
  ai = new AI(f2);
  timer = 99; timerTick = 0;
  koTimer = 0; koWinner = null;
  particles = []; projectiles = [];
  gameState = 'fight';
}

function handlePlayerInput() {
  if (!f1.canAct) return;
  const left  = keys['ArrowLeft'];
  const right = keys['ArrowRight'];
  const up    = keys['ArrowUp'];
  const down  = keys['ArrowDown'];
  const lp    = keys['KeyA'];
  const hp    = keys['KeyS'];
  const lk    = keys['KeyZ'];
  const hk    = keys['KeyX'];
  const blk   = keys['KeyD'];

  const fwd  = f1.facing === 1 ? right : left;
  const back = f1.facing === 1 ? left  : right;

  // Input buffer for QCF
  if (down  && !f1._wasDown)  { f1.setDir('D'); } f1._wasDown  = down;
  if (fwd   && !f1._wasFwd)   { f1.setDir('F'); } f1._wasFwd   = fwd;

  // Hadouken
  if ((lp || hp) && f1.onGround && f1.hadoukenCooldown === 0 && f1.checkQCF()) {
    f1.setState('hadouken');
    spawnHadouken(f1);
    f1.hadoukenCooldown = 80;
    return;
  }

  // Air attacks
  if (!f1.onGround) {
    if (lp && f1.state === 'jump') { f1.setState('airPunch'); return; }
    if (lk && f1.state === 'jump') { f1.setState('airKick');  return; }
    return;
  }

  // Ground attacks
  if (down) {
    if      (lp) f1.setState('crouchP');
    else if (lk) f1.setState('crouchK');
    else         f1.setState(blk ? 'crouchBlock' : 'crouch');
    return;
  }
  if (lp) { f1.setState('punchL'); return; }
  if (hp) { f1.setState('punchH'); return; }
  if (lk) { f1.setState('kickL');  return; }
  if (hk) { f1.setState('kickH');  return; }
  if (blk) { f1.setState('block'); return; }

  if (up && f1.onGround) {
    f1.vy = JVY; f1.y -= 2;
    f1.setState('jump');
    return;
  }

  if (fwd)  { f1.x += WSPD * f1.facing; f1.setState('walkFwd');  return; }
  if (back) { f1.x -= WSPD * f1.facing * 0.8; f1.setState('walkBack'); return; }

  if (f1.state === 'walkFwd' || f1.state === 'walkBack') f1.setState('idle');
}

// ─── Projectile vs fighter collision ─────────────────────────────────────────
function checkProjectileHits() {
  for (const proj of projectiles) {
    const target = proj.owner === f1 ? f2 : f1;
    if (Math.abs(proj.x - target.x) < 28 && Math.abs(proj.y - (target.y - 55)) < 55) {
      if (target.blocking) {
        target.hp -= 4;
        target.blockstun = 20;
        spawnHitFX(proj.x, proj.y, 'block');
      } else if (target.hitstun <= 0) {
        target.hp -= ATK.hadouken.dmg;
        target.hitstun = ATK.hadouken.hs;
        target.setState('hurtH');
        spawnHitFX(proj.x, proj.y, 'hit');
        screenShakeVal = 6;
        proj.owner.score = (proj.owner.score || 0) + ATK.hadouken.dmg;
      }
      proj.hit = true;
    }
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  gameFrame++;
  if (screenShakeVal > 0) screenShakeVal--;

  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (screenShakeVal > 0) {
    shakeX = (Math.random()-0.5) * screenShakeVal * 2;
    shakeY = (Math.random()-0.5) * screenShakeVal * 2;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);

  if (gameState === 'title') {
    drawTitle();
    if (keys['Space'] || keys['Enter']) { startFight(); }
    ctx.restore(); requestAnimationFrame(loop); return;
  }

  if (gameState === 'matchWin') {
    drawBackground();
    drawFighter(f1); drawFighter(f2);
    drawParticles(); drawProjectiles();
    drawHUD(f1, f2);
    drawMatchWin(f1);
    if (keys['Space'] || keys['Enter']) { f1.wins = 0; f2.wins = 0; startFight(); }
    ctx.restore(); requestAnimationFrame(loop); return;
  }
  if (gameState === 'cpuWin') {
    drawBackground();
    drawFighter(f1); drawFighter(f2);
    drawParticles(); drawProjectiles();
    drawHUD(f1, f2);
    drawCPUWin();
    if (keys['Space'] || keys['Enter']) { f1.wins = 0; f2.wins = 0; startFight(); }
    ctx.restore(); requestAnimationFrame(loop); return;
  }

  // ── Fight ──
  timerTick++;
  if (timerTick >= 60) { timerTick = 0; timer = Math.max(0, timer - 1); }

  // Timeout
  if (timer <= 0 && koTimer === 0) {
    const winner = f1.hp >= f2.hp ? f1 : f2;
    koWinner = winner;
    koTimer = 180;
  }

  if (koTimer === 0) {
    handlePlayerInput();
    ai.update(f1);
    f1.update(f2);
    f2.update(f1);
    checkProjectileHits();
    updateProjectiles();
    updateParticles();

    // Check KO
    if (f1.hp <= 0 || f2.hp <= 0) {
      koWinner = f1.hp > 0 ? f1 : f2;
      koTimer = 1;
      f1.setState(f1.hp > 0 ? 'win' : 'knockdown');
      f2.setState(f2.hp > 0 ? 'win' : 'knockdown');
    }
  } else {
    koTimer--;
    if (koTimer <= 0) {
      koWinner.wins++;
      if (koWinner.wins >= 2) {
        gameState = koWinner.isP1 ? 'matchWin' : 'cpuWin';
      } else {
        startFight();
      }
      ctx.restore(); requestAnimationFrame(loop); return;
    }
  }

  // Draw
  drawBackground();
  drawFighter(f1);
  drawFighter(f2);
  drawProjectiles();
  drawParticles();
  drawHUD(f1, f2);
  if (koTimer > 0 && koWinner) drawKOScreen(koWinner);

  ctx.restore();
  requestAnimationFrame(loop);
}

loop();
