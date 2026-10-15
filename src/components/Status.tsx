import { useEffect, useState } from 'react';
import { myAction } from '../lib/client.ts';
import { view, mmss, useClient } from '../lib/view.ts';
import './Status.css';

const PHASE: Record<string, string> = { PLANNING: 'Preparazione', BAN_PICK: 'Ban e scelte', FINALIZATION: 'Ultimi ritocchi', GAME_STARTING: 'La partita sta partendo' };

export default function Status() {
  const c = useClient();
  const stage = view.stage;
  const q = view.q;
  const members = view.members;
  const size = view.size;
  const response = view.response;

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

  return (
    <header className="status" aria-live="polite">
      {stage === 'off' ? <>
        <p className="eyebrow">Offline</p>
        <h1>Client non collegato</h1>
        <p>Avvia League dal Riot Client: il collegamento parte da solo.</p>
      </> : stage === 'lobby' ? <>
        <p className="eyebrow">{c.lobby ? 'Lobby aperta' : 'Pronto'}</p>
        <h1>{q ? q.label : 'Nessuna coda'}</h1>
        <p className="seats">
          {size <= 10 && (
            <span className="pips" aria-hidden="true">{Array.from({ length: size }, (_, i) => <i key={i} className={i < members.length ? 'on' : undefined}></i>)}</span>
          )}
          {members.length} di {size} nel party
        </p>
      </> : stage === 'queue' ? <>
        <p className="eyebrow">In coda{q && ` · ${q.label}`}</p>
        <h1 className="clock">{mmss(c.search?.timeInQueue ?? 0)}</h1>
        <p>{c.search?.estimatedQueueTime ? `Attesa stimata ${mmss(c.search.estimatedQueueTime)}` : 'Cerco una partita…'}</p>
      </> : stage === 'select' ? <>
        <p className="eyebrow">{PHASE[timer!.phase] ?? 'Selezione campione'}{played && ` · ${played.label}`}</p>
        <h1 className="clock">{timer!.isInfinite ? '∞' : mmss(left)}</h1>
        <p>
          {action?.isInProgress
            ? `Tocca a te: ${action.type === 'ban' ? 'banna un campione' : 'scegli il tuo campione'}.`
            : action
              ? 'Mostra alla squadra chi vorresti giocare.'
              : 'In attesa degli altri giocatori.'}
        </p>
      </> : stage === 'ready' ? <>
        <p className="eyebrow">{q?.label ?? 'Coda'}</p>
        <h1>Partita trovata</h1>
        <p>
          {response === 'Accepted'
            ? (c.autoAccepted ? 'Accettata per te. In attesa degli altri giocatori.' : 'Accettata. In attesa degli altri giocatori.')
            : response === 'Declined'
              ? 'Rifiutata.'
              : 'Accetta prima che scada il tempo.'}
        </p>
      </> : <>
        <p className="eyebrow">In partita</p>
        <h1>{c.phase === 'ChampSelect' ? 'Selezione campione' : 'Partita in corso'}</h1>
        <p>Prosegue nell’interfaccia di Riot. Qui torna tutto alla fine della partita.</p>
      </>}
    </header>
  );
}
