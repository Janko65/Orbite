// Orbite — moteur partagé par le jeu (index.html), l'éditeur (editeur.js) et le solveur (solveur.js)
// Physique, astres mobiles (lunes), étoiles et ombres, objectifs, pilote automatique, simulation, calibrage.

// ===== Réglages physiques =====
const WORLD_W = 1000, WORLD_H = 2000; // taille du monde (1 unité = 1 m), proportion d'un écran de téléphone
const K = 0.5;              // G × densité : gravité de surface = K × rayon × g ; masse ∝ rayon³
const STAR_DENSITY = 0.25;  // une étoile est moins dense qu'une planète
const THRUST = 110;         // accélération max des jets (m/s²)
const CRASH_SPEED = 45;     // vitesse max au contact d'un astre (m/s, relative à l'astre)
const SHIP_R = 14;          // taille du vaisseau
const HULL_R = SHIP_R * 0.62; // rayon de collision
const TURN_RATE = 3.5;      // vitesse de rotation du vaisseau (rad/s)
const OUT_MARGIN = 150;     // marge hors écran avant d'être perdu
const ZONE_TIME = 5;        // secondes à rester dans une zone pour la valider
const LAND_ANGLE = 45;      // écart max (degrés) entre l'axe du vaisseau et la verticale du sol
const DT = 1 / 60, SUB = 4; // pas de temps fixe (jeu et simulation identiques)
// seuils de crash (le solveur les durcit pour que ses solutions gardent une marge de sécurité)
const TOL = { crash: CRASH_SPEED, angle: LAND_ANGLE };

const BODY_NAMES = {
  soleil: 'le Soleil', mercure: 'Mercure', venus: 'Vénus', terre: 'la Terre', lune: 'la Lune',
  mars: 'Mars', jupiter: 'Jupiter', saturne: 'Saturne', uranus: 'Uranus', neptune: 'Neptune',
};
const bodyName = p => p.name || BODY_NAMES[p.type] || 'la planète';

// racine exacte (IEEE) au lieu de Math.hypot / Math.pow : résultats identiques d'un moteur JS à l'autre
const hyp = (x, y) => Math.sqrt(x * x + y * y);

// masse : rayon³ × densité × multiplicateur de gravité g (réglable dans l'éditeur)
const bodyMass = p => K * (p.star ? STAR_DENSITY : 1) * (p.g || 1) * p.r * p.r * p.r;
const surfaceGravity = p => bodyMass(p) / (p.r * p.r);
const hasStar = L => L.planets.some(p => p.star);
const hasMoons = L => L.planets.some(p => p.orbit);

// ===== Astres mobiles =====
// une lune a orbit = {p: astre parent, d: distance, a0: angle de départ, dir: ±1} ; vitesse angulaire réaliste √(M/d³)
function bodyPos(L, i, t) {
  const p = L.planets[i];
  if (!p.orbit) return [p.x, p.y, 0, 0];
  const q = L.planets[p.orbit.p], [px, py, pvx, pvy] = bodyPos(L, p.orbit.p, t), d = p.orbit.d;
  const w = (p.orbit.dir || 1) * Math.sqrt(bodyMass(q) / (d * d * d)), a = p.orbit.a0 + w * t;
  const c = Math.cos(a), s = Math.sin(a);
  return [px + c * d, py + s * d, pvx - s * d * w, pvy + c * d * w];
}
// position de tous les astres à l'instant t (temps compté depuis le premier jet)
// B.belts : ceintures d'astéroïdes {x, y, r, w} autour d'une planète ou d'une étoile (jamais d'une lune)
function snapshot(L, t) {
  const withBelts = B => { B.belts = (L.belts || []).filter(b => B[b.p]).map(b => ({ x: B[b.p].x, y: B[b.p].y, r: b.r, w: b.w })); return B; };
  if (!hasMoons(L)) {
    if (!L._B) L._B = withBelts(L.planets.map((p, i) => ({ i, x: p.x, y: p.y, vx: 0, vy: 0, r: p.r, m: bodyMass(p), star: !!p.star })));
    return L._B;
  }
  return withBelts(L.planets.map((p, i) => { const [x, y, vx, vy] = bodyPos(L, i, t); return { i, x, y, vx, vy, r: p.r, m: bodyMass(p), star: !!p.star }; }));
}
// le point touche-t-il une ceinture d'astéroïdes (infranchissable) ?
const inBelt = (B, x, y) => (B.belts || []).some(b => Math.abs(hyp(x - b.x, y - b.y) - b.r) < b.w / 2 + HULL_R);
const invalidate = L => { delete L._B; };

