// Ombres douces instanciées : un seul appel de rendu pour toutes les ombres, opacité par instance (attribut aOp).
import * as THREE from 'three';

export function createShadows(scene, blobTex, { size = 2.1, max = 256, y = 0.012 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size); geo.rotateX(-Math.PI / 2);
  const op = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); op.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aOp', op);
  const mat = new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aOp;\nvarying float vOp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp = aOp;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOp;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vOp;');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.count = 0; scene.add(mesh);
  const free = [], tmp = new THREE.Matrix4(); let next = 0;
  return {
    acquire() { const i = free.length ? free.pop() : next++; if (i >= max) throw new Error('trop d\'ombres'); mesh.count = Math.max(mesh.count, i + 1); op.setX(i, 0); return i; },
    set(i, x, z, o) { tmp.makeTranslation(x, y, z); mesh.setMatrixAt(i, tmp); op.setX(i, o); },
    release(i) { op.setX(i, 0); free.push(i); },
    commit() { mesh.instanceMatrix.needsUpdate = true; op.needsUpdate = true; },   // une fois par image
    clear() { free.length = 0; next = 0; mesh.count = 0; },
  };
}
