import { useState } from 'react';
import { pickQueue, type Queue } from '../lib/client.ts';
import { asset } from '../lib/lcu.ts';
import { view, useClient } from '../lib/view.ts';
import './ModePicker.css';

type Card = Queue['mode'] & { items: readonly Queue[] };

export default function ModePicker() {
  const c = useClient();
  const q = view.q;
  const me = view.me;
  const members = view.members;
  // Mode picker: one card per map, in order of use, each holding its queues.
  const cards: Card[] = [...Map.groupBy(c.queues, (x) => x.mode.key)].map(([, items]) => ({ ...items[0].mode, items }));
  const [peek, setPeek] = useState<number | string | null>(null); // a card opened to look inside without changing the queue yet
  const openKey = peek ?? q?.mode.key;

  function openCard(card: Card) {
    // Custom games are a deliberate choice among many: look first. Any other card switches to its most played queue.
    if (card.key === 'custom' || card.items.some((i) => i.id === q?.id)) setPeek(card.key);
    else chooseQueue(card.items.find((i) => i.max >= members.length) ?? card.items[0]);
  }

  function chooseQueue(item: Queue) {
    setPeek(null);
    pickQueue(item.id);
  }

  return (
    <section className="pick" aria-labelledby="h-queue">
      <div className="head">
        <h2 id="h-queue">Coda</h2>
        {!!c.games && <span className="hint">In ordine di uso; il numero conta le tue ultime {c.games} partite</span>}
      </div>
      <div className="modes">
        {cards.map((card) => {
          const open = card.key === openKey;
          return (
            <div key={card.key} className={'mode' + (open ? ' open' : '') + (card.items.some((i) => i.id === q?.id) ? ' current' : '')}>
              {card.bg && <img className="mode-art" src={asset(card.bg)} alt="" loading="lazy" />}
              <button className="mode-face" aria-expanded={open} disabled={c.busy || (!!c.lobby && !me?.allowedChangeActivity)} onClick={() => openCard(card)}>
                {open && card.video ? (
                  // Riot's own "mode selected" flourish, played once each time the card opens.
                  <video className="mode-icon" src={asset(card.video)} poster={card.icon ? asset(card.icon) : undefined} autoPlay muted playsInline></video>
                ) : card.icon && (
                  <img className="mode-icon" src={asset(card.icon)} alt="" />
                )}
                <span className="mode-name">{card.name}</span>
              </button>
              <div className="variants" role="radiogroup" aria-label={card.name} inert={!open}>
                {card.items.map((item) => (
                  <button
                    key={item.id}
                    role="radio" aria-checked={item.id === q?.id} title={item.label}
                    disabled={c.busy || item.max < members.length || (!!c.lobby && !me?.allowedChangeActivity)}
                    onClick={() => chooseQueue(item)}
                  >
                    <span>{item.label}</span>
                    {item.max < members.length ? <small>max {item.max}</small> : !!item.count && <small>{item.count}</small>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