function gravity(B, x, y) {
  let ax = 0, ay = 0;
  for (const b of B) {
    const dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2), g = b.m / d2;
    ax += g * dx / d; ay += g * dy / d;
  }
  return [ax, ay];
}

// Zone d'influence (là où la gravité de l'astre domine) : d × (m/M)^0,4 ; orbite stable conseillée au milieu
function influence(B, i) {
  const p = B[i];
  let soi = 1200;
  B.forEach((q, j) => { if (i !== j) soi = Math.min(soi, hyp(p.x - q.x, p.y - q.y) * Math.exp(0.4 * Math.log(p.m / q.m))); });
  const rin = p.r + 25, rout = Math.min(soi * 0.5, 700);
  return { soi: Math.min(soi, 1200), rin, rout, ok: rout > rin + 10, rorb: (rin + rout) / 2 };
}

// Ombre : le point ne voit aucune étoile (un astre masque chaque étoile). Sans étoile : jamais d'ombre.
function inShadow(B, x, y) {
  let any = false;
  for (const S of B) {
    if (!S.star) continue;
    any = true;
    let blocked = false;
    const dx = S.x - x, dy = S.y - y, l2 = dx * dx + dy * dy;
    for (const p of B) {
      if (p.star) continue;
      let t = ((p.x - x) * dx + (p.y - y) * dy) / l2; t = Math.max(0, Math.min(1, t));
      const cx = x + dx * t - p.x, cy = y + dy * t - p.y;
      if (cx * cx + cy * cy < p.r * p.r) { blocked = true; break; }
    }
    if (!blocked) return false;
  }
  return any;
}

// le vaisseau touche le sol par l'arrière : son nez pointe à moins de LAND_ANGLE de la verticale du sol
const rearOk = (ang, nx, ny) => Math.cos(ang) * nx + Math.sin(ang) * ny >= Math.cos(TOL.angle * Math.PI / 180);

function startState(L) {
  const p = L.planets[L.start.p], a = L.start.a;
  return { x: p.x + Math.cos(a) * (p.r + HULL_R), y: p.y + Math.sin(a) * (p.r + HULL_R), vx: 0, vy: 0, ang: a, airT: 0 };
}

const outOfBounds = s => s.x < -OUT_MARGIN || s.x > WORLD_W + OUT_MARGIN || s.y < -OUT_MARGIN || s.y > WORLD_H + OUT_MARGIN;

// le vaisseau s'oriente progressivement dans le sens de la poussée
function turn(s, th, dt) {
  if (!th) return;
  let d = Math.atan2(th.y, th.x) - s.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
  const m = TURN_RATE * dt * th.p; s.ang += Math.max(-m, Math.min(m, d));
}

