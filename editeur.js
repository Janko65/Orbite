// Orbite — niveaux perso et éditeur
// Les joueurs créent leurs propres niveaux (vierges ou à partir d'un niveau officiel), les partagent par un code
// à copier-coller (sans la solution), puis peuvent envoyer la solution plus tard. Les 20 niveaux officiels ne se
// modifient qu'en mode développeur (mot de passe), qui permet aussi d'exporter niveaux.js.
// Carte déplaçable et zoomable au doigt, placement des astres par glisser (y compris hors de l'écran de jeu),
// taille, gravité, couleurs, anneaux, étoiles, lunes en orbite, ceintures d'astéroïdes, départ, objectifs,
// solveur intégré (gaz, chrono, solution conseillée), test, publication sur l'appareil et export de niveaux.js.

const BODY_TYPES = ['terre', 'lune', 'mars', 'mercure', 'venus', 'jupiter', 'saturne', 'uranus', 'neptune', 'perso', 'soleil'];
const TYPE_LABEL = { terre: 'Terre', lune: 'Lune', mars: 'Mars', mercure: 'Mercure', venus: 'Vénus', jupiter: 'Jupiter', saturne: 'Saturne', uranus: 'Uranus', neptune: 'Neptune', perso: 'Personnalisée', soleil: 'Soleil (étoile)' };
const STYLES = { roche: 'Rocheuse', gaz: 'Gazeuse', ocean: 'Océan', glace: 'Glace' };

const DEV_PASSWORD = 'admin'; // mode développeur : modifier les niveaux officiels et exporter niveaux.js
const ED = { mode: 'perso', levels: [], cur: 0, sel: null, tab: 'astre', drag: null, solve: null, showHint: true, hintCache: null, top: 0,
  mapBottom: 0, view: null, fold: false, ptrs: new Map(), pinch: null };

// ===== Styles et éléments =====
(function injectStyle() {
  const st = document.createElement('style');
  st.textContent = `
  .ed{position:fixed;left:0;right:0;z-index:10;color:#fff;font:14px/1.35 system-ui,-apple-system,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation}
  .ed *{box-sizing:border-box}
  #edTop{top:0;padding:calc(env(safe-area-inset-top) + 6px) 8px 6px;display:flex;gap:6px;align-items:center;background:rgba(0,0,0,.88);border-bottom:1px solid rgba(255,255,255,.15)}
  #edPanel{bottom:0;background:#0c0c0e;border-top:1px solid rgba(255,255,255,.18);display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}
  .ed button,.ed select,.ed input{font:inherit;color:#fff;background:#1c1c20;border:1px solid rgba(255,255,255,.25);border-radius:10px;min-height:44px;padding:0 12px}
  .ed input[type=color]{width:56px;flex:none;padding:4px}
  .ed input[type=checkbox]{width:24px;height:24px;min-height:0;accent-color:#fff}
  .ed button{cursor:pointer;font-weight:600}
  .ed button.pri{background:#fff;color:#000;border-color:#fff}
  .ed button.dan{color:#ff6b61;border-color:rgba(255,107,97,.5)}
  .ed select{flex:1;min-width:0}
  .ed input[type=range]{flex:1;min-width:0;padding:0;accent-color:#fff;background:none;border:0}
  .ed input[type=text]{flex:1;min-width:0}
  .edTabs{display:flex;border-bottom:1px solid rgba(255,255,255,.15)}
  .edTabs button{flex:1;border:0;border-radius:0;background:none;color:rgba(255,255,255,.55);min-height:46px;padding:0 4px}
  .edTabs button.fold{flex:none;width:48px;color:#fff;font-size:18px}
  .row.wrap{flex-wrap:wrap}.row.wrap>button{flex:1 1 auto}
  .mapBtn{position:fixed;z-index:9;left:auto!important;right:10px;width:auto;min-height:40px!important;font-size:13px!important;background:rgba(20,20,24,.85)!important}
  .edTabs button.on{color:#fff;box-shadow:inset 0 -2px 0 #fff}
  .edBody{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
  .row{display:flex;gap:8px;align-items:center}
  .row>label{width:78px;flex:none;color:rgba(255,255,255,.75);font-size:13px}
  .val{width:62px;flex:none;text-align:right;font-variant-numeric:tabular-nums;font-size:13px}
  .hint{color:rgba(255,255,255,.55);font-size:12.5px}
  .step{display:flex;gap:6px;align-items:center;padding:6px 8px;border:1px solid rgba(255,255,255,.15);border-radius:10px}
  .step b{width:18px;flex:none}
  .step .t{flex:1;min-width:0}
  .step button{min-height:40px;padding:0 10px}
  .bar{height:8px;border-radius:4px;background:#2a2a2e;overflow:hidden}.bar i{display:block;height:100%;background:#fff;width:0}
  .ok{color:#30d158}.ko{color:#ff6b61}
  .modal{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:20px}
  .modal .box{background:#141417;border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:18px;width:min(100%,360px);display:flex;flex-direction:column;gap:12px;color:#fff;font:15px system-ui,-apple-system,sans-serif}
  .modal h3{margin:0;font-size:18px}
  .modal input,.modal button,.modal textarea{font:inherit;color:#fff;background:#1c1c20;border:1px solid rgba(255,255,255,.25);border-radius:10px;min-height:44px;padding:0 12px}
  .modal textarea{min-height:160px;padding:8px;font:12px ui-monospace,monospace}
  .modal button.pri{background:#fff;color:#000}
  .menu{display:flex;flex-direction:column;gap:8px}
  `;
  document.head.appendChild(st);
})();

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else n[k] = v;
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

function modal(build) {
  const m = el('div', { class: 'modal' }), box = el('div', { class: 'box' });
  m.append(box);
  const close = () => m.remove();
  build(box, close);
  m.addEventListener('pointerdown', e => { if (e.target === m) close(); });
  document.body.append(m);
  return close;
}

// ===== Accès =====
// depuis l'accueil : l'écran des niveaux perso
function openEditorLogin() { openPerso(); }

// mode développeur (niveaux officiels) : protégé par mot de passe
function openDevLogin() {
  modal((box, close) => {
    const inp = el('input', { type: 'password', placeholder: 'Mot de passe', autocomplete: 'off' });
    const err = el('div', { class: 'hint' }, 'Modifier les niveaux officiels et exporter niveaux.js.');
    const go = () => { if (inp.value === DEV_PASSWORD) { close(); closePerso(); openEditor('dev'); } else { err.textContent = 'Mot de passe incorrect.'; err.className = 'ko'; } };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    box.append(el('h3', {}, 'Mode développeur'), inp, err,
      el('div', { class: 'row' }, el('button', { onclick: close, style: 'flex:1' }, 'Annuler'), el('button', { class: 'pri', onclick: go, style: 'flex:1' }, 'Entrer')));
    setTimeout(() => inp.focus(), 50);
  });
}

// mode 'perso' : les créations du joueur ; mode 'dev' : brouillon des niveaux officiels
function openEditor(mode = 'perso', idx) {
  ED.mode = mode;
  if (mode === 'dev') {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem('orbite-brouillon') || 'null'); } catch (e) {}
    ED.levels = Array.isArray(draft) && draft.length ? draft : JSON.parse(JSON.stringify(LV));
  } else {
    ED.levels = persoList('mine');
    if (!ED.levels.length) { chooseTemplate(); return; }
  }
  ED.cur = Math.max(0, Math.min(idx ?? ED.cur, ED.levels.length - 1));
  ED.sel = null; ED.tab = 'astre'; ED.view = null;
  testMode = false; playCtx = null; cancelJobs();
  screen = 'editor';
  buildUI();
  selectLevel(ED.cur);
}

