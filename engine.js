// Orbite — moteur partagé par le jeu (index.html), l'éditeur (editeur.js) et le solveur (solveur.js)
// Physique, astres mobiles (lunes), étoiles et ombres, objectifs, pilote automatique, simulation, calibrage.

// ===== Réglages physiques =====
const WORLD_W = 1000, WORLD_H = 2000; // taille du monde (1 unité = 1 m), proportion d'un écran de téléphone
const worldH = L => (L && L.h > WORLD_H ? L.h : WORLD_H); // « grand voyage » : niveau perso deux fois plus haut (h = 4000)
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
  const withBelts = B => { B.belts = (L.belts || []).filter(b => B[b.p]).map(b => ({ p: b.p, x: B[b.p].x, y: B[b.p].y, r: b.r, w: b.w })); return B; };
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

const outOfBounds = (s, hgt = WORLD_H) => s.x < -OUT_MARGIN || s.x > WORLD_W + OUT_MARGIN || s.y < -OUT_MARGIN || s.y > hgt + OUT_MARGIN;

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
  if (inBelt(B, s.x, s.y)) { const bl = (B.belts || []).find(b => Math.abs(hyp(s.x - b.x, s.y - b.y) - b.r) < b.w / 2 + HULL_R); return { crash: 'belt', p: bl ? bl.p : -1 }; }
  let contact = -1;
  for (const b of B) {
    const dx = s.x - b.x, dy = s.y - b.y, d = hyp(dx, dy), min = b.r + HULL_R;
    if (d >= min) continue;
    if (b.star) return { crash: 'star', p: b.i };
    const nx = dx / d, ny = dy / d;
    let rvx = s.vx - b.vx, rvy = s.vy - b.vy; // vitesse relative à l'astre (une lune bouge)
    if (hyp(rvx, rvy) > TOL.crash) return { crash: 'speed', p: b.i };
    if (s.airT > 0 && !rearOk(s.ang, nx, ny)) return { crash: 'angle', p: b.i };
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

// Pilote « humain agile » (niveaux avec human: true) : une décision toutes les 0,2 s (poussée tenue entre deux),
// et après chaque atterrissage une vraie pause au sol (0,6 s + attente réglable « wait ») avant de repartir : pas de touché-décollé
const HUMAN_HOLD = 12, HUMAN_REST = 0.6; // réglés d'après le vol d'un joueur expérimenté (niveau 23 : 19 % de gaz, 46 s)
const pilotInit = () => ({ step: 0, hold: null, holdN: 0, restN: 0 });
function pilot(L, B, s, m, P, ws, ps) {
  if (!L.human) return missionControl(L, B, s, m, P, ws);
  if (ps.step !== m.step) { // objectif atteint : après un atterrissage, on reste posé un moment
    const prev = L.steps[ps.step];
    if (m.step > ps.step && prev && prev.type === 'land') { const Q = (P.per && P.per[ps.step]) || P; ps.restN = Math.round((HUMAN_REST + (Q.wait || 0)) / DT); }
    ps.holdN = 0; ps.step = m.step;
  }
  if (ps.restN > 0) { ps.restN--; return null; }
  if (ps.holdN > 0) { ps.holdN--; return ps.hold; }
  ps.hold = missionControl(L, B, s, m, P, ws); ps.holdN = HUMAN_HOLD - 1;
  return ps.hold;
}
function missionControl(L, B, s, m, P0, ws) {
  const o = L.steps[m.step], P = P0.per && P0.per[m.step] ? P0.per[m.step] : P0; // réglages propres à chaque objectif (solveur par étapes)
  const wpsAll = P0.wps;
  if (ws.step !== m.step) { ws.step = m.step; ws.i = 0; }
  const wps = (wpsAll && wpsAll[m.step]) || [];
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
// P.rec : vol enregistré d'un joueur (poussée et orientation image par image) rejoué à l'identique
// résultat : prog = avancement (objectifs finis + rapprochement du suivant), steps = objectif en cours à chaque point du tracé
function decodeRec(rec) {
  const out = [];
  for (const r of rec) {
    const fr = r.length > 2 ? { th: { x: r[1], y: r[2], p: r[3], fuel: r[4] }, ang: r[5] } : { th: null, ang: r[1] };
    for (let k = 0; k < r[0]; k++) out.push(fr);
  }
  return out;
}
function stepCloseness(L, B, m, s) {
  const o = L.steps[m.step];
  if (!o) return 1;
  if (o.type === 'zone') return 1 / (1 + Math.max(0, hyp(s.x - o.x, s.y - o.y) - o.r) / 200);
  const p = B[o.p], d = hyp(s.x - p.x, s.y - p.y);
  if (o.type === 'land') return 0.9 / (1 + Math.max(0, d - p.r) / 200);
  return 0.5 / (1 + Math.max(0, d - influence(B, o.p).soi) / 200) + 0.45 * Math.min(1, Math.abs(m.orbA) / (2 * Math.PI * o.n));
}
function fly(L, P, pts, tmax) {
  const s = startState(L), m = missionInit(), ws = { step: -1, i: 0 }, ps = pilotInit(), path = [[s.x, s.y]], steps = [0];
  const rec = P && P.rec ? decodeRec(P.rec) : null;
  let used = 0, t = 0, tw = 0, launched = false, frame = 0, pi = 0, best = 0, bStep = 0;
  tmax = rec ? rec.length * DT + 0.5 : tmax || (pts ? 40 : Math.max(150, 70 * L.steps.length)) * worldH(L) / WORLD_H;
  const h = DT / SUB;
  const res = ok => (path.push([s.x, s.y]), steps.push(m.step), { ok, used, t: tw, path, steps, prog: ok ? L.steps.length : m.step + best, end: { x: s.x, y: s.y, vx: s.vx, vy: s.vy, ang: s.ang, tw } });
  while (t < tmax) {
    const B0 = snapshot(L, tw);
    let th;
    if (rec) { if (frame >= rec.length) return res(false); th = rec[frame].th; }
    else if (pts) {
      // points de passage dans l'ordre : on traverse les premiers à vitesse de croisière, on s'arrête au dernier
      if (hyp(pts[pi][0] - s.x, pts[pi][1] - s.y) < 30 && ++pi >= pts.length) return res(true);
      th = steer(B0, s, pts[pi][0], pts[pi][1], pi < pts.length - 1 ? P.vmax : 0, P);
    } else th = pilot(L, B0, s, m, P, ws, ps);
    if (th && !L.noShadow && inShadow(B0, s.x, s.y)) th = null;
    if (th) launched = true;
    if (rec) s.ang = rec[frame].ang; else turn(s, th, DT);
    let landedOn = -1;
    for (let k = 0; k < SUB; k++) {
      if (th) used += h * (th.fuel ?? th.p);
      const r = physStep(launched ? snapshot(L, tw + k * h) : B0, s, th, h);
      if (r.crash) return res(false);
      if (r.contact >= 0 && r.wasAir > 0.5) landedOn = r.contact;
      if (outOfBounds(s, worldH(L))) return res(false);
    }
    if (launched) tw += DT;
    if (!pts) {
      const Bt = snapshot(L, tw);
      missionTick(L, Bt, m, s, DT, landedOn); if (m.done) return res(true);
      if (m.step !== bStep) { bStep = m.step; best = 0; }
      if (frame % 3 === 0) best = Math.max(best, stepCloseness(L, Bt, m, s));
    }
    t += DT;
    if (++frame % 6 === 0) { path.push([s.x, s.y]); steps.push(m.step); }
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
        const nx = (x - p.x) / d, ny = (y - p.y) / d;
        return { path, hit: { x, y, t: i * h, p: p.i, v: hyp(vx - p.vx, vy - p.vy), da: Math.acos(Math.max(-1, Math.min(1, Math.cos(o.ang) * nx + Math.sin(o.ang) * ny))) * 180 / Math.PI, star: p.star, crash: p.star || hyp(vx - p.vx, vy - p.vy) > CRASH_SPEED || !rearOk(o.ang, (x - p.x) / d, (y - p.y) / d) } };
      }
    }
    if (x < -OUT_MARGIN || x > WORLD_W + OUT_MARGIN || y < -OUT_MARGIN || y > worldH(L) + OUT_MARGIN) break;
  }
  return { path, hit: null };
}

