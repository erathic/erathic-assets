// Scène, rendu, caméra orthographique isométrique et suivi du joueur.
import * as THREE from 'three';
import { C, VIEW, CAM_OFFSET, CAM_FOLLOW, CAM_SMOOTH } from './config.js';

// base écran -> monde de la vue isométrique
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize(), SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();

export function createStage(host, { view = VIEW } = {}) {
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
  return { renderer, scene, cam, resize, follow, render };
}
