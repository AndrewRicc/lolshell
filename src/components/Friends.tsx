import { useRef, useState, type FormEvent } from 'react';
import { animate } from 'animejs';
import { useSnapshot } from 'valtio';
import { invite, answerInvite, addFriend, answerRequest, openChat, type Friend } from '../lib/client.ts';
import { ui, view, icon, unread, useClient } from '../lib/view.ts';
import { useOnChange, still } from '../lib/motion.ts';
import Badge from './Badge.tsx';
import './Friends.css';

// Order here is the order of the friends list.
const AVAILABILITY: Record<string, string> = { chat: 'Disponibile', away: 'Assente', dnd: 'Occupato', mobile: 'Su mobile', offline: 'Offline' };
const RANK = Object.keys(AVAILABILITY);
const rank = (f: Friend) => (RANK.indexOf(f.availability) + 1 || RANK.length) - 1;
const onLeague = (f: Friend) => f.product === 'league_of_legends' && rank(f) < 3;

export default function Friends() {
  const c = useClient();
  const { friendsOpen } = useSnapshot(ui);
  const [riotId, setRiotId] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const stage = view.stage;
  const me = view.me;
  const members = view.members;
  const size = view.size;
  const incoming = c.requests.filter((r) => r.direction === 'in');

  async function add(e: FormEvent) {
    e.preventDefault();
    setRequestSent(false);
    if (await addFriend(riotId)) {
      setRiotId('');
      setRequestSent(true);
    }
  }

  function chatWith(f: Friend) {
    ui.friendsOpen = false;
    openChat(f.id);
  }

  const pendingInvites = c.invites.filter((i) => i.state === 'Pending');
  const friends = [...c.friends].sort((a, b) => rank(a) - rank(b) || (a.gameName ?? '').localeCompare(b.gameName ?? ''));
  const online = c.friends.filter(onLeague).length;
  const inParty = (id: number) => (c.lobby?.members ?? []).some((m) => m.summonerId === id);
  const invited = (id: number) => (c.lobby?.invitations ?? []).some((i) => i.toSummonerId === id && i.state === 'Pending');
  const queueLabel = (id?: number) => c.queues.find((x) => x.id === id)?.label ?? 'una partita';

  // A friend who turns available glows teal; with the drawer shut, the online counter pops instead.
  const root = useRef<HTMLElement>(null);
  useOnChange(c.friends.map((f) => `${f.puuid}=${f.availability}`).join(), (prev, next) => {
    const was = new Map(prev.split(',').map((x) => x.split('=') as [string, string]));
    const fresh = c.friends.filter((f) => f.availability === 'chat' && was.has(f.puuid) && was.get(f.puuid) !== 'chat'); // not on first load, not new friends
    if (!fresh.length || still()) return;
    const rows = [...root.current!.querySelectorAll<HTMLElement>('.people li[data-id]')].filter((li) => fresh.some((f) => f.puuid === li.dataset.id));
    animate(rows, { backgroundColor: ['rgba(25, 214, 199, 0.35)', 'rgba(25, 214, 199, 0)'], duration: 500, ease: 'outQuad', onComplete: (a) => { a.revert(); } });
    if (!friendsOpen) animate(root.current!.querySelector('.pill .count')!, { scale: [1.3, 1], duration: 300, ease: 'outBack' });
  });

  return (
    <aside ref={root}>
      {!!pendingInvites.length && stage === 'lobby' && (
        <section aria-labelledby="h-invites">
          <div className="head"><h2 id="h-invites">Inviti</h2></div>
          <ul className="people">
            {pendingInvites.map((inv) => (
              <li key={inv.invitationId}>
                <span className="person"><b>{c.names[inv.fromPuuid] || inv.fromSummonerName || 'Un amico'}</b><small>ti invita a {queueLabel(inv.gameConfig?.queueId)}</small></span>
                <button className="icon" aria-label="Accetta l’invito" disabled={c.busy || !inv.canAcceptInvitation} onClick={() => answerInvite(inv.invitationId, true)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </button>
                <button className="icon" aria-label="Rifiuta l’invito" disabled={c.busy} onClick={() => answerInvite(inv.invitationId, false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={friendsOpen ? 'friends open' : 'friends'}>
        <button className="pill" aria-expanded={friendsOpen} aria-controls="friends" onClick={() => { ui.friendsOpen = !friendsOpen; }}>
          <h2>Amici</h2><span className="count">{online} online su {friends.length}</span>
          <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
        </button>
        <div className="drawer" id="friends" inert={!friendsOpen}><div>
          <form className="add" onSubmit={add}>
            <input value={riotId} onChange={(e) => { setRiotId(e.target.value); setRequestSent(false); }} placeholder="Aggiungi: Nome#TAG" aria-label="Riot ID da aggiungere agli amici" maxLength={40} autoComplete="off" spellCheck="false" />
            <button className="icon" aria-label="Invia richiesta di amicizia" disabled={c.busy || !riotId.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </form>
          {requestSent && <p className="hint sent" role="status">Richiesta di amicizia inviata.</p>}
          {!!incoming.length && (
            <ul className="people requests">
              {incoming.map((r) => (
                <li key={r.puuid}>
                  <span className="person"><b>{r.gameName || r.name}</b><small>vuole aggiungerti agli amici</small></span>
                  <button className="icon" aria-label={`Accetta ${r.gameName}`} disabled={c.busy} onClick={() => answerRequest(r.puuid, true)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                  </button>
                  <button className="icon" aria-label={`Rifiuta ${r.gameName}`} disabled={c.busy} onClick={() => answerRequest(r.puuid, false)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {friends.length ? (
            <ul className="people">
              {friends.map((f) => (
                <li key={f.puuid} data-id={f.puuid} className={onLeague(f) ? undefined : 'away'} data-availability={f.availability}>
                  <button className="person chat-with" data-opens-chat aria-label={`Apri la chat con ${f.gameName || f.name}`} onClick={() => chatWith(f)}>
                    <img src={icon(f.icon)} alt="" width="32" height="32" loading="lazy" />
                    <span><b>{f.gameName || f.name}</b><small>{AVAILABILITY[f.availability] ?? 'Offline'}</small></span>
                  </button>
                  <Badge n={+unread(f.id)} label={`${unread(f.id)} messaggi non letti`} />
                  {inParty(f.summonerId) ? (
                    <small className="tag">Nel party</small>
                  ) : invited(f.summonerId) ? (
                    <small className="tag">Invitato</small>
                  ) : onLeague(f) && stage === 'lobby' && (
                    <button className="icon" aria-label={`Invita ${f.gameName}`} disabled={c.busy || (!!c.lobby && !me?.allowedInviteOthers) || members.length >= size} onClick={() => invite(f.summonerId)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">La lista amici è vuota.</p>
          )}
        </div></div>
      </div>
    </aside>
  );
}
