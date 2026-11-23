// Orbite — solveur de calibrage des niveaux en ligne de commande (outil de développement, ne pas déployer)
// Même calcul que le bouton « Solveur » de l'éditeur (fonction calibrate d'engine.js).
// Usage : node solveur.js            → tous les niveaux de niveaux.js, réécrit le fichier
//         node solveur.js 3 7        → niveaux 3 et 7 seulement (numéros à partir de 1)
const path = require('path'), fs = require('fs'), os = require('os'), { fork } = require('child_process');
const DIR = __dirname;

function calibrateOne(i, f) {
  const E = require(path.join(DIR, 'engine.js')), LEVELS = require(path.join(DIR, 'niveaux.js'));
  const L = LEVELS[i], g = E.calibrate(L, L.margins || E.defaultMargins(i, LEVELS.length), f);
  let r = g.next();
  while (!r.done) r = g.next();
  return { i, ...r.value };
}

if (process.argv[2] === '--worker') {
  process.on('message', ({ i, f }) => { process.send(calibrateOne(i, f)); });
} else {
  const LEVELS = require(path.join(DIR, 'niveaux.js'));
  const only = process.argv.slice(2).map(n => +n - 1);
  const todo = only.length ? only : LEVELS.map((_, i) => i);
  const results = {};
  let next = 0, running = 0;
  const done = () => {
    let failed = false;
    for (const i of todo) {
      const r = results[i];
      if (r.error) { failed = true; console.log(`Niveau ${i + 1} : ${r.error}`); continue; }
      Object.assign(LEVELS[i], { fuel: r.fuel, time: r.time, hint: r.hint });
      console.log(`Niveau ${i + 1} : gaz min ${r.minFuel.toFixed(2)} → gaz ${r.fuel} · chrono ${r.time} s (meilleur ${r.tFastHalf.toFixed(1)} s avec 50 %) · conseil ${r.hintUsed.toFixed(2)} gaz / ${r.hintT.toFixed(1)} s`);
    }
    const src = fs.readFileSync(path.join(DIR, 'niveaux.js'), 'utf8');
    const head = src.slice(0, src.indexOf('const LEVELS'));
    const body = 'const LEVELS = [\n' + LEVELS.map(l => '  ' + JSON.stringify(l)).join(',\n') + ',\n];\n\nif (typeof module !== \'undefined\') module.exports = LEVELS;\n';
    fs.writeFileSync(path.join(DIR, 'niveaux.js'), head + body);
    console.log(failed ? 'Terminé avec des erreurs (niveaux non modifiés ci-dessus).' : 'niveaux.js mis à jour.');
    process.exit(0);
  };
  const launch = () => {
    while (running < Math.max(1, os.cpus().length) && next < todo.length) {
      const i = todo[next++], w = fork(__filename, ['--worker']);
      running++;
      w.on('message', r => { results[i] = r; w.kill(); running--; if (Object.keys(results).length === todo.length) done(); else launch(); });
      w.send({ i, f: 1 });
    }
  };
  launch();
}
