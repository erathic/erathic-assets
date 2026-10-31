// Atelier Erathic : point d'entrée. Assemble le viewer, les chargeurs, les animations et les outils autour du panneau HTML.
import * as THREE from 'three';
import { createGore } from '../gore.js';
import { BLOOD } from '../config.js';
import { zMat } from '../materials.js';
import { createViewer } from './viewer.js';
import { loadRobot, loadRobotSword, loadZombie, makeDemoSword, loadFile } from './assets.js';
import { createAnim, suggestFade } from './anim.js';
import { MODELS, GUN_QUAT } from '../survie/weapons.js';
import { inspect, prepareMaterials, applyMaterialMode, setWireframe, createHelpers, createWeaponTool, createDismember } from './tools.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

const viewer = createViewer($('view'));
const anim = createAnim(), helpers = createHelpers(viewer), wtool = createWeaponTool(viewer);
const gore = createGore({ scene:viewer.scene, half:5, palette:BLOOD }), dis = createDismember(gore, zMat);
let obj = null, wire = false, weaponFile = null, dragging = false, sc = 1, localH = 1;

const msg = t => { $('msg').textContent = t || ''; };

// ---------- affichage d'un objet ----------
const MAT_LABELS = { defaut:'Shaders Erathic (comme dans le jeu)', original:'Matériaux d\'origine', gris:'Gris Erathic', normales:'Normales' };
function fillMaterials() {
  const opts = []; if (obj.game || obj.kind === 'weapon') opts.push('defaut'); if (obj.hasOriginal) opts.push('original'); opts.push('gris', 'normales');
  $('matMode').replaceChildren(...opts.map(v => { const o = el('option', null, MAT_LABELS[v]); o.value = v; return o; }));
}
function setObject(o) {
  if (obj) { wtool.detach(); gore.clear(); }
  viewer.stage.clear(); obj = o; viewer.stage.add(o.root); o.root.updateMatrixWorld(true); prepareMaterials(o.root); helpers.set(o.root);
  fillMaterials(); $('matMode').value = o.game || o.kind === 'weapon' ? 'defaut' : 'original'; applyMaterialMode(o.root, $('matMode').value, wire);
  $('bSkel').classList.remove('on'); $('bBox').classList.remove('on');
  const f = viewer.frame(o.root); sc = o.root.scale.y || 1; localH = f ? f.size.y / sc : 1;
  anim.set(o.root, o.clips); buildClips(); buildTransition(); buildWeapon(); buildGore(); refreshInfo();
  document.querySelectorAll('#objBtns button').forEach(b => b.classList.toggle('on', b.dataset.k === o.kind));
  $('secAnim').classList.toggle('hide', !o.clips.length); $('secTrans').classList.toggle('hide', o.clips.length < 2);
  $('bHideSword').classList.toggle('hide', o.kind !== 'robot');
  const idle = o.clips.find(c => /idle/i.test(c.name)) || o.clips[0]; if (idle) playClip(idle);
  msg('');
}
function refreshInfo() {
  const i = inspect(obj.root), kv = $('info'); kv.replaceChildren();
  [['Nom', obj.name], ['Triangles', i.tris.toLocaleString('fr-FR')], ['Maillages', i.meshes + (i.skinned ? ' (' + i.skinned + ' skinnés)' : '')], ['Os', i.bones || '—'],
   ['Taille', i.size.join(' × ') + ' (unités du modèle affiché)'], ['Matériaux', i.materials.join(', ') || '—'], ['Clips', obj.clips.length]]
    .forEach(([k, v]) => { kv.append(el('b', null, k), el('span', null, String(v))); });
}