function closeEditor() {
  stopSolve();
  document.getElementById('edTop')?.remove();
  document.getElementById('edPanel')?.remove();
  document.getElementById('edCenter')?.remove();
  testMode = false;
  screen = 'home'; resize(); // retour à la mise en page du jeu
  if (ED.mode === 'perso') openPerso();
}

// retour depuis un test
function backToEditor() {
  testMode = false; cancelJobs();
  screen = 'editor';
  for (const id of ['edTop', 'edPanel', 'edCenter']) document.getElementById(id).style.display = '';
  selectLevel(ED.cur);
}

const EL = () => ED.levels[ED.cur];
const saveDraft = () => {
  if (ED.mode === 'perso') persoSave('mine', ED.levels);
  else try { localStorage.setItem('orbite-brouillon', JSON.stringify(ED.levels, (k, v) => k === '_B' ? undefined : v)); } catch (e) {}
};

// toute modification : la solution conseillée n'est plus valable, le niveau est à recalibrer
function changed(retexture) {
  const Lv = EL();
  invalidate(Lv);
  delete Lv.hint; delete Lv.stars; Lv.dirty = true;
  ED.hintCache = null;
  if (retexture) { clearTimeout(changed.t); changed.t = setTimeout(buildTextures, 120); }
  saveDraft();
  refreshLevelSelect();
}

function selectLevel(i) {
  stopSolve();
  ED.cur = i; ED.sel = null; ED.hintCache = null;
  L = EL(); lvl = i; invalidate(L);
  editorLayout(); buildTextures();
  refreshLevelSelect(); renderPanel();
}

// ===== Mise en page : carte entre la barre du haut et le panneau (repliable) =====
// ED.view : cadrage choisi au doigt (déplacement, zoom) ; null = tout le monde visible
function editorLayout() {
  const top = document.getElementById('edTop');
  ED.top = top ? top.getBoundingClientRect().bottom : safeTop + 50;
  const panelH = ED.fold ? 48 + safeBot : Math.round(Math.max(H - bandTop, H * 0.4));
  ED.mapBottom = H - panelH;
  const p = document.getElementById('edPanel');
  if (p) p.style.height = panelH + 'px';
  const c = document.getElementById('edCenter');
  if (c) c.style.top = (ED.top + 8) + 'px';
  if (ED.view) { ({ scale, ox, oy } = ED.view); return; }
  const area = ED.mapBottom - ED.top - 8;
  scale = Math.min(W / WORLD_W, area / WORLD_H);
  ox = (W - WORLD_W * scale) / 2;
  oy = ED.top + 4 + (area - WORLD_H * scale) / 2;
}
const setView = (sc, x, y) => {
  ED.view = { scale: sc, ox: x, oy: y }; editorLayout();
  clearTimeout(setView.t); setView.t = setTimeout(buildTextures, 250); // textures nettes après un zoom
};

// ===== Interface =====
function buildUI() {
  document.getElementById('edTop')?.remove();
  document.getElementById('edPanel')?.remove();
  const top = el('div', { id: 'edTop', class: 'ed' },
    el('button', { onclick: closeEditor }, ED.mode === 'dev' ? '‹ Quitter' : '‹ Mes niveaux'),
    el('select', { id: 'edLevel', onchange: e => selectLevel(+e.target.value) }),
    el('button', { onclick: openMenu }, 'Menu'));
  const panel = el('div', { id: 'edPanel', class: 'ed' },
    el('div', { class: 'edTabs', id: 'edTabs' }),
    el('div', { class: 'edBody', id: 'edBody' }));
  const center = el('button', { id: 'edCenter', class: 'ed mapBtn', onclick: () => { ED.view = null; editorLayout(); buildTextures(); } }, 'Recentrer');
  document.body.append(top, panel, center);
  editorLayout();
}

function refreshLevelSelect() {
  const s = document.getElementById('edLevel');
  if (!s) return;
  s.innerHTML = '';
  ED.levels.forEach((l, i) => s.append(el('option', { value: i, selected: i === ED.cur }, `${i + 1}. ${l.name || 'Sans nom'}${l.dirty || !l.hint ? ' •' : ''}`)));
}

function renderPanel() {
  const tabs = document.getElementById('edTabs'), body = document.getElementById('edBody');
  if (!tabs) return;
  tabs.innerHTML = '';
  [['astre', 'Astres'], ['obj', 'Objectifs'], ['niveau', 'Niveau'], ['solveur', 'Solveur']].forEach(([k, t]) =>
    tabs.append(el('button', { class: ED.tab === k && !ED.fold ? 'on' : '', onclick: () => { ED.tab = k; if (ED.fold) { ED.fold = false; editorLayout(); } renderPanel(); } }, t)));
  // replier / déplier le panneau pour agrandir la carte
  tabs.append(el('button', { class: 'fold', title: ED.fold ? 'Déplier' : 'Replier', onclick: () => { ED.fold = !ED.fold; editorLayout(); renderPanel(); } }, ED.fold ? '▴' : '▾'));
  body.style.display = ED.fold ? 'none' : '';
  body.innerHTML = '';
  ({ astre: panelBody, obj: panelSteps, niveau: panelLevel, solveur: panelSolver })[ED.tab](body);
}

const slider = (label, min, max, step, value, fmtv, oninput) => {
  const v = el('span', { class: 'val' }, fmtv(value));
  const r = el('input', { type: 'range', min, max, step, value, oninput: e => { const x = +e.target.value; v.textContent = fmtv(x); oninput(x); } });
  return el('div', { class: 'row' }, el('label', {}, label), r, v);
};
const bodyLabel = (Lv, i) => `${TYPE_LABEL[Lv.planets[i].type] || Lv.planets[i].type} (${i + 1})`;
const bodyOptions = (Lv, cur, filter = () => true) => Lv.planets.map((p, i) => filter(p, i) ? el('option', { value: i, selected: i === cur }, bodyLabel(Lv, i)) : null);

