import { useSnapshot } from 'valtio';
import { settings, play, cancelSearch, accept, decline, myAction, lockIn, reroll, quitSelect } from '../lib/client.ts';
import { view, useClient } from '../lib/view.ts';
import { hide, desktop } from '../lib/win.ts';
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

  const blocked =
    !q ? (c.queues.length ? 'Nessuna coda disponibile in questo momento.' : 'Carico le code…')
      : c.lobby && !me?.allowedStartActivity ? 'Solo il capo party può avviare la ricerca.'
      : q.roles && myRoles[0] === 'UNSELECTED' ? 'Scegli i ruoli per questa coda.'
      : c.lobby && !c.lobby.canStartActivity ? 'Il party non può entrare in questa coda: controlla numero di giocatori e ruoli.'
      : null;

  return (
    <footer className="bar">
      {stage === 'lobby' && blocked && <p className="notice">{blocked}</p>}
      <div className="actions">
        {stage === 'lobby' ? (
          <button className="primary" onClick={play} disabled={!!blocked || c.busy}>{!q?.custom ? 'Trova partita' : c.lobby ? 'Avvia partita' : 'Crea lobby'}</button>
        ) : stage === 'queue' ? <>
          <button className="primary" onClick={cancelSearch} disabled={c.busy}>Annulla ricerca</button>
          {desktop && <button className="quiet" onClick={hide}>Nascondi nella tray</button>}
        </> : stage === 'select' ? <>
          {action?.isInProgress && (
            <button className="primary" onClick={lockIn} disabled={c.busy || !action.championId}>{action.type === 'ban' ? 'Banna' : 'Blocca'}</button>
          )}
          {c.select!.allowRerolling && (
            <button className="quiet" onClick={reroll} disabled={c.busy || !c.select!.rerollsRemaining}>Cambia campione ({c.select!.rerollsRemaining})</button>
          )}
          {(c.select!.isCustomGame || c.select!.showQuitButton) && (
            <button className="quiet" onClick={quitSelect} disabled={c.busy}>Esci</button>
          )}
        </> : response === 'None' && <>
          <button className="primary" onClick={accept} disabled={c.busy}>Accetta</button>
          <button className="quiet" onClick={decline} disabled={c.busy}>Rifiuta</button>
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
