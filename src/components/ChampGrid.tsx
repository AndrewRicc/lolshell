import { useState } from 'react';
import { champIcon, useClient } from '../lib/view.ts';
import './ChampGrid.css';

// ids: the champions on offer; taken: ids nobody can choose any more.
type Props = { ids: readonly number[]; taken: Set<number>; selected: number; onpick: (id: number) => void; label: string };

export default function ChampGrid({ ids, taken, selected, onpick, label }: Props) {
  const c = useClient();
  const [query, setQuery] = useState('');
  // The grid is never left empty: when the client's list names no champion we know, show the regular
  // roster (ids above 10000 are mode-only variants) and let the client refuse what cannot be chosen.
  const offered = c.champions.filter((x) => ids.includes(x.id));
  const roster = offered.length ? offered : c.champions.filter((x) => x.id < 10000);
  const list = roster.filter((x) => x.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un campione" aria-label="Cerca un campione" autoComplete="off" spellCheck="false" />
    <div className="champs" role="radiogroup" aria-label={label}>
      {list.length ? list.map((x) => (
        <button key={x.id} role="radio" aria-checked={selected === x.id} disabled={c.busy || taken.has(x.id)} title={x.name} onClick={() => onpick(x.id)}>
          <img src={champIcon(x.id)} alt="" loading="lazy" />
          <span>{x.name}</span>
        </button>
      )) : (
        <p className="hint">Nessun campione con questo nome.</p>
      )}
    </div>
  </>;
}
