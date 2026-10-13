<script>
  import { c, settings, saveSettings, toggleRiotUi } from '../lib/client.svelte.js';
  import { icon } from '../lib/view.svelte.js';
  import { minimize, close, desktop } from '../lib/win.js';

  let menuOpen = $state(false);
</script>

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
