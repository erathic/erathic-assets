// pose_gap.mjs : mesure l'écart de pose entre la fin (ou n'importe quelle phase) d'un clip et le début du suivant,
// pour toutes les transitions utilisées par le jeu Robot à l'épée, et propose une durée de fondu.
// Usage (depuis la racine du dépôt) : node --no-warnings outils/transitions/pose_gap.mjs [--json sortie.json]
// Mesure : angle moyen (degrés) entre les rotations des os communs. Source en boucle : moyenne sur 8 phases ; coup unique : phases 50 %, 75 % et 100 %.
// La cible est prise à sa première image. C'est une approximation (le fondu mélange aussi les images suivantes), utile pour classer les paires.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ANIMS, TRANSITIONS } from '../../projets/robot-sword-game/src/config.js';
import { resolveTransition } from '../../projets/robot-sword-game/src/transitions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = p => path.join(root, p);

// ---------- lecture minimale d'un GLB : clips -> { dur, tracks:{ 'Os.quaternion': {t, v} } } ----------
function readGlbClips(p) {
  const buf = fs.readFileSync(p); const jl = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')); const bin = buf.subarray(20 + jl + 8);
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  const acc = i => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = a.count * comps[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0); const out = new Float32Array(n);
    for (let k = 0; k < n; k++) out[k] = bin.readFloatLE(off + k * 4); return { v: out, n: a.count, c: comps[a.type] }; };
  const clips = {};
  for (const an of j.animations) {
    const tracks = {}; let dur = 0;
    for (const ch of an.channels) {
      const suffix = { rotation:'quaternion', translation:'position' }[ch.target.path]; if (!suffix) continue;
      const s = an.samplers[ch.sampler], tin = acc(s.input), out = acc(s.output);
      let v = out.v; if (s.interpolation === 'CUBICSPLINE') { v = new Float32Array(tin.n * out.c); for (let i = 0; i < tin.n; i++) for (let c = 0; c < out.c; c++) v[i * out.c + c] = out.v[(3 * i + 1) * out.c + c]; }
      tracks[`${j.nodes[ch.target.node].name}.${suffix}`] = { t: Array.from(tin.v), v: Array.from(v) };
      dur = Math.max(dur, tin.v[tin.n - 1]);
    }
    clips[an.name] = { dur, tracks };
  }
  return clips;
}
const fromJson = c => ({ dur: c.dur, tracks: Object.fromEntries(c.tracks.map(t => [t.n, { t: t.t, v: t.v }])) });

// ---------- échantillonnage d'une pose (rotations seulement) ----------
function qslerp(a, b, f) { let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]; const s = d < 0 ? -1 : 1; d = Math.abs(d);
  const o = [0, 0, 0, 0]; if (d > 0.9995) { for (let i = 0; i < 4; i++) o[i] = a[i] + (s*b[i] - a[i]) * f; }
  else { const th = Math.acos(d), sn = Math.sin(th), w1 = Math.sin((1 - f) * th) / sn, w2 = Math.sin(f * th) / sn; for (let i = 0; i < 4; i++) o[i] = w1 * a[i] + w2 * s * b[i]; }
  const l = Math.hypot(...o); return o.map(x => x / l); }
function poseAt(clip, time) {
  const pose = {};
  for (const [name, tr] of Object.entries(clip.tracks)) { if (!name.endsWith('.quaternion')) continue;
    const t = tr.t, v = tr.v; let i = 0; while (i < t.length - 2 && t[i + 1] < time) i++;
    const q = k => v.slice(k * 4, k * 4 + 4);
    if (time <= t[0]) pose[name] = q(0); else if (time >= t[t.length - 1]) pose[name] = q(t.length - 1);
    else pose[name] = qslerp(q(i), q(i + 1), (time - t[i]) / (t[i + 1] - t[i])); }
  return pose;
}
function gap(pa, pb) {                       // angle moyen et pire os (degrés) sur les os communs
  let sum = 0, n = 0, worst = 0, wn = '';
  for (const k in pa) { if (!pb[k]) continue; const d = Math.abs(pa[k][0]*pb[k][0] + pa[k][1]*pb[k][1] + pa[k][2]*pb[k][2] + pa[k][3]*pb[k][3]);
    const deg = 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; sum += deg; n++; if (deg > worst) { worst = deg; wn = k.replace('.quaternion', ''); } }
  return { mean: sum / n, worst, worstBone: wn };
}

