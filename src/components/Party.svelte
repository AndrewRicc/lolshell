<script>
  import { c, ROLES, roleName, pickRoles, leave, kick, promote, lobbyChat, openChat } from '../lib/client.svelte.js';
  import { ui, view, icon, unread, nameOf } from '../lib/view.svelte.js';

  const stage = $derived(view.stage);
  const q = $derived(view.q);
  const me = $derived(view.me);
  const myRoles = $derived(view.myRoles);
  const members = $derived(view.members);
  const size = $derived(view.size);
  const room = $derived(lobbyChat());
  const free = $derived(Math.max(size - members.length, 0));
  // Only a custom game has two sides; the client lists who sits on each.
  const teamOf = (m) => c.lobby?.gameConfig?.customTeam200?.some((x) => x.puuid === m.puuid) ? 'Squadra 2'
    : c.lobby?.gameConfig?.customTeam100?.some((x) => x.puuid === m.puuid) ? 'Squadra 1' : '';
  // Riot's role icons, redrawn: the client does not serve its own over the API. Each is [lit shape, dimmed shape].
  const GLYPH = {
    TOP: ['M4 4v24.045L9 23V9h14l5.045-5z', 'M21 14h-7v7h7zM26 11v15H11.014l-4 4H30V7.016z'],
    JUNGLE: ['M25 3c-2.128 3.3-5.147 6.851-6.966 11.469A42.373 42.373 0 0 1 20 20a27.7 27.7 0 0 1 1-3c0-4.977 1.856-8.723 4-14zM13 20c-1.488-4.487-4.76-6.966-9-9 3.868 3.136 4.422 7.52 5 12l3.743 3.312C14.215 27.917 16.527 30 17 30c4.555-9.445-3.366-20.8-8-27 2.67 6.573 4.717 10.342 4 17zm8 5a15.271 15.271 0 0 1 0 2l4-4c.578-4.48 1.132-8.864 5-12-5.288 2.537-7.866 7.854-9 14z'],
    MIDDLE: ['M25 4 4 25v5h5L30 9V4z', 'M30 12.968l-4.008 4L26 26h-9l-4 4h17zM16.979 8 21 4H4v16.977L8 17V8z'],
    BOTTOM: ['M30 5.955 25 11v14H11l-5.045 5H30z', 'M13 20h7v-7h-7zM4 4v22.984l3.955-4L8 8h14.986l4-4z'],
    UTILITY: ['M26 13c3.535 0 8-4 8-4H23l-3 3 2 7 5-2-3-4zM22 5l-1.173-2h-7.765L12 5l5 6zm-5 9-1-1-3 15 4 3 4-3-3-15zM11 9H0s4.465 4 8 4h2l-3 4 5 2 2-7z'],
    FILL: ['M17 12l5 5-5 5-5-5z', 'M17 3 3 17l14 14 14-14zm0 5.5 8.5 8.5-8.5 8.5L8.5 17z'],
    UNSELECTED: ['', 'M15 9h4v6h6v4h-6v6h-4v-6H9v-4h6z'],
  };
</script>

{#snippet glyph(id)}
  {@const [lit, dim] = GLYPH[id] ?? GLYPH.UNSELECTED}
  <svg class="glyph" viewBox="0 0 34 34" aria-hidden="true"><path d={dim} opacity="0.45" /><path d={lit} /></svg>
{/snippet}

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
  <ul class="party" class:big={size > 5}>
    {#each members as m (m.summonerId)}
      {@const self = m.summonerId === c.me?.summonerId}
      <li class="member">
        <img src={icon(m.summonerIconId)} alt="" width="40" height="40" />
        <span class="member-name">
          <span>{nameOf(m)}</span>
          {#if m.isLeader && members.length > 1}
            <svg viewBox="0 0 24 24" role="img" aria-label="Capo party"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z" /></svg>
          {/if}
        </span>
        {#if q?.roles}
          <span class="member-roles">
            {#each [0, 1] as n}
              {@const id = self ? myRoles[n] : n ? m.secondPositionPreference : m.firstPositionPreference}
              {#if self && stage === 'lobby'}
                <!-- Like Riot's lobby: your two roles sit under your own slot and open a small menu. -->
                {#if !n || (myRoles[0] !== 'FILL' && myRoles[0] !== 'UNSELECTED')}
                  <button class="role" popovertarget="roles-{n}" style:anchor-name="--role-{n}" disabled={c.busy}
                    aria-label="{n ? 'Secondo' : 'Primo'} ruolo: {roleName(id) || 'da scegliere'}" title="{n ? 'Secondo' : 'Primo'} ruolo">
                    {@render glyph(id)}
                  </button>
                {/if}
              {:else if roleName(id) && (!n || m.firstPositionPreference !== 'FILL')}
                <span class="role" role="img" aria-label={roleName(id)} title={roleName(id)}>{@render glyph(id)}</span>
              {/if}
            {/each}
          </span>
        {:else if teamOf(m)}
          <span class="member-team">{teamOf(m)}</span>
        {/if}
        {#if c.lobby && !self && stage === 'lobby' && (me?.isLeader || me?.allowedKickOthers)}
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
    {#if size > 5}
      {#if free}<li class="member free">{free === 1 ? '1 posto libero' : `${free} posti liberi`}</li>{/if}
    {:else}
      {#each { length: free } as _}
        <li>
          <button class="member free" disabled={stage !== 'lobby' || (c.lobby && !me?.allowedInviteOthers)} onclick={() => ui.friendsOpen = true}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Invita
          </button>
        </li>
      {/each}
    {/if}
  </ul>
  {#if q?.roles && stage === 'lobby'}
    {#each [0, 1] as n}
      <div class="role-menu" popover id="roles-{n}" role="radiogroup" aria-label={n ? 'Secondo ruolo' : 'Primo ruolo'} style:position-anchor="--role-{n}">
        {#each ROLES as [id, label]}
          <button
            role="radio" aria-checked={myRoles[n] === id} disabled={c.busy || (n === 1 && id === myRoles[0])}
            onclick={(e) => { e.currentTarget.parentElement.hidePopover(); n ? pickRoles(myRoles[0], id) : pickRoles(id, myRoles[1]); }}
          >{@render glyph(id)}{label}</button>
        {/each}
      </div>
    {/each}
  {/if}
</section>
