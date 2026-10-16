import { useEffect, useRef } from 'react';
import { animate, createScope, stagger, waapi } from 'animejs';
import { splitText } from 'animejs/text';
import { myAction, hover, benchSwap } from '../lib/client.ts';
import { champIcon, champName, champSplash, ui, useClient } from '../lib/view.ts';
import { onMoment, type Moment } from '../lib/moments.ts';
import { recall, still } from '../lib/motion.ts';
import Team from './Team.tsx';
import ChampGrid from './ChampGrid.tsx';
import Spells from './Spells.tsx';
import Runes from './Runes.tsx';
import './Select.css';

// Modes played with augments instead of rune pages: Arena and ARAM: Mayhem.
const NO_RUNES = new Set(['CHERRY', 'KIWI']);

export default function Select() {
  const c = useClient();
  const s = c.select!;
  const action = myAction();
  // Modes that deal a few champions offer only those; the pickable list still names the whole roster.
  const offer = s.allowSubsetChampionPicks && c.subset.length ? c.subset : c.pickable;
  const runes = !NO_RUNES.has(c.queues.find((q) => q.id === s.queueId)?.gameMode ?? '');
  const me = s.myTeam.find((p) => p.cellId === s.localPlayerCellId);
  const done = s.actions.flat().filter((a) => a.completed && a.championId);
  const bans = (ally: boolean) => done.filter((a) => a.type === 'ban' && a.isAllyAction === ally).map((a) => a.championId);
  // Banned for everyone; picked ones too, unless this mode lets champions repeat.
  const taken = new Set(done.filter((a) => a.type === 'ban' || !s.allowDuplicatePicks).map((a) => a.championId));

  // A pick or ban lands. Moments arrive with the new session, before React has drawn it: they play on the next frame.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scope = createScope({ root: root.current! }).add('play', (m: Moment, from: DOMRect | null) => {
      const r = root.current;
      if (!r) return;
      if (m.kind === 'ban') {
        const ban = r.querySelector(`.team${m.ally ? ':not(.enemy)' : '.enemy'} .ban[data-id="${m.championId}"]`);
        if (!ban) return;
        animate(ban.querySelector('.slash')!, { scaleX: [0, 1], duration: 300, ease: 'outExpo' });
        animate(ban.querySelector('img')!, { x: [-2, 2], duration: 50, loop: 3, alternate: true, onComplete: (a) => { a.revert(); } });
        return;
      }
      const icon = r.querySelector<HTMLElement>(m.mine ? '.team .seat.me img' : `.team .seat[data-cell="${m.cellId}"] img`);
      if (!icon) return;
      // WAAPI, not inline styles: the seat icon's own CSS transitions would chase every frame.
      if (!m.mine) {
        if (!m.ally) waapi.animate(icon, { scale: [1.3, 1], opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'], duration: 450 });
        return;
      }
      const name = r.querySelector('.my-champ b');
      if (name) animate(splitText(name as HTMLElement, { chars: true }).chars, { y: ['40%', 0], opacity: [0, 1], delay: stagger(30), ease: 'outBack' });
      const flash = () => waapi.animate(icon, { scale: [1, 1.08, 1], boxShadow: ['0 0 0 0 rgb(217 189 130 / 0)', '0 0 24px 6px rgb(217 189 130 / 0.9)', '0 0 0 0 rgb(217 189 130 / 0)'], duration: 500 });
      if (!from) return void flash();
      // Inside .select, so it leaves with the panel if champion select ends mid-flight.
      const to = icon.getBoundingClientRect();
      const ghost = r.appendChild(Object.assign(document.createElement('img'), { className: 'ghost', src: champIcon(m.championId), alt: '' }));
      Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      const dy = to.top - from.top;
      animate(ghost, { x: to.left - from.left, y: [0, dy / 2 - 40, dy], scale: to.width / from.width, duration: 650, ease: 'inOutQuart', onComplete: () => { ghost.remove(); flash(); } });
    });
    const frames = new Set<number>();
    const off = onMoment((m) => {
      const mine = m.kind === 'pick' && m.mine;
      const from = mine ? recall('pick') : null; // taken even when nothing flies, so a stale one never does later
      if (mine) ui.scene = champSplash(m.championId);
      if (!still()) { const f = requestAnimationFrame(() => { frames.delete(f); scope.methods.play(m, from); }); frames.add(f); }
    });
    // Champion select is over: the profile splash comes back.
    return () => { off(); frames.forEach(cancelAnimationFrame); scope.revert(); ui.scene = null; };
  }, []);

  return (
    <div className={s.theirTeam.length ? 'select' : 'select solo'} ref={root}>
      <Team title="Alleati" players={s.myTeam} bans={bans(true)} />

      <section className="center" aria-labelledby="h-center">
        <div className="head">
          <h2 id="h-center">
            {action ? (action.type === 'ban' ? 'Banna un campione' : action.isInProgress ? 'Scegli il campione' : 'Mostra la tua scelta') : 'Il tuo campione'}
          </h2>
          <span className="loadout">{runes && <Runes championId={me?.championId || me?.championPickIntent || action?.championId} position={me?.assignedPosition} />}{me && <Spells me={me} />}</span>
        </div>
        {action ? (
          <ChampGrid ids={action.type === 'ban' ? c.bannable : offer} taken={taken} selected={action.championId} onpick={hover} label="Campioni" />
        ) : <>
          <div className="my-champ">
            <img src={champIcon(me?.championId)} alt="" width="96" height="96" />
            <b key={me?.championId}>{champName(me?.championId) || 'In attesa degli altri giocatori'}</b>
          </div>
          {s.benchEnabled && <>
            <h2>Panchina</h2>
            <div className="champs bench">
              {s.benchChampions.length ? s.benchChampions.map((b) => (
                <button key={b.championId} title={`Prendi ${champName(b.championId)}`} disabled={c.busy} onClick={() => benchSwap(b.championId)}>
                  <img src={champIcon(b.championId)} alt="" />
                  <span>{champName(b.championId)}</span>
                </button>
              )) : (
                <p className="hint">Vuota: qui finiscono i campioni scartati dalla squadra.</p>
              )}
            </div>
          </>}
        </>}
      </section>

      {!!s.theirTeam.length && <Team title="Nemici" players={s.theirTeam} bans={bans(false)} enemy />}
    </div>
  );
}
