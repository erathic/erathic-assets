// Démembrement, éclaboussures et morceaux physiques (cannon-es). Style Erathic : cubes facettés, taches octogonales.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { rand } from './util.js';

// groupes d'os -> membres (le reste = buste)
export const LIMBS = {
  head: { re: /^(Neck|Head)/, stump: 'Neck' },
  armL: { re: /^Left(Shoulder|Arm|ForeArm|Hand)/, stump: 'LeftArm' },
  armR: { re: /^Right(Shoulder|Arm|ForeArm|Hand)/, stump: 'RightArm' },
  legL: { re: /^Left(UpLeg|Leg|Foot|Toe)/, stump: 'LeftUpLeg' },
  legR: { re: /^Right(UpLeg|Leg|Foot|Toe)/, stump: 'RightUpLeg' },
};

// Découpe un SkinnedMesh en un SkinnedMesh par membre (même squelette) selon le poids de peau dominant de chaque triangle.
// keepWhole : garde le maillage d'origine visible (userData.whole) et cache les pièces (userData.part) ; à la mort, on inverse (un seul appel de rendu et un seul squelette par zombie vivant)
export function splitSkinned(src, material, { keepWhole = false } = {}) {
  const g = src.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const nrm = g.attributes.normal, uv = g.attributes.uv, dg = g.attributes.aDiag;
  const bones = src.skeleton.bones;
  const groupOfBone = bones.map(b => { for (const k in LIMBS) if (LIMBS[k].re.test(b.name)) return k; return 'torso'; });
  const idx = g.index ? g.index.array : null, nTri = (idx ? idx.length : pos.count) / 3;
  const names = ['torso', ...Object.keys(LIMBS)], tris = Object.fromEntries(names.map(n => [n, []]));
  for (let t = 0; t < nTri; t++) {
    const v = [0, 1, 2].map(k => idx ? idx[t * 3 + k] : t * 3 + k), sc = {};
    v.forEach(i => { for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0) { const n = groupOfBone[si.getComponent(i, k)]; sc[n] = (sc[n] || 0) + w; } } });
    let best = 'torso', bw = -1; for (const n in sc) if (sc[n] > bw) { bw = sc[n]; best = n; }
    tris[best].push(v);
  }
  const parts = {};
  names.forEach(n => {
    const list = tris[n]; if (!list.length) return; const m = list.length * 3;
    const P = new Float32Array(m * 3), N = new Float32Array(m * 3), U = new Float32Array(m * 2), I = new Uint16Array(m * 4), W = new Float32Array(m * 4), D = new Float32Array(m);
    let o = 0; list.forEach(tri => tri.forEach(i => {
      for (let k = 0; k < 3; k++) { P[o * 3 + k] = pos.getComponent(i, k); N[o * 3 + k] = nrm ? nrm.getComponent(i, k) : 0; }
      if (uv) { U[o * 2] = uv.getX(i); U[o * 2 + 1] = uv.getY(i); }
      for (let k = 0; k < 4; k++) { I[o * 4 + k] = si.getComponent(i, k); W[o * 4 + k] = sw.getComponent(i, k); }
      D[o] = dg ? dg.getX(i) : 0; o++;
    }));
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(P, 3)); ng.setAttribute('normal', new THREE.BufferAttribute(N, 3)); ng.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    ng.setAttribute('skinIndex', new THREE.BufferAttribute(I, 4)); ng.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4)); ng.setAttribute('aDiag', new THREE.BufferAttribute(D, 1));
    const mesh = new THREE.SkinnedMesh(ng, material); mesh.name = 'part_' + n; mesh.frustumCulled = false; mesh.userData.part = true; mesh.visible = !keepWhole;
    mesh.position.copy(src.position); mesh.quaternion.copy(src.quaternion); mesh.scale.copy(src.scale);
    src.parent.add(mesh); mesh.bind(src.skeleton, src.bindMatrix); parts[n] = mesh;
  });
  if (keepWhole) src.userData.whole = true; else src.parent.remove(src);
  return parts;
}

