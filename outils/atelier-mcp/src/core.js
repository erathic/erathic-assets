// Noyau de l'atelier local : lecture, inspection et dérivation de modèles GLB (sans jamais modifier l'original).
// Utilisé par la ligne de commande (cli.js) et par le serveur MCP (mcp.js).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, quantize, meshopt, draco, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import validator from 'gltf-validator';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');

// ---------- garde-fous : racines autorisées, originaux en lecture seule ----------
export function roots() {
  const env = process.env.ATELIER_ROOTS;
  const list = env ? env.split(path.delimiter).filter(Boolean) : [REPO_ROOT];
  return list.map(r => fs.realpathSync(path.resolve(r)));
}
const within = (p, r) => p === r || p.startsWith(r + path.sep);
export function safeInput(p) {
  const rs = roots(); const cand = path.isAbsolute(p) ? [p] : [...rs.map(r => path.resolve(r, p)), path.resolve(process.cwd(), p)];   // relatif aux racines, sinon au dossier courant
  for (const c of cand) { if (!fs.existsSync(c)) continue; const real = fs.realpathSync(c); const root = rs.find(r => within(real, r));
    if (!root) throw new Error('Chemin hors des dossiers autorisés : ' + p);
    if (!/\.(glb|gltf)$/i.test(real)) throw new Error('Seuls les fichiers .glb et .gltf sont pris en charge (FBX : à convertir d\'abord) : ' + p);
    return { file: real, root }; }
  if (cand.length && path.isAbsolute(p) && !rs.some(r => within(path.resolve(p), r))) throw new Error('Chemin hors des dossiers autorisés : ' + p);
  throw new Error('Fichier introuvable : ' + p);
}
const slugify = s => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'modele';

