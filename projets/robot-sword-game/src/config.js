// Données du jeu : constantes, tables de réglages et listes d'animations. Aucune logique, aucun import.

export const C = { noir:'#1E1F22', lime:'#DBFF00', blanc:'#FFFFFF', gris:'#F1F1F3', gris2:'#D9D9D9', anthra:'#2F2F33' };   // charte Erathic

// scène et caméra
export const VIEW = 4.6, CAM_OFFSET = [9, 8.2, 9], CAM_FOLLOW = 0.8, CAM_SMOOTH = 0.02;
export const HALF = 4.4, THICK = 0.7;                       // plateforme : demi-côté et épaisseur

// robot
export const HP_MAX = 6, SPEED = 3.4, G = 19, JV = 6.6, LIM = HALF - 0.4;

// combo à 4 coups (animations Frank RPG 2Handed : Combo01_1 à 4).
// hit = instant du coup, cut = début de la fenêtre d'enchaînement, end = fin du coup
export const COMBO = [
  { key:'f1', hit:0.29, cut:0.52, end:0.74, range:2.4, cos:0.05, sc:1.0, lunge:1.2 },
  { key:'f2', hit:0.35, cut:0.58, end:0.88, range:2.7, cos:-0.2, sc:1.2, lunge:1.0 },
  { key:'f3', hit:0.42, cut:0.66, end:0.93, range:2.7, cos:-0.2, sc:1.2, lunge:1.0 },
  { key:'f4', hit:0.39, cut:9,    end:1.20, range:3.1, cos:-0.6, sc:1.6, lunge:2.0 },
];

// animations du robot : [clé, nom du clip, boucle, vitesse]
export const ANIMS = {
  native: [['idle', 'Idle_Sword', true, 1], ['walk', 'Walk', true, 1], ['run', 'Run', true, 1]],                     // clips du GLB
  frank:  [['f1', 'Combo01_1', false, 1.7], ['f2', 'Combo01_2', false, 1.7], ['f3', 'Combo01_3', false, 1.7], ['f4', 'Combo01_4', false, 1.7],
           ['hit', 'Hit01', false, 1.4], ['death', 'Death01', false, 1]],                                             // frank_clips.json
  jumps:  [['jstart', 'Jump_Start', false, 2.3], ['jloop', 'Jump_Loop', true, 1.2], ['jland', 'Jump_Land', false, 2.4]],   // jumps.json
};

// zombies
export const ZOMBIE = {
  height: 1.9, speedMin: 0.85, speedRange: 0.25,
  anims: [['walk', 1.5], ['idle', 1], ['bite', 1.1]],        // [clé, vitesse]
  wave: [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]], waveDelay: 0.35,
  respawnEvery: 2,                                           // un nouveau zombie tous les N éliminés
  limbChance: { head:0.75, armL:0.5, armR:0.5, legL:0.22, legR:0.22 },
};

// couleur du « sang » : jaune Erathic par défaut. Pour du rouge : ['#B3001B', '#7A0012', '#D9D9D9']
export const BLOOD = ['#DBFF00', '#B9D600', '#F1F1F3'];