// ---------- animations ----------
function buildClips() {
  const box = $('clips'); box.replaceChildren(); let g = '';
  obj.clips.forEach((c, idx) => { if (c.group !== g) { g = c.group; box.append(el('div', 'g', g)); }
    const row = el('div', 'c'); row.dataset.i = idx; row.append(el('span', null, c.name), el('i', null, c.clip.duration.toFixed(2) + ' s')); row.onclick = () => playClip(c); box.append(row); });
}
function playClip(c) {
  anim.play(c, { fade:0.2, loop:$('bLoop').classList.contains('on') });
  document.querySelectorAll('#clips .c').forEach(r => r.classList.toggle('on', obj.clips[+r.dataset.i] === c));
  $('bPlay').textContent = 'pause'; $('tline').max = c.clip.duration;
}
$('bPlay').onclick = () => { const p = !anim.paused; anim.pause(p); $('bPlay').textContent = p ? 'lecture' : 'pause'; };
$('bLoop').onclick = e => { e.target.classList.toggle('on'); anim.setLoop(e.target.classList.contains('on')); };
$('speed').oninput = e => { anim.speed(+e.target.value); $('speedV').textContent = e.target.value; };
$('tline').addEventListener('pointerdown', () => { dragging = true; }); $('tline').addEventListener('pointerup', () => { dragging = false; });
$('tline').oninput = e => { anim.setTime(+e.target.value); $('bPlay').textContent = 'lecture'; };

// ---------- transitions ----------
function buildTransition() {
  [$('tA'), $('tB')].forEach((s, k) => { s.replaceChildren(...obj.clips.map((c, i) => { const o = el('option', null, c.group.split(' ')[0] + ' : ' + c.name); o.value = i; return o; })); s.value = Math.min(k, obj.clips.length - 1); });
  $('gapRes').textContent = '';
}
const pair = () => [obj.clips[+$('tA').value], obj.clips[+$('tB').value]];
function measure() {
  const [A, B] = pair(); if (!A || !B) return null; const r = anim.gap(A, +$('tAt').value, B), t = anim.gameFade(A, B);
  if (!r) return null; $('tFade').value = (t ? t.fade : r.suggested).toFixed(2); if (t) $('bSync').classList.toggle('on', t.sync);
  $('gapRes').textContent = `écart moyen ${r.mean}°, pire os ${r.bone} (${r.worst}°), fondu suggéré ${r.suggested} s` + (t ? `, table du jeu ${t.fade} s${t.sync ? ' (synchronisé)' : ''}` : ''); return r;
}
$('bGap').onclick = measure; $('bSync').onclick = e => e.target.classList.toggle('on');
$('bTrans').onclick = () => { const [A, B] = pair(); anim.transition(A, B, { tA:+$('tAt').value, hold:+$('tHold').value, fade:+$('tFade').value, sync:$('bSync').classList.contains('on') });
  document.querySelectorAll('#clips .c').forEach(r => r.classList.remove('on')); $('bPlay').textContent = 'pause'; };

