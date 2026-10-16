import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { honor } from '../lib/client.ts';
import { postGame, votesLeft, type Line } from '../lib/postgame.ts';
import { asset } from '../lib/lcu.ts';
import { ui, mmss, champIcon, useClient } from '../lib/view.ts';
import { useMotion, still } from '../lib/motion.ts';
import './PostGame.css';

export default function PostGame() {
  const c = useClient();
  const g = postGame(c.eog!);
  const mode = c.queues.find((q) => q.gameMode === c.eog!.gameMode)?.mode.name;
  const left = votesLeft(c.honor);
  const honored = (p: Line) => !!c.honor?.honoredPlayers.some((h) => h.recipientPuuid === p.puuid);
  const target = (p: Line) => [...(c.honor?.eligibleAllies ?? []), ...(c.honor?.eligibleOpponents ?? [])].find((t) => t.puuid === p.puuid);
  const item = (id: number) => c.items.find((x) => x.id === id);
  const spell = (id: number) => c.spells.find((x) => x.id === id);

  // Your champion's splash takes the backdrop for as long as the summary is up.
  const splash = c.eog!.teams.flatMap((t) => t.players).find((p) => p.isLocalPlayer)?.skinSplashPath;
  useEffect(() => {
    ui.scene = splash ?? null;
    return () => { if (ui.scene === splash) ui.scene = null; };
  }, [splash]);

  // The summary arrives: rows step in team by team, and each damage bar runs out to its length.
  const root = useRef<HTMLElement>(null);
  useMotion(root, [c.eog!.gameId], () => {
    animate('.player', { y: [8, 0], opacity: [0, 1], delay: stagger(35), duration: 350, ease: 'outQuart' });
    root.current!.querySelectorAll<HTMLElement>('.dmg i').forEach((bar, i) => {
      animate(bar, { scaleX: [0, Number(bar.dataset.share)], delay: 200 + i * 35, duration: 700, ease: 'outExpo' });
    });
  });

  function vote(p: Line, el: HTMLElement) {
    const t = target(p);
    if (!t) return;
    if (!still()) animate(el, { scale: [1, 1.35, 1], duration: 380, ease: 'outBack' });
    void honor(t);
  }

  return (
    <section className="post" ref={root} aria-labelledby="h-post">
      <div className="head">
        <h2 id="h-post">Riepilogo</h2>
        <span className="hint">{[mode, mmss(g.length), g.surrender && 'Resa anticipata'].filter(Boolean).join(' · ')}</span>
        {c.mastery && (
          <span className="mastery" title={`Maestria livello ${c.mastery.level}`}>
            Voto <b>{c.mastery.grade}</b> · +{c.mastery.pointsGained} maestria{c.mastery.hasLeveledUp && ' · livello su'}
          </span>
        )}
      </div>
      {!!c.honor && (
        <p className="honor-hint">
          {left ? `Onora chi ti è piaciuto in partita: ${left === 1 ? 'ti resta 1 voto' : `ti restano ${left} voti`}.` : 'Hai usato tutti i voti di onore di questa partita.'}
        </p>
      )}
      {g.teams.map((t) => (
        <div key={String(t.mine)} className={t.win ? 'side win' : 'side'}>
          <h3>
            <span>{t.mine ? 'La tua squadra' : 'Avversari'}</span>
            <span className="result">{t.win ? 'Vittoria' : 'Sconfitta'}</span>
            <span className="kills">{t.kills} uccisioni</span>
          </h3>
          <ol>
            {t.players.map((p) => {
              const can = !!target(p);
              const done = honored(p);
              return (
                <li key={p.puuid} className={p.me ? 'player me' : 'player'}>
                  <img className="champ" src={champIcon(p.championId)} alt={p.champion} title={p.champion} width="30" height="30" />
                  <span className="spells">
                    {p.spells.map((id, i) => spell(id) && <img key={i} src={asset(spell(id)!.iconPath)} alt={spell(id)!.name} title={spell(id)!.name} width="14" height="14" />)}
                  </span>
                  <span className="who">{p.name}{p.left && <small> · uscito</small>}</span>
                  <span className="kda" aria-label={`${p.kills} uccisioni, ${p.deaths} morti, ${p.assists} assist`}>{p.kills} / {p.deaths} / {p.assists}</span>
                  <span className="cs" title="Minion e mostri uccisi">{p.cs}</span>
                  <span className="dmg" title="Danni ai campioni">
                    <i data-share={p.damage / g.topDamage} style={{ transform: `scaleX(${p.damage / g.topDamage})` }}></i>
                    {p.damage.toLocaleString('it-IT')}
                  </span>
                  <span className="gold">{(p.gold / 1000).toFixed(1)}k</span>
                  <span className="items">
                    {p.items.map((id, i) => item(id) && <img key={i} src={asset(item(id)!.iconPath)} alt={item(id)!.name} title={item(id)!.name} width="20" height="20" />)}
                  </span>
                  {!p.me && (can || done) ? (
                    <button
                      className={done ? 'heart on' : 'heart'} aria-pressed={done} disabled={done || !left || c.busy}
                      aria-label={done ? `Hai onorato ${p.name}` : `Onora ${p.name}`} title={done ? 'Onorato' : 'Onora'}
                      onClick={(e) => vote(p, e.currentTarget)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
                    </button>
                  ) : <span className="heart-slot"></span>}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
