// Atelier : rendu, caméra orbitale, lumières de la charte, grille, plateau tournant, captures.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C } from '../config.js';

export function createViewer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(C.noir, 1);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500); camera.position.set(3.2, 2.2, 4.2);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 0.9, 0);
  // mêmes lumières que le jeu (les shaders Erathic sont réglés pour elles)
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(7, 9, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-7, 2, -4); scene.add(rim);
  const grid = new THREE.GridHelper(10, 20, 0x3a3b40, 0x2F2F33); scene.add(grid);
  const stage = new THREE.Group(); scene.add(stage);               // contient l'objet affiché
  let spin = false, onFrame = null;

  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();

  // cadre l'objet : cible au centre de sa boîte, distance selon sa taille
  function frame(obj) {
    const box = new THREE.Box3().setFromObject(obj, true); if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), r = Math.max(size.x, size.y, size.z) || 1;
    const d = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.75;
    controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0.55, 0.3, 0.8).normalize().multiplyScalar(d));
    camera.near = r / 200; camera.far = r * 200; camera.updateProjectionMatrix(); controls.update();
    return { size, center: c };
  }
  function view(name) {                 // vues de contrôle autour de la cible, à distance constante
    const t = controls.target, d = camera.position.distanceTo(t), v = { face:[0, 0.1, 1], profil:[1, 0.1, 0], dos:[0, 0.1, -1], trois_quarts:[0.7, 0.3, 0.7] }[name];
    camera.position.copy(t).add(new THREE.Vector3(...v).normalize().multiplyScalar(d)); camera.lookAt(t); controls.update();
  }
  const clock = new THREE.Clock(); let fps = 60, acc = 0, n = 0, last = { fps:0, calls:0, tris:0 };
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (spin) stage.rotation.y += dt * 0.6;
    if (onFrame) onFrame(dt);
    controls.update(); renderer.render(scene, camera);
    acc += dt; n++; if (acc > 0.5) { last = { fps:Math.round(n / acc), calls:renderer.info.render.calls, tris:renderer.info.render.triangles }; acc = 0; n = 0; }
  });
  function capture() {                                         // image de la vue courante (data URL PNG)
    renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
  }
  function sheet() {                           // planche de contrôle : 4 vues (face, profil, trois-quarts, dos)
    const keep = { p:camera.position.clone(), t:controls.target.clone() }, w = renderer.domElement.width, h = renderer.domElement.height, s = Math.min(w, h);
    const out = document.createElement('canvas'); out.width = s * 2; out.height = s * 2; const g = out.getContext('2d'); g.fillStyle = C.noir; g.fillRect(0, 0, out.width, out.height);
    ['face', 'profil', 'trois_quarts', 'dos'].forEach((v, i) => { view(v); renderer.render(scene, camera);
      g.drawImage(renderer.domElement, (w - s) / 2, (h - s) / 2, s, s, (i % 2) * s, Math.floor(i / 2) * s, s, s);
      g.fillStyle = C.lime; g.font = '700 ' + Math.round(s / 28) + 'px system-ui'; g.fillText(v.replace('_', ' ').toUpperCase(), (i % 2) * s + 14, Math.floor(i / 2) * s + s / 18); });
    camera.position.copy(keep.p); controls.target.copy(keep.t); controls.update();
    return { url:out.toDataURL('image/png'), size:[out.width, out.height] };
  }
  return { renderer, scene, camera, controls, stage, grid, frame, view, capture, sheet, setSpin: v => { spin = v; if (!v) stage.rotation.y = 0; }, onFrame: f => { onFrame = f; }, stats: () => last };
}
