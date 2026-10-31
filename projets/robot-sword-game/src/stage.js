// Scène, rendu, caméra orthographique isométrique et suivi du joueur.
import * as THREE from 'three';
import { C, VIEW, CAM_OFFSET, CAM_FOLLOW, CAM_SMOOTH } from './config.js';

// base écran -> monde de la vue isométrique
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize(), SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();

// orbit : permet de tourner, incliner et zoomer la caméra (glisser, molette, pincer, double-clic pour recentrer) ; la base de déplacement SCREEN_RIGHT/SCREEN_UP suit l'angle
export function createStage(host, { view = VIEW, orbit = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(C.noir, 1);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camOff = new THREE.Vector3(...CAM_OFFSET), camT = new THREE.Vector3();
  const cam = new THREE.OrthographicCamera(-view, view, view, -view, 4, 40);
  cam.position.copy(camOff); cam.lookAt(0, 0.3, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(7, 9, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-7, 2, -4); scene.add(rim);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight, a = w / h;
    renderer.setSize(w, h, false);
    if (a >= 1) { cam.left = -view * a; cam.right = view * a; cam.top = view; cam.bottom = -view; }
    else { cam.left = -view; cam.right = view; cam.top = view / a; cam.bottom = -view / a; }
    cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // ---------- caméra orbitale (facultative) ----------
  const R = camOff.length(), YAW0 = Math.atan2(camOff.x, camOff.z), PITCH0 = Math.asin(camOff.y / R), PITCH_MIN = 0.32, PITCH_MAX = 1.25, ZOOM_MIN = 0.55, ZOOM_MAX = 2.6;
  const camCtl = { yaw: YAW0, pitch: PITCH0, zoom: 1,
    apply() { this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch)); this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom));
      const y = this.yaw, p = this.pitch; camOff.set(R * Math.sin(y) * Math.cos(p), R * Math.sin(p), R * Math.cos(y) * Math.cos(p));
      SCREEN_RIGHT.set(Math.cos(y), 0, -Math.sin(y)); SCREEN_UP.set(-Math.sin(y), 0, -Math.cos(y));     // le joystick suit l'angle de la caméra
      cam.zoom = this.zoom; cam.updateProjectionMatrix(); },
    set(o) { Object.assign(this, o); this.apply(); }, reset() { this.set({ yaw: YAW0, pitch: PITCH0, zoom: 1 }); } };
  if (orbit) {
    const pts = new Map(); let pinch = 0; const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    host.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) pinch = dist(); });
    host.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) camCtl.set({ yaw: camCtl.yaw - dx * 0.006, pitch: camCtl.pitch + dy * 0.004 });
      else if (pts.size === 2) { const d = dist(); if (pinch > 0) camCtl.set({ zoom: camCtl.zoom * d / pinch }); pinch = d; } });
    const up = e => { pts.delete(e.pointerId); pinch = 0; }; host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('pointerleave', up);
    host.addEventListener('wheel', e => { e.preventDefault(); camCtl.set({ zoom: camCtl.zoom * Math.exp(-e.deltaY * 0.0012) }); }, { passive: false });
    host.addEventListener('dblclick', () => camCtl.reset());
    window.addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') camCtl.set({ zoom: camCtl.zoom * 1.15 }); else if (e.key === '-' || e.key === '_') camCtl.set({ zoom: camCtl.zoom / 1.15 }); });
  }

  // la caméra suit la cible en douceur
  function follow(target, dt) {
    const f = 1 - Math.pow(CAM_SMOOTH, dt);
    camT.x += (target.x * CAM_FOLLOW - camT.x) * f; camT.z += (target.z * CAM_FOLLOW - camT.z) * f;
    cam.position.set(camT.x + camOff.x, camOff.y, camT.z + camOff.z); cam.lookAt(camT.x, 0.3, camT.z);
  }
  // perte du contexte graphique (fréquente sur mobile) : on autorise la restauration, three.js recharge alors ses ressources
  const lostEl = document.createElement('div');
  lostEl.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#1E1F22;color:#DBFF00;font:700 14px system-ui,sans-serif;letter-spacing:.12em;z-index:9';
  lostEl.textContent = 'CONTEXTE GRAPHIQUE PERDU, RESTAURATION EN COURS'; document.body.appendChild(lostEl);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); lostEl.style.display = 'flex'; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { lostEl.style.display = 'none'; });
  const render = () => renderer.render(scene, cam);
  return { renderer, scene, cam, resize, follow, render, camCtl };
}
