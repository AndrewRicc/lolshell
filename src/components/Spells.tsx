import { Fragment } from 'react';
import { pickSpells, type Player } from '../lib/client.ts';
import { asset } from '../lib/lcu.ts';
import { useClient } from '../lib/view.ts';
import './Spells.css';

export default function Spells({ me }: { me: Player }) {
  const c = useClient();

  const mine = [me.spell1Id, me.spell2Id];
  const mode = c.queues.find((q) => q.id === c.select?.queueId)?.gameMode ?? 'CLASSIC';
  const offered = c.spells.filter((x) => x.gameModes?.includes(mode));
  const spell = (id: number) => c.spells.find((x) => x.id === id);

  function choose(n: number, id: number) {
    // Taking the spell the other slot holds swaps the two.
    const other = mine[1 - n] === id ? mine[n] : mine[1 - n];
    pickSpells(n ? other : id, n ? id : other);
  }

  return (
    <span className="spells">
      {[0, 1].map((n) => (
        <Fragment key={n}>
          <button className="spell" popoverTarget={`spells-${n}`} style={{ anchorName: `--spell-${n}` }} disabled={c.busy} aria-label={`${n ? 'Secondo' : 'Primo'} incantesimo: ${spell(mine[n])?.name ?? 'nessuno'}`} title={spell(mine[n])?.name}>
            {spell(mine[n]) && <img src={asset(spell(mine[n])!.iconPath)} alt="" />}
          </button>
          <div className="role-menu spell-menu" popover="" id={`spells-${n}`} role="radiogroup" aria-label={n ? 'Secondo incantesimo' : 'Primo incantesimo'} style={{ positionAnchor: `--spell-${n}` }}>
            {offered.map((x) => (
              <button key={x.id} role="radio" aria-checked={mine[n] === x.id} title={x.name} aria-label={x.name}
                onClick={(e) => { e.currentTarget.parentElement!.hidePopover(); choose(n, x.id); }}
              ><img src={asset(x.iconPath)} alt="" /></button>
            ))}
          </div>
        </Fragment>
      ))}
    </span>
  );
}
