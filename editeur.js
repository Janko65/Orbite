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
  .ed input[type=range]{flex:1;min-width:0;padding:0;accent-color:#fff;background:none;border:0;height:40px;-webkit-appearance:none;appearance:none}
  .ed input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:rgba(255,255,255,.25)}
  .ed input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-11px;border-radius:14px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.6)}
  .ed input[type=range]::-moz-range-thumb{width:28px;height:28px;border-radius:14px;background:#fff;border:0}
  .ed input[type=text]{flex:1;min-width:0}
  .edTabs{display:flex;border-bottom:1px solid rgba(255,255,255,.15)}
  .edTabs button{flex:1;border:0;border-radius:0;background:none;color:rgba(255,255,255,.55);min-height:46px;padding:0 4px}
  .edTabs button.fold{flex:none;width:48px;color:#fff;font-size:18px}
  .row.wrap{flex-wrap:wrap}.row.wrap>button{flex:1 1 auto}
  .mapBtn{position:fixed;z-index:9;left:auto!important;right:10px;width:auto;min-height:40px!important;font-size:13px!important;background:rgba(20,20,24,.85)!important}
  #edCenter{position:fixed;z-index:9;right:10px;left:auto;display:flex;flex-direction:column;gap:8px;background:none;border:0}
  #edCenter button{width:56px;min-height:56px;padding:0;border-radius:28px;background:rgba(20,20,24,.88);font-size:11px;line-height:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
  #edCenter button b{font-size:20px;font-weight:600}
  #edCenter button.pri{background:#fff;color:#000}
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
  testMode = false; recMode = null; testRec = null; testRuns = null; cancelJobs();
  stripFrags(L); // morceaux de planète nés pendant l'essai
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
  delete Lv.hint; delete Lv.stars; Lv.dirty = true; if (ED.rec && ED.rec.level === Lv) ED.rec = null; // un vol enregistré ne vaut plus après une modification
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
  if (c) c.style.top = Math.max(ED.top + 8, ED.mapBottom - 194) + 'px'; // colonne d'outils en bas à droite de la carte
  if (ED.view) { ({ scale, ox, oy } = ED.view); return; }
  const area = ED.mapBottom - ED.top - 8, hh = ED.levels && ED.levels[ED.cur] ? worldH(EL()) : WORLD_H;
  scale = Math.min(W / WORLD_W, area / hh);
  ox = (W - WORLD_W * scale) / 2;
  oy = ED.top + 4 + (area - hh * scale) / 2;
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
  // outils toujours à portée de pouce, à droite de la carte
  const tool = (ic, t, f, cls = '') => el('button', { class: cls, onclick: f }, el('b', {}, ic), t);
  const center = el('div', { id: 'edCenter', class: 'ed' },
    tool('⤢', 'Cadrer', () => { ED.view = null; editorLayout(); buildTextures(); }),
    tool('☄', 'Tout détacher', toggleAllLoose, 'edLoose'),
    tool('🎲', 'Hasard', rerollLevel),
    tool('▶', 'Tester', () => testLevel(), 'pri'));
  document.body.append(top, panel, center);
  editorLayout(); syncLooseBtn();
}
// tout le niveau détachable (ou tout fixe à nouveau) : chaque astre sauf les étoiles
const allLoose = Lv => Lv.planets.some(p => !p.star) && Lv.planets.every(p => p.star || p.loose);
function syncLooseBtn() {
  const b = document.querySelector('#edCenter .edLoose'); if (!b) return;
  b.lastChild.textContent = allLoose(EL()) ? 'Tout fixer' : 'Tout détacher';
}
function toggleAllLoose() {
  const Lv = EL(), on = !allLoose(Lv);
  Lv.planets.forEach(p => { if (p.star) return; if (on) p.loose = true; else delete p.loose; });
  Lv.dirty = true; saveDraft(); renderPanel();
}

function refreshLevelSelect() {
  const s = document.getElementById('edLevel');
  if (!s) return;
  s.innerHTML = '';
  ED.levels.forEach((l, i) => s.append(el('option', { value: i, selected: i === ED.cur }, `${i + 1}. ${l.name || 'Sans nom'}${l.dirty || !l.hint ? ' •' : ''}`)));
}

function renderPanel() {
  syncLooseBtn();
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
  if (sel < 0) { body.append(el('div', { class: 'hint' }, 'Toucher un astre : le régler. Le faire glisser : le déplacer. Appui long dans le vide : nouvelle planète. Glisser la fusée : changer le départ. Un doigt déplace la carte, deux doigts zooment.')); return; }
  const p = Lv.planets[sel];
  body.append(el('div', { class: 'row' }, el('label', {}, 'Type'),
    el('select', { onchange: e => { p.type = e.target.value; if (p.type === 'soleil') p.star = true; else delete p.star; fixStart(Lv); changed(true); renderPanel(); } },
      BODY_TYPES.map(t => el('option', { value: t, selected: t === p.type }, TYPE_LABEL[t])))));
  body.append(el('div', { class: 'row' }, el('label', {}, 'Nom'), el('input', { type: 'text', value: p.name || '', placeholder: bodyName({ type: p.type }), oninput: e => { if (e.target.value.trim()) p.name = e.target.value.trim(); else delete p.name; saveDraft(); } })));
  body.append(slider('Taille', 20, 240, 1, p.r, v => `${v} m`, v => { p.r = v; if (p.orbit) placeMoon(Lv, sel); placeTree(Lv, sel); changed(true); }));
  const gv = el('span');
  body.append(slider('Gravité', 0.2, 3, 0.05, p.g || 1, v => `× ${v.toFixed(2)}`, v => { p.g = +v.toFixed(2); if (p.g === 1) delete p.g; gv.textContent = gText(p); changed(false); }));
  gv.textContent = gText(p);
  body.append(el('div', { class: 'hint' }, gv));
  if (p.star) {
    // étoile : couleur (température) et intensité de la lumière émise
    body.append(slider('Couleur', 0, 1, 0.05, p.temp ?? 0.5, v => starName({ temp: v }), v => { p.temp = +v.toFixed(2); changed(true); }));
    body.append(slider('Intensité', 0.3, 2, 0.05, p.lum ?? 1, v => `× ${v.toFixed(2)}`, v => { p.lum = +v.toFixed(2); if (p.lum === 1) delete p.lum; changed(false); }));
    body.append(el('div', { class: 'hint' }, 'De la géante rouge à la naine blanche. Plus une étoile est grosse et intense, plus ses ombres sont marquées ; les ombres prennent la couleur des autres étoiles.'));
  }
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
    body.append(slider('Axe', -90, 90, 1, p.axis || 0, v => `${v}°`, v => { p.axis = v; if (!v) delete p.axis; changed(false); }));
  }
  { // anneaux décoratifs (étoiles comprises)
    body.append(el('div', { class: 'row' }, el('label', {}, 'Anneaux'),
      el('input', { type: 'checkbox', checked: hasRings(p), onchange: e => { if (e.target.checked) p.ring = p.type === 'saturne' && !p.ring ? true : (typeof p.ring === 'string' ? p.ring : '#d6c496'); else p.ring = false; if (p.ring === true) delete p.ring; changed(false); renderPanel(); } }),
      el('span', { class: 'hint' }, 'décoratifs : le vaisseau les traverse et les brise')));
    if (hasRings(p)) body.append(el('div', { class: 'row' }, el('label', {}, 'Forme'),
      el('select', { onchange: e => { if (e.target.value === 'classique') delete p.ringForm; else p.ringForm = e.target.value; changed(false); } }, Object.entries(RING_FORMS).map(([k, f]) => el('option', { value: k, selected: k === (p.ringForm || 'classique') }, f.label)))));
    if (hasRings(p)) body.append(el('div', { class: 'row' }, el('label', {}, 'Couleur'),
      ...RING_COLORS.map(col => el('button', { title: col, style: `width:26px;height:26px;min-height:0;padding:0;border-radius:13px;background:${col};border:${ringColor(p) === col ? '2px solid #fff' : '1px solid rgba(255,255,255,.25)'}`, onclick: () => { p.ring = col; changed(false); renderPanel(); } })),
      el('input', { type: 'color', value: ringColor(p), oninput: e => { p.ring = e.target.value; changed(false); } })));
    if (hasRings(p)) body.append(slider('Rotation', -90, 90, 1, p.ringTilt ?? Math.round(ringForm({ ringForm: p.ringForm }).tilt * 180 / Math.PI), v => `${v}°`, v => { p.ringTilt = v; changed(false); }));
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
  // astre détachable : les impacts du vaisseau le poussent hors de son orbite et l'abîment ; il peut percuter d'autres astres
  if (!p.star) body.append(el('div', { class: 'row' }, el('label', {}, 'Détachable'),
    el('input', { type: 'checkbox', checked: !!p.loose, onchange: e => { if (e.target.checked) p.loose = true; else delete p.loose; changed(false); renderPanel(); } }),
    el('span', { class: 'hint' }, 'les impacts le déplacent et l’arrachent en éclats')));
  // n'importe quel astre peut tourner autour de n'importe quel autre (étoiles comprises), sauf le départ et sans boucle
  const parents = Lv.planets.map((q, i) => i).filter(i => i !== sel && !isUnder(Lv, i, sel));
  if (sel !== Lv.start.p && parents.length) body.append(el('div', { class: 'row' }, el('label', {}, 'En orbite'),
    el('input', { type: 'checkbox', checked: !!p.orbit, onchange: e => {
      if (e.target.checked) {
        const par = parents.reduce((a, b) => hyp(Lv.planets[b].x - p.x, Lv.planets[b].y - p.y) < hyp(Lv.planets[a].x - p.x, Lv.planets[a].y - p.y) ? b : a), q = Lv.planets[par];
        p.orbit = { p: par, d: Math.round(hyp(p.x - q.x, p.y - q.y)), a0: +Math.atan2(p.y - q.y, p.x - q.x).toFixed(4), dir: 1 };
        if (Lv.belts) { Lv.belts = Lv.belts.filter(b => b.p !== sel); if (!Lv.belts.length) delete Lv.belts; }
        placeMoon(Lv, sel); placeTree(Lv, sel);
      } else delete p.orbit;
      changed(false); renderPanel();
    } }), el('span', { class: 'hint' }, 'tourne autour d’un autre astre')));
  if (p.orbit) {
    body.append(el('div', { class: 'row' }, el('label', {}, 'Tourne autour'),
      el('select', { onchange: e => { p.orbit.p = +e.target.value; placeMoon(Lv, sel); placeTree(Lv, sel); changed(false); } }, bodyOptions(Lv, p.orbit.p, (q, i) => parents.includes(i)))));
    body.append(slider('Distance', Lv.planets[p.orbit.p].r + p.r + 15, 700, 1, Math.round(p.orbit.d), v => `${v} m`, v => { p.orbit.d = v; placeMoon(Lv, sel); placeTree(Lv, sel); changed(false); }));
    body.append(el('div', { class: 'row' }, el('label', {}, 'Sens'),
      el('select', { onchange: e => { p.orbit.dir = +e.target.value; changed(false); } },
        el('option', { value: 1, selected: (p.orbit.dir || 1) === 1 }, 'Horaire'), el('option', { value: -1, selected: p.orbit.dir === -1 }, 'Anti-horaire'))));
    const q = Lv.planets[p.orbit.p], per = 2 * Math.PI * Math.sqrt(p.orbit.d ** 3 / bodyMass(q));
    body.append(el('div', { class: 'hint' }, `Un tour en ${Math.round(per)} s (vitesse réelle d’orbite). Faites glisser l’astre pour changer sa position de départ.`));
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
    const par = ED.sel && ED.sel.kind === 'body' ? ED.sel.i : Lv.planets.findIndex(q => !q.orbit && !q.star);
    if (par < 0) return;
    p = { type: 'lune', r: 35, x: 0, y: 0, orbit: { p: par, d: Lv.planets[par].r * 2 + 60, a0: 0, dir: 1 } };
  }
  Lv.planets.push(p);
  const i = Lv.planets.length - 1;
  if (p.orbit) placeMoon(Lv, i);
  ED.sel = { kind: 'body', i };
  changed(true); renderPanel();
}

// i est-il en orbite (directement ou non) autour de j ?
function isUnder(Lv, i, j) {
  for (let k = i, n = 0; Lv.planets[k] && Lv.planets[k].orbit && n < 20; n++) { k = Lv.planets[k].orbit.p; if (k === j) return true; }
  return false;
}
// replace tout ce qui tourne (directement ou non) autour de l'astre i
function placeTree(Lv, i, n = 0) {
  if (n > 10) return;
  Lv.planets.forEach((m, k) => { if (m.orbit && m.orbit.p === i && k !== i) { placeMoon(Lv, k); placeTree(Lv, k, n + 1); } });
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
  for (let pass = 0; pass < 10; pass++) Lv.planets.forEach((p, k) => { if (p.orbit && gone.has(p.orbit.p)) gone.add(k); });
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
  // grand voyage : carte deux fois plus haute, l'espace ajouté est au-dessus (tout le niveau descend de 2000 m)
  body.append(el('div', { class: 'row' }, el('label', {}, 'Grand voyage'),
    el('input', { type: 'checkbox', checked: worldH(Lv) > WORLD_H, onchange: e => {
      const dy = e.target.checked ? WORLD_H : -WORLD_H;
      if (e.target.checked) Lv.h = 2 * WORLD_H; else delete Lv.h;
      Lv.planets.forEach(p => { p.y += dy; });
      Lv.steps.forEach(s => { if (s.type === 'zone') s.y += dy; });
      ED.view = null; editorLayout(); changed(false); renderPanel();
    } }),
    el('span', { class: 'hint' }, 'carte deux fois plus haute')));
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
    if (r && r.fromRec) body.append(el('div', { class: 'hint' }, 'Le solveur n’a pas trouvé seul : la solution conseillée est ton vol.'));
    if (r && !r.error) body.append(el('div', { class: 'hint' }, `Gaz minimum ${r.minFuel.toFixed(2)} · meilleur temps avec 50 % de gaz ${r.tFastHalf.toFixed(1)} s · solution conseillée ${r.hintUsed.toFixed(2)} de gaz en ${r.hintT.toFixed(1)} s`));
    body.append(el('div', { class: 'row' }, el('label', {}, 'Solution'),
      el('button', { onclick: () => { ED.showHint = !ED.showHint; renderPanel(); } }, ED.showHint ? 'Masquer' : 'Afficher')));
  } else if (!r) body.append(el('div', { class: 'hint' }, 'Le solveur vérifie que le niveau est faisable, puis calcule le gaz, le chrono et la solution conseillée (aide « ? »).'));
  body.append(el('div', { class: 'row' },
    el('button', { class: 'pri', style: 'flex:1', onclick: () => startSolve() }, 'Lancer le solveur'),
    el('button', { style: 'flex:1', onclick: () => testLevel() }, 'Tester')));
  body.append(el('button', { class: r && r.error ? 'pri' : '', onclick: () => testLevel(true) }, 'Piloter moi-même (gaz illimité)'),
    el('div', { class: 'hint' }, 'Réussis le niveau : ton vol guide le solveur, et sert de solution si le solveur n’en trouve pas.'));
}