// --- Astres ---
function panelBody(body) {
  const Lv = EL(), sel = ED.sel && ED.sel.kind === 'body' ? ED.sel.i : -1;
  body.append(el('div', { class: 'row wrap' },
    el('button', { onclick: () => addBody('planet') }, '+ Planète'),
    el('button', { onclick: () => addBody('moon') }, '+ Lune'),
    el('button', { onclick: () => addBody('star') }, '+ Étoile')));
  if (sel < 0) { body.append(el('div', { class: 'hint' }, 'Touchez un astre pour le régler, faites-le glisser pour le déplacer (même hors de l’écran de jeu). Faites glisser la fusée pour choisir le départ. Un doigt dans le vide déplace la carte, deux doigts zooment ; ▾ replie ce panneau.')); return; }
  const p = Lv.planets[sel];
  body.append(el('div', { class: 'row' }, el('label', {}, 'Type'),
    el('select', { onchange: e => { p.type = e.target.value; if (p.type === 'soleil') { p.star = true; delete p.orbit; } else delete p.star; fixStart(Lv); changed(true); renderPanel(); } },
      BODY_TYPES.map(t => el('option', { value: t, selected: t === p.type }, TYPE_LABEL[t])))));
  body.append(el('div', { class: 'row' }, el('label', {}, 'Nom'), el('input', { type: 'text', value: p.name || '', placeholder: bodyName({ type: p.type }), oninput: e => { if (e.target.value.trim()) p.name = e.target.value.trim(); else delete p.name; saveDraft(); } })));
  body.append(slider('Taille', 20, 240, 1, p.r, v => `${v} m`, v => { p.r = v; if (p.orbit) placeMoon(Lv, sel); changed(true); }));
  const gv = el('span');
  body.append(slider('Gravité', 0.2, 3, 0.05, p.g || 1, v => `× ${v.toFixed(2)}`, v => { p.g = +v.toFixed(2); if (p.g === 1) delete p.g; gv.textContent = gText(p); changed(false); }));
  gv.textContent = gText(p);
  body.append(el('div', { class: 'hint' }, gv));
  if (!p.star) {
    // apparence
    if (p.type === 'perso') {
      body.append(el('div', { class: 'row' }, el('label', {}, 'Couleur'),
        el('input', { type: 'color', value: p.color || '#8a7fd0', oninput: e => { p.color = e.target.value; changed(true); } }),
        el('select', { onchange: e => { p.style = e.target.value; changed(true); } }, Object.entries(STYLES).map(([k, t]) => el('option', { value: k, selected: k === (p.style || 'roche') }, t)))));
    } else {
      body.append(el('div', { class: 'row' }, el('label', {}, 'Teinte'),
        el('input', { type: 'checkbox', checked: !!p.tint, onchange: e => { if (e.target.checked) p.tint = p.tint || '#ff6a3d'; else { delete p.tint; delete p.shade; } changed(true); renderPanel(); } }),
        p.tint ? el('input', { type: 'color', value: p.tint, oninput: e => { p.tint = e.target.value; changed(true); } }) : el('span', { class: 'hint' }, 'couleurs d’origine')));
      if (p.tint) body.append(slider('Nuance', 0.1, 1, 0.05, p.shade ?? 0.6, v => `${Math.round(v * 100)} %`, v => { p.shade = +v.toFixed(2); changed(true); }));
    }
    body.append(el('div', { class: 'row' }, el('label', {}, 'Anneaux'),
      el('input', { type: 'checkbox', checked: hasRings(p), onchange: e => { if (e.target.checked) p.ring = p.type === 'saturne' && !p.ring ? true : (typeof p.ring === 'string' ? p.ring : '#d6c496'); else p.ring = false; if (p.ring === true) delete p.ring; changed(false); renderPanel(); } }),
      hasRings(p) ? el('input', { type: 'color', value: ringColor(p), oninput: e => { p.ring = e.target.value; changed(false); } }) : null,
      el('span', { class: 'hint' }, 'décoratifs : le vaisseau les traverse en soulevant de la poussière')));
  }
  if (!p.orbit) {
    // ceinture d'astéroïdes infranchissable autour de cet astre
    Lv.belts = Lv.belts || [];
    const belt = Lv.belts.find(b => b.p === sel);
    body.append(el('div', { class: 'row' }, el('label', {}, 'Ceinture'),
      el('input', { type: 'checkbox', checked: !!belt, onchange: e => { if (e.target.checked) Lv.belts.push({ p: sel, r: Math.round(p.r * 2.4 + 40), w: 36 }); else Lv.belts = Lv.belts.filter(b => b.p !== sel); if (!Lv.belts.length) delete Lv.belts; changed(false); renderPanel(); } }),
      el('span', { class: 'hint' }, 'astéroïdes infranchissables en orbite')));
    if (belt) {
      body.append(slider('Rayon', Math.round(p.r + 30), 1200, 1, belt.r, v => `${v} m`, v => { belt.r = v; changed(false); }));
      body.append(slider('Largeur', 10, 160, 1, belt.w, v => `${v} m`, v => { belt.w = v; changed(false); }));
    }
  }
  if (p.orbit) {
    body.append(el('div', { class: 'row' }, el('label', {}, 'Tourne autour'),
      el('select', { onchange: e => { p.orbit.p = +e.target.value; placeMoon(Lv, sel); changed(false); } }, bodyOptions(Lv, p.orbit.p, (q, i) => i !== sel && !q.orbit && !q.star))));
    body.append(slider('Distance', Lv.planets[p.orbit.p].r + p.r + 15, 700, 1, Math.round(p.orbit.d), v => `${v} m`, v => { p.orbit.d = v; placeMoon(Lv, sel); changed(false); }));
    body.append(el('div', { class: 'row' }, el('label', {}, 'Sens'),
      el('select', { onchange: e => { p.orbit.dir = +e.target.value; changed(false); } },
        el('option', { value: 1, selected: (p.orbit.dir || 1) === 1 }, 'Horaire'), el('option', { value: -1, selected: p.orbit.dir === -1 }, 'Anti-horaire'))));
    const q = Lv.planets[p.orbit.p], per = 2 * Math.PI * Math.sqrt(p.orbit.d ** 3 / bodyMass(q));
    body.append(el('div', { class: 'hint' }, `Un tour en ${Math.round(per)} s (vitesse réelle d’orbite). Faites glisser la lune pour changer sa position de départ.`));
  }
  body.append(el('div', { class: 'row' }, el('button', { class: 'dan', onclick: () => removeBody(sel) }, 'Supprimer cet astre')));
}
const gText = p => `Gravité de surface : ${surfaceGravity(p).toFixed(0)} m/s²${p.star ? ' · étoile : éclaire et brûle au contact' : ''}`;

function addBody(kind) {
  const Lv = EL();
  let p;
  if (kind === 'star') p = { type: 'soleil', star: true, x: -60, y: -60, r: 160 };
  else if (kind === 'planet') p = { type: 'mars', x: 500, y: 750, r: 90 };
  else {
    const par = ED.sel && ED.sel.kind === 'body' && !Lv.planets[ED.sel.i].orbit && !Lv.planets[ED.sel.i].star ? ED.sel.i : Lv.planets.findIndex(q => !q.orbit && !q.star);
    if (par < 0) return;
    p = { type: 'lune', r: 35, x: 0, y: 0, orbit: { p: par, d: Lv.planets[par].r * 2 + 60, a0: 0, dir: 1 } };
  }
  Lv.planets.push(p);
  const i = Lv.planets.length - 1;
  if (p.orbit) placeMoon(Lv, i);
  ED.sel = { kind: 'body', i };
  changed(true); renderPanel();
}

// position de départ (x, y) d'une lune d'après son orbite
function placeMoon(Lv, i) {
  const p = Lv.planets[i], q = Lv.planets[p.orbit.p];
  p.orbit.d = Math.max(q.r + p.r + 15, p.orbit.d);
  p.x = Math.round(q.x + Math.cos(p.orbit.a0) * p.orbit.d); p.y = Math.round(q.y + Math.sin(p.orbit.a0) * p.orbit.d);
}

function removeBody(i) {
  const Lv = EL();
  if (Lv.planets.filter(p => !p.star && !p.orbit).length <= 1 && !Lv.planets[i].star && !Lv.planets[i].orbit) { alertBox('Il faut garder au moins une planète fixe pour le départ.'); return; }
  const gone = new Set([i]);
  Lv.planets.forEach((p, k) => { if (p.orbit && gone.has(p.orbit.p)) gone.add(k); });
  const map = {}; let n = 0;
  Lv.planets.forEach((p, k) => { if (!gone.has(k)) map[k] = n++; });
  Lv.planets = Lv.planets.filter((p, k) => !gone.has(k));
  Lv.planets.forEach(p => { if (p.orbit) p.orbit.p = map[p.orbit.p]; });
  if (Lv.belts) { Lv.belts = Lv.belts.filter(b => map[b.p] !== undefined).map(b => ({ ...b, p: map[b.p] })); if (!Lv.belts.length) delete Lv.belts; }
  Lv.steps = Lv.steps.filter(s => s.type === 'zone' || map[s.p] !== undefined).map(s => s.type === 'zone' ? s : { ...s, p: map[s.p] });
  Lv.start.p = map[Lv.start.p] !== undefined ? map[Lv.start.p] : -1;
  fixStart(Lv);
  ED.sel = null;
  changed(true); buildTextures(); renderPanel();
}

