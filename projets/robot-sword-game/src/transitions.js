// Résolution d'une transition d'animation (fondu et synchronisation de phase) depuis la table TRANSITIONS de config.js.
import { TRANSITIONS as T } from './config.js';

export function resolveTransition(from, to) {
  const pair = T.pairs[`${from}>${to}`] || {};
  return { fade: pair.fade ?? T.to[to] ?? T.default.fade, sync: pair.sync ?? T.default.sync };
}
