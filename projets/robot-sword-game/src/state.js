// État de la partie (un seul objet partagé, lu et écrit par les modules).
export function createState() {
  return { state:'ground', t:0, vy:0, y:0, yaw:Math.PI * 0.25, atkT:0, landT:0, cur:'', jump:false, atk:false, hp:6, step:0, queued:false, inv:0, hurtT:0, hit:false, over:false, kills:0, deadT:0 };
}
// remise à zéro pour « rejouer » (ne touche ni à l'animation courante ni aux champs de service)
export function resetState(S, hpMax) {
  Object.assign(S, { state:'ground', vy:0, y:0, yaw:Math.PI * 0.25, atkT:0, landT:0, jump:false, atk:false, hp:hpMax, step:0, queued:false, inv:0, hurtT:0, over:false, kills:0, deadT:0 });
}