// ---------- E/S glTF ----------
let _io = null;
async function getIO() {
  if (_io) return _io;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  _io = new NodeIO().setLogger(new Logger(Logger.Verbosity.SILENT)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
    'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  return _io;
}
export async function readDoc(file) { const io = await getIO(); return io.read(file); }
export async function sizeOf(doc) { const io = await getIO(); return (await io.writeBinary(doc)).byteLength; }

// ---------- mesures ----------
function primTris(p) { const idx = p.getIndices(), pos = p.getAttribute('POSITION'); const n = idx ? idx.getCount() : (pos ? pos.getCount() : 0); const mode = p.getMode(); return mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0; }
function accBytes(accs) { let b = 0; accs.forEach(a => { const arr = a.getArray(); if (arr) b += arr.byteLength; }); return b; }
function primAccessors(p) { const s = new Set(); p.listAttributes().forEach(a => s.add(a)); const i = p.getIndices(); if (i) s.add(i); p.listTargets().forEach(t => t.listAttributes().forEach(a => s.add(a))); return s; }

export function metrics(doc) {
  const root = doc.getRoot(); let tris = 0; root.listMeshes().forEach(m => m.listPrimitives().forEach(p => { tris += primTris(p); }));
  return { triangles: Math.round(tris), noeuds: root.listNodes().length, maillages: root.listMeshes().length, materiaux: root.listMaterials().length, textures: root.listTextures().length, animations: root.listAnimations().length, peaux: root.listSkins().length };
}

export async function inspectDoc(doc, { arbre = false } = {}) {
  const root = doc.getRoot(); const joints = new Set(); root.listSkins().forEach(s => s.listJoints().forEach(j => joints.add(j)));
  const meshes = root.listMeshes().map(m => { const accs = new Set(); let tris = 0, verts = 0; const mats = new Set();
    m.listPrimitives().forEach(p => { tris += primTris(p); const pos = p.getAttribute('POSITION'); verts += pos ? pos.getCount() : 0; primAccessors(p).forEach(a => accs.add(a)); const mt = p.getMaterial(); if (mt) mats.add(mt.getName()); });
    return { nom: m.getName() || '(sans nom)', primitives: m.listPrimitives().length, triangles: Math.round(tris), sommets: verts, octets: accBytes(accs), materiaux: [...mats] }; });
  const materials = root.listMaterials().map(m => ({ nom: m.getName(), textures: ['BaseColor', 'MetallicRoughness', 'Normal', 'Occlusion', 'Emissive'].map(k => m['get' + k + 'Texture']?.()).filter(Boolean).map(t => t.getName() || t.getURI() || '(sans nom)') }));
  const textures = root.listTextures().map(t => { const img = t.getImage(); const size = (() => { try { return t.getSize(); } catch { return null; } })();
    return { nom: t.getName() || t.getURI() || '(sans nom)', type: t.getMimeType(), taille: size, octets: img ? img.byteLength : 0 }; });
  const animations = root.listAnimations().map(a => { let dur = 0; const accs = new Set(); a.listSamplers().forEach(s => { const i = s.getInput(), o = s.getOutput(); if (i) { accs.add(i); dur = Math.max(dur, i.getMax([])[0] ?? 0); } if (o) accs.add(o); });
    return { nom: a.getName(), duree: +dur.toFixed(3), canaux: a.listChannels().length, octets: accBytes(accs) }; });
  const out = { octets_fichier: await sizeOf(doc), ...metrics(doc), extensions: root.listExtensionsUsed().map(e => e.extensionName), maillages_detail: meshes, materiaux_detail: materials, textures_detail: textures, animations_detail: animations };
  if (arbre) { const walk = (n, d) => ({ nom: n.getName() || '(sans nom)', maillage: n.getMesh()?.getName() || undefined, os: joints.has(n) || undefined, enfants: n.listChildren().map(c => walk(c, d + 1)) });
    out.arbre = root.listScenes().flatMap(s => s.listChildren().map(n => walk(n, 0))); }
  return out;
}
export async function inspectFile(p, opts) { const { file } = safeInput(p); const doc = await readDoc(file); const r = await inspectDoc(doc, opts); r.fichier = path.relative(REPO_ROOT, file) || file; return r; }

// ---------- sélection de nœuds ----------
const globRe = g => new RegExp('^' + g.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
function matchNodes(doc, { noms, motif, maillages }) {
  const tests = [...(noms || []), ...(motif ? [motif] : [])].map(globRe), ms = (maillages || []).map(globRe);
  return doc.getRoot().listNodes().filter(n => tests.some(t => t.test(n.getName())) || (n.getMesh() && ms.some(t => t.test(n.getMesh().getName()))));
}
const jointSet = doc => { const s = new Set(); doc.getRoot().listSkins().forEach(k => k.listJoints().forEach(j => s.add(j))); return s; };
const descendants = n => { const o = [n]; n.listChildren().forEach(c => o.push(...descendants(c))); return o; };
const cleanup = doc => doc.transform(prune({ keepLeaves: true }));   // garde les nœuds vides (points d'attache comme « Weapon »)

// ---------- opérations ----------
export const OPS = {
  // supprime des nœuds (et leurs enfants) ; refuse les os d'une peau et tout nœud qui en contient
  async supprimer(doc, p) {
    const joints = jointSet(doc), found = matchNodes(doc, p), refused = [], removed = [];
    const seen = new Set(found);
    found.forEach(n => { if ([...seen].some(o => o !== n && descendants(o).includes(n))) return;                 // déjà couvert par un parent sélectionné
      const sub = descendants(n); if (sub.some(d => joints.has(d))) { refused.push(n.getName() + (joints.has(n) ? '' : ' (contient des os)')); return; }
      sub.forEach(d => { removed.push(d.getName()); d.dispose(); }); });
    await cleanup(doc);
    return `${removed.length} nœud(s) supprimé(s)` + (refused.length ? `, refusé(s) car os de squelette : ${refused.join(', ')}` : '') + (found.length ? '' : ' (aucun nœud trouvé)');
  },
  // ne garde que la sélection (avec ses ancêtres et, pour un maillage skinné, son squelette)
  async extraire(doc, p) {
    const sel = matchNodes(doc, p); if (!sel.length) throw new Error('Aucun nœud ne correspond à la sélection');
    const keep = new Set(); const addUp = n => { for (let c = n; c; c = c.getParentNode()) keep.add(c); };
    sel.forEach(n => { descendants(n).forEach(d => keep.add(d)); addUp(n); });
    [...keep].forEach(n => { const sk = n.getSkin(); if (sk) { sk.listJoints().forEach(j => { descendants(j).forEach(d => keep.add(d)); addUp(j); }); } });
    doc.getRoot().listNodes().forEach(n => { if (!keep.has(n)) n.dispose(); });
    const anims = doc.getRoot().listAnimations();
    if (!p.garder_animations) anims.forEach(a => a.dispose()); else anims.forEach(a => { a.listChannels().forEach(c => { if (!c.getTargetNode()) c.dispose(); }); if (!a.listChannels().length) a.dispose(); });
    await cleanup(doc); return `sélection de ${sel.length} nœud(s) extraite (${keep.size} nœuds conservés avec ancêtres et squelette)`;
  },
  // réduit le nombre de triangles (ratio = part conservée)
  async simplifier(doc, { ratio = 0.5, erreur = 0.01, bord_verrouille = true } = {}) {
    const before = metrics(doc).triangles;
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: erreur, lockBorder: bord_verrouille })); await cleanup(doc);
    const after = metrics(doc).triangles; return `triangles ${before} vers ${after} (ratio demandé ${ratio})`;
  },
  // quantification et compression de la géométrie
  async compresser(doc, { mode = 'quantifier' } = {}) {
    await doc.transform(dedup(), weld(), quantize());
    if (mode === 'meshopt') await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    else if (mode === 'draco') await doc.transform(draco());
    await cleanup(doc); return `géométrie : ${mode}` + (mode === 'meshopt' ? ' (le chargeur doit fournir le décodeur Meshopt)' : mode === 'draco' ? ' (le chargeur doit fournir le décodeur Draco)' : ' (KHR_mesh_quantization, sans décodeur)');
  },
  // redimensionne et recompresse les textures
  async textures(doc, { taille_max = 1024, format = 'webp', qualite = 80 } = {}) {
    const n = doc.getRoot().listTextures().length; if (!n) return 'aucune texture';
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: format === 'garder' ? undefined : format, resize: [taille_max, taille_max], quality: qualite }));
    return `${n} texture(s) limitée(s) à ${taille_max} px, format ${format}` + (format === 'webp' ? ' (EXT_texture_webp)' : '');
  },
  // garde ou supprime des clips ; rééchantillonne pour retirer les images clés inutiles
  async animations(doc, { garder, supprimer, reechantillonner = false, tolerance = 1e-4 } = {}) {
    const all = doc.getRoot().listAnimations(); let dropped = 0;
    const keepT = (garder || []).map(globRe), dropT = (supprimer || []).map(globRe);
    all.forEach(a => { const name = a.getName(); const del = (keepT.length && !keepT.some(t => t.test(name))) || dropT.some(t => t.test(name)); if (del) { a.dispose(); dropped++; } });
    if (reechantillonner) await doc.transform(resample({ tolerance }));
    await cleanup(doc); return `${dropped} clip(s) supprimé(s), ${all.length - dropped} conservé(s)` + (reechantillonner ? `, rééchantillonnage (tolérance ${tolerance})` : '');
  },
  // doublons et ressources inutilisées
  async nettoyer(doc) { await doc.transform(dedup()); await cleanup(doc); return 'doublons fusionnés, ressources inutilisées retirées'; },
};

