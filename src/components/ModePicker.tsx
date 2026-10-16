import { useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { pickQueue, type Queue } from '../lib/client.ts';
import { asset } from '../lib/lcu.ts';
import { ui, view, useClient } from '../lib/view.ts';
import { still, useOnChange } from '../lib/motion.ts';
import './ModePicker.css';

type Card = Queue['mode'] & { items: readonly Queue[] };

const OPEN = 3.4; // the open card's flex-grow in ModePicker.css

export default function ModePicker() {
  const c = useClient();
  const q = view.q;
  const me = view.me;
  const members = view.members;
  // Mode picker: one card per map, in order of use, each holding its queues.
  const cards: Card[] = [...Map.groupBy(c.queues, (x) => x.mode.key)].map(([, items]) => ({ ...items[0].mode, items }));
  const [peek, setPeek] = useState<number | string | null>(null); // a card opened to look inside without changing the queue yet
  const openKey = peek ?? q?.mode.key;

  // The cards reflow by animating their share of the row (what the CSS flex-grow sets), so each card's artwork follows its width.
  // A change that lands mid-reflow starts from the share the card has on screen.
  const modes = useRef<HTMLDivElement>(null);
  useOnChange(openKey, (prev, next) => {
    if (still()) return;
    for (const el of modes.current!.querySelectorAll<HTMLElement>('.mode')) {
      const key = el.dataset.key;
      const from = Number(el.style.flexGrow) || (key === String(prev) ? OPEN : 1);
      const to = key === String(next) ? OPEN : 1;
      if (from === to) continue;
      const a = animate(el, { flexGrow: [from, to], duration: 600, ease: 'outElastic(1, .6)' });
      a.then(() => { el.style.flexGrow = ''; });
    }
  });

  // The new queue's artwork takes over the backdrop for a moment, unless something else claimed it meanwhile.
  useOnChange(q?.id, (prev, next) => {
    if (prev == null || next == null || still()) return;
    const bg = cards.find((x) => x.items.some((i) => i.id === next))?.bg;
    if (!bg) return;
    ui.scene = bg;
    setTimeout(() => { if (ui.scene === bg) ui.scene = null; }, 4000);
  });
  useOnChange(openKey, () => {
    if (still()) return;
    const a = animate(modes.current!.querySelectorAll('.mode.open .variants button'), { y: [8, 0], opacity: [0, 1], delay: stagger(40), duration: 300, ease: 'outQuad' });
    a.then(() => a.revert());
  });

  function openCard(card: Card) {
    // Custom games are a deliberate choice among many: look first. Any other card switches to its most played queue.
    if (card.key === 'custom' || card.items.some((i) => i.id === q?.id)) setPeek(card.key);
    else chooseQueue(card.items.find((i) => i.max >= members.length) ?? card.items[0]);
  }

  // In a lobby the switch waits for the client: keep the chosen card open until it answers, or the cards swing back to the old queue first.
  async function chooseQueue(item: Queue) {
    setPeek(item.mode.key);
    await pickQueue(item.id);
    setPeek(null);
  }

  return (
    <section className="pick" aria-labelledby="h-queue">
      <div className="head">
        <h2 id="h-queue">Coda</h2>
        {!!c.games && <span className="hint">In ordine di uso; il numero conta le tue ultime {c.games} partite</span>}
      </div>
      <div className="modes" ref={modes}>
        {cards.map((card) => {
          const open = card.key === openKey;
          return (
            <div key={card.key} data-key={card.key} className={'mode' + (open ? ' open' : '') + (card.items.some((i) => i.id === q?.id) ? ' current' : '')}>
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
