// retarget.js : retarget d'animations de squelette à squelette (méthode « delta de pose de repos »).
// Module pur : ne charge aucun fichier. L'appelant fournit les objets chargés (GLTFLoader / FBXLoader).
//   retargetClips({ target, source, clips, map, ... }) -> { k, clips: { nom: { dur, tracks:[{n,t,v}], peaks } } }
// Principe : pour chaque os mappé, on prend la rotation MONDE de la source, on retire sa pose de repos (delta),
// puis on applique ce delta à la pose de repos de la cible. Indépendant des axes locaux des os.
import * as THREE from 'three';

// --- tables de correspondance : os de la CIBLE -> noms candidats côté SOURCE (le premier trouvé est utilisé) ---
export const RIG_MAPS = {
  // cible = robot « Character-bot » (25 os) ; sources = squelettes type mannequin UE (UAL1, UAL2, Frank)
  botFromUE: {
    Hips: ['pelvis'], Abdomen: ['spine_01'], Torso: ['spine_02'], Chest: ['spine_03'], Neck: ['neck_01'], Head: ['head', 'Head'],
    ShoulderL: ['clavicle_l'], UpperArmL: ['upperarm_l'], LowerArmL: ['lowerarm_l'], HandL: ['hand_l'],
    ShoulderR: ['clavicle_r'], UpperArmR: ['upperarm_r'], LowerArmR: ['lowerarm_r'], HandR: ['hand_r'],
    UpperLegL: ['thigh_l'], LowerLegL: ['calf_l'], UpperLegR: ['thigh_r'], LowerLegR: ['calf_r'], FootL: ['foot_l'], FootR: ['foot_r'],
  },
  // cible = robot ; source = squelette Mixamo (zombie Quaternius, etc.)
  botFromMixamo: {
    Hips: ['Hips'], Abdomen: ['Spine'], Torso: ['Spine1'], Chest: ['Spine2'], Neck: ['Neck'], Head: ['Head'],
    ShoulderL: ['LeftShoulder'], UpperArmL: ['LeftArm'], LowerArmL: ['LeftForeArm'], HandL: ['LeftHand'],
    ShoulderR: ['RightShoulder'], UpperArmR: ['RightArm'], LowerArmR: ['RightForeArm'], HandR: ['RightHand'],
    UpperLegL: ['LeftUpLeg'], LowerLegL: ['LeftLeg'], UpperLegR: ['RightUpLeg'], LowerLegR: ['RightLeg'], FootL: ['LeftFoot'], FootR: ['RightFoot'],
  },
};
// os de pied pilotés par IK côté robot : on les fait suivre le bas de la jambe (cible -> os de jambe)
export const FOOT_FOLLOW = { FootL: 'LowerLegL', FootR: 'LowerLegR' };

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const dec = (m) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, _s); return { p, q }; };
const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const round4 = (a) => Array.from(a, (x) => Math.round(x * 1e4) / 1e4);

function collectBones(root) { const out = []; root.traverse((o) => { if (o.isBone) out.push(o); }); return out; }
function resolveMap(map, bones) {
  const by = new Map(); bones.forEach((b) => { if (!by.has(b.name)) by.set(b.name, b); });      // noms dupliqués : le premier gagne
  const out = {}, missing = [];
  for (const [t, cands] of Object.entries(map)) { const hit = cands.map((n) => by.get(n)).find(Boolean); if (hit) out[t] = hit; else missing.push(t + ' <- ' + cands.join('|')); }
  return { resolved: out, missing, by };
}
// repère orthonormé (droite, haut, avant) déduit de la pose de repos : tête/bassin = haut, main gauche/droite = côté
function basis(head, pelvis, handL, handR) {
  const up = head.clone().sub(pelvis).normalize(); const right = handL.clone().sub(handR);
  right.sub(up.clone().multiplyScalar(right.dot(up))).normalize();
  return snap(right, up);
}
// aligne (droite, haut) sur l'axe monde le plus proche : on corrige des rotations de 90° (ex. FBX en Z vers le haut), pas les inclinaisons propres à chaque personnage
function snap(right, up) {
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const nearest = (v, skip) => { let best = -1, bs = -1, sign = 1; axes.forEach((a, i) => { if (i === skip) return; const d = v.dot(a); if (Math.abs(d) > bs) { bs = Math.abs(d); best = i; sign = Math.sign(d) || 1; } }); return { i: best, v: axes[best].clone().multiplyScalar(sign) }; };
  const r = nearest(right, -1), u = nearest(up, r.i);
  return new THREE.Matrix4().makeBasis(r.v, u.v, new THREE.Vector3().crossVectors(r.v, u.v));
}

