import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useSnapshot } from 'valtio';
import { lobbyChat, openChat, closeChat, closeTab, send, type Conversation, type Message } from '../lib/client.ts';
import { animate } from 'animejs';
import { ui, icon, unread, useClient, useClickAway } from '../lib/view.ts';
import { useOnChange, still } from '../lib/motion.ts';
import Badge from './Badge.tsx';
import './Chat.css';

const SYSTEM: Record<string, string> = { joined_room: 'è nel party', left_room: 'ha lasciato il party' };

const LAUNCHER = 52; // the docked button's size in Chat.css: the panel grows out of it and folds back into it

export default function Chat() {
  const c = useClient();
  const { friendsOpen } = useSnapshot(ui);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLOListElement>(null);
  const panel = useRef<HTMLElement>(null);
  const morph = useRef<Animation | null>(null);
  // The friends list counts as inside: opening it only slides the chat away, it does not close it.
  useClickAway(!!c.chatOpen, '.chat, .chat-launcher, aside, [data-opens-chat]', closeChat);

  // While the panel folds away chatOpen is already null: it keeps showing the last chat.
  const last = useRef(c.chatOpen);
  if (c.chatOpen) last.current = c.chatOpen;
  const shown = c.chatOpen ?? last.current;
  const [visible, setVisible] = useState(!!c.chatOpen);

  // The panel unfolds from the docked button's corner and folds back into it, as a clip over the whole panel.
  const clip = (el: HTMLElement) => {
    const { width: w, height: h } = el.getBoundingClientRect();
    return [`inset(${h - LAUNCHER}px 0px 0px ${w - LAUNCHER}px round ${LAUNCHER / 2}px)`, 'inset(0px 0px 0px 0px round 18px)'];
  };
  function unfold() {
    morph.current?.cancel();
    const el = panel.current;
    if (still() || !el) return;
    morph.current = el.animate({ clipPath: clip(el) }, { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    for (const part of el.children) part.animate({ opacity: [0, 1] }, { duration: 260, delay: 160, easing: 'ease-out', fill: 'backwards' });
  }
  function fold() {
    morph.current?.cancel();
    const el = panel.current;
    if (still() || !el) return setVisible(false);
    morph.current = el.animate({ clipPath: clip(el).reverse() }, { duration: 300, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' });
    morph.current.finished.then(() => setVisible(false), () => {}); // cancelled: it is opening again
  }
  useOnChange(!!c.chatOpen, (_, opening) => {
    if (!opening) fold();
    else if (visible) unfold(); // reopened while folding
    else setVisible(true);
  });
  useLayoutEffect(() => { if (visible && c.chatOpen) unfold(); }, [visible]);

  const room = lobbyChat();
  // The party chat first, then every private conversation the client knows about.
  const tabs = c.conversations.filter((v) => (v.id === room && room !== c.roomHidden) || v.type === 'chat').sort((a, b) => Number(b.id === room) - Number(a.id === room));
  const messages = c.chats[shown!] ?? [];
  const open = c.conversations.find((v) => v.id === shown);
  const friendOf = (id: string) => c.friends.find((f) => f.id === id);
  const chatName = (v: Conversation) => v.id === room ? (c.select ? 'Squadra' : 'Party') : v.gameName || friendOf(v.id)?.gameName || 'Chat';
  const author = (m: Message) => c.names[m.fromPuuid] ?? c.friends.find((f) => f.puuid === m.fromPuuid)?.gameName ?? '';
  const mine = (m: Message) => m.fromPuuid === c.me?.puuid;

  // Keep the newest message in view.
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length]);

  // A new message in the open chat slides up from below (opening or switching chats does not).
  useOnChange(`${c.chatOpen}|${messages.length}`, (prev, next) => {
    const [pc, pn] = prev.split('|'), [nc, nn] = next.split('|');
    if (pc !== nc || +pn === 0 || +nn <= +pn || still()) return; // an empty chat filling up is the history loading
    animate([...log.current!.children].slice(-(+nn - +pn)), { y: [12, 0], opacity: [0, 1], duration: 250, ease: 'outQuad', onComplete: (a) => { a.revert(); } });
  });

  // The docked button opens the chat that needs reading, else the last one, else the first.
  const waiting = tabs.reduce((n, v) => n + +unread(v.id), 0);
  const launch = () => openChat((tabs.find((v) => unread(v.id)) ?? tabs.find((v) => v.id === last.current) ?? tabs[0]).id);

  function say(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send(body);
  }

  if (!tabs.length && !visible) return null;
  return (
    <div className={friendsOpen ? 'chat-dock away' : 'chat-dock'} inert={friendsOpen}>
      {!!tabs.length && (
        <button className={visible ? 'chat-launcher under' : 'chat-launcher'} aria-label="Apri la chat" aria-expanded={!!c.chatOpen} tabIndex={visible ? -1 : undefined} onClick={launch}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v10h-8l-4 3v-3H5z" /></svg>
          <Badge n={waiting} label={`${waiting} messaggi non letti`} />
        </button>
      )}
      <section ref={panel} className="chat" aria-label="Chat" hidden={!visible}>
        {/* One avatar per conversation, stacked down the side: any number of them scrolls with the plain wheel. */}
        <ul className="rail" role="tablist" aria-orientation="vertical" aria-label="Conversazioni">
          {tabs.map((v) => {
            const f = friendOf(v.id);
            return (
              <li key={v.id} className={v.id === shown ? 'on' : undefined}>
                <button role="tab" aria-selected={v.id === shown} aria-label={chatName(v)} title={chatName(v)} onClick={() => openChat(v.id)}>
                  {v.id === room ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.6 3 2.2 3 4.7" /></svg>
                  ) : f ? (
                    <img src={icon(f.icon)} alt="" width="36" height="36" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{chatName(v).slice(0, 1)}</span>
                  )}
                  <Badge n={+unread(v.id)} label={`${unread(v.id)} messaggi non letti`} />
                </button>
                <button className="tab-close" aria-label={`Chiudi la chat ${chatName(v)}`} onClick={() => closeTab(v.id)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="pane">
          <div className="chat-head">
            <b className="chat-title">{open ? chatName(open) : ''}</b>
            <button className="icon" aria-label="Chiudi il riquadro della chat" onClick={closeChat}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <ol className="log" ref={log} aria-live="polite">
            {messages.length ? messages.map((m) => (
              m.type === 'system'
                ? shown === room && SYSTEM[m.body] && author(m) && <li key={m.id} className="event">{author(m)} {SYSTEM[m.body]}</li>
                : m.type === 'information'
                  ? <li key={m.id} className="event">{m.body}</li>
                  : (
                    <li key={m.id} className={mine(m) ? 'mine' : undefined}>
                      {shown === room && !mine(m) && <small>{author(m)}</small>}
                      <p>{m.body}</p>
                    </li>
                  )
            )) : (
              <li className="event">Nessun messaggio.</li>
            )}
          </ol>
          <form className="say" onSubmit={say}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrivi un messaggio" aria-label="Messaggio" maxLength={400} autoComplete="off" />
            <button className="icon" aria-label="Invia" disabled={!draft.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