// applique une recette (liste d'opérations) en mémoire ; renvoie les notes de chaque pas
export async function applyRecipe(doc, ops) {
  const steps = [];
  for (const o of ops) { const { op, ...params } = o; const fn = OPS[op]; if (!fn) throw new Error('Opération inconnue : ' + op + ' (disponibles : ' + Object.keys(OPS).join(', ') + ')');
    const note = await fn(doc, params); steps.push({ op, params, note, ...metrics(doc) }); }
  return steps;
}

// ---------- validation glTF : le dérivé ne doit introduire aucune erreur absente de la base ----------
async function validationCodes(bytes) {
  const r = await validator.validateBytes(new Uint8Array(bytes), { maxIssues: 0 }); const codes = {};
  r.issues.messages.filter(m => m.severity === 0).forEach(m => { codes[m.code] = (codes[m.code] || 0) + 1; }); return { erreurs: r.issues.numErrors, codes };
}
// ---------- dérivés ----------
const sha8 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
export async function derive({ entree, nom, ops, a_blanc = false }) {
  const { file, root } = safeInput(entree); const bytes = fs.readFileSync(file);
  const doc = await readDoc(file); const avant = { octets: bytes.byteLength, ...metrics(doc) };
  const pas = await applyRecipe(doc, ops); const io = await getIO(); const out = await io.writeBinary(doc); const apres = { octets: out.byteLength, ...metrics(doc) };
  const vb = await validationCodes(bytes), vd = await validationCodes(out);
  const validation = { erreurs_base: vb.erreurs, erreurs_derive: vd.erreurs, nouveaux_codes: Object.keys(vd.codes).filter(c => !(c in vb.codes)), codes_base: vb.codes };
  const pct = (a, b) => (a ? +(100 * (b - a) / a).toFixed(1) : 0);
  const rapport = { base: { chemin: path.relative(root, file), sha256_8: sha8(bytes) }, avant, apres, variation_octets_pct: pct(avant.octets, apres.octets), variation_triangles_pct: pct(avant.triangles, apres.triangles), validation, pas,
    a_verifier: 'ouvrir le dérivé dans l\'atelier : rendu, animations, tenue des armes' };
  if (a_blanc) return { ecrit: false, rapport };
  const slug = slugify(nom || path.basename(file)); const dRoot = path.join(root, 'derives'); fs.mkdirSync(dRoot, { recursive: true });
  const versions = fs.readdirSync(dRoot).map(d => d.match(new RegExp('^' + slug + '_v(\\d+)$'))).filter(Boolean).map(m => +m[1]); const v = (versions.length ? Math.max(...versions) : 0) + 1;
  const dir = path.join(dRoot, `${slug}_v${v}`); if (fs.existsSync(dir)) throw new Error('Le dossier existe déjà : ' + dir); fs.mkdirSync(dir);
  const fname = `${slug}_v${v}.glb`; fs.writeFileSync(path.join(dir, fname), out);
  const recette = { outil: 'atelier-mcp', version: v, base: rapport.base, ops, cree_le: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(path.join(dir, 'recette.json'), JSON.stringify(recette, null, 1)); fs.writeFileSync(path.join(dir, 'rapport.json'), JSON.stringify(rapport, null, 1));
  const baseFiche = readJson(path.join(path.dirname(file), 'fiche.json')) || {};   // la licence se transmet (la plus restrictive : ici celle de la base)
  const fiche = { id: 'derive.' + slug, nom: `${baseFiche.nom || path.basename(file)} (dérivé v${v})`, type: baseFiche.type || 'Modèle', nature: 'Dérivé', version: v, derive_de: [baseFiche.id || rapport.base.chemin],
    auteur: 'dérivé', licence: baseFiche.licence || 'Inconnue', redistribuable: baseFiche.redistribuable || 'à vérifier', famille_squelette: baseFiche.famille_squelette, source: `atelier-mcp : ${ops.map(o => o.op).join(', ')}`, recu_le: recette.cree_le,
    notes: 'À vérifier dans l\'atelier avant usage. Ajouter une ligne à CATALOGUE.md et une fiche Notion si le dérivé est retenu.',
    fichiers: [fname, 'recette.json', 'rapport.json'].map(f => { const b = fs.readFileSync(path.join(dir, f)); return { chemin: f, sha256_8: sha8(b), octets: b.byteLength }; }) };
  fs.writeFileSync(path.join(dir, 'fiche.json'), JSON.stringify(fiche, null, 1));
  return { ecrit: true, dossier: path.relative(root, dir), fichier: path.join(path.relative(root, dir), fname), rapport };
}
export function readReport(dossier) {
  const rs = roots(); const cand = path.isAbsolute(dossier) ? [dossier] : rs.map(r => path.resolve(r, dossier));
  for (const c of cand) { const f = path.join(c, 'rapport.json'); if (fs.existsSync(f)) { const real = fs.realpathSync(f); if (!rs.some(r => within(real, r))) throw new Error('Chemin hors des dossiers autorisés'); return JSON.parse(fs.readFileSync(real, 'utf8')); } }
  throw new Error('Rapport introuvable dans : ' + dossier);
}
export function listAssets(sous = '') {
  const out = []; for (const r of roots()) { const start = path.resolve(r, sous); if (!within(start, r) || !fs.existsSync(start)) continue;
    (function walk(d, depth) { if (depth > 6) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1); else if (/\.(glb|gltf)$/i.test(e.name)) out.push({ chemin: path.relative(r, p), octets: fs.statSync(p).size }); } })(start, 0); }
  return out;
}
