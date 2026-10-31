// Entrées : clavier, joystick tactile/souris, boutons. Produit une direction écran -> monde ; les actions passent par des rappels.
import * as THREE from 'three';
import { hyp } from './util.js';
import { SCREEN_RIGHT, SCREEN_UP } from './stage.js';

export function createInput({ onJump, onAttack }) {
  const keys = {}, stick = { x:0, y:0 };
  const keyOf = e => e.key.toLowerCase();
  window.addEventListener('keydown', e => { const k = keyOf(e); if (k === ' ' || k === 'j' || k === 'enter' || k.startsWith('arrow')) e.preventDefault();
    if (!keys[k]) { if (k === ' ') onJump(); if (k === 'j' || k === 'enter') onAttack(); } keys[k] = true; });
  window.addEventListener('keyup', e => { keys[keyOf(e)] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // joystick tactile / souris
  const stickEl = document.getElementById('stick'), knob = stickEl.querySelector('.knob'); const R = 52; let stickId = null;
  function stickMove(e) {
    const r = stickEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = hyp(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; stick.x = dx / R; stick.y = dy / R;
  }
  stickEl.addEventListener('pointerdown', e => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); stickMove(e); e.preventDefault(); });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', stickEnd); stickEl.addEventListener('pointercancel', stickEnd);

  // boutons ; held[id] = bouton maintenu (tir en continu)
  const held = {};
  function bind(id, fn) { const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { el.classList.add('on'); held[id] = true; fn(); e.preventDefault(); });
    const off = () => { el.classList.remove('on'); held[id] = false; }; el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
  bind('bAtk', onAttack); bind('bJmp', onJump);
  const attackHeld = () => !!(keys.j || keys.enter || held.bAtk);
  document.addEventListener('contextmenu', e => e.preventDefault());

  // direction de déplacement dans le monde + intensité (0 à 1)
  const out = { dir: new THREE.Vector3(), mag: 0 };   // réutilisé (valable jusqu'à l'appel suivant)
  function read() {
    let x = stick.x, y = stick.y;                                     // x droite, y bas (écran)
    const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.q || keys.a ? 1 : 0);
    const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.z || keys.w ? 1 : 0);
    if (kx || ky) { const l = hyp(kx, ky); x = kx / l; y = ky / l; }
    const m = Math.min(hyp(x, y), 1); if (m < 0.12) { out.dir.set(0, 0, 0); out.mag = 0; return out; }
    out.dir.set(0, 0, 0).addScaledVector(SCREEN_RIGHT, x).addScaledVector(SCREEN_UP, -y).setY(0).normalize(); out.mag = m;
    return out;
  }
  return { keys, stick, read, attackHeld };
}