// Paramètres du pilote : tirage et mutation
function randP(L, withWps, rnd = Math.random) {
  const R = (a, b) => a + rnd() * (b - a);
  const wps = L.steps.map((o, i) => {
    const n = withWps ? Math.floor(rnd() * (i === 0 ? 3 : 2)) : 0, w = [];
    for (let j = 0; j < n; j++) w.push([R(50, WORLD_W - 50), R(50, worldH(L) - 50)]);
    return w;
  });
  return { wps, vmax: R(30, 220), brake: R(10, 100), gain: R(0.3, 4), comp: R(0, 1), db: R(0, 0.4), land: R(5, 35),
    orbR: R(0, 1), orbDir: rnd() < 0.5 ? -1 : 1, orbK: R(0.2, 1.5), wait: R(0, 6) };
}
function mutate(P, rnd = Math.random, k = 1, hgt = WORLD_H) {
  const m = (v, s, lo, hi) => Math.max(lo, Math.min(hi, v + (rnd() - 0.5) * s * k));
  const par = Q => ({ vmax: m(Q.vmax, 30, 20, 250), brake: m(Q.brake, 15, 5, 120), gain: m(Q.gain, 0.5, 0.2, 5),
    comp: m(Q.comp, 0.15, 0, 1), db: m(Q.db, 0.06, 0, 0.6), land: m(Q.land, 6, 3, 40),
    orbR: m(Q.orbR, 0.15, 0, 1), orbDir: rnd() < 0.03 ? -Q.orbDir : Q.orbDir, orbK: m(Q.orbK, 0.2, 0.1, 2), wait: m(Q.wait || 0, 1.5, 0, 8) });
  const out = { wps: P.wps.map(w => w.map(([x, y]) => [m(x, 60, 30, WORLD_W - 30), m(y, 60, 30, hgt - 30)])), ...par(P) };
  if (P.per) out.per = P.per.map(par);
  return out;
}
const PARAM_KEYS = ['vmax', 'brake', 'gain', 'comp', 'db', 'land', 'orbR', 'orbDir', 'orbK', 'wait'];
const paramsOf = P => Object.fromEntries(PARAM_KEYS.map(k => [k, P[k]]));

