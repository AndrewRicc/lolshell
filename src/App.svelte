<script>
  import {
    c, settings, saveSettings, start, ROLES, roleName, queue, roles, pickQueue, pickRoles, play,
    cancelSearch, accept, decline, leave, invite, answerInvite, toggleRiotUi, kick, promote,
    lobbyChat, openChat, closeChat, closeTab, send, addFriend, answerRequest,
  } from './lib/client.svelte.js';
  import { asset } from './lib/lcu.js';
  import { hide, minimize, close, desktop } from './lib/win.js';

  start();

  let menuOpen = $state(false);
  let friendsOpen = $state(false);
  let draft = $state('');
  let riotId = $state('');
  let requestSent = $state(false);
  let log = $state();

  const SYSTEM = { joined_room: 'è nel party', left_room: 'ha lasciato il party' };
  const room = $derived(lobbyChat());
  // The party chat first, then every private conversation the client knows about.
  const tabs = $derived(c.conversations.filter((v) => (v.id === room && room !== c.roomHidden) || v.type === 'chat').sort((a, b) => (b.id === room) - (a.id === room)));
  const messages = $derived(c.chats[c.chatOpen] ?? []);
  const friendOf = (id) => c.friends.find((f) => f.id === id);
  const chatName = (v) => v.id === room ? 'Party' : v.gameName || friendOf(v.id)?.gameName || 'Chat';
  const unread = (id) => id !== c.chatOpen && (c.conversations.find((v) => v.id === id)?.unreadMessageCount ?? 0);
  const author = (m) => c.names[m.fromPuuid] ?? c.friends.find((f) => f.puuid === m.fromPuuid)?.gameName ?? '';
  const mine = (m) => m.fromPuuid === c.me?.puuid;
  const incoming = $derived(c.requests.filter((r) => r.direction === 'in'));

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

  async function add(e) {
    e.preventDefault();
    requestSent = false;
    if (await addFriend(riotId)) {
      riotId = '';
      requestSent = true;
    }
  }

  function chatWith(f) {
    friendsOpen = false;
    openChat(f.id);
  }
  // Order here is the order of the friends list.
  const AVAILABILITY = { chat: 'Disponibile', away: 'Assente', dnd: 'Occupato', mobile: 'Su mobile', offline: 'Offline' };
  const RANK = Object.keys(AVAILABILITY);
  const rank = (f) => (RANK.indexOf(f.availability) + 1 || RANK.length) - 1;
  const onLeague = (f) => f.product === 'league_of_legends' && rank(f) < 3;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const icon = (id) => asset(`/lol-game-data/assets/v1/profile-icons/${id}.jpg`);

  const stage = $derived(
    !c.connected ? 'off'
      : c.phase === 'ReadyCheck' ? 'ready'
      : c.phase === 'Matchmaking' ? 'queue'
      : c.phase === 'None' || c.phase === 'Lobby' ? 'lobby'
      : 'game',
  );

  const q = $derived(queue());
  const myRoles = $derived(roles());
  const me = $derived(c.lobby?.localMember);

  // Before a lobby exists the party is just you, shown the way it will look once created.
  const members = $derived(
    c.lobby?.members ?? (c.me ? [{
      summonerId: c.me.summonerId, summonerIconId: c.me.profileIconId, isLeader: true,
      firstPositionPreference: myRoles[0], secondPositionPreference: myRoles[1],
    }] : []),
  );
  const size = $derived(c.lobby?.gameConfig?.maxLobbySize ?? q?.max ?? 5);
  // Mode picker: one card per map, in order of use, each holding its queues.
  const cards = $derived([...Map.groupBy(c.queues, (x) => x.mode.key)].map(([key, items]) => ({ key, ...items[0].mode, items })));
  let peek = $state(null); // a card opened to look inside without changing the queue yet
  const openKey = $derived(peek ?? q?.mode.key);

  function openCard(card) {
    // Custom games are a deliberate choice among many: look first. Any other card switches to its most played queue.
    if (card.key === 'custom' || card.items.some((i) => i.id === q?.id)) peek = card.key;
    else chooseQueue(card.items.find((i) => i.max >= members.length) ?? card.items[0]);
  }

  function chooseQueue(item) {
    peek = null;
    pickQueue(item.id);
  }
  // Only a custom game has two sides; the client lists who sits on each.
  const teamOf = (m) => c.lobby?.gameConfig?.customTeam200?.some((x) => x.puuid === m.puuid) ? 'Squadra 2'
    : c.lobby?.gameConfig?.customTeam100?.some((x) => x.puuid === m.puuid) ? 'Squadra 1' : '';
  const free = $derived(Math.max(size - members.length, 0));
  const nameOf = (m) => m.summonerId === c.me?.summonerId ? c.me.gameName : c.names[m.puuid] ?? m.summonerName ?? '';

  const blocked = $derived(
    !q ? (c.queues.length ? 'Nessuna coda disponibile in questo momento.' : 'Carico le code…')
      : c.lobby && !me?.allowedStartActivity ? 'Solo il capo party può avviare la ricerca.'
      : q.roles && myRoles[0] === 'UNSELECTED' ? 'Scegli i ruoli per questa coda.'
      : c.lobby && !c.lobby.canStartActivity ? 'Il party non può entrare in questa coda: controlla numero di giocatori e ruoli.'
      : null,
  );

  const pendingInvites = $derived(c.invites.filter((i) => i.state === 'Pending'));
  const friends = $derived(
    [...c.friends].sort((a, b) => rank(a) - rank(b) || (a.gameName ?? '').localeCompare(b.gameName ?? '')),
  );
  const online = $derived(c.friends.filter(onLeague).length);
  const inParty = (id) => (c.lobby?.members ?? []).some((m) => m.summonerId === id);
  const invited = (id) => (c.lobby?.invitations ?? []).some((i) => i.toSummonerId === id && i.state === 'Pending');
  const queueLabel = (id) => c.queues.find((x) => x.id === id)?.label ?? 'una partita';

  const penalty = $derived(c.search?.lowPriorityData?.penaltyTimeRemaining ?? 0);
  const response = $derived(c.ready?.playerResponse ?? 'None');
  // shortcut: assumes the ready check lasts about 10 s; the client reports elapsed time only.
  const timeLeft = $derived(1 - Math.min(c.ready?.timer ?? 0, 10) / 10);
