// Collisions du niveau : cercles (arbres, rochers), segments épais (logo), bord de l'île. Tout se joue dans le plan x, z.
import { hyp } from '../util.js';

export function createColliders({ circles, segments, playR }) {
  // repousse la position p (objet avec x et z) hors des obstacles ; radius = rayon de l'entité
  function constrain(p, radius = 0.4) {
    for (let it = 0; it < 2; it++) {
      for (const c of circles) { const dx = p.x - c.x, dz = p.z - c.z, d = hyp(dx, dz), m = c.r + radius; if (d < m) { if (d > 1e-5) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } else { p.x = c.x + m; } } }
      for (const s of segments) {
        const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez; let t = ((p.x - s.ax) * ex + (p.z - s.az) * ez) / l2; t = Math.max(0, Math.min(1, t));
        const cx = s.ax + ex * t, cz = s.az + ez * t, dx = p.x - cx, dz = p.z - cz, d = hyp(dx, dz), m = s.r + radius;
        if (d < m) { if (d > 1e-5) { p.x = cx + dx / d * m; p.z = cz + dz / d * m; } else { p.x = cx + m; } }
      }
      const rr = hyp(p.x, p.z), lim = playR - radius; if (rr > lim) { p.x *= lim / rr; p.z *= lim / rr; }
    }
  }
  // un point est-il dans un obstacle ? (projectiles)
  function blocked(x, z) {
    for (const c of circles) if (hyp(x - c.x, z - c.z) < c.r) return true;
    for (const s of segments) { const ex = s.bx - s.ax, ez = s.bz - s.az; let t = ((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez); t = Math.max(0, Math.min(1, t)); if (hyp(x - (s.ax + ex * t), z - (s.az + ez * t)) < s.r) return true; }
    return hyp(x, z) > playR + 1.2;
  }
  // distance jusqu'au premier obstacle le long d'un rayon (pour le laser), plafonnée à max
  function rayDistance(ox, oz, dx, dz, max) {
    let best = max; const step = 0.15; for (let t = 0.3; t < max; t += step) if (blocked(ox + dx * t, oz + dz * t)) { best = t; break; } return best;
  }
  return { constrain, blocked, rayDistance, playR, circles, segments };
}