// Un sous-pas de physique (B = astres à cet instant). Retourne {crash} ou {contact: index ou -1, wasAir}
function physStep(B, s, th, h) {
  let [ax, ay] = gravity(B, s.x, s.y);
  if (th) { ax += th.x * THRUST * th.p; ay += th.y * THRUST * th.p; }
  s.vx += ax * h; s.vy += ay * h; s.x += s.vx * h; s.y += s.vy * h;
  if (inBelt(B, s.x, s.y)) return { crash: 'belt' };
  let contact = -1;
  for (const b of B) {
    const dx = s.x - b.x, dy = s.y - b.y, d = hyp(dx, dy), min = b.r + HULL_R;
    if (d >= min) continue;
    if (b.star) return { crash: 'star' };
    const nx = dx / d, ny = dy / d;
    let rvx = s.vx - b.vx, rvy = s.vy - b.vy; // vitesse relative à l'astre (une lune bouge)
    if (hyp(rvx, rvy) > TOL.crash) return { crash: 'speed' };
    if (s.airT > 0 && !rearOk(s.ang, nx, ny)) return { crash: 'angle' };
    s.x = b.x + nx * min; s.y = b.y + ny * min;
    const vn = rvx * nx + rvy * ny; if (vn < 0) { rvx -= vn * nx; rvy -= vn * ny; }
    const f = Math.max(0, 1 - 10 * h); // frottement au sol
    const vt = rvx * -ny + rvy * nx, vn2 = Math.max(0, rvx * nx + rvy * ny);
    s.vx = b.vx + nx * vn2 - ny * vt * f; s.vy = b.vy + ny * vn2 + nx * vt * f;
    contact = b.i;
  }
  const wasAir = s.airT;
  if (contact < 0) s.airT += h; else s.airT = 0;
  return { contact, wasAir };
}

// ===== Objectifs de mission =====
// {type:'zone', x, y, r} rester ZONE_TIME s ; {type:'land', p} se poser sur l'astre p ; {type:'orbit', p, n} faire n tours de l'astre p
const missionInit = () => ({ step: 0, zoneT: 0, orbA: 0, orbPrev: null, done: false });

function missionTick(L, B, m, s, dt, landedOn) {
  const o = L.steps[m.step];
  if (!o) return;
  let ok = false;
  if (o.type === 'zone') {
    if (hyp(s.x - o.x, s.y - o.y) < o.r) { m.zoneT += dt; ok = m.zoneT >= ZONE_TIME; } else m.zoneT = 0;
  } else if (o.type === 'land') {
    ok = landedOn === o.p;
  } else if (o.type === 'orbit') {
    const p = B[o.p], a = Math.atan2(s.y - p.y, s.x - p.x);
    if (s.airT > 0 && hyp(s.x - p.x, s.y - p.y) < influence(B, o.p).soi) {
      if (m.orbPrev !== null) { let d = a - m.orbPrev; d = Math.atan2(Math.sin(d), Math.cos(d)); m.orbA += d; }
      m.orbPrev = a;
    } else { m.orbA = 0; m.orbPrev = null; }
    ok = Math.abs(m.orbA) >= Math.PI * 2 * o.n;
  }
  if (ok) {
    m.step++; m.zoneT = 0; m.orbA = 0; m.orbPrev = null;
    if (m.step >= L.steps.length) m.done = true;
  }
}

function stepText(L, o) {
  if (o.type === 'zone') return `Rester ${ZONE_TIME} s dans la zone`;
  const p = L.planets[o.p];
  if (!p) return '?';
  if (o.type === 'land') return (o.p === L.start.p ? 'Revenir se poser sur ' : 'Se poser sur ') + bodyName(p);
  return `Faire ${o.n} tour${o.n > 1 ? 's' : ''} de ${bodyName(p)}`;
}

// ===== Pilote automatique =====
function steer(B, s, tx, ty, final, P) {
  const dx = tx - s.x, dy = ty - s.y, d = hyp(dx, dy) || 1;
  const spd = Math.min(P.vmax, Math.sqrt(final * final + 2 * P.brake * d));
  const [gx, gy] = gravity(B, s.x, s.y);
  const ax = (dx / d * spd - s.vx) * P.gain - gx * P.comp, ay = (dy / d * spd - s.vy) * P.gain - gy * P.comp;
  const am = hyp(ax, ay);
  return am < P.db * THRUST ? null : { x: ax / am, y: ay / am, p: Math.min(1, am / THRUST) };
}

