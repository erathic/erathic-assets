// Interface de survie : points de vie, vague, éliminés, temps, arme, bannières, écran de fin, rejouer.
import { HP_MAX, WEAPONS } from './config.js';

export function createUI(ctx) {
  const { S } = ctx, $ = id => document.getElementById(id), hpEl = $('hp'), cntEl = $('cnt'), wpnEl = $('wpn'), banEl = $('banner'), endEl = $('end');
  let banT = 0, best = null; const KEY = 'erathic_survie_best';
  try { best = JSON.parse(localStorage.getItem(KEY)); } catch { best = null; }            // meilleur score : localStorage (peut manquer ou échouer, on garde alors la valeur en mémoire)
  const fmt = t => { const s = Math.floor(t); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function hud() {
    hpEl.innerHTML = Array.from({ length: HP_MAX }, (_, i) => `<i class="${i < S.hp ? '' : 'off'}"></i>`).join('');
    cntEl.textContent = `VAGUE ${Math.max(1, S.wave)}   ·   ÉLIMINÉS ${S.kills}   ·   ${fmt(S.time)}`;
    wpnEl.textContent = WEAPONS[S.weapon].nom;
  }
  function banner(text, dur = 2) { banEl.textContent = text; banEl.style.opacity = 1; banT = dur; }
  function tick(dt) { if (banT > 0) { banT -= dt; if (banT <= 0.5) banEl.style.opacity = Math.max(0, banT / 0.5); } }
  const endShown = () => endEl.style.display === 'flex';
  function finish() {
    if (endShown()) return; S.over = true;
    $('endT').textContent = 'PERDU';
    $('endS').textContent = `VAGUE ${Math.max(1, S.wave)}   ·   ${S.kills} ZOMBIES   ·   ${S.supers} SUPER   ·   ${fmt(S.time)}`;
    const rec = !best || S.time > best.t; if (rec) { best = { t: S.time, wave: Math.max(1, S.wave), kills: S.kills }; try { localStorage.setItem(KEY, JSON.stringify(best)); } catch {} }
    $('endB').textContent = (rec ? 'NOUVEAU RECORD  ·  ' : 'MEILLEUR  ·  ') + `${fmt(best.t)}  ·  VAGUE ${best.wave}  ·  ${best.kills} ZOMBIES`;
    endEl.style.display = 'flex';
  }
  $('bRe').addEventListener('pointerdown', e => { ctx.restart(); e.preventDefault(); });
  return { hud, banner, tick, finish, endShown, hide: () => { endEl.style.display = 'none'; banEl.style.opacity = 0; } };
}