// Solution la plus adaptée : meilleur compromis temps / gaz (rapportés au gaz disponible et au temps objectif)
const ratioCost = (L, r) => r.used / L.fuel + r.t / L.time;

// marges par défaut selon la position du niveau (gaz : 3,0 → 2,2 ; chrono : 1,5 → 1,15)
const defaultMargins = (i, n) => ({ fuel: +(3.0 - 0.8 * i / Math.max(1, n - 1)).toFixed(2), time: +(1.5 - 0.35 * i / Math.max(1, n - 1)).toFixed(2) });

// ===== Calibrage d'un niveau (générateur : rend la main régulièrement pour afficher la progression) =====
// fuel = gaz minimum × marge gaz (la réserve de 50 % reste atteignable) ;
// Vol d'un seul objectif à partir d'un état enregistré (solveur par étapes) : mêmes calculs, dans le même ordre, que fly()
// st = { s, m, tw, used, launched } ; s'arrête quand l'objectif m.step est rempli (ok), au crash, ou après tmax secondes
function flyStage(L, P, st, tmax) {
  const s = { ...st.s }, m = { ...st.m }, ws = { step: -1, i: 0 }, ps = { ...(st.ps || pilotInit()) }, k0 = m.step;
  let used = st.used, tw = st.tw, launched = st.launched, t = 0, frame = 0, best = 0;
  const h = DT / SUB;
  const out = ok => ({ ok, prog: ok ? 1 : best, st: { s: { ...s }, m: { ...m }, ps: { ...ps }, tw, used, launched } });
  while (t < tmax) {
    const B0 = snapshot(L, tw);
    let th = pilot(L, B0, s, m, P, ws, ps);
    if (th && !L.noShadow && inShadow(B0, s.x, s.y)) th = null;
    if (th) launched = true;
    turn(s, th, DT);
    let landedOn = -1;
    for (let k = 0; k < SUB; k++) {
      if (th) used += h * (th.fuel ?? th.p);
      const r = physStep(launched ? snapshot(L, tw + k * h) : B0, s, th, h);
      if (r.crash) return out(false);
      if (r.contact >= 0 && r.wasAir > 0.5) landedOn = r.contact;
      if (outOfBounds(s, worldH(L))) return out(false);
    }
    if (launched) tw += DT;
    const Bt = snapshot(L, tw);
    missionTick(L, Bt, m, s, DT, landedOn);
    if (m.step > k0) return out(true);
    if (frame++ % 3 === 0) best = Math.max(best, stepCloseness(L, Bt, m, s));
    t += DT;
  }
  return out(false);
}