// le départ doit être sur une planète fixe (ni étoile, ni lune)
function fixStart(Lv) {
  const ok = i => i >= 0 && Lv.planets[i] && !Lv.planets[i].star && !Lv.planets[i].orbit;
  if (!ok(Lv.start.p)) Lv.start.p = Lv.planets.findIndex((p, i) => ok(i));
}

// --- Objectifs ---
function panelSteps(body) {
  const Lv = EL();
  Lv.steps.forEach((s, k) => {
    const row = el('div', { class: 'step' }, el('b', {}, `${k + 1}.`));
    if (s.type === 'zone') {
      row.append(el('span', { class: 't' }, 'Rester 5 s dans la zone'));
    } else {
      row.append(el('span', { class: 't' }, s.type === 'land' ? 'Se poser sur' : 'Tours de'));
      row.append(el('select', { style: 'flex:1.4', onchange: e => { s.p = +e.target.value; changed(false); } }, bodyOptions(Lv, s.p, q => !q.star || s.type === 'orbit')));
      if (s.type === 'orbit') row.append(el('select', { style: 'flex:.6', onchange: e => { s.n = +e.target.value; changed(false); } }, [1, 2, 3].map(n => el('option', { value: n, selected: n === s.n }, `× ${n}`))));
    }
    row.append(el('button', { disabled: k === 0, onclick: () => { [Lv.steps[k - 1], Lv.steps[k]] = [Lv.steps[k], Lv.steps[k - 1]]; changed(false); renderPanel(); } }, '↑'));
    row.append(el('button', { class: 'dan', onclick: () => { Lv.steps.splice(k, 1); ED.sel = null; changed(false); renderPanel(); } }, '×'));
    body.append(row);
    if (s.type === 'zone' && ED.sel && ED.sel.kind === 'zone' && ED.sel.i === k)
      body.append(slider('Taille zone', 40, 200, 1, s.r, v => `${v} m`, v => { s.r = v; changed(false); }));
  });
  if (!Lv.steps.length) body.append(el('div', { class: 'hint' }, 'Aucun objectif : ajoutez-en au moins un.'));
  const first = Lv.planets.findIndex((p, i) => !p.star && i !== Lv.start.p);
  body.append(el('div', { class: 'row' },
    el('button', { onclick: () => { Lv.steps.push({ type: 'zone', x: 500, y: 500, r: 80 }); ED.sel = { kind: 'zone', i: Lv.steps.length - 1 }; changed(false); renderPanel(); } }, '+ Zone'),
    el('button', { onclick: () => { Lv.steps.push({ type: 'land', p: first >= 0 ? first : Lv.start.p }); changed(false); renderPanel(); } }, '+ Se poser'),
    el('button', { onclick: () => { Lv.steps.push({ type: 'orbit', p: first >= 0 ? first : 0, n: 1 }); changed(false); renderPanel(); } }, '+ Tours')));
  body.append(el('div', { class: 'hint' }, 'Les zones se déplacent en les faisant glisser sur la carte ; touchez-en une pour régler sa taille.'));
}

// --- Niveau ---
function panelLevel(body) {
  const Lv = EL(), dm = defaultMargins(ED.cur, ED.levels.length), mg = Lv.margins || dm;
  body.append(el('div', { class: 'row' }, el('label', {}, 'Nom'), el('input', { type: 'text', value: Lv.name || '', oninput: e => { Lv.name = e.target.value; saveDraft(); refreshLevelSelect(); } })));
  body.append(el('div', { class: 'row' }, el('label', {}, 'Départ'),
    el('select', { onchange: e => { Lv.start.p = +e.target.value; changed(false); } }, bodyOptions(Lv, Lv.start.p, q => !q.star && !q.orbit))));
  body.append(slider('Marge gaz', 2, 4, 0.05, mg.fuel, v => `× ${v.toFixed(2)}`, v => { Lv.margins = { ...(Lv.margins || dm), fuel: +v.toFixed(2) }; changed(false); }));
  body.append(slider('Marge chrono', 1.05, 2, 0.05, mg.time, v => `× ${v.toFixed(2)}`, v => { Lv.margins = { ...(Lv.margins || dm), time: +v.toFixed(2) }; changed(false); }));
  body.append(el('div', { class: 'hint' }, 'Gaz du niveau = gaz minimum trouvé par le solveur × marge gaz (au moins ×2 pour que la réserve de 50 % reste faisable). Chrono = meilleur temps avec 50 % de gaz × marge chrono.'));
  body.append(el('div', { class: 'hint' }, `Actuellement : gaz ${Lv.fuel ?? '—'} · chrono ${Lv.time ?? '—'} s${Lv.dirty || !Lv.hint ? ' · à recalibrer' : ''}`));
}

// --- Solveur ---
function panelSolver(body) {
  const Lv = EL();
  if (ED.solve) {
    body.append(el('div', {}, 'Recherche de solutions…'), el('div', { class: 'bar' }, el('i', { id: 'edProg', style: `width:${Math.round(ED.solve.progress * 100)}%` })),
      el('button', { onclick: () => { stopSolve(); renderPanel(); } }, 'Arrêter'));
    return;
  }
  const r = ED.lastResult && ED.lastResult.level === Lv ? ED.lastResult : null;
  if (r && r.error) body.append(el('div', { class: 'ko' }, `Impossible : ${r.error}. Modifiez le niveau puis relancez.`));
  if (Lv.hint && !Lv.dirty && !(r && r.error)) {
    body.append(el('div', { class: 'ok' }, `Niveau faisable · gaz ${Lv.fuel} · chrono ${Lv.time} s`));
    if (r && !r.error) body.append(el('div', { class: 'hint' }, `Gaz minimum ${r.minFuel.toFixed(2)} · meilleur temps avec 50 % de gaz ${r.tFastHalf.toFixed(1)} s · solution conseillée ${r.hintUsed.toFixed(2)} de gaz en ${r.hintT.toFixed(1)} s`));
    body.append(el('div', { class: 'row' }, el('label', {}, 'Solution'),
      el('button', { onclick: () => { ED.showHint = !ED.showHint; renderPanel(); } }, ED.showHint ? 'Masquer' : 'Afficher')));
  } else if (!r) body.append(el('div', { class: 'hint' }, 'Le solveur vérifie que le niveau est faisable, puis calcule le gaz, le chrono et la solution conseillée (aide « ? »).'));
  body.append(el('div', { class: 'row' },
    el('button', { class: 'pri', style: 'flex:1', onclick: startSolve }, 'Lancer le solveur'),
    el('button', { style: 'flex:1', onclick: testLevel }, 'Tester')));
}