function startSolve(seeds) {
  const Lv = EL(), mg = Lv.margins || defaultMargins(ED.cur, ED.levels.length);
  stopSolve();
  const g = calibrate(Lv, mg, 0.6, seeds || null);
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
      let res = r.value;
      // le solveur n'a rien trouvé, mais le joueur a réussi un vol : il devient la solution
      const rc = ED.rec && ED.rec.level === Lv ? ED.rec : null;
      if (res.error && rc) res = { minFuel: rc.used, fuel: Math.ceil(rc.used * mg.fuel * 10) / 10, tFastHalf: rc.t, time: Math.max(1, Math.ceil(rc.t * mg.time)), hint: rc.P, hintUsed: rc.used, hintT: rc.t, fromRec: true };
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

function testLevel(record) {
  const Lv = EL();
  stopSolve();
  for (const id of ['edTop', 'edPanel', 'edCenter']) document.getElementById(id).style.display = 'none';
  testMode = true; screen = 'game';
  resize(); // mise en page du jeu (et non celle de l'éditeur) avant de lancer le niveau
  testRec = { auto: record === true }; // chaque essai est enregistré ; en « gaz illimité », le vol réussi part directement au solveur
  if (record === true) { // gaz et chrono illimités ; le vol réussi servira de base au solveur
    const c = JSON.parse(JSON.stringify(Lv, (k, v) => k === '_B' ? undefined : v)); c.fuel = 9999; c.time = 9999; delete c.hint;
    loadLevel(ED.cur, c);
  } else loadLevel(ED.cur, Lv);
}
// vol du joueur réussi : on le rejoue, on en tire des points de passage pour le solveur, et il sert de solution de secours
function recordDone(runs) {
  if (screen !== 'game' || !testMode) return;
  backToEditor();
  const Lv = EL(), P = { rec: runs }, r = fly(Lv, P, null);
  if (!r.ok) { alertBox('Ce vol ne se rejoue pas à l’identique. Réessaie avec un vol un peu plus franc.'); return; }
  const seeds = [1, 2, 3].map(k => Lv.steps.map((_, si) => {
    const pts = r.path.filter((_, j) => r.steps[j] === si);
    return Array.from({ length: k }, (_, q) => pts[Math.floor((q + 1) * pts.length / (k + 1))]).filter(Boolean);
  }));
  ED.rec = { level: Lv, P, used: r.used, t: r.t };
  ED.tab = 'solveur'; ED.fold = false;
  startSolve(seeds);
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
    const pick = (src, rnd) => {
      close();
      const c = rnd ? randomLevel() : src ? JSON.parse(JSON.stringify(src, (k, v) => ['_B', 'hint', 'fuel', 'time', 'stars', 'margins'].includes(k) ? undefined : v)) : newLevel();
      if (!rnd) c.name = src ? `${src.name} (perso)` : 'Mon niveau';
      c.dirty = true;
      if (screen === 'editor' && ED.mode === 'perso') { ED.levels.push(c); saveDraft(); selectLevel(ED.levels.length - 1); }
      else { const mine = persoList('mine'); mine.push(c); persoSave('mine', mine); closePerso(); openEditor('perso', mine.length - 1); }
    };
    const list = el('div', { class: 'menu', style: 'max-height:50vh;overflow-y:auto' },
      el('button', { class: 'pri', onclick: () => pick(null) }, 'Niveau vierge'),
      el('button', { class: 'pri', onclick: () => pick(null, true) }, 'Aléatoire'),
      LEVELS.map((l, i) => el('button', { onclick: () => pick(l) }, `${i + 1}. ${l.name}`)));
    box.append(el('h3', {}, 'Nouveau niveau'), el('div', { class: 'hint' }, 'Partir de zéro, du hasard ou d’un niveau officiel comme modèle.'), list, el('button', { onclick: close }, 'Annuler'));
  });
}

