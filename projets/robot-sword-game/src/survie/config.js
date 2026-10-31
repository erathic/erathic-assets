// Niveau de survie « Île Erathic » : arène, vagues, super zombies, armes. Données seules.
import { C } from '../config.js';

export const ARENA = { k: 2, playR: 5.5, view: 5.2, logoH: 4.2, logoPos: [-2.6, -2.6] };   // logoPos : le logo est au fond de l'île (côté opposé à la caméra), pour ne pas masquer l'action    // k = agrandissement de l'île par rapport à la scène de démonstration
export const HP_MAX = 14;                                             // 14 points de vie (une morsure en retire 1)
export const WAVES = { cap: 26, first: 6, add: 3, maxPerWave: 45, spawnEvery: 0.5, pause: 3, speedPerWave: 0.03, speedMaxMul: 1.6, hpEvery: 4 };
export const ZHP = 2;                                                 // points de vie d'un zombie normal (+1 toutes les WAVES.hpEvery vagues)
export const SUPER = { every: 10, hp: 8, hpAdd: 3, scale: 1.25, speedMul: 1.3, color: C.lime };   // un super zombie tous les 10 zombies tués
export const DROP_ORDER = ['sword1', 'sword2', 'pistol', 'mg', 'laser'];   // puis des soins
export const HEAL = 4;

// animations du robot : [clé, nom du clip, boucle, vitesse]
export const ANIMS_S = {
  native: [['i_fists', 'Idle_Neutral', true, 1], ['i_sword', 'Idle_Sword', true, 1], ['i_gun', 'Idle_Gun_Pointing', true, 1], ['walk', 'Walk', true, 1], ['run', 'Run', true, 1],
    ['punchL', 'Punch_Left', false, 1.5], ['punchR', 'Punch_Right', false, 1.5], ['kickL', 'Kick_Left', false, 1.5], ['kickR', 'Kick_Right', false, 1.5],
    ['slash', 'Sword_Slash', false, 1.4], ['gshoot', 'Gun_Shoot', false, 1.6], ['igshoot', 'Idle_Gun_Shoot', true, 1.6], ['runshoot', 'Run_Shoot', true, 1.2],
    ['hit', 'HitRecieve', false, 1.2], ['death', 'Death', false, 1]],
  frank: [['f1', 'Combo01_1', false, 1.7], ['f2', 'Combo01_2', false, 1.7], ['f3', 'Combo01_3', false, 1.7], ['f4', 'Combo01_4', false, 1.7]],
  jumps: [['jstart', 'Jump_Start', false, 2.3], ['jloop', 'Jump_Loop', true, 1.2], ['jland', 'Jump_Land', false, 2.4], ['satk', 'Sword_Attack', false, 1.5]],
};

// armes. Mêlée : combo = coups enchaînés { key, hit (instant du coup), cut (début de la fenêtre d'enchaînement), end, range, cos (arc : 1 devant seulement, -1 tout autour), dmg, lunge, sc (taille de l'arc) }.
// Distance : cooldown (s entre deux tirs), dmg, speed, spread, range ; beam = rayon laser qui traverse.
export const WEAPONS = {
  fists: { id: 'fists', nom: 'MAINS NUES', type: 'melee', idle: 'i_fists',
    combo: [ { key: 'punchL', hit: 0.27, cut: 0.40, end: 0.55, range: 2.0, cos: 0.1, dmg: 1, lunge: 0.8, sc: 0.8 }, { key: 'punchR', hit: 0.27, cut: 0.40, end: 0.55, range: 2.0, cos: 0.1, dmg: 1, lunge: 0.8, sc: 0.8 },
             { key: 'kickL', hit: 0.44, cut: 0.52, end: 0.64, range: 2.3, cos: 0.0, dmg: 1, lunge: 1.0, sc: 1.0 }, { key: 'kickR', hit: 0.54, cut: 9, end: 0.66, range: 2.4, cos: -0.2, dmg: 2, lunge: 1.2, sc: 1.2 } ] },
  sword1: { id: 'sword1', nom: 'ÉPÉE', type: 'melee', idle: 'i_sword', model: 'robot',
    combo: [ { key: 'slash', hit: 0.22, cut: 0.34, end: 0.62, range: 2.5, cos: 0.0, dmg: 2, lunge: 1.2, sc: 1.1 }, { key: 'satk', hit: 0.26, cut: 9, end: 0.86, range: 2.8, cos: -0.2, dmg: 3, lunge: 1.3, sc: 1.3 } ] },
  sword2: { id: 'sword2', nom: 'ÉPÉE À DEUX MAINS', type: 'melee', idle: 'i_sword', model: 'sword2',
    combo: [ { key: 'f1', hit: 0.29, cut: 0.52, end: 0.74, range: 2.4, cos: 0.05, dmg: 3, lunge: 1.2, sc: 1.0 }, { key: 'f2', hit: 0.35, cut: 0.58, end: 0.88, range: 2.7, cos: -0.2, dmg: 3, lunge: 1.0, sc: 1.2 },
             { key: 'f3', hit: 0.42, cut: 0.66, end: 0.93, range: 2.7, cos: -0.2, dmg: 4, lunge: 1.0, sc: 1.2 }, { key: 'f4', hit: 0.39, cut: 9, end: 1.20, range: 3.1, cos: -0.6, dmg: 6, lunge: 2.0, sc: 1.6 } ] },
  pistol: { id: 'pistol', nom: 'PISTOLET', type: 'ranged', idle: 'i_gun', model: 'pistol', shot: 'gshoot', cooldown: 0.38, dmg: 2, speed: 22, spread: 0.0, range: 13 },
  mg: { id: 'mg', nom: 'MITRAILLEUSE', type: 'ranged', idle: 'i_gun', model: 'mg', shot: 'igshoot', loopShot: true, cooldown: 0.11, dmg: 1, speed: 26, spread: 0.07, range: 13 },
  laser: { id: 'laser', nom: 'CANON LASER', type: 'ranged', idle: 'i_gun', model: 'laser', shot: 'gshoot', cooldown: 1.1, dmg: 6, beam: true, beamLen: 11, beamWidth: 0.55 },
};