function orbitSteer(B, s, i, P) {
  const p = B[i], dx = s.x - p.x, dy = s.y - p.y, r = hyp(dx, dy) || 1, nx = dx / r, ny = dy / r;
  const inf = influence(B, i), rtMin = p.r + 30, rtMax = Math.max(rtMin + 10, Math.min(inf.soi * 0.85, p.r * 2.5 + 30));
  const rt = rtMin + P.orbR * (rtMax - rtMin);
  const v = Math.sqrt(p.m / rt), dir = P.orbDir;
  const vr = Math.max(-80, Math.min(80, (rt - r) * P.orbK));
  const ax = (p.vx - ny * dir * v + nx * vr - s.vx) * P.gain, ay = (p.vy + nx * dir * v + ny * vr - s.vy) * P.gain;
  const am = hyp(ax, ay);
  return am < P.db * THRUST ? null : { x: ax / am, y: ay / am, p: Math.min(1, am / THRUST) };
}

function missionControl(L, B, s, m, P, ws) {
  const o = L.steps[m.step];
  if (ws.step !== m.step) { ws.step = m.step; ws.i = 0; }
  const wps = (P.wps && P.wps[m.step]) || [];
  while (ws.i < wps.length && hyp(wps[ws.i][0] - s.x, wps[ws.i][1] - s.y) < 70) ws.i++;
  if (ws.i < wps.length) return steer(B, s, wps[ws.i][0], wps[ws.i][1], P.vmax, P);
  if (o.type === 'zone') return steer(B, s, o.x, o.y, 0, P);
  if (o.type === 'land') {
    const p = B[o.p], a = Math.atan2(s.y - p.y, s.x - p.x);
    return steer(B, s, p.x + Math.cos(a) * (p.r + HULL_R), p.y + Math.sin(a) * (p.r + HULL_R), P.land, P);
  }
  return orbitSteer(B, s, o.p, P);
}

// ===== Simulation =====
// pts = [[x, y]] : vers un point (simulation du joueur) ; pts = null : mission complète (aide, solveur)
// le temps (chrono et mouvement des lunes) démarre au premier jet, comme dans le jeu
function fly(L, P, pts, tmax) {
  const s = startState(L), m = missionInit(), ws = { step: -1, i: 0 }, path = [[s.x, s.y]];
  let used = 0, t = 0, tw = 0, launched = false, frame = 0;
  tmax = tmax || (pts ? 40 : 150);
  const h = DT / SUB;
  const res = ok => (path.push([s.x, s.y]), { ok, used, t: tw, path, end: { x: s.x, y: s.y, vx: s.vx, vy: s.vy, ang: s.ang, tw } });
  while (t < tmax) {
    const B0 = snapshot(L, tw);
    let th;
    if (pts) {
      if (hyp(pts[0][0] - s.x, pts[0][1] - s.y) < 30) return res(true);
      th = steer(B0, s, pts[0][0], pts[0][1], 0, P);
    } else th = missionControl(L, B0, s, m, P, ws);
    if (th && inShadow(B0, s.x, s.y)) th = null;
    if (th) launched = true;
    turn(s, th, DT);
    let landedOn = -1;
    for (let k = 0; k < SUB; k++) {
      if (th) used += h * th.p;
      const r = physStep(launched ? snapshot(L, tw + k * h) : B0, s, th, h);
      if (r.crash) return res(false);
      if (r.contact >= 0 && r.wasAir > 0.5) landedOn = r.contact;
      if (outOfBounds(s)) return res(false);
    }
    if (launched) tw += DT;
    if (!pts) { missionTick(L, snapshot(L, tw), m, s, DT, landedOn); if (m.done) return res(true); }
    t += DT;
    if (++frame % 6 === 0) path.push([s.x, s.y]);
  }
  return res(false);
}

