<script>
  import { c, settings, saveSettings, play, cancelSearch, accept, decline } from '../lib/client.svelte.js';
  import { view } from '../lib/view.svelte.js';
  import { hide, desktop } from '../lib/win.js';

  const stage = $derived(view.stage);
  const q = $derived(view.q);
  const me = $derived(view.me);
  const myRoles = $derived(view.myRoles);
  const response = $derived(view.response);

  const blocked = $derived(
    !q ? (c.queues.length ? 'Nessuna coda disponibile in questo momento.' : 'Carico le code…')
      : c.lobby && !me?.allowedStartActivity ? 'Solo il capo party può avviare la ricerca.'
      : q.roles && myRoles[0] === 'UNSELECTED' ? 'Scegli i ruoli per questa coda.'
      : c.lobby && !c.lobby.canStartActivity ? 'Il party non può entrare in questa coda: controlla numero di giocatori e ruoli.'
      : null,
  );
</script>

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
