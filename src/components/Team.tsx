import { roleName, swap, type Player } from '../lib/client.ts';
import { champIcon, champName, useClient } from '../lib/view.ts';
import RoleGlyph from './RoleGlyph.tsx';
import './Team.css';

type Props = { title: string; players: readonly Player[]; bans: number[]; enemy?: boolean };

export default function Team({ title, players, bans, enemy = false }: Props) {
  const c = useClient();
  const s = c.select!;
  const acting = (p: Player) => s.actions.flat().find((a) => a.isInProgress && !a.completed && a.actorCellId === p.cellId);
  const trade = (p: Player) => !enemy && s.trades.find((t) => t.cellId === p.cellId);
  // Ranked hides names until the game starts.
  const name = (p: Player, i: number) => p.gameName || c.names[p.puuid] || `${enemy ? 'Nemico' : 'Alleato'} ${i + 1}`;

  return (
    <section className={enemy ? 'team enemy' : 'team'} aria-label={title}>
      <div className="head">
        <h2>{title}</h2>
        <span className="bans" aria-label="Campioni bannati">
          {bans.map((id, i) => <span key={i} className="ban" data-id={id}><img src={champIcon(id)} alt={champName(id)} title={champName(id)} width="22" height="22" /><i className="slash"></i></span>)}
        </span>
      </div>
      <ul>
        {players.map((p, i) => {
          const a = acting(p);
          const id = p.championId || p.championPickIntent;
          const t = trade(p);
          return (
            <li key={p.cellId} data-cell={p.cellId} className={'seat' + (a ? ' acting' : '') + (p.cellId === s.localPlayerCellId ? ' me' : '') + (!p.championId ? ' intent' : '')}>
              <img src={champIcon(id)} alt="" width="40" height="40" />
              <span className="person">
                <b>{name(p, i)}</b>
                <small>{a ? (a.type === 'ban' ? 'Banna…' : 'Sceglie…') : champName(id) || 'In attesa'}</small>
              </span>
              {t && t.state === 'AVAILABLE' ? (
                <button className="icon" aria-label={`Chiedi a ${name(p, i)} di scambiare campione`} title="Chiedi lo scambio" disabled={c.busy} onClick={() => swap(t.id, 'request')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h11l-3-3M17 16H6l3 3" /></svg>
                </button>
              ) : t && t.state === 'RECEIVED' ? <>
                <button className="icon" aria-label={`Accetta lo scambio con ${name(p, i)}`} title="Accetta lo scambio" disabled={c.busy} onClick={() => swap(t.id, 'accept')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </button>
                <button className="icon" aria-label={`Rifiuta lo scambio con ${name(p, i)}`} title="Rifiuta lo scambio" disabled={c.busy} onClick={() => swap(t.id, 'decline')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </> : t && t.state === 'SENT' ? (
                <button className="link" disabled={c.busy} onClick={() => swap(t.id, 'cancel')}>Annulla</button>
              ) : roleName(p.assignedPosition?.toUpperCase()) && (
                <span className="role" title={roleName(p.assignedPosition.toUpperCase())}><RoleGlyph id={p.assignedPosition.toUpperCase()} /></span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
