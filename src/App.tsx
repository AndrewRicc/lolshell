import { useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { animate, stagger } from 'animejs';
import { settings, start } from './lib/client.ts';
import { view, mmss, useClient } from './lib/view.ts';
import { useMotion, useOnChange, still } from './lib/motion.ts';
import Backdrop, { type BackdropHandle } from './components/Backdrop.tsx';
import Account from './components/Account.tsx';
import Chat from './components/Chat.tsx';
import Status from './components/Status.tsx';
import Party from './components/Party.tsx';
import ModePicker from './components/ModePicker.tsx';
import Friends from './components/Friends.tsx';
import Bar from './components/Bar.tsx';
import Select from './components/Select.tsx';
import './shell.css';

start();

export default function App() {
  const c = useClient();
  const { glass } = useSnapshot(settings);

  const stage = view.stage;
  const active = stage === 'lobby' || stage === 'queue' || stage === 'ready';
  const penalty = c.search?.lowPriorityData?.penaltyTimeRemaining ?? 0;
  // shortcut: assumes the ready check lasts about 10 s; the client reports elapsed time only.
  const timeLeft = 1 - Math.min(c.ready?.timer ?? 0, 10) / 10;
  const late = timeLeft < 0.3;

  // Match found: the picture breathes in; the rest of the moment lives in Status and Bar.
  const backdrop = useRef<BackdropHandle>(null);
  useOnChange(stage, (_, next) => { if (next === 'ready') backdrop.current?.pulse(); });
  const timer = useRef<HTMLDivElement>(null);
  useMotion(timer, [stage, late], () => {
    if (!late) return;
    animate(timer.current!.firstElementChild!, { backgroundColor: ['var(--teal)', 'var(--red)'], duration: 300 });
    animate(timer.current!, { x: [-2, 2], duration: 50, loop: 5, alternate: true, onComplete: (a) => { a.revert(); } });
  });

  // First connection: the panels come up one after the other, once per session.
  const shell = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  useOnChange(c.connected, (_, on) => {
    if (!on || entered.current || still()) return;
    entered.current = true;
    animate(shell.current!.querySelectorAll('.status, .work > *, aside, .bar'), { y: [16, 0], opacity: [0, 1], delay: stagger(70), ease: 'outExpo', onComplete: (a) => { a.revert(); } });
  });

  // Each new error replays the slide, even the same text twice (the client clears it in between).
  const [toast, setToast] = useState({ text: '', n: 0 });
  useOnChange(c.error, (_, text) => { if (text) setToast((t) => ({ text, n: t.n + 1 })); });

  // Gold motes drift up behind the panels; the champion grid stays calm. Their randomness is fixed once.
  const motes = useMemo(() => Array.from({ length: 12 }, () => ({ left: `${Math.random() * 100}%`, peak: 0.15 + Math.random() * 0.25, duration: 8000 + Math.random() * 6000 })), []);
  const drifting = stage === 'lobby' || stage === 'queue';
  const field = useRef<HTMLDivElement>(null);
  useMotion(field, [drifting], () => {
    if (!drifting) return;
    field.current!.querySelectorAll('.mote').forEach((m, i) => {
      const { peak, duration } = motes[i]!;
      animate(m, { y: ['0vh', '-105vh'], opacity: [0, peak, 0], duration, delay: Math.random() * duration, ease: 'linear', loop: true });
    });
  });

  return (
    <div ref={shell} className={glass ? 'app glass' : 'app'} data-stage={stage} data-ban={view.banning || undefined}>
      <Backdrop ref={backdrop} />
      {drifting && <div className="motes" ref={field} aria-hidden="true">{motes.map((m, i) => <i key={i} className="mote" style={{ left: m.left }}></i>)}</div>}

      <Account />
      {c.chatOpen && <Chat />}
      <Toast {...toast} on={!!c.error} />

      <main>
        <Status />

        <div className="body">
          <div className="work">
            {stage === 'ready' && (
              <div className={late ? 'timer late' : 'timer'} ref={timer} role="progressbar" aria-label="Tempo per accettare" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timeLeft * 100)}>
                <span style={{ transform: `scaleX(${timeLeft})` }}></span>
              </div>
            )}

            {active && <Party />}
            {stage === 'lobby' && <ModePicker />}
            {stage === 'select' && <Select />}

            {stage === 'queue' && <>
              {penalty > 0 && <p className="notice">Coda a bassa priorità: restano {mmss(penalty)} di attesa aggiuntiva.</p>}
              {(c.search?.errors ?? []).map((e) => (
                <p key={e.id} className="notice" role="alert">{e.message || 'La ricerca è stata bloccata.'}{e.penaltyTimeRemaining > 0 && ` Riprova tra ${mmss(e.penaltyTimeRemaining)}.`}</p>
              ))}
            </>}
          </div>

          {c.connected && <Friends />}
        </div>

        {(active || stage === 'select') && <Bar />}
      </main>
    </div>
  );
}

// Slides in with a small bounce (CSS, so reduced motion switches it off); on dismissal it fades but stays mounted for a moment.
function Toast({ text, n, on }: { text: string; n: number; on: boolean }) {
  if (!text) return null;
  return <p key={n} className={on ? 'toast' : 'toast gone'} role={on ? 'alert' : undefined} aria-hidden={!on}>{text}</p>;
}