// Recherche par étapes : objectif après objectif, on garde les meilleurs départs (faisceau) et on cherche la suite à partir d'eux
function* stagedSearch(L, f, onSol) {
  const hh = worldH(L), n = L.steps.length, s0 = startState(L);
  let beam = [{ per: [], wps: [], st: { s: s0, m: missionInit(), tw: 0, used: 0, launched: false }, c: 0 }];
  const randWps = k => { const o = L.steps[k], w = [], c = Math.floor(Math.random() * 3); for (let j = 0; j < c; j++) w.push([50 + Math.random() * (WORLD_W - 100), 50 + Math.random() * (hh - 100)]); return w; };
  for (let k = 0; k < n; k++) {
    const next = [], tries = Math.round(500 * f), cands = [];
    for (let j = 0; j < tries; j++) {
      const b = beam[j % beam.length];
      let par, w;
      // un peu d'exploration au hasard, surtout de l'amélioration des meilleurs essais
      if (cands.length > 4 && Math.random() < 0.6) { const c = cands[Math.floor(Math.random() * Math.random() * cands.length)]; const Q = mutate({ wps: [c.w], ...c.par }, Math.random, 0.3 + Math.random(), hh); par = paramsOf(Q); w = Q.wps[0]; if (Math.random() < 0.15) w = randWps(k); }
      else { par = paramsOf(randP(L, false)); w = randWps(k); }
      const wpsAll = b.wps.concat([w]), P = { wps: wpsAll, per: b.per.concat([par]), ...par };
      const r = flyStage(L, P, b.st, 70 * hh / WORLD_H);
      if (r.ok) next.push({ per: P.per, wps: wpsAll, st: r.st, c: r.st.used + 0.03 * r.st.tw });
      else { cands.push({ par, w, prog: r.prog, b }); cands.sort((a, b2) => b2.prog - a.prog); if (cands.length > 12) cands.pop(); }
      if (next.length >= 24) break;
      if (j % 10 === 0) yield (k + j / tries) / n;
    }
    if (!next.length) return;
    next.sort((a, b) => a.c - b.c);
    beam = next.slice(0, 6);
  }
  for (const b of beam) onSol({ wps: b.wps, per: b.per, ...b.per[0] });
}