function startSolve() {
  const Lv = EL();
  stopSolve();
  const g = calibrate(Lv, Lv.margins || defaultMargins(ED.cur, ED.levels.length), 0.6);
  const job = { progress: 0, cancel: false, level: Lv };
  ED.solve = job;
  renderPanel();
  const slice = () => {
    if (job.cancel) return;
    const t0 = performance.now();
    let r;
    while (performance.now() - t0 < 30) { r = g.next(); if (r.done) break; job.progress = r.value; }
    const bar = document.getElementById('edProg');
    if (bar) bar.style.width = Math.round(job.progress * 100) + '%';
    if (r && r.done) {
      ED.solve = null;
      const res = r.value;
      ED.lastResult = { ...res, level: Lv };
      if (!res.error) { Lv.fuel = res.fuel; Lv.time = res.time; Lv.hint = res.hint; delete Lv.dirty; ED.hintCache = null; saveDraft(); refreshLevelSelect(); }
      if (ED.tab === 'solveur') renderPanel();
      return;
    }
    setTimeout(slice, 0);
  };
  setTimeout(slice, 0);
}
function stopSolve() { if (ED.solve) ED.solve.cancel = true; ED.solve = null; }

function testLevel() {
  const Lv = EL();
  stopSolve();
  for (const id of ['edTop', 'edPanel', 'edCenter']) document.getElementById(id).style.display = 'none';
  resize();
  testMode = true; screen = 'game';
  loadLevel(ED.cur, Lv);
}

// ===== Menu =====
function openMenu() {
  modal((box, close) => {
    const Lv = EL(), act = fn => () => { close(); fn(); };
    const dup = () => { const c = JSON.parse(JSON.stringify(Lv, (k, v) => (k === '_B' || k === 'stars') ? undefined : v)); c.name = (c.name || '') + ' (copie)'; ED.levels.splice(ED.cur + 1, 0, c); saveDraft(); selectLevel(ED.cur + 1); };
    const del = () => confirmBox(`Supprimer « ${Lv.name || 'Sans nom'} » ?`, () => {
      ED.levels.splice(ED.cur, 1); saveDraft();
      if (!ED.levels.length) { closeEditor(); return; } // plus aucune création : retour à la liste
      selectLevel(Math.min(ED.cur, ED.levels.length - 1));
    });
    if (ED.mode === 'perso') {
      box.append(el('h3', {}, 'Menu'), el('div', { class: 'menu' },
        el('button', { onclick: act(chooseTemplate) }, 'Nouveau niveau'),
        el('button', { onclick: act(dup) }, 'Dupliquer ce niveau'),
        el('button', { class: 'pri', onclick: act(() => shareLevel(Lv)) }, 'Partager ce niveau'),
        el('button', { onclick: act(() => shareSolution(Lv)) }, 'Partager la solution'),
        el('button', { class: 'dan', onclick: act(del) }, 'Supprimer ce niveau'),
        el('button', { onclick: close }, 'Fermer')));
      return;
    }
    const todo = ED.levels.filter(l => l.dirty || !l.hint).length;
    box.append(el('h3', {}, 'Mode développeur'), el('div', { class: 'menu' },
      el('button', { onclick: act(() => { ED.levels.push(newLevel()); saveDraft(); selectLevel(ED.levels.length - 1); }) }, 'Nouveau niveau'),
      el('button', { onclick: act(dup) }, 'Dupliquer ce niveau'),
      el('div', { class: 'row' },
        el('button', { style: 'flex:1', disabled: ED.cur === 0, onclick: act(() => moveLevel(-1)) }, 'Monter'),
        el('button', { style: 'flex:1', disabled: ED.cur === ED.levels.length - 1, onclick: act(() => moveLevel(1)) }, 'Descendre')),
      el('button', { class: 'dan', disabled: ED.levels.length <= 1, onclick: act(del) }, 'Supprimer ce niveau'),
      el('div', { class: 'hint' }, todo ? `${todo} niveau${todo > 1 ? 'x' : ''} à recalibrer (•) avant de publier.` : 'Tous les niveaux sont calibrés.'),
      el('button', { class: 'pri', onclick: act(publish) }, 'Publier sur cet appareil'),
      el('button', { onclick: act(exportLevels) }, 'Exporter niveaux.js'),
      el('button', { onclick: act(() => confirmBox('Abandonner le brouillon et repartir des niveaux publiés ?', () => { localStorage.removeItem('orbite-brouillon'); openEditor('dev'); })) }, 'Annuler les modifications'),
      el('button', { onclick: close }, 'Fermer')));
  });
}

// nouveau niveau perso : vierge ou à partir d'un niveau officiel (copie, l'original n'est jamais modifié)
function chooseTemplate() {
  modal((box, close) => {
    const pick = src => {
      close();
      const c = src ? JSON.parse(JSON.stringify(src, (k, v) => ['_B', 'hint', 'fuel', 'time', 'stars', 'margins'].includes(k) ? undefined : v)) : newLevel();
      c.name = src ? `${src.name} (perso)` : 'Mon niveau'; c.dirty = true;
      if (screen === 'editor' && ED.mode === 'perso') { ED.levels.push(c); saveDraft(); selectLevel(ED.levels.length - 1); }
      else { const mine = persoList('mine'); mine.push(c); persoSave('mine', mine); closePerso(); openEditor('perso', mine.length - 1); }
    };
    const list = el('div', { class: 'menu', style: 'max-height:50vh;overflow-y:auto' },
      el('button', { class: 'pri', onclick: () => pick(null) }, 'Niveau vierge'),
      LEVELS.map((l, i) => el('button', { onclick: () => pick(l) }, `${i + 1}. ${l.name}`)));
    box.append(el('h3', {}, 'Nouveau niveau'), el('div', { class: 'hint' }, 'Partir de zéro ou d’un niveau officiel comme modèle.'), list, el('button', { onclick: close }, 'Annuler'));
  });
}

function newLevel() {
  return { name: 'Nouveau niveau', planets: [{ type: 'terre', x: 500, y: 1500, r: 100 }, { type: 'mars', x: 500, y: 600, r: 80 }], start: { p: 0, a: -1.5708 }, steps: [{ type: 'land', p: 1 }], dirty: true };
}
function moveLevel(d) {
  const i = ED.cur, j = i + d;
  [ED.levels[i], ED.levels[j]] = [ED.levels[j], ED.levels[i]];
  saveDraft(); selectLevel(j);
}

const cleanLevels = () => JSON.parse(JSON.stringify(ED.levels, (k, v) => (k === '_B' || k === 'dirty') ? undefined : v));

function publish() {
  const todo = ED.levels.filter(l => l.dirty || !l.hint).length;
  const go = () => {
    const lv = cleanLevels();
    try { localStorage.setItem('orbite-niveaux-publies', JSON.stringify(lv)); } catch (e) {}
    LV = lv;
    alertBox('Niveaux publiés sur cet appareil. Pour les publier pour tous les joueurs, exportez niveaux.js et déposez-le sur Firebase avec le reste du jeu.');
  };
  if (todo) confirmBox(`${todo} niveau${todo > 1 ? 'x n’ont' : ' n’a'} pas été recalibré${todo > 1 ? 's' : ''} : gaz, chrono et aide peuvent être faux. Publier quand même ?`, go);
  else go();
}

