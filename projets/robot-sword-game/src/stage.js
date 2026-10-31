// Scène, rendu, caméra orthographique isométrique et suivi du joueur.
import * as THREE from 'three';
import { C, VIEW, CAM_OFFSET, CAM_FOLLOW, CAM_SMOOTH } from './config.js';

// base écran -> monde de la vue isométrique
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize(), SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();

export function createStage(host) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(C.noir, 1);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camOff = new THREE.Vector3(...CAM_OFFSET), camT = new THREE.Vector3();
  const cam = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 4, 40);
  cam.position.copy(camOff); cam.lookAt(0, 0.3, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(7, 9, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-7, 2, -4); scene.add(rim);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight, a = w / h;
    renderer.setSize(w, h, false);
    if (a >= 1) { cam.left = -VIEW * a; cam.right = VIEW * a; cam.top = VIEW; cam.bottom = -VIEW; }
    else { cam.left = -VIEW; cam.right = VIEW; cam.top = VIEW / a; cam.bottom = -VIEW / a; }
    cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // la caméra suit la cible en douceur
  function follow(target, dt) {
    const f = 1 - Math.pow(CAM_SMOOTH, dt);
    camT.x += (target.x * CAM_FOLLOW - camT.x) * f; camT.z += (target.z * CAM_FOLLOW - camT.z) * f;
    cam.position.set(camT.x + camOff.x, camOff.y, camT.z + camOff.z); cam.lookAt(camT.x, 0.3, camT.z);
  }
  const render = () => renderer.render(scene, cam);
  return { renderer, scene, cam, resize, follow, render };
}
