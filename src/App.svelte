<script>
  import { c, settings, start } from './lib/client.svelte.js';
  import { asset } from './lib/lcu.js';
  import { view, mmss } from './lib/view.svelte.js';
  import Account from './components/Account.svelte';
  import Chat from './components/Chat.svelte';
  import Status from './components/Status.svelte';
  import Party from './components/Party.svelte';
  import ModePicker from './components/ModePicker.svelte';
  import Friends from './components/Friends.svelte';
  import Bar from './components/Bar.svelte';

  start();

  const stage = $derived(view.stage);
  const active = $derived(stage === 'lobby' || stage === 'queue' || stage === 'ready');
  const penalty = $derived(c.search?.lowPriorityData?.penaltyTimeRemaining ?? 0);
  // shortcut: assumes the ready check lasts about 10 s; the client reports elapsed time only.
  const timeLeft = $derived(1 - Math.min(c.ready?.timer ?? 0, 10) / 10);
</script>

<div class="app" class:glass={settings.glass} data-stage={stage}>
  {#if c.splash}<img class="backdrop" src={asset(c.splash)} alt="" />{/if}

  <Account />
  {#if c.chatOpen}<Chat />{/if}
  {#if c.error}<p class="toast" role="alert">{c.error}</p>{/if}

  <main>
    <Status />

    <div class="body">
      <div class="work">
        {#if stage === 'ready'}
          <div class="timer" role="progressbar" aria-label="Tempo per accettare" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(timeLeft * 100)}>
            <span style:transform="scaleX({timeLeft})"></span>
          </div>
        {/if}

        {#if active}<Party />{/if}
        {#if stage === 'lobby'}<ModePicker />{/if}

        {#if stage === 'queue'}
          {#if penalty > 0}<p class="notice">Coda a bassa priorità: restano {mmss(penalty)} di attesa aggiuntiva.</p>{/if}
          {#each c.search?.errors ?? [] as e (e.id)}
            <p class="notice" role="alert">{e.message || 'La ricerca è stata bloccata.'}{#if e.penaltyTimeRemaining > 0} Riprova tra {mmss(e.penaltyTimeRemaining)}.{/if}</p>
          {/each}
        {/if}
      </div>

      {#if c.connected}<Friends />{/if}
    </div>

    {#if active}<Bar />{/if}
  </main>
</div>
