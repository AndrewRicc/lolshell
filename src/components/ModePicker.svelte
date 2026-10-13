<script>
  import { c, pickQueue } from '../lib/client.svelte.js';
  import { asset } from '../lib/lcu.js';
  import { view } from '../lib/view.svelte.js';

  const q = $derived(view.q);
  const me = $derived(view.me);
  const members = $derived(view.members);
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
</script>

<section class="pick" aria-labelledby="h-queue">
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
