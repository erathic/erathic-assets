// Tests du noyau : inspection, opérations, dérivés, garde-fous. Aucune écriture hors d'un dossier temporaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Document, NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const REPO = path.resolve(import.meta.dirname, '../../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-'));
fs.mkdirSync(path.join(tmp, 'personnages/bot_v1'), { recursive: true });
fs.copyFileSync(path.join(REPO, 'personnages/bot_v1/Character-bot.glb'), path.join(tmp, 'personnages/bot_v1/Character-bot.glb'));
fs.copyFileSync(path.join(REPO, 'personnages/bot_v1/fiche.json'), path.join(tmp, 'personnages/bot_v1/fiche.json'));
process.env.ATELIER_ROOTS = tmp;
const core = await import('../src/core.js');
const BOT = 'personnages/bot_v1/Character-bot.glb';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const botSha = sha(path.join(tmp, BOT));
await MeshoptDecoder.ready;
const rio = new NodeIO().setLogger(new Logger(Logger.Verbosity.SILENT)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const read = f => rio.read(path.join(tmp, f));

test('inspection du robot', async () => {
  const r = await core.inspectFile(BOT, { arbre: true });
  assert.equal(r.animations, 22); assert.equal(r.peaux > 0, true); assert.equal(r.triangles > 7000, true);
  const names = []; (function w(a) { a.forEach(n => { names.push(n.nom); w(n.enfants); }); })(r.arbre);
  assert.ok(names.includes('Weapon') && names.includes('Sword') && names.includes('HandR'));
  assert.ok(r.maillages_detail.every(m => m.octets > 0));
});

test('supprimer : épée retirée, point d\'attache conservé, os refusés', async () => {
  const d = await core.derive({ entree: BOT, nom: 't_supp', a_blanc: true, ops: [{ op: 'supprimer', noms: ['Sword'] }] });
  assert.ok(d.rapport.apres.triangles < d.rapport.avant.triangles); assert.equal(d.rapport.apres.triangles, d.rapport.avant.triangles - 258);
  const d2 = await core.derive({ entree: BOT, nom: 't_supp2', a_blanc: true, ops: [{ op: 'supprimer', noms: ['HandR', 'Hips'] }] });
  assert.match(d2.rapport.pas[0].note, /refusé/); assert.equal(d2.rapport.apres.triangles, d2.rapport.avant.triangles);
  const w = await core.derive({ entree: BOT, nom: 't_supp', ops: [{ op: 'supprimer', noms: ['Sword'] }] });
  const doc = await read(w.fichier); assert.ok(doc.getRoot().listNodes().some(n => n.getName() === 'Weapon'), 'le nœud Weapon (point d\'attache) doit rester');
});

test('extraire : l\'épée seule, avec son squelette', async () => {
  const w = await core.derive({ entree: BOT, nom: 't_extr', ops: [{ op: 'extraire', noms: ['Sword'] }] });
  assert.equal(w.rapport.apres.triangles, 258); assert.equal(w.rapport.apres.animations, 0); assert.ok(w.rapport.apres.octets < w.rapport.avant.octets / 2);
  await assert.rejects(core.derive({ entree: BOT, nom: 'x', a_blanc: true, ops: [{ op: 'extraire', noms: ['Inexistant'] }] }), /Aucun nœud/);
});

test('simplifier : moins de triangles, GLB valide', async () => {
  const w = await core.derive({ entree: BOT, nom: 't_simp', ops: [{ op: 'simplifier', ratio: 0.5 }] });
  assert.ok(w.rapport.apres.triangles < w.rapport.avant.triangles * 0.8, `triangles ${w.rapport.avant.triangles} -> ${w.rapport.apres.triangles}`);
  assert.deepEqual(w.rapport.validation.nouveaux_codes, [], 'le dérivé ne doit pas introduire de nouvelle erreur glTF'); assert.ok(w.rapport.validation.erreurs_derive <= w.rapport.validation.erreurs_base);
});

test('compresser : quantifier et meshopt allègent le fichier, relisibles, triangles identiques', async () => {
  const q = await core.derive({ entree: BOT, nom: 't_q', ops: [{ op: 'compresser', mode: 'quantifier' }] });
  const m = await core.derive({ entree: BOT, nom: 't_m', ops: [{ op: 'compresser', mode: 'meshopt' }] });
  assert.ok(q.rapport.apres.octets < q.rapport.avant.octets * 0.6); assert.ok(m.rapport.apres.octets <= q.rapport.apres.octets);
  assert.equal(q.rapport.apres.triangles, q.rapport.avant.triangles); assert.equal(m.rapport.apres.triangles, m.rapport.avant.triangles);
  const docM = await read(m.fichier); assert.ok(docM.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression'));
  const docQ = await read(q.fichier); assert.ok(docQ.getRoot().listExtensionsUsed().some(e => e.extensionName === 'KHR_mesh_quantization'));
  for (const r of [q, m]) assert.deepEqual(r.rapport.validation.nouveaux_codes, [], 'nouvelles erreurs glTF : ' + JSON.stringify(r.rapport.validation));
});

test('animations : ne garder que certains clips', async () => {
  const w = await core.derive({ entree: BOT, nom: 't_anim', ops: [{ op: 'animations', garder: ['Idle_Sword', 'Walk', 'Run'] }] });
  assert.equal(w.rapport.apres.animations, 3); assert.ok(w.rapport.apres.octets < w.rapport.avant.octets);
  const w2 = await core.derive({ entree: BOT, nom: 't_anim2', a_blanc: true, ops: [{ op: 'animations', garder: ['Run*'] }] }); assert.equal(w2.rapport.apres.animations, 5);   // motif avec joker : Run, Run_Back, Run_Left, Run_Right, Run_Shoot
});

test('textures : réduction et conversion WebP', async () => {
  const doc = new Document(); const buf = doc.createBuffer(); const noise = Buffer.alloc(2048 * 2048 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761 >>> 24) & 255;
  const png = await sharp(noise, { raw: { width: 2048, height: 2048, channels: 3 } }).png().toBuffer();
  const tex = doc.createTexture('grain').setImage(new Uint8Array(png)).setMimeType('image/png'); const mat = doc.createMaterial('m').setBaseColorTexture(tex);
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buf); const prim = doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(mat);
  doc.createScene().addChild(doc.createNode('n').setMesh(doc.createMesh('mesh').addPrimitive(prim)));
  fs.mkdirSync(path.join(tmp, 'modeles'), { recursive: true }); await rio.write(path.join(tmp, 'modeles/texte.glb'), doc);
  const w = await core.derive({ entree: 'modeles/texte.glb', nom: 't_tex', ops: [{ op: 'textures', taille_max: 512, format: 'webp' }] });
  assert.ok(w.rapport.apres.octets < w.rapport.avant.octets * 0.3, `${w.rapport.avant.octets} -> ${w.rapport.apres.octets}`);
  const out = await read(w.fichier); const t = out.getRoot().listTextures()[0]; assert.equal(t.getMimeType(), 'image/webp'); assert.ok(Math.max(...t.getSize()) <= 512);
});

test('dérivé : dossier versionné, recette, rapport, fiche héritée, original intact', async () => {
  const a = await core.derive({ entree: BOT, nom: 'bot_leger', ops: [{ op: 'compresser', mode: 'quantifier' }] });
  const b = await core.derive({ entree: BOT, nom: 'bot_leger', ops: [{ op: 'nettoyer' }] });
  assert.equal(a.dossier, path.join('derives', 'bot_leger_v1')); assert.equal(b.dossier, path.join('derives', 'bot_leger_v2'));
  for (const f of ['bot_leger_v1.glb', 'recette.json', 'rapport.json', 'fiche.json']) assert.ok(fs.existsSync(path.join(tmp, a.dossier, f)), f);
  const fiche = JSON.parse(fs.readFileSync(path.join(tmp, a.dossier, 'fiche.json'), 'utf8')); const base = JSON.parse(fs.readFileSync(path.join(tmp, 'personnages/bot_v1/fiche.json'), 'utf8'));
  assert.equal(fiche.licence, base.licence); assert.equal(fiche.nature, 'Dérivé'); assert.deepEqual(fiche.derive_de, [base.id]);
  assert.equal(sha(path.join(tmp, BOT)), botSha, 'l\'original ne doit jamais changer');
  const rec = JSON.parse(fs.readFileSync(path.join(tmp, a.dossier, 'recette.json'), 'utf8')); assert.equal(rec.base.sha256_8, botSha.slice(0, 8));
  assert.equal(core.readReport(a.dossier).apres.octets, a.rapport.apres.octets);
});

test('à blanc : rien n\'est écrit', async () => {
  const before = fs.existsSync(path.join(tmp, 'derives')) ? fs.readdirSync(path.join(tmp, 'derives')).length : 0;
  const r = await core.derive({ entree: BOT, nom: 'bot_a_blanc', a_blanc: true, ops: [{ op: 'simplifier', ratio: 0.3 }] });
  assert.equal(r.ecrit, false); assert.equal(fs.readdirSync(path.join(tmp, 'derives')).length, before);
});

test('garde-fous : hors racine, format, opération inconnue', async () => {
  await assert.rejects(core.inspectFile('../../../etc/hostname'), /hors des dossiers|introuvable/i);
  await assert.rejects(core.inspectFile('/etc/hostname'), /hors des dossiers/);
  fs.writeFileSync(path.join(tmp, 'zombie.fbx'), 'x'); await assert.rejects(core.inspectFile('zombie.fbx'), /FBX/);
  fs.symlinkSync('/etc', path.join(tmp, 'lien')); fs.symlinkSync('/etc/hostname', path.join(tmp, 'lien.glb')); await assert.rejects(core.inspectFile('lien.glb'), /hors des dossiers/);
  await assert.rejects(core.derive({ entree: BOT, nom: 'x', a_blanc: true, ops: [{ op: 'detruire' }] }), /Opération inconnue/);
  assert.ok(core.listAssets().some(a => a.chemin === BOT));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
