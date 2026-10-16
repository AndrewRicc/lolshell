import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { splitText } from 'animejs/text';
import { myAction } from '../lib/client.ts';
import { postGame } from '../lib/postgame.ts';
import { view, mmss, useClient } from '../lib/view.ts';
import { useMotion, useOnChange, still } from '../lib/motion.ts';
import './Status.css';

const PHASE: Record<string, string> = { PLANNING: 'Preparazione', BAN_PICK: 'Ban e scelte', FINALIZATION: 'Ultimi ritocchi', GAME_STARTING: 'La partita sta partendo' };

export default function Status() {
  const c = useClient();
  const stage = view.stage;
  const q = view.q;
  const members = view.members;
  const size = view.size;
  const response = view.response;
  const post = c.eog ? postGame(c.eog) : null;

  const timer = c.select?.timer;
  const action = myAction();
  const played = c.queues.find((x) => x.id === c.select?.queueId);
  // The client says how much of the phase was left at a given instant: count down from there.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => { setNow(Date.now()); }, 250);
    return () => clearInterval(tick);
  }, []);
  const left = timer ? Math.max(0, Math.min(timer.internalNowInEpochMs + timer.adjustedTimeLeftInPhase - now, timer.totalTimeInPhase)) / 1000 : 0;

  // Match found: a gold ring sweeps out and the title falls into place letter by letter.
  const root = useRef<HTMLElement>(null);
  useMotion(root, [stage === 'ready'], () => {
    if (stage !== 'ready') return;
    const h1 = root.current!.querySelector<HTMLElement>('h1:not([aria-hidden])')!;
    // The scope reverts the split, putting back the h1's own text; its key makes React drop that h1 on the way out.
    const { chars } = splitText(h1, { chars: true }); // before measuring: the split letters set the title's width
    const ring = root.current!.appendChild(Object.assign(document.createElement('span'), { className: 'ring' }));
    ring.style.left = `${h1.offsetLeft + h1.offsetWidth / 2}px`;
    ring.style.top = `${h1.offsetTop + h1.offsetHeight / 2}px`;
    animate(ring, { scale: [0, 3], opacity: [0.8, 0], duration: 1100, ease: 'outExpo', onComplete: () => { ring.remove(); } });
    animate(chars, { y: ['40%', 0], opacity: [0, 1], rotate: ['8deg', 0], delay: stagger(35), ease: 'outBack' });
    return () => { ring.remove(); };
  });

  // Queue clock: React renders one span per character; the one whose digit changed rolls up from below.
  const clock = stage === 'queue' ? mmss(c.search?.timeInQueue ?? 0) : '';
  useOnChange(clock, (prev, next) => {
    if (!prev || still()) return;
    const spans = root.current!.querySelectorAll('.clock span');
    animate([...spans].filter((_, i) => next[i] !== prev[i]), { y: ['100%', 0], opacity: [0, 1], duration: 250, ease: 'outQuad' });
  });

  // Any other stage: the old title (copied at the previous commit) leaves upward as the new one rises.
  // Off -> lobby is the first connection, which the panel entrance already covers.
  const snap = useRef<{ node: HTMLElement; box: number[] } | null>(null);
  const leaving = useRef(new Set<HTMLElement>());
  useOnChange(stage, (prev, next) => {
    if (prev === 'ready' || next === 'ready' || prev === 'off' || still()) return;
    animate(root.current!.querySelector<HTMLElement>('h1:not([aria-hidden])')!, { y: [14, 0], opacity: [0, 1], duration: 300, ease: 'outQuad', onComplete: (a) => { a.revert(); } });
    const old = snap.current;
    if (!old) return;
    const [left, top, width] = old.box;
    const ghost = root.current!.appendChild(old.node);
    Object.assign(ghost.style, { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${width}px`, pointerEvents: 'none' });
    ghost.setAttribute('aria-hidden', 'true');
    leaving.current.add(ghost);
    animate(ghost, { y: [0, -14], opacity: [1, 0], duration: 300, ease: 'inQuad', onComplete: () => { ghost.remove(); leaving.current.delete(ghost); } });
  });
  useLayoutEffect(() => {
    const h1 = root.current!.querySelector<HTMLElement>('h1:not([aria-hidden])')!;
    snap.current = { node: h1.cloneNode(true) as HTMLElement, box: [h1.offsetLeft, h1.offsetTop, h1.offsetWidth] };
  });
  useEffect(() => () => { leaving.current.forEach((g) => { g.remove(); }); }, []);

  return (
    <header className="status" ref={root} aria-live="polite">
      {stage === 'off' ? <>
        <p className="eyebrow">Offline</p>
        <h1 key="off">Client non collegato</h1>
        <p>Avvia League dal Riot Client: il collegamento parte da solo.</p>
      </> : stage === 'lobby' ? <>
        <p className="eyebrow">{c.lobby ? 'Lobby aperta' : 'Pronto'}</p>
        <h1 key="lobby">{q ? q.label : 'Nessuna coda'}</h1>
        <p className="seats">
          {size <= 10 && (
            <span className="pips" aria-hidden="true">{Array.from({ length: size }, (_, i) => <i key={i} className={i < members.length ? 'on' : undefined}></i>)}</span>
          )}
          {members.length} di {size} nel party
        </p>
      </> : stage === 'queue' ? <>
        <p className="eyebrow">In coda{q && ` · ${q.label}`}</p>
        <h1 key="queue" className="clock">{[...clock].map((ch, i) => <span key={i}>{ch}</span>)}</h1>
        <p>{c.search?.estimatedQueueTime ? `Attesa stimata ${mmss(c.search.estimatedQueueTime)}` : 'Cerco una partita…'}</p>
      </> : stage === 'select' ? <>
        <p className="eyebrow">{PHASE[timer!.phase] ?? 'Selezione campione'}{played && ` · ${played.label}`}</p>
        <h1 key="select" className="clock">{timer!.isInfinite ? '∞' : mmss(left)}</h1>
        <p>
          {action?.isInProgress
            ? `Tocca a te: ${action.type === 'ban' ? 'banna un campione' : 'scegli il tuo campione'}.`
            : action
              ? 'Mostra alla squadra chi vorresti giocare.'
              : 'In attesa degli altri giocatori.'}
        </p>
      </> : stage === 'ready' ? <>
        <p className="eyebrow">{q?.label ?? 'Coda'}</p>
        <h1 key="found">Partita trovata</h1>
        <p>
          {response === 'Accepted'
            ? (c.autoAccepted ? 'Accettata per te. In attesa degli altri giocatori.' : 'Accettata. In attesa degli altri giocatori.')
            : response === 'Declined'
              ? 'Rifiutata.'
              : 'Accetta prima che scada il tempo.'}
        </p>
      </> : stage === 'post' ? <>
        <p className="eyebrow">Fine partita</p>
        <h1 key={`post-${c.eog ? (post?.win ? 'win' : 'loss') : 'wait'}`}>{!c.eog ? 'Statistiche in arrivo' : post!.win ? 'Vittoria' : 'Sconfitta'}</h1>
        <p>{post ? `${post.me.champion} · ${post.me.kills} / ${post.me.deaths} / ${post.me.assists}` : 'Il client sta raccogliendo i risultati.'}</p>
      </> : <>
        <p className="eyebrow">In partita</p>
        <h1 key="game">{c.phase === 'ChampSelect' ? 'Selezione campione' : 'Partita in corso'}</h1>
        <p>Prosegue nell’interfaccia di Riot. Qui torna tutto alla fine della partita.</p>
      </>}
    </header>
  );
}