/**
 * @param {THREE.SkinnedMesh} target  maillage skinné de la cible (porte le squelette et les poses de repos)
 * @param {THREE.Object3D}    source  racine chargée de la source (contient les os)
 * @param {Object<string,THREE.AnimationClip>} clips  clips de la source, par nom de sortie
 * @param {object} [o]  map, fps (30), root ('root' : os racine de la source, ses déplacements sont ignorés ; null si aucune), hand ('hand_r' : pour mesurer le pic de vitesse),
 *                 restFrom : 'skin' (poses de repos du skinning), 'nodes' (poses des noeuds du fichier) ou 'auto' (skin si le squelette skinné contient tous les os mappés, sinon noeuds)
 */
export function retargetClips({ target, source, clips, map = RIG_MAPS.botFromUE, fps = 30, root = 'root', hand = 'hand_r', feet = FOOT_FOLLOW, restFrom = 'auto' }) {
  // 1) poses de repos
  target.skeleton.pose(); target.updateMatrixWorld(true);
  const tBind = {}; target.skeleton.bones.forEach((b, i) => { if (!(b.name in tBind)) tBind[b.name] = new THREE.Matrix4().copy(target.skeleton.boneInverses[i]).invert().premultiply(target.bindMatrix); });
  let skinned = null; source.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  const sk = new Set(skinned ? skinned.skeleton.bones.map((b) => b.name) : []);
  const useSkin = restFrom === 'skin' || (restFrom === 'auto' && skinned && Object.values(map).every((c) => c.some((n) => sk.has(n))));
  if (useSkin) source.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });   // sinon : pose des noeuds du fichier (FBX d'animation dont la peau n'a pas tout le squelette)
  source.updateMatrixWorld(true);
  const sBones = collectBones(source); const { resolved, missing, by } = resolveMap(map, sBones);
  if (missing.length) throw new Error('os sources introuvables : ' + missing.join(', '));
  const rootBone = root ? by.get(root) : source; if (!rootBone) throw new Error('os racine introuvable : ' + root);   // root = null : pas de racine à ignorer (ex. Mixamo, dont la racine est le bassin)
  const rootBindInv = new THREE.Matrix4().copy(rootBone.matrixWorld).invert();
  // 2) repère source -> repère cible (haut / gauche-droite / avant), calculé dans le repère de la racine
  const rel = (b) => new THREE.Matrix4().copy(rootBindInv).multiply(b.matrixWorld);
  const Ms = basis(posOf(rel(resolved.Head)), posOf(rel(resolved.Hips)), posOf(rel(resolved.HandL)), posOf(rel(resolved.HandR)));
  const Mt = basis(posOf(tBind.Head), posOf(tBind.Hips), posOf(tBind.HandL), posOf(tBind.HandR));
  const R4 = new THREE.Matrix4().copy(Mt).multiply(Ms.clone().transpose()); const Rq = new THREE.Quaternion().setFromRotationMatrix(R4);
  const sBindQ = {}, sBindP = {};
  for (const t in resolved) { const d = dec(new THREE.Matrix4().copy(R4).multiply(rel(resolved[t]))); sBindQ[t] = d.q; sBindP[t] = d.p; }
  const k = tBind.Hips.elements[13] / sBindP.Hips.y;                         // rapport de taille (hauteur du bassin)
  // 3) os cibles, parents d'abord
  const tb = target.skeleton.bones, order = []; const tRoot = tb.find((b) => !tb.includes(b.parent));
  (function dfs(b) { if (tb.includes(b)) order.push(b); b.children.forEach(dfs); })(tRoot);
  const local = {}; order.forEach((b) => { const pb = b.parent && tBind[b.parent.name] ? tBind[b.parent.name] : new THREE.Matrix4(); const d = dec(new THREE.Matrix4().copy(pb).invert().multiply(tBind[b.name])); local[b.name] = d; });
  const bindQ = {}; order.forEach((b) => { bindQ[b.name] = dec(tBind[b.name]).q; });
  const footOff = {}; for (const f in feet) footOff[f] = new THREE.Matrix4().copy(tBind[feet[f]]).invert().multiply(tBind[f]);
  const handBone = by.get(hand), mixer = new THREE.AnimationMixer(source);
  const result = { k, clips: {} };
  // 4) échantillonnage image par image
  for (const [name, clip] of Object.entries(clips)) {
    const act = mixer.clipAction(clip); act.play();
    const N = Math.round(clip.duration * fps), times = [], Q = {}, P = {}, speed = []; order.forEach((b) => { Q[b.name] = []; P[b.name] = []; });
    let prev = null;
    for (let f = 0; f <= N; f++) {
      const t = f / fps; times.push(t); mixer.setTime(t); source.updateMatrixWorld(true);
      const rootInv = new THREE.Matrix4().copy(rootBone.matrixWorld).invert(); const relNow = (b) => new THREE.Matrix4().copy(rootInv).multiply(b.matrixWorld);
      if (handBone) { const hp = posOf(handBone.matrixWorld); speed.push(prev ? hp.distanceTo(prev) * fps : 0); prev = hp; }
      const W = {};
      order.forEach((b) => {
        const parentW = b.parent && W[b.parent.name] ? W[b.parent.name] : new THREE.Matrix4();
        let q = local[b.name].q.clone(), p = local[b.name].p.clone();
        const sb = resolved[b.name];
        if (sb) {                                                              // rotation : delta monde de la source appliqué au repos cible
          relNow(sb).decompose(_p, _q, _s); const sw = _q.clone().premultiply(Rq);
          const worldQ = sw.multiply(sBindQ[b.name].clone().invert()).multiply(bindQ[b.name]);
          q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(parentW)).invert().multiply(worldQ);
        }
        if (b.name === 'Hips' || b.name === 'Body') {                          // translation du bassin, portée par l'os parent de Hips (Body) s'il existe
          const carrier = tb.find((x) => x.name === 'Body') ? 'Body' : 'Hips';
          if (b.name === carrier) {
            const sp = posOf(relNow(resolved.Hips)).applyQuaternion(Rq); const dp = sp.sub(sBindP.Hips).multiplyScalar(k);
            p.add(dp.applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(parentW)).invert()));
          }
        }
        if (feet[b.name]) p = posOf(new THREE.Matrix4().copy(W[feet[b.name]]).multiply(footOff[b.name])).applyMatrix4(new THREE.Matrix4().copy(parentW).invert());
        W[b.name] = new THREE.Matrix4().copy(parentW).multiply(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
        Q[b.name].push(...q.toArray()); P[b.name].push(...p.toArray());
      });
    }
    const tracks = [];
    order.forEach((b) => { if (resolved[b.name]) tracks.push({ n: b.name + '.quaternion', t: round4(times), v: round4(Q[b.name]) });
      if (b.name === 'Body' || feet[b.name]) tracks.push({ n: b.name + '.position', t: round4(times), v: round4(P[b.name]) }); });
    const peaks = speed.map((s, i) => [+(i / fps).toFixed(2), +s.toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    result.clips[name] = { dur: +clip.duration.toFixed(3), tracks, peaks }; act.stop(); mixer.uncacheClip(clip);
  }
  return result;
}
