// Interface : points de vie, compteur, écran de fin, relance de partie.
import { HP_MAX } from './config.js';
import { resetState } from './state.js';

export function createUI(ctx) {
  const { S } = ctx;
  const hpEl = document.getElementById('hp'), cntEl = document.getElementById('cnt'), endEl = document.getElementById('end');

  function hud() {
    hpEl.innerHTML = Array.from({ length: HP_MAX }, (_, i) => `<i class="${i < S.hp ? '' : 'off'}"></i>`).join('');
    cntEl.textContent = `ZOMBIES ${ctx.zombies.alive()}   ·   ÉLIMINÉS ${S.kills}`;
  }
  function finish(win) {
    if (win && S.over) return; S.over = true;
    document.getElementById('endT').textContent = win ? 'VICTOIRE' : 'PERDU';
    document.getElementById('endS').textContent = win ? `${S.kills} zombies éliminés` : `${S.kills} zombie${S.kills > 1 ? 's' : ''} éliminé${S.kills > 1 ? 's' : ''}`;
    endEl.style.display = 'flex';
  }
  const endShown = () => endEl.style.display === 'flex';
  function restart() {
    ctx.zombies.clear(); ctx.gore.clear();
    resetState(S, HP_MAX);
    ctx.pl.group.position.set(0, 0, 0); S.cur = ''; ctx.pl.play('idle', 0.1); endEl.style.display = 'none'; ctx.zombies.startWave();
  }
  document.getElementById('bRe').addEventListener('pointerdown', e => { restart(); e.preventDefault(); });
  return { hud, finish, endShown, restart };
}