// Trajectoire sans poussée (10 s max) depuis l'état o (o.tw = temps monde) : s'arrête à l'impact ou hors de l'écran
function predict(L, o) {
  let x = o.x, y = o.y, vx = o.vx, vy = o.vy;
  const h = 1 / 120, path = [[x, y]], t0 = o.tw || 0;
  for (let i = 1; i <= 1200; i++) {
    const B = snapshot(L, t0 + i * h);
    const [ax, ay] = gravity(B, x, y);
    vx += ax * h; vy += ay * h; x += vx * h; y += vy * h;
    if (i % 6 === 0) path.push([x, y]);
    if (inBelt(B, x, y)) { path.push([x, y]); return { path, hit: { x, y, t: i * h, crash: true } }; }
    for (const p of B) {
      const d = hyp(x - p.x, y - p.y);
      if (d < p.r + HULL_R) {
        path.push([x, y]);
        return { path, hit: { x, y, t: i * h, crash: p.star || hyp(vx - p.vx, vy - p.vy) > CRASH_SPEED || !rearOk(o.ang, (x - p.x) / d, (y - p.y) / d) } };
      }
    }
    if (x < -OUT_MARGIN || x > WORLD_W + OUT_MARGIN || y < -OUT_MARGIN || y > WORLD_H + OUT_MARGIN) break;
  }
  return { path, hit: null };
}

// Paramètres du pilote : tirage et mutation
function randP(L, withWps, rnd = Math.random) {
  const R = (a, b) => a + rnd() * (b - a);
  const wps = L.steps.map((o, i) => {
    const n = withWps ? Math.floor(rnd() * (i === 0 ? 3 : 2)) : 0, w = [];
    for (let j = 0; j < n; j++) w.push([R(50, WORLD_W - 50), R(50, WORLD_H - 50)]);
    return w;
  });
  return { wps, vmax: R(30, 220), brake: R(10, 100), gain: R(0.3, 4), comp: R(0, 1), db: R(0, 0.4), land: R(5, 35),
    orbR: R(0, 1), orbDir: rnd() < 0.5 ? -1 : 1, orbK: R(0.2, 1.5) };
}
function mutate(P, rnd = Math.random, k = 1) {
  const m = (v, s, lo, hi) => Math.max(lo, Math.min(hi, v + (rnd() - 0.5) * s * k));
  return { wps: P.wps.map(w => w.map(([x, y]) => [m(x, 60, 30, WORLD_W - 30), m(y, 60, 30, WORLD_H - 30)])),
    vmax: m(P.vmax, 30, 20, 250), brake: m(P.brake, 15, 5, 120), gain: m(P.gain, 0.5, 0.2, 5),
    comp: m(P.comp, 0.15, 0, 1), db: m(P.db, 0.06, 0, 0.6), land: m(P.land, 6, 3, 40),
    orbR: m(P.orbR, 0.15, 0, 1), orbDir: rnd() < 0.03 ? -P.orbDir : P.orbDir, orbK: m(P.orbK, 0.2, 0.1, 2) };
}

// Solution la plus adaptée : meilleur compromis temps / gaz (rapportés au gaz disponible et au temps objectif)
const ratioCost = (L, r) => r.used / L.fuel + r.t / L.time;

// marges par défaut selon la position du niveau (gaz : 3,0 → 2,2 ; chrono : 1,5 → 1,15)
const defaultMargins = (i, n) => ({ fuel: +(3.0 - 0.8 * i / Math.max(1, n - 1)).toFixed(2), time: +(1.5 - 0.35 * i / Math.max(1, n - 1)).toFixed(2) });

