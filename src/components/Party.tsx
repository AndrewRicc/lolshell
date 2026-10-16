import { useEffect, useRef } from 'react';
import { animate, stagger, svg } from 'animejs';
import { ROLES, roleName, pickRoles, leave, kick, promote, lobbyChat, openChat, type Member } from '../lib/client.ts';
import RoleGlyph from './RoleGlyph.tsx';
import Badge from './Badge.tsx';
import { ui, view, icon, unread, nameOf, useClient } from '../lib/view.ts';
import { still, useMotion, useOnChange } from '../lib/motion.ts';
import './Party.css';

export default function Party() {
  const c = useClient();
  const stage = view.stage;
  const q = view.q;
  const me = view.me;
  const myRoles = view.myRoles;
  const members = view.members;
  const size = view.size;
  const room = lobbyChat();
  const free = Math.max(size - members.length, 0);
  // Only a custom game has two sides; the client lists who sits on each.
  const teamOf = (m: Member) => c.lobby?.gameConfig?.customTeam200?.some((x) => x.puuid === m.puuid) ? 'Squadra 2'
    : c.lobby?.gameConfig?.customTeam100?.some((x) => x.puuid === m.puuid) ? 'Squadra 1' : '';

  // Search starts: a wave runs through the slots.
  const root = useRef<HTMLElement>(null);
  useMotion(root, [stage === 'queue'], () => {
    if (stage === 'queue') animate('.member', { y: [0, -6, 0], duration: 500, delay: stagger(60), ease: 'inOutSine' });
  });

  // A newly picked role draws itself in the button, then fills with a small pop.
  useOnChange(myRoles.join(), (prev, next) => {
    if (still() || !root.current) return;
    const was = prev.split(',');
    next.split(',').forEach((id, n) => {
      if (id === was[n]) return;
      const g = root.current!.querySelectorAll('button.role')[n]?.querySelector('.glyph');
      const paths = [...(g?.querySelectorAll('path') ?? [])].filter((p) => p.getAttribute('d'));
      if (!g || !paths.length) return;
      paths.forEach((p) => p.setAttribute('style', 'stroke: currentColor; stroke-width: 1; fill-opacity: 0'));
      const anims = [
        animate(paths, { fillOpacity: [0, 1], duration: 200, delay: 500, ease: 'linear' }),
        animate(svg.createDrawable(paths), { draw: ['0 0', '0 1'], duration: 500, ease: 'inOutSine' }),
        animate(g, { scale: [1, 1.15, 1], duration: 200, delay: 500, ease: 'outQuad' }),
      ];
      // Back to the plain filled glyph: no stroke, dash or transform left behind.
      anims[0].then(() => {
        anims.forEach((a) => a.revert());
        paths.forEach((p) => ['style', 'pathLength', 'stroke-dasharray', 'stroke-dashoffset', 'draw'].forEach((a) => p.removeAttribute(a)));
        g.removeAttribute('style');
      });
    });
  });

  // Role menu: the options step in as it opens ('toggle' does not bubble, so catch it on the way down).
  useEffect(() => {
    const el = root.current!;
    const open = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open' || still()) return;
      const a = animate((e.target as Element).querySelectorAll('button'), { y: [6, 0], opacity: [0, 1], delay: stagger(30), duration: 200, ease: 'outQuad' });
      a.then(() => a.revert());
    };
    el.addEventListener('toggle', open, true);
    return () => el.removeEventListener('toggle', open, true);
  }, []);

  return (
    <section ref={root} aria-labelledby="h-party">
      <div className="head">
        <h2 id="h-party">Party</h2>
        <span className="head-actions">
          {room && c.chatOpen !== room && (
            <button className="chip" onClick={() => openChat(room)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v10h-8l-4 3v-3H5z" /></svg>
              Chat del party<Badge n={+unread(room)} label={`${unread(room)} messaggi non letti`} />
            </button>
          )}
          {c.lobby && stage === 'lobby' && <button className="link" onClick={leave} disabled={c.busy}>Esci dal party</button>}
        </span>
      </div>
      <ul className={size > 5 ? 'party big' : 'party'} style={{ '--cols': Math.min(size, 5) } as React.CSSProperties}>
        {members.map((m) => {
          const self = m.summonerId === c.me?.summonerId;
          return (
            <li key={m.summonerId} className="member">
              <img src={icon(m.summonerIconId)} alt="" width="40" height="40" />
              <span className="member-name">
                <span>{nameOf(m)}</span>
                {m.isLeader && members.length > 1 && (
                  <svg viewBox="0 0 24 24" role="img" aria-label="Capo party"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z" /></svg>
                )}
              </span>
              {q?.roles ? (
                <span className="member-roles">
                  {[0, 1].map((n) => {
                    const id = self ? myRoles[n] : n ? m.secondPositionPreference : m.firstPositionPreference;
                    return self && stage === 'lobby'
                      // Like Riot's lobby: your two roles sit under your own slot and open a small menu.
                      ? (!n || (myRoles[0] !== 'FILL' && myRoles[0] !== 'UNSELECTED')) && (
                        <button key={n} className="role" popoverTarget={`roles-${n}`} style={{ anchorName: `--role-${n}` }} disabled={c.busy}
                          aria-label={`${n ? 'Secondo' : 'Primo'} ruolo: ${roleName(id) || 'da scegliere'}`} title={`${n ? 'Secondo' : 'Primo'} ruolo`}>
                          <RoleGlyph id={id} />
                        </button>
                      )
                      : roleName(id) && (!n || m.firstPositionPreference !== 'FILL') && (
                        <span key={n} className="role" role="img" aria-label={roleName(id)} title={roleName(id)}><RoleGlyph id={id} /></span>
                      );
                  })}
                </span>
              ) : teamOf(m) && (
                <span className="member-team">{teamOf(m)}</span>
              )}
              {c.lobby && !self && stage === 'lobby' && (me?.isLeader || me?.allowedKickOthers) && (
                <span className="member-actions">
                  {me?.isLeader && (
                    <button className="icon" aria-label={`Rendi ${nameOf(m)} capo party`} title="Rendi capo party" disabled={c.busy} onClick={() => promote(m.summonerId)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z" /></svg>
                    </button>
                  )}
                  {me?.allowedKickOthers && (
                    <button className="icon" aria-label={`Espelli ${nameOf(m)} dal party`} title="Espelli dal party" disabled={c.busy} onClick={() => kick(m.summonerId)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
        {size > 5 ? (
          !!free && <li className="member free">{free === 1 ? '1 posto libero' : `${free} posti liberi`}</li>
        ) : (
          Array.from({ length: free }, (_, i) => (
            <li key={i}>
              <button className="member free" disabled={stage !== 'lobby' || (!!c.lobby && !me?.allowedInviteOthers)} onClick={() => { ui.friendsOpen = true; }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Invita
              </button>
            </li>
          ))
        )}
      </ul>
      {q?.roles && stage === 'lobby' && [0, 1].map((n) => (
        <div key={n} className="role-menu" popover="" id={`roles-${n}`} role="radiogroup" aria-label={n ? 'Secondo ruolo' : 'Primo ruolo'} style={{ positionAnchor: `--role-${n}` }}>
          {ROLES.map(([id, label]) => (
            <button
              key={id}
              role="radio" aria-checked={myRoles[n] === id} disabled={c.busy || (n === 1 && id === myRoles[0])}
              onClick={(e) => { e.currentTarget.parentElement!.hidePopover(); if (n) pickRoles(myRoles[0], id); else pickRoles(id, myRoles[1]); }}
            ><RoleGlyph id={id} />{label}</button>
          ))}
        </div>
      ))}
    </section>
  );
}
