import { useRef } from 'react';
import { useSnapshot } from 'valtio';
import { animate, stagger } from 'animejs';
import { settings, play, cancelSearch, accept, decline, myAction, lockIn, reroll, quitSelect } from '../lib/client.ts';
import { view, useClient } from '../lib/view.ts';
import { hide, desktop } from '../lib/win.ts';
import { useMotion, still, remember, recall } from '../lib/motion.ts';
import './Bar.css';

export default function Bar() {
  const c = useClient();
  const set = useSnapshot(settings);

  const stage = view.stage;
  const q = view.q;
  const me = view.me;
  const myRoles = view.myRoles;
  const response = view.response;

  const action = myAction();

  // Accept breathes (its --lift plus a teal halo) until answered, then pops once. It stays, disabled, so the pop has something to land on.
  const btn = useRef<HTMLButtonElement>(null);
  useMotion(btn, [stage === 'ready' && response], () => {
    if (stage !== 'ready') return;
    if (response === 'None') animate(btn.current!, { scale: [1, 1.05], boxShadow: ['0 18px 44px rgba(0, 0, 0, 0.38), 0 0 0 0 rgba(25, 214, 199, 0)', '0 18px 44px rgba(0, 0, 0, 0.38), 0 0 28px 4px rgba(25, 214, 199, 0.55)'], duration: 700, ease: 'inOutSine', alternate: true, loop: true });
    else if (response === 'Accepted') animate(btn.current!, { scale: [1, 1.1, 1], duration: 350, ease: 'outBack' });
  });

  // Queue entered: the new Cancel button grows in.
  const bar = useRef<HTMLElement>(null);
  useMotion(bar, [stage === 'queue'], () => {
    if (stage === 'queue') animate('.primary', { scale: [0.9, 1], opacity: [0, 1], duration: 300, ease: 'outBack' });
  });

  // Two ripples leave the button centre and squash it, all in the click itself: play() is never delayed.
  const go = () => {
    if (!still()) {
      const b = btn.current!, r = b.getBoundingClientRect(), o = b.closest('.bar')!.getBoundingClientRect();
      const ripples = [0, 1].map(() => b.closest('.bar')!.appendChild(Object.assign(document.createElement('span'), { className: 'ripple' })));
      ripples.forEach((s) => { s.style.left = `${r.left - o.left + r.width / 2}px`; s.style.top = `${r.top - o.top + r.height / 2}px`; });
      animate(ripples, { scale: [0, 4], opacity: [0.5, 0], duration: 800, delay: stagger(180), ease: 'outQuad', onComplete: () => { ripples.forEach((s) => { s.remove(); }); } });
      animate(b, { scale: [1, 0.96, 1], duration: 250 });
    }
    void play();
  };

  const blocked =
    !q ? (c.queues.length ? 'Nessuna coda disponibile in questo momento.' : 'Carico le code…')
      : c.lobby && !me?.allowedStartActivity ? 'Solo il capo party può avviare la ricerca.'
      : q.roles && myRoles[0] === 'UNSELECTED' ? 'Scegli i ruoli per questa coda.'
      : c.lobby && !c.lobby.canStartActivity ? 'Il party non può entrare in questa coda: controlla numero di giocatori e ruoli.'
      : null;

  return (
    <footer className="bar" ref={bar}>
      {stage === 'lobby' && blocked && <p className="notice">{blocked}</p>}
      <div className="actions">
        {stage === 'lobby' ? (
          <button className="primary" ref={btn} onClick={go} disabled={!!blocked || c.busy}>{!q?.custom ? 'Trova partita' : c.lobby ? 'Avvia partita' : 'Crea lobby'}</button>
        ) : stage === 'queue' ? <>
          <button className="primary" onClick={cancelSearch} disabled={c.busy}>Annulla ricerca</button>
          {desktop && <button className="quiet" onClick={hide}>Nascondi nella tray</button>}
        </> : stage === 'select' ? <>
          {action?.isInProgress && (
            <button className="primary" onClick={() => { if (action.type === 'pick') remember('pick', document.querySelector('.champs [aria-checked="true"] img')); void lockIn().then((ok) => { if (!ok) recall('pick'); }); }} disabled={c.busy || !action.championId}>{action.type === 'ban' ? 'Banna' : 'Blocca'}</button>
          )}
          {c.select!.allowRerolling && (
            <button className="quiet" onClick={reroll} disabled={c.busy || !c.select!.rerollsRemaining}>Cambia campione ({c.select!.rerollsRemaining})</button>
          )}
          {(c.select!.isCustomGame || c.select!.showQuitButton) && (
            <button className="quiet" onClick={quitSelect} disabled={c.busy}>Esci</button>
          )}
        </> : response !== 'Declined' && <>
          <button className="primary" ref={btn} onClick={accept} disabled={c.busy || response !== 'None'}>Accetta</button>
          {response === 'None' && <button className="quiet" onClick={decline} disabled={c.busy}>Rifiuta</button>}
        </>}
        {stage !== 'select' && (
          <label className={set.autoAccept ? 'auto on' : 'auto'}>
            <input type="checkbox" role="switch" checked={set.autoAccept} onChange={(e) => { settings.autoAccept = e.target.checked; }} />
            <span><b>Auto-accetta</b><small>{set.autoAccept ? 'L’app accetta al posto tuo' : 'Accetti tu ogni partita'}</small></span>
          </label>
        )}
      </div>
    </footer>
  );
}
