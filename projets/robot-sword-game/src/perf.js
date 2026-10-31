// Chronomètres par système (désactivés par défaut : coût nul). Activés par le banc d'essai via perf.enable().
export function createPerf() {
  const acc = {}, cnt = {}; let on = false;
  const t0 = {};
  return {
    enable() { on = true; }, get enabled() { return on; },
    begin(name) { if (on) t0[name] = performance.now(); },
    end(name) { if (on) { acc[name] = (acc[name] || 0) + performance.now() - t0[name]; cnt[name] = (cnt[name] || 0) + 1; } },
    reset() { for (const k in acc) { acc[k] = 0; cnt[k] = 0; } },
    report(frames) { const o = {}; for (const k in acc) o[k] = +(acc[k] / frames).toFixed(3); return o; },   // ms par image
  };
}
