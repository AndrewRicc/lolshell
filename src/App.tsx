import { useSnapshot } from 'valtio';
import { settings, start } from './lib/client.ts';
import { asset } from './lib/lcu.ts';
import { view, mmss, useClient } from './lib/view.ts';
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

  return (
    <div className={glass ? 'app glass' : 'app'} data-stage={stage} data-ban={view.banning || undefined}>
      {c.splash && <img className="backdrop" src={asset(c.splash)} alt="" />}

      <Account />
      {c.chatOpen && <Chat />}
      {c.error && <p className="toast" role="alert">{c.error}</p>}

      <main>
        <Status />

        <div className="body">
          <div className="work">
            {stage === 'ready' && (
              <div className="timer" role="progressbar" aria-label="Tempo per accettare" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timeLeft * 100)}>
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