// time = meilleur temps en gardant 50 % de gaz × marge chrono (les deux bonus atteignables ensemble) ;
// hint = solution conseillée robuste au meilleur compromis temps / gaz.
// seeds : points de passage tirés d'un vol du joueur (wps par objectif), pour orienter la recherche
function* calibrate(L0, margins, f = 1, seeds = null) {
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
    const pool = []; // meilleurs vols ratés, classés par avancement (objectifs enchaînés + rapprochement)
    const run = P => {
      done++; const r = fly(L, P, null);
      if (r.ok) sols.push({ P, used: r.used, t: r.t });
      else if (pool.length < 16 || r.prog > pool[pool.length - 1].prog) { pool.push({ P, prog: r.prog }); pool.sort((a, b) => b.prog - a.prog); if (pool.length > 16) pool.pop(); }
      return r;
    };
    const hh = worldH(L);
    const seeded = () => { const P = randP(L, false), sd = seeds[Math.floor(Math.random() * seeds.length)]; P.wps = L.steps.map((_, i) => (sd[i] || []).map(([x, y]) => [x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80])); return P; };
    // variante qui ajoute ou retire parfois un point de passage
    const mutateW = P => {
      const Q = mutate(P, Math.random, 0.3 + Math.random() * 1.2, hh), u = Math.random(), st = Math.floor(Math.random() * L.steps.length);
      if (u < 0.25 && Q.wps[st].length < 4) Q.wps[st].splice(Math.floor(Math.random() * (Q.wps[st].length + 1)), 0, [50 + Math.random() * (WORLD_W - 100), 50 + Math.random() * (hh - 100)]);
      else if (u < 0.4 && Q.wps[st].length) Q.wps[st].splice(Math.floor(Math.random() * Q.wps[st].length), 1);
      return Q;
    };
    // 1) plusieurs objectifs : recherche objectif par objectif d'abord (bien plus rapide pour les enchaînements)
    const multi = L.steps.length > 1;
    if (multi) { const g = stagedSearch(L, f, P => run(P)); for (let r = g.next(); !r.done; r = g.next()) yield 0.2 * r.value; }
    // 2) recherche au hasard (en partie guidée par le vol du joueur s'il y en a un), plus courte si l'étape 1 a trouvé
    for (let n = 0; n < (multi && sols.length ? 500 : 1500) * f; n++) { run(seeds && Math.random() < 0.6 ? seeded() : randP(L, true)); if (n % 20 === 0) yield Math.min(0.4, 0.2 + done / total); }
    // 2 bis) un seul objectif et rien trouvé : la recherche par étapes en dernier recours
    if (!sols.length && !multi) { const g = stagedSearch(L, f, P => run(P)); for (let r = g.next(); !r.done; r = g.next()) yield 0.4 + 0.05 * r.value; }
    // 3) toujours rien : on fait évoluer les vols qui sont allés le plus loin dans l'enchaînement des objectifs
    for (let n = 0; sols.length < 3 && n < 1500 * f && pool.length; n++) {
      const par = pool[Math.floor(Math.random() * Math.random() * pool.length)];
      run(Math.random() < 0.15 ? (seeds && Math.random() < 0.5 ? seeded() : randP(L, true)) : mutateW(par.P));
      if (n % 20 === 0) yield 0.45;
    }
    if (!sols.length) return { error: 'Aucune solution trouvée' };
    function* climb(b, n, better, accept = () => true) {
      for (let k = 0; k < n; k++) {
        const Q = mutate(b.P, Math.random, k < n / 2 ? 1 : 0.4, worldH(L)), r = run(Q);
        if (r.ok && accept(r) && better(r, b)) b = { P: Q, used: r.used, t: r.t };
        if (k % 20 === 0) yield done / total;
      }
      return b;
    }
    const bf = yield* climb(sols.reduce((a, b) => b.used < a.used ? b : a), 900 * f, (r, b) => r.used < b.used);
    const F = Math.ceil(bf.used * M * 10) / 10;
    // chrono : meilleur temps en gardant 50 % de gaz ; ou (margins.timeAny) meilleur temps tout court, sans dépasser le réservoir
    const lim = margins.timeAny ? F : F / 2, half = sols.filter(s => s.used <= lim);
    const bt = yield* climb(half.reduce((a, b) => b.t < a.t ? b : a), 900 * f, (r, b) => r.t < b.t, r => r.used <= lim);
    const T = Math.max(1, Math.ceil(bt.t * TAU));
    L.fuel = F; L.time = T;
    const bh = yield* climb(sols.filter(s => s.used <= F).reduce((a, b) => ratioCost(L, b) < ratioCost(L, a) ? b : a), 700 * f, (r, b) => ratioCost(L, r) < ratioCost(L, b), r => r.used <= F);
    // solution conseillée robuste : elle doit réussir aussi arrondie et légèrement perturbée
    const rd = v => Math.round(v * 1e4) / 1e4;
    const rdp = Q => Object.fromEntries(PARAM_KEYS.map(k => [k, rd(Q[k])]));
    const round = P => { const o = { ...rdp(P), wps: P.wps.map(w => w.map(([x, y]) => [Math.round(x), Math.round(y)])) }; if (P.per) o.per = P.per.map(rdp); return o; };
    const robust = P => {
      const tries = [P];
      for (let k = 0; k < 6; k++) tries.push(mutate(P, Math.random, 0.01, worldH(L)));
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
  WORLD_W, WORLD_H, worldH, pilot, pilotInit, K, THRUST, CRASH_SPEED, LAND_ANGLE, ZONE_TIME, TOL, snapshot, inShadow, startState, influence, fly, randP, mutate,
  ratioCost, bodyMass, calibrate, defaultMargins, decodeRec,
};
