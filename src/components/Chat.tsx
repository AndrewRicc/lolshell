import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lobbyChat, openChat, closeChat, closeTab, send, type Conversation, type Message } from '../lib/client.ts';
import { animate } from 'animejs';
import { unread, useClient } from '../lib/view.ts';
import { useOnChange, still } from '../lib/motion.ts';
import Badge from './Badge.tsx';
import './Chat.css';

const SYSTEM: Record<string, string> = { joined_room: 'è nel party', left_room: 'ha lasciato il party' };

export default function Chat() {
  const c = useClient();
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLOListElement>(null);

  const room = lobbyChat();
  // The party chat first, then every private conversation the client knows about.
  const tabs = c.conversations.filter((v) => (v.id === room && room !== c.roomHidden) || v.type === 'chat').sort((a, b) => Number(b.id === room) - Number(a.id === room));
  const messages = c.chats[c.chatOpen!] ?? [];
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

  function say(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send(body);
  }

  return (
    <section className="chat" aria-label="Chat">
      <div className="chat-head">
        <div className="tabs" role="tablist">
          {tabs.map((v) => (
            <span key={v.id} className={v.id === c.chatOpen ? 'tab on' : 'tab'}>
              <button role="tab" aria-selected={v.id === c.chatOpen} onClick={() => openChat(v.id)}>
                <span className="tab-name">{chatName(v)}</span><Badge n={+unread(v.id)} />
              </button>
              <button className="tab-close" aria-label={`Chiudi la chat ${chatName(v)}`} onClick={() => closeTab(v.id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </button>
            </span>
          ))}
        </div>
        <button className="icon" aria-label="Chiudi il riquadro della chat" onClick={closeChat}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <ol className="log" ref={log} aria-live="polite">
        {messages.length ? messages.map((m) => (
          m.type === 'system'
            ? c.chatOpen === room && SYSTEM[m.body] && author(m) && <li key={m.id} className="event">{author(m)} {SYSTEM[m.body]}</li>
            : m.type === 'information'
              ? <li key={m.id} className="event">{m.body}</li>
              : (
                <li key={m.id} className={mine(m) ? 'mine' : undefined}>
                  {c.chatOpen === room && !mine(m) && <small>{author(m)}</small>}
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
    </section>
  );
}