// ---------- tenue d'arme ----------
let ctl = {};
function slider(parent, key, label, min, max, step, val, fmt = v => v.toFixed(3)) {
  const row = el('div', 'row'), lab = el('label', null, label), inp = el('input'), out = el('span', null, fmt(val)); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
  inp.oninput = () => { out.textContent = fmt(+inp.value); applyWeapon(); }; row.append(lab, inp, out); parent.append(row); ctl[key] = inp; return inp;
}
function buildWeapon() {
  const bones = wtool.bonesOf(obj.root); $('secWeapon').classList.toggle('hide', !bones.length); if (!bones.length) return;
  $('wBone').replaceChildren(...bones.map(b => { const o = el('option', null, b); o.value = b; return o; })); $('wBone').value = bones.includes('Weapon') ? 'Weapon' : bones.find(b => /hand.*r|right.*hand|hand_r/i.test(b)) || bones[0];
  $('wJson').value = ''; $('wCtl').replaceChildren(); ctl = {};
}
function weaponControls(def) {
  const w = $('wCtl'); w.replaceChildren(); ctl = {}; const r = localH * 0.35, rf = v => v.toFixed(0) + '°';
  [['px', 'x', -r], ['py', 'y', -r], ['pz', 'z', -r]].forEach(([k, l]) => slider(w, k, 'position ' + l, -r, r, r / 200, 0));
  ['rx', 'ry', 'rz'].forEach((k, i) => slider(w, k, 'rotation ' + 'xyz'[i], -180, 180, 1, def ? def.rot[i] : 0, rf));
  slider(w, 's', 'échelle', 0.05, 4 / sc, 0.005 / sc, def ? def.scale : 1 / sc);
}
function applyWeapon() {
  if (!wtool.attached) return; const g = k => +ctl[k].value;
  wtool.set({ pos:[g('px'), g('py'), g('pz')], rot:[g('rx'), g('ry'), g('rz')], scale:g('s') }); $('wJson').value = JSON.stringify(wtool.json(), null, 1);
}
$('bWFile').onclick = () => $('wFile').click();
$('wFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { weaponFile = await loadFile(f); prepareMaterials(weaponFile.root); $('wSrc').value = 'file'; $('wFileName').textContent = f.name + ' prêt'; } catch (err) { msg(String(err.message || err)); } };
$('bWAttach').onclick = () => {
  const src = $('wSrc').value; let def = null, w;
  if (src.startsWith('game:')) { const id = src.slice(5), e = new THREE.Euler().setFromQuaternion(GUN_QUAT), gun = id === 'pistol' || id === 'mg' || id === 'laser';   // modèles du jeu : mêmes repères et mêmes unités que dans le jeu
    w = { root: MODELS[id](), name: 'jeu : ' + id }; def = { rot: gun ? [e.x, e.y, e.z].map(r => Math.round(r * 180 / Math.PI)) : [0, 0, 0], scale: 1 }; }
  else w = src === 'file' ? weaponFile : makeDemoSword();
  if (!w) { msg('Choisir d\'abord un fichier d\'arme.'); return; }
  try { wtool.attach(obj.root, w.root, w.name, $('wBone').value, localH * 0.08); } catch (err) { msg(err.message); return; }
  weaponControls(def); applyWeapon(); wtool.showAxes($('bWAxes').classList.contains('on')); msg('');
};
$('bWDetach').onclick = () => { wtool.detach(); $('wJson').value = ''; $('wCtl').replaceChildren(); };
$('bWAxes').onclick = e => { e.target.classList.toggle('on'); wtool.showAxes(e.target.classList.contains('on')); };
$('bHideSword').onclick = e => { if (!obj.sword) return; obj.sword.visible = !obj.sword.visible; e.target.classList.toggle('on', !obj.sword.visible); };
$('bWCopy').onclick = async () => { const t = $('wJson').value; if (!t) return; try { await navigator.clipboard.writeText(t); } catch { $('wJson').select(); document.execCommand('copy'); } };
// enregistrement d'un fichier : capacité « downloads » de l'artefact (confirmation du lecteur) ; en usage local, lien de téléchargement classique
async function saveFile(name, data) {
  try { const d = window.claude && await window.claude.use('downloads'); if (d) { await d.save({ filename:name, data }); return; } } catch (err) { if (err && err.code === 'declined') return; }
  const a = el('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type:'application/json' })); a.download = name; a.click();
}
const dataUrlToBlob = u => { const [h, b] = u.split(','), bin = atob(b), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type:h.match(/:(.*?);/)[1] }); };
$('bWSave').onclick = () => { const t = $('wJson').value; if (t) saveFile('tenue_arme.json', t); };

// ---------- démembrement ----------
const GORE_LABELS = { head:'tête', armL:'bras gauche', armR:'bras droit', legL:'jambe gauche', legR:'jambe droite' };
function buildGore() {
  const box = $('goreBtns'); box.replaceChildren(); $('secGore').classList.toggle('hide', obj.kind !== 'zombie'); if (obj.kind !== 'zombie') return;
  dis.keys.forEach(k => { const b = el('button', null, GORE_LABELS[k] || k); b.onclick = () => dis.cut(obj, [k]); box.append(b); });
  const all = el('button', null, 'tout'); all.onclick = () => dis.cut(obj, dis.keys); const re = el('button', null, 'réinitialiser'); re.onclick = () => setObject(loadZombie()); box.append(all, re);
}

