// Petits utilitaires mathématiques.
export function angleLerp(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
export const b64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