// niveau tiré au hasard (à calibrer ensuite avec le solveur) : nombre, types, tailles, couleurs, gravités, orbites imbriquées,
// étoiles, anneaux, ceintures, objectifs enchaînés et grand voyage, tout est tiré ; seul garde-fou : un départ hors de l'ombre
function randomLevel() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const Lv = randomLevelTry();
    invalidate(Lv); const st = startState(Lv);
    if (!inShadow(snapshot(Lv, 0), st.x, st.y)) return Lv;
  }
  return newLevel();
}
function randomLevelTry() {
  const R = (a, b) => a + Math.random() * (b - a), I = (a, b) => Math.floor(R(a, b + 1)), pickOf = a => a[Math.floor(Math.random() * a.length)], chance = p => Math.random() < p;
  const tall = chance(0.35), Hh = tall ? 2 * WORLD_H : WORLD_H;
  const rocky = ['terre', 'mars', 'lune', 'mercure', 'venus', 'perso'], giant = ['jupiter', 'saturne', 'uranus', 'neptune', 'perso'];
  const planets = [];
  const free = (x, y, r, gap = 120) => x - r > 20 && x + r < WORLD_W - 20 && y - r > 60 && y + r < Hh - 60 && planets.every(q => q.orbit || Math.hypot(q.x - x, q.y - y) > q.r + r + gap);
  const dress = p => { // apparence au hasard
    if (p.type === 'perso') { p.color = '#' + [0, 0, 0].map(() => I(40, 240).toString(16).padStart(2, '0')).join(''); p.style = pickOf(Object.keys(STYLES)); }
    else if (chance(0.3)) { p.tint = '#' + [0, 0, 0].map(() => I(40, 240).toString(16).padStart(2, '0')).join(''); p.shade = +R(0.3, 0.9).toFixed(2); }
    if (chance(0.35)) p.g = +R(0.5, 2.5).toFixed(1);
    if (chance(0.3)) p.axis = I(-60, 60);
    if (chance(0.25)) { if (chance(0.5)) p.ringTilt = I(-90, 90); p.ring = chance(0.7) ? pickOf(RING_COLORS) : '#' + [0, 0, 0].map(() => I(60, 240).toString(16).padStart(2, '0')).join(''); const f = pickOf(Object.keys(RING_FORMS)); if (f !== 'classique') p.ringForm = f; }
    return p;
  };
  // départ : n'importe où, plutôt dans le bas ; arrivée : loin du départ
  const sy = chance(0.75) ? I(Math.round(Hh * 0.7), Hh - 380) : I(300, Hh - 380);
  planets.push(dress({ type: pickOf(rocky), x: I(150, 850), y: sy, r: I(45, 110) }));
  delete planets[0].g;
  for (let t = 0; t < 200; t++) {
    const big = chance(0.4), r = big ? I(80, 150) : I(30, 90), x = I(100, 900), y = I(150, Hh - 150);
    if (Math.abs(y - sy) < Hh * 0.4 || !free(x, y, r)) continue;
    planets.push(dress({ type: pickOf(big ? giant : rocky), x, y, r })); break;
  }
  if (planets.length < 2) planets.push(dress({ type: pickOf(rocky), x: I(200, 800), y: sy > Hh / 2 ? 300 : Hh - 300, r: 70 }));
  // astres de plus, étoiles comprises
  const extra = tall ? I(2, 8) : I(0, 5);
  for (let k = 0, t = 0; k < extra && t < 500; t++) {
    const star = chance(0.15), big = chance(0.35), r = star ? I(40, 110) : big ? I(80, 150) : I(20, 90), x = I(60, 940), y = I(80, Hh - 80);
    if (!free(x, y, r, star ? 200 : 100)) continue;
    planets.push(star ? { type: 'soleil', star: true, x, y, r, temp: +R(0, 1).toFixed(2), lum: +R(0.5, 1.8).toFixed(2) } : dress({ type: pickOf(big ? giant : rocky), x, y, r }));
    k++;
  }
  // orbites : n'importe quel astre (sauf le départ) peut tourner autour d'un autre, parfois en cascade
  const Lv = { name: pickOf(['Dérive', 'Cap', 'Passage', 'Remous', 'Traversée', 'Écho', 'Halo', 'Faille', 'Vertige', 'Sillage', 'Orée', 'Abîme']) + ' ' + pickOf(['lointain', 'étroit', 'oublié', 'sauvage', 'perdu', 'des géants', 'du silence', 'pourpre', 'boréal', 'des ombres']) + (tall ? ' · grand voyage' : ''),
    planets, start: { p: 0, a: +R(-Math.PI, Math.PI).toFixed(4) }, steps: [], dirty: true };
  if (tall) Lv.h = Hh;
  const nm = I(0, 3);
  for (let k = 0; k < nm; k++) {
    const host = I(0, planets.length - 1), hp = planets[host];
    const moon = { type: chance(0.8) ? 'lune' : pickOf(rocky), r: I(12, Math.max(14, Math.round(hp.r * 0.45))), orbit: { p: host, d: 0, a0: +R(0, 6.28).toFixed(2), dir: chance(0.5) ? 1 : -1 } };
    moon.orbit.d = hp.r + moon.r + I(40, 160);
    if (chance(0.2)) { moon.type = 'soleil'; moon.star = true; moon.temp = +R(0, 1).toFixed(2); moon.lum = +R(0.5, 1.8).toFixed(2); } else dress(moon);
    planets.push(moon); placeMoon(Lv, planets.length - 1);
    if (moon.x < -200 || moon.x > WORLD_W + 200) planets.pop();
  }
  // le départ doit rester fixe et le plus bas des deux premiers astres sert de départ si l'arrivée a été tirée dessous
  if (chance(0.15) && !planets[1].orbit) { // parfois la planète d'arrivée tourne autour d'une étoile ou d'un géant
    const host = planets.findIndex((q, i) => i > 1 && !q.orbit && q.r >= 60);
    if (host > 1) { const q = planets[host], p = planets[1]; p.orbit = { p: host, d: Math.round(Math.hypot(p.x - q.x, p.y - q.y)), a0: +Math.atan2(p.y - q.y, p.x - q.x).toFixed(4), dir: chance(0.5) ? 1 : -1 }; }
  }
  // ceintures autour d'astres fixes, si elles n'enferment ni le départ ni l'arrivée
  for (let k = 0, nb = I(0, 2); k < nb; k++) {
    const i = I(2, Math.max(2, planets.length - 1)), q = planets[i];
    if (!q || q.orbit) continue;
    const br = Math.round(q.r * R(1.8, 3) + 30), bw = I(20, 60);
    if ([0, 1].every(j => Math.hypot(planets[j].x - q.x, planets[j].y - q.y) > br + bw + planets[j].r + 60 + (planets[j].orbit ? planets[j].orbit.d : 0))) (Lv.belts = Lv.belts || []).push({ p: i, r: br, w: bw });
  }
  // objectifs : 1 à 4, enchaînés au hasard ; le dernier est souvent un atterrissage
  const nsteps = I(1, 4), solid = planets.map((q, i) => i).filter(i => !planets[i].star);
  for (let k = 0; k < nsteps; k++) {
    const last = k === nsteps - 1, u = Math.random();
    if (last && u < 0.75) Lv.steps.push({ type: 'land', p: chance(0.15) ? 0 : 1 });
    else if (u < 0.4) { const p = planets[I(1, planets.length - 1)]; Lv.steps.push({ type: 'zone', x: I(120, 880), y: Math.round(Math.max(150, Math.min(Hh - 150, p.y + R(-300, 300)))), r: I(60, 110) }); }
    else if (u < 0.75) Lv.steps.push({ type: 'orbit', p: pickOf(planets.map((q, i) => i).filter(i => i !== 0)), n: chance(0.8) ? 1 : 2 });
    else Lv.steps.push({ type: 'land', p: pickOf(solid.filter(i => i !== 0)) ?? 1 });
  }
  return Lv;
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
    '//           ring (couleur ou false : anneaux décoratifs) + ringForm (classique, fin, large, double, penche), tint + shade (teinte), color + style (type « perso »), name\n' +
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
const sharePayload = l => JSON.parse(JSON.stringify({ name: l.name || 'Niveau perso', h: l.h, planets: l.planets, start: l.start, steps: l.steps, belts: l.belts, fuel: l.fuel, time: l.time }, (k, v) => k === '_B' ? undefined : v));

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
    if (p.type === 'soleil' || p.star) { q.star = true; if (p.temp !== undefined) q.temp = num(p.temp, 0, 1); if (p.lum !== undefined) q.lum = num(p.lum, 0.2, 3); }
    if (p.orbit) q.orbit = { p: int(p.orbit.p, n), d: num(p.orbit.d, 10, 5000), a0: num(p.orbit.a0, -100, 100), dir: p.orbit.dir === -1 ? -1 : 1 };
    if (p.ring === false) q.ring = false; else if (p.ring === true) q.ring = true; else if (hex(p.ring)) q.ring = hex(p.ring);
    if (RING_FORMS[p.ringForm]) q.ringForm = p.ringForm;
    if (p.ringTilt !== undefined) q.ringTilt = num(p.ringTilt, -180, 180);
    if (p.axis !== undefined) q.axis = num(p.axis, -180, 180);
    if (hex(p.tint)) { q.tint = hex(p.tint); if (p.shade !== undefined) q.shade = num(p.shade, 0, 1); }
    if (hex(p.color)) q.color = hex(p.color);
    if (STYLES[p.style]) q.style = p.style;
    if (str(p.name, 30)) q.name = str(p.name, 30);
    return q;
  });
  planets.forEach((p, i) => { for (let k = i, n = 0; planets[k].orbit; n++) { k = planets[k].orbit.p; if (k === i || n > 8) throw 0; } }); // orbites imbriquées permises, sans boucle
  const steps = o.steps.map(s => {
    if (s.type === 'zone') return { type: 'zone', x: num(s.x, -5000, 6000), y: num(s.y, -5000, 7000), r: num(s.r, 10, 500) };
    if (s.type === 'land') return { type: 'land', p: int(s.p, n) };
    if (s.type === 'orbit') return { type: 'orbit', p: int(s.p, n), n: Math.round(num(s.n, 1, 5)) };
    throw 0;
  });
  const sp = int(o.start && o.start.p, n);
  if (planets[sp].star || planets[sp].orbit) throw 0;
  const lv = { name: str(o.name, 40) || 'Niveau reçu', planets, start: { p: sp, a: num(o.start.a, -10, 10) }, steps, fuel: num(o.fuel, 0.1, 500), time: num(o.time, 1, 2000) };
  if (o.h === 2 * WORLD_H) lv.h = o.h;
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
  if (data.hint.rec && !(Array.isArray(data.hint.rec) && data.hint.rec.length < 30000 && data.hint.rec.every(r => Array.isArray(r) && (r.length === 2 || r.length === 6) && r.every(v => typeof v === 'number' && isFinite(v))))) return 'Solution abîmée.';
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
  const Lv = EL(), [wx, wy] = toWorld(e), tol = 22 / scale; // zones de toucher larges, faites pour le doigt
  const st = startState(Lv);
  let hit = null;
  if (hyp(wx - st.x, wy - st.y) < 30 / scale) hit = { kind: 'start' };
  if (!hit) for (let i = Lv.planets.length - 1; i >= 0; i--) { const p = Lv.planets[i]; if (hyp(wx - p.x, wy - p.y) < p.r + tol) { hit = { kind: 'body', i }; break; } }
  if (!hit) Lv.steps.forEach((s, i) => { if (!hit && s.type === 'zone' && hyp(wx - s.x, wy - s.y) < s.r + tol) hit = { kind: 'zone', i }; });
  ED.drag = { ...(hit || { kind: 'none' }), id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  // appui long dans le vide : nouvelle planète à cet endroit
  clearTimeout(ED.lp);
  if (!hit) ED.lp = setTimeout(() => { const d = ED.drag; if (d && d.kind === 'none' && !d.moved && !ED.pinch) { ED.drag = null; addBodyAt(wx, wy); } }, 550);
}
function addBodyAt(x, y) {
  const Lv = EL();
  Lv.planets.push({ type: ['mars', 'terre', 'lune', 'venus', 'mercure'][Math.floor(Math.random() * 5)], x: Math.round(x), y: Math.round(y), r: 60 });
  ED.sel = { kind: 'body', i: Lv.planets.length - 1 }; ED.tab = 'astre';
  if (ED.fold) { ED.fold = false; editorLayout(); }
  try { navigator.vibrate && navigator.vibrate(15); } catch (err) {}
  changed(true); renderPanel();
}
// remplace le niveau en cours par un tirage au hasard
function rerollLevel() {
  confirmBox('Remplacer ce niveau par un tirage au hasard ?', () => {
    ED.levels[ED.cur] = randomLevel(); ED.sel = null; ED.view = null; ED.rec = null;
    saveDraft(); selectLevel(ED.cur);
  });
}