// export : niveaux.js complet, prêt à remplacer celui du jeu sur Firebase (diffusion à tous les joueurs)
function exportLevels() {
  const text = '// Orbite — niveaux (exporté depuis l\u2019éditeur le ' + new Date().toLocaleDateString('fr-FR') + ')\n' +
    '// planets : x, y, r, type, g (multiplicateur de gravité), star:true pour une étoile, orbit:{p, d, a0, dir} pour une lune,\n' +
    '//           ring (couleur ou false : anneaux décoratifs), tint + shade (teinte), color + style (type « perso »), name\n' +
    '// belts : ceintures d\u2019astéroïdes {p, r, w} ; start : astre de départ + angle ; steps : objectifs\n' +
    '// fuel, time, hint : calculés par le solveur\nconst LEVELS = [\n' +
    cleanLevels().map(l => '  ' + JSON.stringify(l)).join(',\n') + ',\n];\n\nif (typeof module !== \'undefined\') module.exports = LEVELS;\n';
  const todo = ED.levels.filter(l => l.dirty || !l.hint).length;
  const file = () => new File([text], 'niveaux.js', { type: 'text/javascript' });
  modal((box, close) => {
    const ta = el('textarea', { value: text, readOnly: true });
    const msg = el('div', { class: 'hint' }, 'Pour diffuser : remplace niveaux.js sur Firebase par ce fichier (avec le reste du jeu), puis pense à monter la version. Les joueurs le reçoivent avec « Mises à jour ».');
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file()] }));
    box.append(el('h3', {}, 'Exporter niveaux.js'),
      todo ? el('div', { class: 'ko' }, `${todo} niveau${todo > 1 ? 'x' : ''} non recalibré${todo > 1 ? 's' : ''} (•) : gaz, chrono et aide peuvent être faux.`) : null,
      ta, msg,
      el('div', { class: 'row', style: 'flex-wrap:wrap' },
        canShare ? el('button', { class: 'pri', style: 'flex:1 1 100%', onclick: () => navigator.share({ files: [file()], title: 'niveaux.js' }).then(() => { msg.textContent = 'Fichier envoyé.'; }, () => {}) }, 'Enregistrer / partager le fichier') : null,
        el('button', { style: 'flex:1', onclick: () => { navigator.clipboard?.writeText(text).then(() => { msg.textContent = 'Copié.'; }, () => { ta.select(); msg.textContent = 'Sélectionne le texte et copie-le.'; }); } }, 'Copier'),
        el('button', { style: 'flex:1', onclick: () => {
          try { const a = el('a', { href: URL.createObjectURL(file()), download: 'niveaux.js' }); document.body.append(a); a.click(); a.remove(); msg.textContent = 'Téléchargement lancé.'; }
          catch (err) { msg.textContent = 'Téléchargement impossible ici : utilise Copier.'; }
        } }, 'Télécharger'),
        el('button', { style: 'flex:1', onclick: close }, 'Fermer')));
  });
}

// ===== Écran « Niveaux perso » =====
function closePerso() { document.getElementById('persoScr')?.remove(); }