export function createGore({ scene, half, palette = ['#DBFF00', '#B9D600', '#F1F1F3'], ground = 0 }) {
  // ---------- physique des morceaux ----------
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -26, 0) });
  world.defaultContactMaterial.friction = 0.5; world.defaultContactMaterial.restitution = 0.28;
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(half, 1, half)), position: new CANNON.Vec3(0, ground - 1, 0) }); world.addBody(floor);
  const pieces = [];
  const MAXP = 34;
  function dropPiece(p) { scene.remove(p.mesh); world.removeBody(p.body); p.mesh.geometry.dispose(); }

  // fige un membre dans sa pose actuelle et en fait un corps physique
  function detach(part, material, impulse) {
    if (!part || !part.parent) return null;
    part.updateWorldMatrix(true, false); part.skeleton.bones.forEach(b => b.updateMatrixWorld(true)); part.skeleton.update();
    const src = part.geometry, n = src.attributes.position.count, arr = new Float32Array(n * 3), v = new THREE.Vector3(), box = new THREE.Box3();
    for (let i = 0; i < n; i++) { part.getVertexPosition(i, v); v.applyMatrix4(part.matrixWorld); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; box.expandByPoint(v); }
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    for (let i = 0; i < n; i++) { arr[i * 3] -= c.x; arr[i * 3 + 1] -= c.y; arr[i * 3 + 2] -= c.z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(n), 1)); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material); mesh.frustumCulled = false; mesh.position.copy(c); scene.add(mesh);
    part.parent.remove(part);
    const he = new CANNON.Vec3(Math.max(s.x, 0.12) / 2 * 0.85, Math.max(s.y, 0.12) / 2 * 0.85, Math.max(s.z, 0.12) / 2 * 0.85);
    const body = new CANNON.Body({ mass: Math.max(0.6, s.x * s.y * s.z * 6), shape: new CANNON.Box(he), position: new CANNON.Vec3(c.x, Math.max(c.y, 0.25), c.z) });
    body.linearDamping = 0.05; body.angularDamping = 0.35;
    body.velocity.set(impulse.x, impulse.y, impulse.z); body.angularVelocity.set((rand() - 0.5) * 14, (rand() - 0.5) * 14, (rand() - 0.5) * 14);
    world.addBody(body); pieces.push({ mesh, body, ttl: 7 + rand() * 2 });
    while (pieces.length > MAXP) dropPiece(pieces.shift());
    return c;
  }

  // ---------- particules (cubes) ----------
  const PN = 640, pGeo = new THREE.BoxGeometry(1, 1, 1);
  const pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), PN);
  pMesh.frustumCulled = false; pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(pMesh);
  const P = Array.from({ length: PN }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.07, life: 0, rot: new THREE.Vector3() }));
  const cols = palette.map(c => new THREE.Color(c)); const dummy = new THREE.Object3D(); let cursor = 0;
  for (let i = 0; i < PN; i++) { pMesh.setColorAt(i, cols[0]); dummy.scale.setScalar(0); dummy.updateMatrix(); pMesh.setMatrixAt(i, dummy.matrix); }
  function emit(pos, vel, size) {
    const qi = cursor, q = P[qi]; cursor = (cursor + 1) % PN;
    q.on = true; q.p.copy(pos); q.v.copy(vel); q.s = size; q.life = 1.6; q.rot.set(rand() * 6, rand() * 6, rand() * 6);
    pMesh.setColorAt(qi, cols[rand() < 0.7 ? 0 : rand() < 0.6 ? 1 : 2]); pMesh.instanceColor.needsUpdate = true;
  }

  // ---------- taches au sol : 4 formes irrégulières, étirées et tournées au hasard ----------
  const VAR = 4, SN = 40;
  const mkShape = () => { const n = 6 + Math.floor(rand() * 4), sh = new THREE.Shape(); const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + (rand() - 0.5) * 0.5, r = 0.55 + rand() * 0.6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); const g2 = new THREE.ShapeGeometry(sh); g2.rotateX(-Math.PI / 2); return g2; };
  const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false, side: THREE.DoubleSide });
  const sMesh = [], Sp = [], sc = new Array(VAR).fill(0);
  for (let v = 0; v < VAR; v++) {
    const m = new THREE.InstancedMesh(mkShape(), sMat, SN); m.frustumCulled = false; m.renderOrder = 1; scene.add(m); sMesh.push(m);
    Sp.push(Array.from({ length: SN }, () => ({ on: false, x: 0, z: 0, r: 0, ax: 1, az: 1, life: 0, rot: 0 })));
    for (let i = 0; i < SN; i++) { m.setColorAt(i, cols[1]); dummy.scale.setScalar(0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
  }
  function splat(x, z, r) {
    const v = Math.floor(rand() * VAR), i = sc[v]; sc[v] = (sc[v] + 1) % SN;
    Sp[v][i] = { on: true, x, z, r, ax: 0.6 + rand() * 0.9, az: 0.6 + rand() * 0.9, life: 10, rot: rand() * 6.28 };
    sMesh[v].setColorAt(i, cols[rand() < 0.65 ? 0 : 1]); sMesh[v].instanceColor.needsUpdate = true;
  }

  // ---------- jets continus (au niveau d'une coupure) ----------
  const jets = [];
  function spurt(getPos, dur = 0.8, power = 2.2) { jets.push({ getPos, t: dur, dur, power }); }
  function burst(pos, dir, n = 40, speed = 2.6) {
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set((rand() - 0.5) * 2, rand() * 1.2 + 0.2, (rand() - 0.5) * 2).multiplyScalar(speed * 0.5).addScaledVector(dir, speed * (0.4 + rand()));
      emit(p.copy(pos), v, 0.018 + rand() * 0.026);
    }
  }

  const tmp = new THREE.Vector3(), tv = new THREE.Vector3();
  function update(dt) {
    // jets
    for (let i = jets.length - 1; i >= 0; i--) {
      const j = jets[i]; j.t -= dt; if (j.t <= 0) { jets.splice(i, 1); continue; }
      const k = j.t / j.dur, n = Math.ceil(70 * dt * (0.4 + k)); j.getPos(tmp);
      for (let q = 0; q < n; q++) { tv.set((rand() - 0.5) * 1.6, 0.8 + rand() * 0.9, (rand() - 0.5) * 1.6).multiplyScalar(j.power * (0.5 + k * 0.7)); emit(tmp, tv, 0.016 + rand() * 0.022); }
    }
    // particules
    for (let i = 0; i < PN; i++) {
      const q = P[i];
      if (q.on) {
        q.v.y -= 22 * dt; q.p.addScaledVector(q.v, dt); q.life -= dt; q.rot.x += dt * 6; q.rot.z += dt * 5;
        const inside = Math.abs(q.p.x) < half && Math.abs(q.p.z) < half;
        if (q.p.y <= ground + 0.02 && inside) { q.on = false; if (rand() < 0.4) splat(q.p.x, q.p.z, 0.035 + Math.pow(rand(), 2) * 0.13); }
        else if (q.life <= 0 || q.p.y < -6) q.on = false;
        if (q.on) { dummy.position.copy(q.p); dummy.rotation.set(q.rot.x, q.rot.y, q.rot.z); dummy.scale.setScalar(q.s * Math.min(1, q.life * 2)); }
        else dummy.scale.setScalar(0);
        dummy.updateMatrix(); pMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    pMesh.instanceMatrix.needsUpdate = true;
    // taches
    for (let v = 0; v < VAR; v++) {
      for (let i = 0; i < SN; i++) {
        const s = Sp[v][i]; if (!s.on) continue; s.life -= dt;
        const grow = Math.min(1, (10 - s.life) / 0.15), fade = Math.min(1, s.life / 2.5), r = s.r * grow * fade;
        dummy.position.set(s.x, ground + 0.012 + ((i + v * 3) % 9) * 0.0006, s.z); dummy.rotation.set(0, s.rot, 0); dummy.scale.set(r * s.ax, 1, r * s.az); dummy.updateMatrix(); sMesh[v].setMatrixAt(i, dummy.matrix);
        if (s.life <= 0) { s.on = false; dummy.scale.setScalar(0); dummy.updateMatrix(); sMesh[v].setMatrixAt(i, dummy.matrix); }
      }
      sMesh[v].instanceMatrix.needsUpdate = true;
    }
    // morceaux
    world.step(1 / 60, dt, 3);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]; p.mesh.position.copy(p.body.position); p.mesh.quaternion.copy(p.body.quaternion); p.ttl -= dt;
      if (p.ttl < 0.8) p.mesh.scale.setScalar(Math.max(0.001, p.ttl / 0.8));
      if (p.ttl <= 0 || p.body.position.y < -8) { dropPiece(p); pieces.splice(i, 1); }
    }
  }
  function clear() {
    pieces.forEach(dropPiece); pieces.length = 0; jets.length = 0;
    P.forEach(q => { q.on = false; }); Sp.forEach(arr => arr.forEach(s => { s.on = false; }));
    dummy.scale.setScalar(0); dummy.updateMatrix(); for (let i = 0; i < PN; i++) pMesh.setMatrixAt(i, dummy.matrix); sMesh.forEach(m => { for (let i = 0; i < SN; i++) m.setMatrixAt(i, dummy.matrix); m.instanceMatrix.needsUpdate = true; });
    pMesh.instanceMatrix.needsUpdate = true;
  }
  return { detach, spurt, burst, update, clear, pieces: () => pieces.length };
}
