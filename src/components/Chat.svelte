<script>
  import { c, lobbyChat, openChat, closeChat, closeTab, send } from '../lib/client.svelte.js';
  import { unread } from '../lib/view.svelte.js';

  let draft = $state('');
  let log = $state();

  const SYSTEM = { joined_room: 'è nel party', left_room: 'ha lasciato il party' };
  const room = $derived(lobbyChat());
  // The party chat first, then every private conversation the client knows about.
  const tabs = $derived(c.conversations.filter((v) => (v.id === room && room !== c.roomHidden) || v.type === 'chat').sort((a, b) => (b.id === room) - (a.id === room)));
  const messages = $derived(c.chats[c.chatOpen] ?? []);
  const friendOf = (id) => c.friends.find((f) => f.id === id);
  const chatName = (v) => v.id === room ? 'Party' : v.gameName || friendOf(v.id)?.gameName || 'Chat';
  const author = (m) => c.names[m.fromPuuid] ?? c.friends.find((f) => f.puuid === m.fromPuuid)?.gameName ?? '';
  const mine = (m) => m.fromPuuid === c.me?.puuid;

  // Keep the newest message in view.
  $effect(() => {
    messages.length;
    if (log) log.scrollTop = log.scrollHeight;
  });

  function say(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    draft = '';
    send(body);
  }
</script>

<section class="chat" aria-label="Chat">
  <div class="chat-head">
    <div class="tabs" role="tablist">
      {#each tabs as v (v.id)}
        <span class="tab" class:on={v.id === c.chatOpen}>
          <button role="tab" aria-selected={v.id === c.chatOpen} onclick={() => openChat(v.id)}>
            {chatName(v)}{#if unread(v.id)}<span class="badge">{unread(v.id)}</span>{/if}
          </button>
          <button class="tab-close" aria-label="Chiudi la chat {chatName(v)}" onclick={() => closeTab(v.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
          </button>
        </span>
      {/each}
    </div>
    <button class="icon" aria-label="Chiudi il riquadro della chat" onclick={closeChat}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </div>
  <ol class="log" bind:this={log} aria-live="polite">
    {#each messages as m (m.id)}
      {#if m.type === 'system'}
        {#if c.chatOpen === room && SYSTEM[m.body] && author(m)}<li class="event">{author(m)} {SYSTEM[m.body]}</li>{/if}
      {:else if m.type === 'information'}
        <li class="event">{m.body}</li>
      {:else}
        <li class:mine={mine(m)}>
          {#if c.chatOpen === room && !mine(m)}<small>{author(m)}</small>{/if}
          <p>{m.body}</p>
        </li>
      {/if}
    {:else}
      <li class="event">Nessun messaggio.</li>
    {/each}
  </ol>
  <form class="say" onsubmit={say}>
    <input bind:value={draft} placeholder="Scrivi un messaggio" aria-label="Messaggio" maxlength="400" autocomplete="off" />
    <button class="icon" aria-label="Invia" disabled={!draft.trim()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  </form>
</section>