// ---------- clips du jeu ----------
const glb = readGlbClips(file('personnages/bot_v1/Character-bot.glb'));
const frank = JSON.parse(fs.readFileSync(file('derives/bot_clips_v1/frank_clips.json')));
const jumps = JSON.parse(fs.readFileSync(file('derives/bot_clips_v1/jumps.json')));
const clips = {}, loops = {};
for (const [key, name, loop] of ANIMS.native) { clips[key] = glb[name]; loops[key] = loop; }
for (const [key, name, loop] of ANIMS.frank) { clips[key] = fromJson(frank[name]); loops[key] = loop; }
for (const [key, name, loop] of ANIMS.jumps) { clips[key] = fromJson(jumps[name]); loops[key] = loop; }

// transitions utilisées par le contrôleur
const LOCO = ['idle', 'walk', 'run'], ATK = ['f1', 'f2', 'f3', 'f4'], edges = [];
for (const a of LOCO) for (const b of LOCO) if (a !== b) edges.push([a, b]);
LOCO.forEach(a => edges.push([a, 'f1'], [a, 'jstart']));
edges.push(['f1', 'f2'], ['f2', 'f3'], ['f3', 'f4']); ATK.forEach(a => LOCO.forEach(b => edges.push([a, b])));
['jstart', 'jloop', 'jland'].forEach(a => LOCO.forEach(b => { if (a === 'jland') edges.push([a, b]); }));
edges.push(['jstart', 'jloop'], ['jstart', 'jland'], ['jloop', 'jland']);
[...LOCO, ...ATK, 'jstart', 'jloop', 'jland'].forEach(a => edges.push([a, 'hit'], [a, 'death']));
LOCO.forEach(b => edges.push(['hit', b]));

const phases = key => { const d = clips[key].dur; return loops[key] ? Array.from({ length: 8 }, (_, i) => d * i / 8) : [d * 0.5, d * 0.75, d]; };
// cibles réactives : un fondu court y est voulu (le coup doit partir tout de suite) ; on ne signale que les écarts très élevés
const REACTIVE = new Set(['f1', 'f2', 'f3', 'f4', 'hit', 'death', 'jstart']);
const suggest = m => m < 15 ? 0.06 : m < 30 ? 0.10 : m < 45 ? 0.15 : 0.20;
const rows = edges.map(([a, b]) => {
  const target = poseAt(clips[b], 0); const gs = phases(a).map(t => gap(poseAt(clips[a], t), target));
  const mean = gs.reduce((s, g) => s + g.mean, 0) / gs.length; const w = gs.reduce((m, g) => g.worst > m.worst ? g : m);
  const { fade, sync } = resolveTransition(a, b); const sug = suggest(mean);
  return { edge: `${a}>${b}`, mean: +mean.toFixed(1), worst: +w.worst.toFixed(0), bone: w.worstBone, fade, sync, suggested: sug, verdict: REACTIVE.has(b) ? (mean > 45 ? 'réactif, écart élevé' : 'réactif (voulu)') : fade + 0.001 < sug ? 'fondu court' : 'ok' };
});
rows.sort((x, y) => y.mean - x.mean);
console.log('transition'.padEnd(14), 'moy°'.padStart(6), 'pire°'.padStart(6), 'os (pire)'.padEnd(14), 'fondu'.padStart(6), 'sugg.'.padStart(6), ' verdict');
rows.forEach(r => console.log(r.edge.padEnd(14), String(r.mean).padStart(6), String(r.worst).padStart(6), r.bone.padEnd(14), String(r.fade).padStart(6), String(r.suggested).padStart(6), ' ' + r.verdict));
const count = v => rows.filter(r => r.verdict === v).length;
console.log(`\n${rows.length} transitions : ${count('ok')} ok, ${count('réactif (voulu)')} réactives, ${count('réactif, écart élevé')} réactives à écart élevé, ${count('fondu court')} au fondu trop court.`);
// fermeture des boucles : la dernière pose doit rejoindre la première (sinon saut visible à chaque tour)
console.log('\nFermeture des boucles (fin contre début, degrés en moyenne) :');
for (const k in clips) if (loops[k]) { const g = gap(poseAt(clips[k], clips[k].dur), poseAt(clips[k], 0)); console.log(' ', k.padEnd(6), g.mean.toFixed(1).padStart(5), g.mean > 5 ? ' à vérifier' : ' ok'); }
const ji = process.argv.indexOf('--json'); if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(rows, null, 1));