</script>

<div class="app" class:glass={settings.glass} data-stage={stage}>
  {#if c.splash}<img class="backdrop" src={asset(c.splash)} alt="" />{/if}

  <!-- The window has no system frame: this strip is what you drag it by. -->
  <div class="titlebar" data-tauri-drag-region>
    {#if desktop}
      <button class="win" aria-label="Riduci a icona" onclick={minimize}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
      <button class="win" aria-label="Chiudi" onclick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    {/if}
  </div>
  <div class="account" class:open={menuOpen}>
    <button class="pill" aria-label="Account e opzioni" aria-expanded={menuOpen} aria-controls="menu" onclick={() => menuOpen = !menuOpen}>
      {#if c.me}
        <span class="who"><b>{c.me.gameName}</b><small>#{c.me.tagLine} · Liv. {c.me.summonerLevel}</small></span>
        <img src={icon(c.me.profileIconId)} alt="" width="40" height="40" />
      {:else}
        <span class="who"><b>Non collegato</b><small>Opzioni</small></span>
      {/if}
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
      <div class="menu" id="menu" inert={!menuOpen}>
        <label><input type="checkbox" role="switch" bind:checked={settings.sound} onchange={saveSettings} /> Suono alla partita trovata</label>
        <label><input type="checkbox" role="switch" bind:checked={settings.glass} onchange={saveSettings} /> Pannelli sfocati</label>
        <button class="quiet" onclick={toggleRiotUi} disabled={!c.connected || c.busy}>
          {c.riotUi ? 'Spegni l’interfaccia di Riot' : 'Riaccendi l’interfaccia di Riot'}
        </button>
      </div>
  </div>

  {#if c.chatOpen}
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
  {/if}

  {#if c.error}<p class="toast" role="alert">{c.error}</p>{/if}

  <main>    <header class="status" aria-live="polite">
      {#if stage === 'off'}
        <h1>Client non collegato</h1>
        <p>Avvia League dal Riot Client: il collegamento parte da solo.</p>
      {:else if stage === 'lobby'}
        <h1>{c.lobby ? 'Lobby' : 'Pronto'}</h1>
        <p>{q ? q.label : 'Nessuna coda'} · {members.length} di {size} nel party</p>
      {:else if stage === 'queue'}
        <h1>In coda <span class="clock">{mmss(c.search?.timeInQueue ?? 0)}</span></h1>
        <p>{q?.label ?? ''}{#if c.search?.estimatedQueueTime}&nbsp;· attesa stimata {mmss(c.search.estimatedQueueTime)}{/if}</p>
      {:else if stage === 'ready'}
        <h1>Partita trovata</h1>
        <p>
          {#if response === 'Accepted'}
            {c.autoAccepted ? 'Accettata per te. In attesa degli altri giocatori.' : 'Accettata. In attesa degli altri giocatori.'}
          {:else if response === 'Declined'}
            Rifiutata.
          {:else}
            Accetta prima che scada il tempo.
          {/if}
        </p>
      {:else}
        <h1>{c.phase === 'ChampSelect' ? 'Selezione campione' : 'Partita in corso'}</h1>
        <p>Prosegue nell’interfaccia di Riot. Qui torna tutto alla fine della partita.</p>
      {/if}
    </header>

    <div class="body">
      <div class="work">
        {#if stage === 'ready'}
          <div class="timer" role="progressbar" aria-label="Tempo per accettare" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(timeLeft * 100)}>
            <span style:transform="scaleX({timeLeft})"></span>
          </div>
        {/if}

        {#if stage === 'lobby' || stage === 'queue' || stage === 'ready'}
          <section aria-labelledby="h-party">
            <div class="head">
              <h2 id="h-party">Party</h2>
              <span class="head-actions">
                {#if room && c.chatOpen !== room}
                  <button class="chip" onclick={() => openChat(room)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v10h-8l-4 3v-3H5z" /></svg>
                    Chat del party{#if unread(room)}<span class="badge" aria-label="{unread(room)} messaggi non letti">{unread(room)}</span>{/if}
                  </button>
                {/if}
                {#if c.lobby && stage === 'lobby'}<button class="link" onclick={leave} disabled={c.busy}>Esci dal party</button>{/if}
              </span>
            </div>
            <ul class="party">
              {#each members as m (m.summonerId)}
                  <li class="member">
                    <img src={icon(m.summonerIconId)} alt="" width="40" height="40" />
                    <span class="member-name">
                      {nameOf(m)}
                      {#if m.isLeader && members.length > 1}
                        <svg viewBox="0 0 24 24" role="img" aria-label="Capo party"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z" /></svg>
                      {/if}
                    </span>
                    {#if q?.roles && m.firstPositionPreference !== 'UNSELECTED'}
                      <span class="member-roles">
                        {roleName(m.firstPositionPreference)}{#if roleName(m.secondPositionPreference)}&nbsp;/ {roleName(m.secondPositionPreference)}{/if}
                      </span>
                    {:else if teamOf(m)}
                      <span class="member-roles">{teamOf(m)}</span>
                    {/if}
                    {#if c.lobby && m.summonerId !== c.me?.summonerId && stage === 'lobby' && (me?.isLeader || me?.allowedKickOthers)}
                      <span class="member-actions">
                        {#if me?.isLeader}
                          <button class="icon" aria-label="Rendi {nameOf(m)} capo party" title="Rendi capo party" disabled={c.busy} onclick={() => promote(m.summonerId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z" /></svg>
                          </button>
                        {/if}
                        {#if me?.allowedKickOthers}
                          <button class="icon" aria-label="Espelli {nameOf(m)} dal party" title="Espelli dal party" disabled={c.busy} onclick={() => kick(m.summonerId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                          </button>
                        {/if}
                      </span>
                    {/if}
                  </li>
              {/each}
              {#if free}<li class="member free">{free === 1 ? '1 posto libero' : `${free} posti liberi`}</li>{/if}
            </ul>
          </section>
        {/if}

        {#if stage === 'lobby'}
          <section aria-labelledby="h-queue">
            <div class="head">
              <h2 id="h-queue">Coda</h2>
              {#if c.games}<span class="hint">In ordine di uso; il numero conta le tue ultime {c.games} partite</span>{/if}
            </div>
            <div class="modes">
              {#each cards as card (card.key)}
                {@const open = card.key === openKey}
                <div class="mode" class:open class:current={card.items.some((i) => i.id === q?.id)}>
                  {#if card.bg}<img class="mode-art" src={asset(card.bg)} alt="" loading="lazy" />{/if}
                  <button class="mode-face" aria-expanded={open} disabled={c.busy || (c.lobby && !me?.allowedChangeActivity)} onclick={() => openCard(card)}>
                    {#if open && card.video}
                      <!-- Riot's own "mode selected" flourish, played once each time the card opens. -->
                      <video class="mode-icon" src={asset(card.video)} poster={card.icon && asset(card.icon)} autoplay muted playsinline></video>
                    {:else if card.icon}
                      <img class="mode-icon" src={asset(card.icon)} alt="" />
                    {/if}
                    <span class="mode-name">{card.name}</span>
                  </button>
                  <div class="variants" role="radiogroup" aria-label={card.name} inert={!open}>
                    {#each card.items as item (item.id)}
                      <button
                        role="radio" aria-checked={item.id === q?.id} title={item.label}
                        disabled={c.busy || item.max < members.length || (c.lobby && !me?.allowedChangeActivity)}
                        onclick={() => chooseQueue(item)}
                      >
                        <span>{item.label}</span>
                        {#if item.max < members.length}<small>max {item.max}</small>{:else if item.count}<small>{item.count}</small>{/if}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </section>

          {#if q?.roles}
            <section aria-labelledby="h-roles">
              <div class="head">
                <h2 id="h-roles">Ruoli</h2>
                {#if !c.rolesPick && c.suggested && myRoles[0] === c.suggested[0]}<span class="hint">Proposti dalle tue ultime partite</span>{/if}
              </div>
              {#each [0, 1] as n}
                <div class="roles" role="radiogroup" aria-label={n ? 'Secondo ruolo' : 'Primo ruolo'}>
                  <span class="roles-label">{n ? 'Secondo' : 'Primo'}</span>
                  {#each ROLES as [id, label]}
                    <button
                      role="radio" aria-checked={myRoles[n] === id}
                      disabled={c.busy || (n === 1 && (myRoles[0] === 'FILL' || myRoles[0] === 'UNSELECTED' || id === myRoles[0]))}
                      onclick={() => n ? pickRoles(myRoles[0], id) : pickRoles(id, myRoles[1])}
                    >{label}</button>
                  {/each}
                </div>
              {/each}
            </section>
          {/if}
        {/if}

        {#if stage === 'queue'}
          {#if penalty > 0}<p class="notice">Coda a bassa priorità: restano {mmss(penalty)} di attesa aggiuntiva.</p>{/if}
          {#each c.search?.errors ?? [] as e (e.id)}
            <p class="notice" role="alert">{e.message || 'La ricerca è stata bloccata.'}{#if e.penaltyTimeRemaining > 0} Riprova tra {mmss(e.penaltyTimeRemaining)}.{/if}</p>
          {/each}
        {/if}
      </div>

      {#if c.connected}
        <aside>
          {#if pendingInvites.length && stage === 'lobby'}
            <section aria-labelledby="h-invites">
              <div class="head"><h2 id="h-invites">Inviti</h2></div>
              <ul class="people">
                {#each pendingInvites as inv (inv.invitationId)}
                  <li>
                    <span class="person"><b>{c.names[inv.fromPuuid] || inv.fromSummonerName || 'Un amico'}</b><small>ti invita a {queueLabel(inv.gameConfig?.queueId)}</small></span>
                    <button class="icon" aria-label="Accetta l’invito" disabled={c.busy || !inv.canAcceptInvitation} onclick={() => answerInvite(inv.invitationId, true)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                    </button>
                    <button class="icon" aria-label="Rifiuta l’invito" disabled={c.busy} onclick={() => answerInvite(inv.invitationId, false)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          <div class="friends" class:open={friendsOpen}>
            <button class="pill" aria-expanded={friendsOpen} aria-controls="friends" onclick={() => friendsOpen = !friendsOpen}>
              <h2>Amici</h2><span class="count">{online} online su {friends.length}</span>
              <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
            </button>
            <div class="drawer" id="friends" inert={!friendsOpen}><div>
              <form class="add" onsubmit={add}>
                <input bind:value={riotId} oninput={() => requestSent = false} placeholder="Aggiungi: Nome#TAG" aria-label="Riot ID da aggiungere agli amici" maxlength="40" autocomplete="off" spellcheck="false" />
                <button class="icon" aria-label="Invia richiesta di amicizia" disabled={c.busy || !riotId.trim()}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </form>
              {#if requestSent}<p class="hint sent" role="status">Richiesta di amicizia inviata.</p>{/if}
              {#if incoming.length}
                <ul class="people requests">
                  {#each incoming as r (r.puuid)}
                    <li>
                      <span class="person"><b>{r.gameName || r.name}</b><small>vuole aggiungerti agli amici</small></span>
                      <button class="icon" aria-label="Accetta {r.gameName}" disabled={c.busy} onclick={() => answerRequest(r.puuid, true)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      </button>
                      <button class="icon" aria-label="Rifiuta {r.gameName}" disabled={c.busy} onclick={() => answerRequest(r.puuid, false)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            {#if friends.length}
              <ul class="people">
                {#each friends as f (f.puuid)}
                  <li class:away={!onLeague(f)}>
                    <button class="person chat-with" aria-label="Apri la chat con {f.gameName || f.name}" onclick={() => chatWith(f)}>
                      <img src={icon(f.icon)} alt="" width="32" height="32" loading="lazy" />
                      <span><b>{f.gameName || f.name}</b><small data-availability={f.availability}>{AVAILABILITY[f.availability] ?? 'Offline'}</small></span>
                    </button>
                    {#if unread(f.id)}<span class="badge" aria-label="{unread(f.id)} messaggi non letti">{unread(f.id)}</span>{/if}
                    {#if inParty(f.summonerId)}
                      <small class="tag">Nel party</small>
                    {:else if invited(f.summonerId)}
                      <small class="tag">Invitato</small>
                    {:else if onLeague(f) && stage === 'lobby'}
                      <button class="icon" aria-label="Invita {f.gameName}" disabled={c.busy || (c.lobby && !me?.allowedInviteOthers) || members.length >= size} onclick={() => invite(f.summonerId)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="hint">La lista amici è vuota.</p>
            {/if}
            </div></div>
          </div>
        </aside>
      {/if}
    </div>

    {#if stage === 'lobby' || stage === 'queue' || stage === 'ready'}
      <footer class="bar">
        {#if stage === 'lobby' && blocked}<p class="notice">{blocked}</p>{/if}
        <div class="actions">
          {#if stage === 'lobby'}
            <button class="primary" onclick={play} disabled={!!blocked || c.busy}>{!q?.custom ? 'Trova partita' : c.lobby ? 'Avvia partita' : 'Crea lobby'}</button>
          {:else if stage === 'queue'}
            <button class="primary" onclick={cancelSearch} disabled={c.busy}>Annulla ricerca</button>
            {#if desktop}<button class="quiet" onclick={hide}>Nascondi nella tray</button>{/if}
          {:else if response === 'None'}
            <button class="primary" onclick={accept} disabled={c.busy}>Accetta</button>
            <button class="quiet" onclick={decline} disabled={c.busy}>Rifiuta</button>
          {/if}
          <label class="auto" class:on={settings.autoAccept}>
            <input type="checkbox" role="switch" bind:checked={settings.autoAccept} onchange={saveSettings} />
            <span><b>Auto-accetta</b><small>{settings.autoAccept ? 'L’app accetta al posto tuo' : 'Accetti tu ogni partita'}</small></span>
          </label>
        </div>
      </footer>
    {/if}
  </main>
</div>
