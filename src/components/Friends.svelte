<script>
  import { c, invite, answerInvite, addFriend, answerRequest, openChat } from '../lib/client.svelte.js';
  import { ui, view, icon, unread } from '../lib/view.svelte.js';

  let riotId = $state('');
  let requestSent = $state(false);

  const stage = $derived(view.stage);
  const me = $derived(view.me);
  const members = $derived(view.members);
  const size = $derived(view.size);
  const incoming = $derived(c.requests.filter((r) => r.direction === 'in'));

  async function add(e) {
    e.preventDefault();
    requestSent = false;
    if (await addFriend(riotId)) {
      riotId = '';
      requestSent = true;
    }
  }

  function chatWith(f) {
    ui.friendsOpen = false;
    openChat(f.id);
  }
  // Order here is the order of the friends list.
  const AVAILABILITY = { chat: 'Disponibile', away: 'Assente', dnd: 'Occupato', mobile: 'Su mobile', offline: 'Offline' };
  const RANK = Object.keys(AVAILABILITY);
  const rank = (f) => (RANK.indexOf(f.availability) + 1 || RANK.length) - 1;
  const onLeague = (f) => f.product === 'league_of_legends' && rank(f) < 3;

  const pendingInvites = $derived(c.invites.filter((i) => i.state === 'Pending'));
  const friends = $derived(
    [...c.friends].sort((a, b) => rank(a) - rank(b) || (a.gameName ?? '').localeCompare(b.gameName ?? '')),
  );
  const online = $derived(c.friends.filter(onLeague).length);
  const inParty = (id) => (c.lobby?.members ?? []).some((m) => m.summonerId === id);
  const invited = (id) => (c.lobby?.invitations ?? []).some((i) => i.toSummonerId === id && i.state === 'Pending');
  const queueLabel = (id) => c.queues.find((x) => x.id === id)?.label ?? 'una partita';
</script>

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

  <div class="friends" class:open={ui.friendsOpen}>
    <button class="pill" aria-expanded={ui.friendsOpen} aria-controls="friends" onclick={() => ui.friendsOpen = !ui.friendsOpen}>
      <h2>Amici</h2><span class="count">{online} online su {friends.length}</span>
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
    </button>
    <div class="drawer" id="friends" inert={!ui.friendsOpen}><div>
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