function openPerso() {
  closePerso();
  cancelJobs(); testMode = false; playCtx = null;
  screen = 'perso';
  const mine = persoList('mine'), recus = persoList('recus');
  const stars = l => { const st = l.stars || [false, false, false]; return el('span', { style: 'color:#ffd60a;letter-spacing:2px' }, st.map(v => v ? '★' : '☆').join('')); };
  const card = (title, sub, btns) => el('div', { class: 'step', style: 'flex-direction:column;align-items:stretch;gap:8px' },
    el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', { style: 'width:auto' }, title), sub), el('div', { class: 'row wrap' }, btns));
  const play = (kind, i) => () => {
    closePerso();
    playCtx = { kind, i }; testMode = false; screen = 'game';
    resize(); loadLevel(0, persoList(kind)[i]);
  };
  const scr = el('div', { id: 'persoScr', class: 'ed', style: 'top:0;bottom:0;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 10px) 14px calc(env(safe-area-inset-bottom) + 20px);background:rgba(0,0,0,.82);display:flex;flex-direction:column;gap:10px' },
    el('div', { class: 'row' }, el('button', { onclick: () => { closePerso(); screen = 'home'; } }, '‹ Accueil'), el('h3', { style: 'margin:0;flex:1;text-align:center;font-size:20px' }, 'Niveaux perso'), el('span', { style: 'width:90px' })),
    el('div', { class: 'row wrap' },
      el('button', { class: 'pri', onclick: () => chooseTemplate() }, '+ Créer un niveau'),
      el('button', { onclick: pasteCode }, 'Coller un code reçu')),
    el('h3', { style: 'margin:8px 0 0;font-size:16px' }, 'Mes créations'),
    mine.length ? mine.map((l, i) => card(l.name || 'Sans nom', l.dirty || !l.hint ? el('span', { class: 'hint' }, 'à calibrer (solveur)') : stars(l), [
      el('button', { onclick: play('mine', i) }, 'Jouer'),
      el('button', { onclick: () => { closePerso(); openEditor('perso', i); } }, 'Modifier'),
      el('button', { onclick: () => shareLevel(l) }, 'Partager'),
      el('button', { onclick: () => shareSolution(l) }, 'Solution'),
      el('button', { class: 'dan', onclick: () => confirmBox(`Supprimer « ${l.name || 'Sans nom'} » ?`, () => { const m = persoList('mine'); m.splice(i, 1); persoSave('mine', m); openPerso(); }) }, 'Supprimer'),
    ])) : el('div', { class: 'hint' }, 'Aucune création pour l’instant.'),
    el('h3', { style: 'margin:8px 0 0;font-size:16px' }, 'Niveaux reçus'),
    recus.length ? recus.map((l, i) => card(l.name || 'Sans nom', stars(l), [
      el('button', { onclick: play('recus', i) }, 'Jouer'),
      el('span', { class: 'hint', style: 'flex:1 1 auto;align-self:center' }, l.hint ? 'solution reçue : aide « ? » disponible' : 'sans solution'),
      el('button', { class: 'dan', onclick: () => confirmBox(`Supprimer « ${l.name || 'Sans nom'} » ?`, () => { const r = persoList('recus'); r.splice(i, 1); persoSave('recus', r); openPerso(); }) }, 'Supprimer'),
    ])) : el('div', { class: 'hint' }, 'Colle ici les codes de niveaux envoyés par tes amis.'),
    el('button', { style: 'margin-top:16px;background:none;border:0;color:rgba(255,255,255,.45);font-weight:400', onclick: openDevLogin }, 'Mode développeur (niveaux officiels)'));
  document.body.append(scr);
}

// ===== Partage par code (copier-coller dans un message) =====
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
// ce qui part avec le niveau : tout sauf la solution
const sharePayload = l => JSON.parse(JSON.stringify({ name: l.name || 'Niveau perso', planets: l.planets, start: l.start, steps: l.steps, belts: l.belts, fuel: l.fuel, time: l.time }, (k, v) => k === '_B' ? undefined : v));

function shareBox(title, text, note) {
  modal((box, close) => {
    const ta = el('textarea', { value: text, readOnly: true });
    const msg = el('div', { class: 'hint' }, note);
    box.append(el('h3', {}, title), msg, ta, el('div', { class: 'row', style: 'flex-wrap:wrap' },
      navigator.share ? el('button', { class: 'pri', style: 'flex:1 1 100%', onclick: () => navigator.share({ text }).catch(() => {}) }, 'Envoyer…') : null,
      el('button', { style: 'flex:1', onclick: () => { navigator.clipboard?.writeText(text).then(() => { msg.textContent = 'Copié : colle-le dans un message.'; }, () => { ta.select(); msg.textContent = 'Sélectionne le texte et copie-le.'; }); } }, 'Copier'),
      el('button', { style: 'flex:1', onclick: close }, 'Fermer')));
  });
}

function shareLevel(l) {
  if (l.dirty || !l.hint) { alertBox('Lance d’abord le solveur (onglet Solveur) : il vérifie que ton niveau est faisable et fixe le gaz et le chrono.'); return; }
  const code = 'ORBITE-N1:' + b64e(JSON.stringify(sharePayload(l)));
  shareBox('Partager ce niveau', `Défi Orbite : « ${l.name || 'Niveau perso'} »\nCopie tout ce message, puis dans Orbite : Niveaux perso → Coller un code reçu.\n${code}`,
    'Le niveau part sans sa solution. Tu pourras l’envoyer plus tard avec « Solution ».');
}

function shareSolution(l) {
  if (l.dirty || !l.hint) { alertBox('Pas encore de solution : lance d’abord le solveur.'); return; }
  const code = 'ORBITE-S1:' + b64e(JSON.stringify({ sig: levelSig(sharePayload(l)), hint: l.hint }));
  shareBox('Partager la solution', `Solution Orbite pour « ${l.name || 'Niveau perso'} »\nCopie tout ce message, puis dans Orbite : Niveaux perso → Coller un code reçu.\n${code}`,
    'Ton ami pourra afficher la trajectoire conseillée avec l’aide « ? ».');
}

// vérifie et nettoie un niveau reçu (on n'accepte que des champs connus, aux bonnes valeurs)
function sanitizeLevel(o) {
  const num = (v, lo, hi) => { if (typeof v !== 'number' || !isFinite(v)) throw 0; return Math.max(lo, Math.min(hi, v)); };
  const int = (v, n) => { if (!Number.isInteger(v) || v < 0 || v >= n) throw 0; return v; };
  const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : undefined;
  if (!o || !Array.isArray(o.planets) || !o.planets.length || o.planets.length > 30 || !Array.isArray(o.steps) || !o.steps.length || o.steps.length > 10) throw 0;
  const n = o.planets.length;
  const planets = o.planets.map(p => {
    if (!BODY_TYPES.includes(p.type)) throw 0;
    const q = { type: p.type, x: num(p.x, -5000, 6000), y: num(p.y, -5000, 7000), r: num(p.r, 5, 600) };
    if (p.g !== undefined) q.g = num(p.g, 0.1, 5);
    if (p.type === 'soleil' || p.star) q.star = true;
    if (p.orbit) q.orbit = { p: int(p.orbit.p, n), d: num(p.orbit.d, 10, 5000), a0: num(p.orbit.a0, -100, 100), dir: p.orbit.dir === -1 ? -1 : 1 };
    if (p.ring === false) q.ring = false; else if (p.ring === true) q.ring = true; else if (hex(p.ring)) q.ring = hex(p.ring);
    if (hex(p.tint)) { q.tint = hex(p.tint); if (p.shade !== undefined) q.shade = num(p.shade, 0, 1); }
    if (hex(p.color)) q.color = hex(p.color);
    if (STYLES[p.style]) q.style = p.style;
    if (str(p.name, 30)) q.name = str(p.name, 30);
    return q;
  });
  planets.forEach((p, i) => { if (p.orbit && (p.orbit.p === i || planets[p.orbit.p].orbit)) throw 0; });
  const steps = o.steps.map(s => {
    if (s.type === 'zone') return { type: 'zone', x: num(s.x, -5000, 6000), y: num(s.y, -5000, 7000), r: num(s.r, 10, 500) };
    if (s.type === 'land') return { type: 'land', p: int(s.p, n) };
    if (s.type === 'orbit') return { type: 'orbit', p: int(s.p, n), n: Math.round(num(s.n, 1, 5)) };
    throw 0;
  });
  const sp = int(o.start && o.start.p, n);
  if (planets[sp].star || planets[sp].orbit) throw 0;
  const lv = { name: str(o.name, 40) || 'Niveau reçu', planets, start: { p: sp, a: num(o.start.a, -10, 10) }, steps, fuel: num(o.fuel, 0.1, 500), time: num(o.time, 1, 2000) };
  if (Array.isArray(o.belts) && o.belts.length) lv.belts = o.belts.slice(0, 10).map(b => ({ p: int(b.p, n), r: num(b.r, 10, 3000), w: num(b.w, 2, 400) }));
  return lv;
}

function importCode(text) {
  const m = /ORBITE-([NS])1:([A-Za-z0-9_-]+)/.exec(text || '');
  if (!m) return 'Aucun code Orbite trouvé dans ce texte.';
  let data;
  try { data = JSON.parse(b64d(m[2])); } catch (e) { return 'Code abîmé : vérifie que tout le message a été copié.'; }
  const recus = persoList('recus');
  if (m[1] === 'N') {
    let lv;
    try { lv = sanitizeLevel(data); } catch (e) { return 'Ce niveau n’est pas valide.'; }
    const sig = levelSig(lv);
    if (recus.some(r => levelSig(sharePayload(r)) === sig)) return `« ${lv.name} » est déjà dans tes niveaux reçus.`;
    recus.push(lv); persoSave('recus', recus);
    return `Niveau « ${lv.name} » ajouté. Bonne chance !`;
  }
  const k = recus.findIndex(r => levelSig(sharePayload(r)) === data.sig);
  if (k < 0) return 'Cette solution ne correspond à aucun de tes niveaux reçus : colle d’abord le niveau.';
  if (!data.hint || typeof data.hint !== 'object') return 'Solution abîmée.';
  recus[k].hint = data.hint; persoSave('recus', recus);
  return `Solution reçue pour « ${recus[k].name} » : l’aide « ? » montre maintenant la trajectoire conseillée.`;
}

function pasteCode() {
  modal((box, close) => {
    const ta = el('textarea', { placeholder: 'Colle ici le message reçu (niveau ou solution)', style: 'min-height:120px' });
    const msg = el('div', { class: 'hint' });
    box.append(el('h3', {}, 'Coller un code reçu'), ta, msg, el('div', { class: 'row', style: 'flex-wrap:wrap' },
      navigator.clipboard?.readText ? el('button', { style: 'flex:1 1 100%', onclick: () => navigator.clipboard.readText().then(t => { ta.value = t; }, () => { msg.textContent = 'Colle le texte à la main dans la case.'; }) }, 'Coller le presse-papiers') : null,
      el('button', { style: 'flex:1', onclick: close }, 'Fermer'),
      el('button', { class: 'pri', style: 'flex:1', onclick: () => { const r = importCode(ta.value); msg.textContent = r; if (/ajouté|Solution reçue/.test(r)) setTimeout(() => { close(); openPerso(); }, 900); } }, 'Ajouter')));
  });
}

function alertBox(text) { modal((box, close) => box.append(el('div', {}, text), el('button', { class: 'pri', onclick: close }, 'OK'))); }
function confirmBox(text, yes) {
  modal((box, close) => box.append(el('div', {}, text), el('div', { class: 'row' },
    el('button', { style: 'flex:1', onclick: close }, 'Annuler'), el('button', { class: 'pri', style: 'flex:1', onclick: () => { close(); yes(); } }, 'Confirmer'))));
}

// ===== Carte : sélection, glisser, déplacement et zoom =====
const toWorld = e => [(e.clientX - ox) / scale, (e.clientY - oy) / scale];
const LIMIT = 3000; // on peut placer les astres loin hors de l'écran de jeu

function editorPointerDown(e) {
  if (e.clientY < ED.top || e.clientY > ED.mapBottom) return;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.ptrs.size === 2) { // deux doigts : zoom
    const [a, b] = [...ED.ptrs.values()];
    ED.pinch = { d: hyp(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, scale, ox, oy };
    ED.drag = null;
    return;
  }
  const Lv = EL(), [wx, wy] = toWorld(e), tol = 14 / scale;
  const st = startState(Lv);
  let hit = null;
  if (hyp(wx - st.x, wy - st.y) < 24 / scale) hit = { kind: 'start' };
  if (!hit) for (let i = Lv.planets.length - 1; i >= 0; i--) { const p = Lv.planets[i]; if (hyp(wx - p.x, wy - p.y) < p.r + tol) { hit = { kind: 'body', i }; break; } }
  if (!hit) Lv.steps.forEach((s, i) => { if (!hit && s.type === 'zone' && hyp(wx - s.x, wy - s.y) < s.r + tol) hit = { kind: 'zone', i }; });
  ED.drag = { ...(hit || { kind: 'none' }), id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
}

function editorPointerMove(e) {
  if (ED.ptrs.has(e.pointerId)) ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.pinch && ED.ptrs.size >= 2) {
    const [a, b] = [...ED.ptrs.values()], P = ED.pinch;
    const base = Math.min(W / WORLD_W, (ED.mapBottom - ED.top - 8) / WORLD_H);
    const sc = Math.max(base * 0.25, Math.min(base * 8, P.scale * hyp(a.x - b.x, a.y - b.y) / P.d));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, wx = (P.mx - P.ox) / P.scale, wy = (P.my - P.oy) / P.scale;
    setView(sc, mx - wx * sc, my - wy * sc);
    return;
  }
  const d = ED.drag;
  if (!d || e.pointerId !== d.id) return;
  if (!d.moved && hyp(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
  d.moved = true;
  if (d.kind === 'none') { // un doigt dans le vide : déplacer la carte
    setView(scale, ox + e.clientX - d.lx, oy + e.clientY - d.ly);
    d.lx = e.clientX; d.ly = e.clientY;
    return;
  }
  const Lv = EL(), [wx, wy] = toWorld(e);
  const cx = Math.max(-LIMIT, Math.min(WORLD_W + LIMIT, wx)), cy = Math.max(-LIMIT, Math.min(WORLD_H + LIMIT, wy));
  if (d.kind === 'body') {
    const p = Lv.planets[d.i];
    if (p.orbit) { const q = Lv.planets[p.orbit.p]; p.orbit.a0 = +Math.atan2(cy - q.y, cx - q.x).toFixed(4); p.orbit.d = Math.round(hyp(cx - q.x, cy - q.y)); placeMoon(Lv, d.i); }
    else {
      p.x = Math.round(cx); p.y = Math.round(cy);
      Lv.planets.forEach((m, k) => { if (m.orbit && m.orbit.p === d.i) placeMoon(Lv, k); });
    }
  } else if (d.kind === 'zone') { const s = Lv.steps[d.i]; s.x = Math.round(cx); s.y = Math.round(cy); }
  else if (d.kind === 'start') {
    // la fusée se pose sur la planète fixe la plus proche, à l'endroit du doigt
    let best = -1, bd = 1e9;
    Lv.planets.forEach((p, i) => { if (p.star || p.orbit) return; const dd = hyp(cx - p.x, cy - p.y) - p.r; if (dd < bd) { bd = dd; best = i; } });
    if (best >= 0) { const p = Lv.planets[best]; Lv.start = { p: best, a: +Math.atan2(cy - p.y, cx - p.x).toFixed(4) }; }
  }
  changed(false);
}

function editorPointerUp(e) {
  ED.ptrs.delete(e.pointerId);
  if (ED.pinch) { if (ED.ptrs.size < 2) ED.pinch = null; return; }

  const d = ED.drag;
  if (!d || e.pointerId !== d.id) return;
  ED.drag = null;
  if (d.moved) { if (d.kind !== 'none' && (ED.tab === 'astre' || ED.tab === 'obj')) renderPanel(); return; }
  if (d.kind === 'body') { ED.sel = { kind: 'body', i: d.i }; ED.tab = 'astre'; }
  else if (d.kind === 'zone') { ED.sel = { kind: 'zone', i: d.i }; ED.tab = 'obj'; }
  else if (d.kind === 'none') ED.sel = null;
  renderPanel();
}

// ===== Dessin de la carte =====
function editorDraw() {
  const Lv = EL();
  L = Lv;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, ED.top, W, ED.mapBottom - ED.top); ctx.clip();
  for (const s of bgStars) { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.fillRect(s.x, s.y, s.s, s.s); }
  ctx.translate(ox, oy); ctx.scale(scale, scale);
  const lw = 1.5 / scale;
  // cadre du monde visible
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = lw; ctx.setLineDash([6 / scale, 6 / scale]);
  ctx.strokeRect(0, 0, WORLD_W, WORLD_H); ctx.setLineDash([]);
  invalidate(Lv);
  const Bs = snapshot(Lv, 0);
  drawShadows(Bs);
  // astre sélectionné : zone de gravité
  if (ED.sel && ED.sel.kind === 'body' && Bs[ED.sel.i]) {
    const p = Bs[ED.sel.i], o = influence(Bs, ED.sel.i);
    const gr = ctx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, o.soi);
    gr.addColorStop(0, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, o.soi, 0, Math.PI * 2); ctx.fill();
  }
  // orbites des lunes
  Lv.planets.forEach(p => {
    if (!p.orbit) return;
    const q = Lv.planets[p.orbit.p];
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = lw; ctx.setLineDash([3 / scale, 6 / scale]);
    ctx.beginPath(); ctx.arc(q.x, q.y, p.orbit.d, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // sens de rotation
    const a = p.orbit.a0 + (p.orbit.dir || 1) * 0.35, ax = q.x + Math.cos(a) * p.orbit.d, ay = q.y + Math.sin(a) * p.orbit.d;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(ax, ay, 4 / scale, 0, Math.PI * 2); ctx.fill();
  });
  // zones
  Lv.steps.forEach((s, i) => {
    if (s.type !== 'zone') return;
    const sel = ED.sel && ED.sel.kind === 'zone' && ED.sel.i === i;
    ctx.strokeStyle = sel ? '#ffd60a' : '#fff'; ctx.lineWidth = sel ? 2.5 / scale : lw; ctx.setLineDash([8 / scale, 6 / scale]);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle; ctx.font = `600 ${14 / scale}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), s.x, s.y);
  });
  drawBelts(Bs, performance.now() / 1000);
  Bs.forEach(b => drawBody(Bs, b));
  // numéros des astres (repères pour les listes)
  Bs.forEach(b => {
    const sel = ED.sel && ED.sel.kind === 'body' && ED.sel.i === b.i;
    if (sel) { ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2.5 / scale; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 / scale, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.arc(b.x, b.y, 10 / scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${11 / scale}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.i + 1), b.x, b.y + 0.5 / scale);
  });
  // solution du solveur
  if (ED.showHint && Lv.hint && !Lv.dirty) {
    if (!ED.hintCache) { const r = fly(Lv, Lv.hint, null); ED.hintCache = r.path; }
    ctx.strokeStyle = 'rgba(255,214,10,0.85)'; drawPath(ED.hintCache, [2, 5]);
  }
  // fusée au départ
  if (Lv.planets[Lv.start.p]) { const st = startState(Lv); drawRocket(st.x, st.y, st.ang, Math.max(1, 1.15 / scale), false); }
  ctx.restore();
}