// ---------- affichage et repères ----------
$('matMode').onchange = e => applyMaterialMode(obj.root, e.target.value, wire);
$('bWire').onclick = e => { wire = !wire; e.target.classList.toggle('on', wire); setWireframe(obj.root, wire); };
$('bSkel').onclick = e => { e.target.classList.toggle('on'); helpers.skeleton(e.target.classList.contains('on')); };
$('bBox').onclick = e => { e.target.classList.toggle('on'); helpers.bbox(e.target.classList.contains('on')); };
$('bGrid').onclick = e => { e.target.classList.toggle('on'); viewer.grid.visible = e.target.classList.contains('on'); };
$('bSpin').onclick = e => { e.target.classList.toggle('on'); viewer.setSpin(e.target.classList.contains('on')); };
document.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => viewer.view(b.dataset.v); });
$('bFrame').onclick = () => viewer.frame(obj.root);
// l'image s'affiche dans la page, puis « enregistrer » (ou clic droit, appui long)
function showImage(url, name) {
  const box = $('shot'); box.replaceChildren(); const img = el('img'); img.src = url; const bar = el('div', 'row');
  const dl = el('button', null, 'enregistrer'); dl.onclick = () => saveFile(name + '.png', dataUrlToBlob(url)); const close = el('button', null, 'fermer'); close.onclick = () => { box.style.display = 'none'; };
  bar.append(close, dl, el('span', 'note', 'Ou clic droit, appui long sur l\'image.')); box.append(bar, img); box.style.display = 'flex';
}
const slug = () => obj.name.replace(/\W+/g, '_');
$('bShot').onclick = () => showImage(viewer.capture(), slug());
$('bSheet').onclick = () => showImage(viewer.sheet().url, 'planche_' + slug());

// ---------- choix de l'objet et dépôt de fichier ----------
const KINDS = [['robot', 'Robot', loadRobot], ['sword', 'Épée du robot', loadRobotSword], ['zombie', 'Zombie', async () => loadZombie()], ['weapon', 'Épée de démo', async () => makeDemoSword()]];
KINDS.forEach(([k, label, fn]) => { const b = el('button', null, label); b.dataset.k = k; b.onclick = async () => { try { setObject(await fn()); } catch (err) { msg(String(err.message || err)); } }; $('objBtns').append(b); });
async function openFile(f) { try { setObject(await loadFile(f)); } catch (err) { msg(String(err.message || err)); } }
$('drop2').onclick = () => $('file').click(); $('file').onchange = e => { if (e.target.files[0]) openFile(e.target.files[0]); };
window.addEventListener('dragover', e => { e.preventDefault(); $('drop').style.display = 'flex'; });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').style.display = 'none'; });
window.addEventListener('drop', e => { e.preventDefault(); $('drop').style.display = 'none'; const f = e.dataTransfer.files[0]; if (f) openFile(f); });

// ---------- boucle ----------
let hudT = 0;
viewer.onFrame(dt => {
  anim.update(dt); gore.update(dt); helpers.update();
  if (!dragging && anim.current) { $('tline').value = anim.time(); $('tval').textContent = anim.time().toFixed(2) + ' / ' + anim.duration.toFixed(2) + ' s'; }
  hudT += dt; if (hudT > 0.4) { hudT = 0; const s = viewer.stats(); $('hud').textContent = `${s.fps} ips\n${s.calls} appels de rendu\n${Math.round(s.tris).toLocaleString('fr-FR')} triangles`; }
});

(async () => { setObject(await loadRobot()); })().catch(err => msg(String(err.message || err)));

// accès pour les tests automatisés
window.__lab = { MODELS, GUN_QUAT, viewer, anim, wtool, gore, dis, setObject, loadRobot, loadRobotSword, loadZombie, makeDemoSword, loadFile, openFile, get obj() { return obj; }, measure, inspect, THREE, suggestFade };
