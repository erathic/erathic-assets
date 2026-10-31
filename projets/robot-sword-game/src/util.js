// Petits utilitaires mathématiques.
export function angleLerp(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
// longueur 2D sans allocation (Math.hypot alloue et est plus lent)
export const hyp = (x, z) => Math.sqrt(x * x + z * z);
export const b64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;

// Générateur aléatoire du jeu (mulberry32) : indépendant de Math.random, que three.js consomme pour ses identifiants d'objets.
// seed(n) rend une partie reproductible (tests, replays).
let _s = (Math.random() * 4294967296) >>> 0;
export function seed(n) { _s = n >>> 0; }
export function rand() { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