function editorPointerMove(e) {
  if (ED.ptrs.has(e.pointerId)) ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.pinch && ED.ptrs.size >= 2) {
    clearTimeout(ED.lp);
    const [a, b] = [...ED.ptrs.values()], P = ED.pinch;
    const base = Math.min(W / WORLD_W, (ED.mapBottom - ED.top - 8) / worldH(EL()));
    const sc = Math.max(base * 0.25, Math.min(base * 8, P.scale * hyp(a.x - b.x, a.y - b.y) / P.d));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, wx = (P.mx - P.ox) / P.scale, wy = (P.my - P.oy) / P.scale;
    setView(sc, mx - wx * sc, my - wy * sc);
    return;
  }
  const d = ED.drag;
  if (!d || e.pointerId !== d.id) return;
  if (!d.moved && hyp(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
  d.moved = true; clearTimeout(ED.lp);
  if (d.kind === 'none') { // un doigt dans le vide : déplacer la carte
    setView(scale, ox + e.clientX - d.lx, oy + e.clientY - d.ly);
    d.lx = e.clientX; d.ly = e.clientY;
    return;
  }
  const Lv = EL(), [wx, wy] = toWorld(e);
  const cx = Math.max(-LIMIT, Math.min(WORLD_W + LIMIT, wx)), cy = Math.max(-LIMIT, Math.min(worldH(Lv) + LIMIT, wy));
  if (d.kind === 'body') {
    const p = Lv.planets[d.i];
    if (p.orbit) { const q = Lv.planets[p.orbit.p]; p.orbit.a0 = +Math.atan2(cy - q.y, cx - q.x).toFixed(4); p.orbit.d = Math.round(hyp(cx - q.x, cy - q.y)); placeMoon(Lv, d.i); placeTree(Lv, d.i); }
    else {
      p.x = Math.round(cx); p.y = Math.round(cy);
      placeTree(Lv, d.i);
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
  ED.ptrs.delete(e.pointerId); clearTimeout(ED.lp);
  if (ED.pinch) { if (ED.ptrs.size < 2) ED.pinch = null; return; }

  const d = ED.drag;
  if (!d || e.pointerId !== d.id) return;
  ED.drag = null;
  if (d.moved) { if (d.kind !== 'none' && (ED.tab === 'astre' || ED.tab === 'obj')) renderPanel(); return; }
  if (d.kind === 'body' || d.kind === 'zone') { // toucher un astre ou une zone ouvre ses réglages
    ED.sel = { kind: d.kind, i: d.i }; ED.tab = d.kind === 'body' ? 'astre' : 'obj';
    if (ED.fold) { ED.fold = false; editorLayout(); }
  }
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
  ctx.strokeRect(0, 0, WORLD_W, worldH(Lv)); ctx.setLineDash([]);
  invalidate(Lv);
  const Bs = snapshot(Lv, 0);
  drawLight(Bs);
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
  drawShadows(Bs);
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

// ===== Tutoriel (bouton de l'accueil) =====
// pages illustrées : commandes, puissance des gaz, réserve de gaz, vitesse et atterrissage, gravité, étoiles et ceintures, outils, objectifs
const TUTO = [
  { t: 'Le vide', svg: `
    <circle cx="60" cy="150" r="42" fill="#1f5fae"/><path d="M60 100 L66 112 L54 112 Z" fill="#fff"/>
    <path d="M62 98 C90 40 170 20 215 60" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="6 5"/>
    <circle cx="200" cy="110" r="26" fill="#c25a30"/>
    <g fill="#ffd60a"><circle cx="62" cy="96" r="4"/><circle cx="140" cy="34" r="3"/><circle cx="205" cy="52" r="3"/></g>
    <text x="74" y="94" fill="#ffd60a" font-size="11">1 décollage</text><text x="118" y="22" fill="#ffd60a" font-size="11">petites tapes</text>`,
    p: ['L’espace est immense. Ton réservoir, non.',
      'Chaque voyage se gagne à l’élan et à la gravité.'] },
  { t: 'Le réacteur', svg: `
    <circle cx="120" cy="80" r="62" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 6"/>
    <path d="M120 64 L131 92 L109 92 Z" fill="#fff"/>
    <circle cx="170" cy="80" r="12" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
    <g stroke="#fff" stroke-width="2"><line x1="134" y1="80" x2="160" y2="80"/><line x1="134" y1="74" x2="156" y2="70"/><line x1="134" y1="86" x2="156" y2="90"/></g>
    <path d="M100 80 H50 M58 72 L50 80 L58 88" stroke="#30d158" stroke-width="3" fill="none"/>
    <text x="40" y="112" fill="#30d158" font-size="12">le vaisseau part par ici</text>`,
    p: ['Le gaz sort du côté de ton doigt. Le vaisseau part à l’opposé.',
      'Plusieurs doigts, plusieurs jets. Au clavier, les flèches.'] },
  { t: 'La poussée', svg: `
    <circle cx="120" cy="80" r="62" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 6"/>
    <circle cx="151" cy="80" r="6" fill="#ffd60a"/><text x="136" y="102" fill="#ffd60a" font-size="11">doux</text>
    <circle cx="182" cy="80" r="6" fill="#ff6b61"/><text x="172" y="66" fill="#ff6b61" font-size="11">fort</text>`,
    p: ['Au bord du cercle, toute la puissance.',
      'Près du centre, une simple correction.'] },
  { t: 'Boussole ou Fixe', svg: `
    <circle cx="62" cy="82" r="46" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 6"/>
    <g transform="translate(62 82) rotate(35)"><path d="M0 -13 L9 9 L-9 9 Z" fill="#fff"/></g>
    <text x="62" y="150" fill="#fff" font-size="12" text-anchor="middle">Boussole</text>
    <g fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 4">
      <rect x="166" y="34" width="20" height="34" rx="6"/><rect x="166" y="96" width="20" height="34" rx="6"/>
      <rect x="128" y="72" width="34" height="20" rx="6"/><rect x="190" y="72" width="34" height="20" rx="6"/></g>
    <path d="M176 70 L184 90 L168 90 Z" fill="#fff"/>
    <text x="176" y="150" fill="#fff" font-size="12" text-anchor="middle">Fixe</text>`,
    p: ['<b>Boussole</b> : les directions de l’écran.',
      '<b>Fixe</b> : celles du vaisseau.',
      'Le bouton Boussole, à droite du réacteur, change de mode.'] },
  { t: 'La gravité', svg: `
    <circle cx="140" cy="90" r="34" fill="#c25a30"/>
    <path d="M10 165 C120 160 205 135 192 90 S170 30 228 18" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="6 5"/>
    <path d="M219 13 L229 18 L221 26" stroke="#fff" stroke-width="2" fill="none"/>
    <text x="10" y="20" fill="#ffd60a" font-size="12">virage gratuit</text>`,
    p: ['Chaque astre t’attire.',
      'Frôle-le pour virer sans brûler de gaz.'] },
  { t: 'L’atterrissage', svg: `
    <path d="M10 165 Q120 140 230 165 L230 180 L10 180 Z" fill="#3d7f3b"/>
    <g transform="translate(55 60) rotate(-50)"><path d="M0 -11 L8 9 L-8 9 Z" fill="#fff" fill-opacity=".5"/></g>
    <path d="M78 66 Q100 66 110 80" stroke="#fff" stroke-opacity=".5" fill="none" stroke-dasharray="3 4"/>
    <path d="M120 84 L128 106 L112 106 Z" fill="#fff"/>
    <g stroke="#ffb340" stroke-width="3"><line x1="120" y1="112" x2="120" y2="138"/><line x1="114" y1="110" x2="108" y2="132"/><line x1="126" y1="110" x2="132" y2="132"/></g>
    <g stroke="#30d158" stroke-width="3"><line x1="188" y1="146" x2="200" y2="158"/><line x1="200" y1="146" x2="188" y2="158"/></g>
    <text x="140" y="96" fill="#ffd60a" font-size="11">grosse poussée</text><text x="140" y="110" fill="#ffd60a" font-size="11">pour freiner</text>
    <text x="12" y="40" fill="#fff" fill-opacity=".7" font-size="11">redresse-le doucement</text>`,
    p: ['Sur l’arrière, et lentement.',
      'La croix au bout de ta trajectoire verdit quand l’approche est bonne.',
      'Le bouton Réglages peut redresser le vaisseau pour toi, contre du gaz.'] },
  { t: 'La route', svg: `
    <path d="M40 120 Q60 40 170 30" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="8 5"/>
    <circle cx="170" cy="30" r="9" fill="#000" stroke="#fff"/><text x="166" y="34" fill="#fff" font-size="10">1</text>
    <circle cx="120" cy="140" r="34" fill="#fff"/><text x="120" y="138" fill="#000" font-size="13" font-weight="700" text-anchor="middle">Valider</text>
    <text x="120" y="152" fill="#000" font-size="8" text-anchor="middle">la trajectoire</text>`,
    p: ['Touche l’espace : une route s’affiche, avec son coût en gaz.',
      '<b>Valider</b> confie le vaisseau au pilote auto. Le réacteur te rend la main.',
      'Le bouton ? montre une solution.'] },
  { t: 'Les étoiles', svg: `
    <circle cx="20" cy="20" r="40" fill="#ffb22e"/>
    <circle cx="120" cy="80" r="24" fill="#3b6ee0"/>
    <path d="M108 101 L180 160 L215 132 L138 62 Z" fill="#000" fill-opacity=".55"/>
    <g fill="#8d8070"><circle cx="30" cy="140" r="4"/><circle cx="48" cy="150" r="3"/><circle cx="66" cy="157" r="4"/><circle cx="14" cy="128" r="3"/></g>
    <text x="150" y="40" fill="#ffd60a" font-size="20">★ ★ ★</text>`,
    p: ['Les soleils brûlent. Les astéroïdes ne pardonnent pas. L’ombre coupe le réacteur solaire !',
      'Trois étoiles : arriver, garder la moitié du gaz, battre le chrono.'] },
];


function openTutorial(page = 0) {
  document.getElementById('tutoScr')?.remove();
  screen = 'tuto';
  const T = TUTO[page];
  const close = () => { document.getElementById('tutoScr')?.remove(); screen = 'home'; };
  const art = el('div', { style: 'display:flex;justify-content:center' });
  art.innerHTML = `<svg viewBox="0 0 240 180" width="100%" style="max-width:300px" font-family="system-ui,-apple-system,sans-serif">${T.svg}</svg>`;
  const text = el('div', { style: 'display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.45' });
  text.innerHTML = T.p.map(x => `<p style="margin:0">${x}</p>`).join('');
  const dots = el('div', { style: 'display:flex;gap:6px;justify-content:center' }, TUTO.map((_, i) => el('span', { style: `width:8px;height:8px;border-radius:4px;background:${i === page ? '#fff' : 'rgba(255,255,255,.25)'}` })));
  const scr = el('div', { id: 'tutoScr', class: 'ed', style: 'top:0;bottom:0;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 10px) 18px calc(env(safe-area-inset-bottom) + 16px);background:rgba(0,0,0,.88);display:flex;flex-direction:column;gap:14px' },
    el('div', { class: 'row' }, el('button', { onclick: close }, '‹ Accueil'), el('span', { style: 'flex:1;text-align:right;color:rgba(255,255,255,.5);font-size:13px' }, `${page + 1} / ${TUTO.length}`)),
    el('h3', { style: 'margin:4px 0 0;font-size:22px' }, T.t), art, text,
    el('div', { style: 'flex:1' }), dots,
    el('div', { class: 'row' },
      el('button', { style: 'flex:1', disabled: page === 0, onclick: () => openTutorial(page - 1) }, 'Précédent'),
      page < TUTO.length - 1
        ? el('button', { class: 'pri', style: 'flex:1', onclick: () => openTutorial(page + 1) }, 'Suivant')
        : el('button', { class: 'pri', style: 'flex:1', onclick: close }, 'C’est parti !')));
  document.body.append(scr);
}
