// Matériaux Erathic partagés (shaders de shaders.js configurés avec la charte).
import * as THREE from 'three';
import { fresnelMaterial } from './shaders.js';
import { C } from './config.js';

export const PLAT = { uIslandY: { value: 0 } };    // matériaux de la plateforme (repère fixe)
export const BASEY = { uIslandY: { value: 0 } };   // matériaux du robot : suit sa hauteur
export const ZSH = { uIslandY: { value: 0 } };     // matériau des zombies

export const limeMat = (shared, o = {}) => fresnelMaterial(C.lime, '#EEFF72', { power:1.05, low:0.34, high:1.10, diagA:1.18, diagB:0.5, shared, ...o });
export const greyMat = (shared, hex = C.gris2, rimHex = '#FCFCFD') => fresnelMaterial(hex, rimHex, { power:1.6, low:0.30, high:1.20, shared });
export const darkMat = shared => fresnelMaterial(C.anthra, '#7C7D87', { power:2.0, strength:0.7, low:0.85, high:1.15, shared });
export const bounds = (m, lo, hi) => { m.userData.U.uYMin.value = lo; m.userData.U.uYMax.value = hi; return m; };

export const zMat = bounds(fresnelMaterial('#3A3B40', C.lime, { power:2.0, strength:0.55, low:0.55, high:1.2, shared:ZSH }), 0, 2.1);
zMat.side = THREE.DoubleSide;   // l'intérieur des membres coupés reste visible