// ===== Calibrage d'un niveau (générateur : rend la main régulièrement pour afficher la progression) =====
// fuel = gaz minimum × marge gaz (la réserve de 50 % reste atteignable) ;
// time = meilleur temps en gardant 50 % de gaz × marge chrono (les deux bonus atteignables ensemble) ;
// hint = solution conseillée robuste au meilleur compromis temps / gaz.
function* calibrate(L0, margins, f = 1) {
  const L = JSON.parse(JSON.stringify(L0)); delete L.hint; delete L._B;
  const M = margins.fuel, TAU = margins.time;
  const tol0 = { ...TOL };
  TOL.crash = CRASH_SPEED - 6; TOL.angle = LAND_ANGLE - 8; // marge de sécurité sur les solutions
  try {
    const st = startState(L);
    if (inShadow(snapshot(L, 0), st.x, st.y)) return { error: 'Le départ est dans l’ombre' };
    if (!L.steps.length) return { error: 'Aucun objectif' };
    const total = (1500 + 900 + 900 + 700) * f;
    let done = 0;
    const sols = [];
    const run = P => { done++; const r = fly(L, P, null); if (r.ok) sols.push({ P, used: r.used, t: r.t }); return r; };
    // recherche au hasard ; si rien n'est trouvé, on insiste (jusqu'à 4 fois plus longtemps)
    for (let n = 0; n < 1500 * f || (!sols.length && n < 6000 * f); n++) { run(randP(L, true)); if (n % 20 === 0) yield Math.min(0.4, done / total); }
    if (!sols.length) return { error: 'Aucune solution trouvée' };
    function* climb(b, n, better, accept = () => true) {
      for (let k = 0; k < n; k++) {
        const Q = mutate(b.P, Math.random, k < n / 2 ? 1 : 0.4), r = run(Q);
        if (r.ok && accept(r) && better(r, b)) b = { P: Q, used: r.used, t: r.t };
        if (k % 20 === 0) yield done / total;
      }
      return b;
    }
    const bf = yield* climb(sols.reduce((a, b) => b.used < a.used ? b : a), 900 * f, (r, b) => r.used < b.used);
    const F = Math.ceil(bf.used * M * 10) / 10;
    const half = sols.filter(s => s.used <= F / 2);
    const bt = yield* climb(half.reduce((a, b) => b.t < a.t ? b : a), 900 * f, (r, b) => r.t < b.t, r => r.used <= F / 2);
    const T = Math.max(1, Math.ceil(bt.t * TAU));
    L.fuel = F; L.time = T;
    const bh = yield* climb(sols.filter(s => s.used <= F).reduce((a, b) => ratioCost(L, b) < ratioCost(L, a) ? b : a), 700 * f, (r, b) => ratioCost(L, r) < ratioCost(L, b), r => r.used <= F);
    // solution conseillée robuste : elle doit réussir aussi arrondie et légèrement perturbée
    const rd = v => Math.round(v * 1e4) / 1e4;
    const round = P => ({ ...Object.fromEntries(Object.entries(P).filter(([k]) => k !== 'wps').map(([k, v]) => [k, rd(v)])), wps: P.wps.map(w => w.map(([x, y]) => [Math.round(x), Math.round(y)])) });
    const robust = P => {
      const tries = [P];
      for (let k = 0; k < 6; k++) tries.push(mutate(P, Math.random, 0.01));
      return tries.every(Q => { const r = fly(L, Q, null); return r.ok && r.used <= F; });
    };
    const cands = [bh].concat(sols.filter(s => s.used <= F).sort((a, b) => ratioCost(L, a) - ratioCost(L, b)));
    let hint = null, k = 0;
    for (const c of cands.slice(0, 300)) { const P = round(c.P); if (robust(P)) { hint = P; break; } if (++k % 5 === 0) yield 1; }
    if (!hint) return { error: 'Pas de solution conseillée assez robuste' };
    const chk = fly(L, hint, null);
    return { minFuel: bf.used, fuel: F, tFastHalf: bt.t, time: T, hint, hintUsed: chk.used, hintT: chk.t };
  } finally { Object.assign(TOL, tol0); }
}

if (typeof module !== 'undefined') module.exports = {
  WORLD_W, WORLD_H, K, THRUST, CRASH_SPEED, LAND_ANGLE, ZONE_TIME, TOL, snapshot, inShadow, startState, influence, fly, randP, mutate,
  ratioCost, bodyMass, calibrate, defaultMargins,
};
