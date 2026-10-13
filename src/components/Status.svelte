<script>
  import { c } from '../lib/client.svelte.js';
  import { view, mmss } from '../lib/view.svelte.js';

  const stage = $derived(view.stage);
  const q = $derived(view.q);
  const members = $derived(view.members);
  const size = $derived(view.size);
  const response = $derived(view.response);
</script>

  <header class="status" aria-live="polite">
  {#if stage === 'off'}
    <p class="eyebrow">Offline</p>
    <h1>Client non collegato</h1>
    <p>Avvia League dal Riot Client: il collegamento parte da solo.</p>
  {:else if stage === 'lobby'}
    <p class="eyebrow">{c.lobby ? 'Lobby aperta' : 'Pronto'}</p>
    <h1>{q ? q.label : 'Nessuna coda'}</h1>
    <p class="seats">
      {#if size <= 10}
        <span class="pips" aria-hidden="true">{#each { length: size } as _, i}<i class:on={i < members.length}></i>{/each}</span>
      {/if}
      {members.length} di {size} nel party
    </p>
  {:else if stage === 'queue'}
    <p class="eyebrow">In coda{#if q}&nbsp;· {q.label}{/if}</p>
    <h1 class="clock">{mmss(c.search?.timeInQueue ?? 0)}</h1>
    <p>{#if c.search?.estimatedQueueTime}Attesa stimata {mmss(c.search.estimatedQueueTime)}{:else}Cerco una partita…{/if}</p>
  {:else if stage === 'ready'}
    <p class="eyebrow">{q?.label ?? 'Coda'}</p>
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
    <p class="eyebrow">In partita</p>
    <h1>{c.phase === 'ChampSelect' ? 'Selezione campione' : 'Partita in corso'}</h1>
    <p>Prosegue nell’interfaccia di Riot. Qui torna tutto alla fine della partita.</p>
  {/if}
</header>
