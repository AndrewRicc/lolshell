import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { saveRunes, recommendedRunes, type RecommendedPage, type RunePage, type RuneStyle } from '../lib/client.ts';
import type { Snapshot } from 'valtio';
import { asset } from '../lib/lcu.ts';
import { champName, useClient } from '../lib/view.ts';
import './RuneEditor.css';

// championId and position: who the recommended pages are for.
type Props = { championId?: number; position?: string };
export type RuneEditorHandle = { open: () => void };

export default forwardRef<RuneEditorHandle, Props>(function RuneEditor({ championId, position }, ref) {
  const c = useClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<number | null>(null); // id of the saved page being rewritten; null writes a new page
  const [name, setName] = useState('');
  const [primary, setPrimaryId] = useState(0);
  const [sub, setSubId] = useState(0);
  const [main, setMain] = useState<number[]>([]); // one rune per row of the primary path, keystone first
  const [second, setSecond] = useState<{ row: number; id: number }[]>([]); // two runes from two different rows of the secondary path
  const [stats, setStats] = useState<number[]>([]); // one shard per row
  const [recommended, setRecommended] = useState<readonly RecommendedPage[]>([]);

  const style = (id: number) => c.runeStyles.find((s) => s.id === id);
  const perk = (id: number) => c.perks.find((p) => p.id === id);
  const rows = (id: number) => style(id)?.slots.filter((s) => s.type !== 'kStatMod') ?? [];
  const shards = style(primary)?.slots.filter((s) => s.type === 'kStatMod') ?? [];
  const subs = c.runeStyles.filter((s) => style(primary)?.allowedSubStyles.includes(s.id));
  const text = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tip = (id: number) => `${perk(id)?.name ?? ''}${perk(id)?.shortDesc ? ` — ${text(perk(id)!.shortDesc)}` : ''}`;

  const ids = [...main, ...[...second].sort((a, b) => a.row - b.row).map((x) => x.id), ...stats];
  const complete =
    name.trim() && main.length === rows(primary).length && main.every(Boolean) && second.length === 2
      && stats.length === shards.length && stats.every(Boolean);

  // A page lists its runes in a fixed order: four of the primary path, two of the secondary, three shards.
  function load(pageIds: readonly number[], primaryId: number, subId: number) {
    setPrimaryId(primaryId);
    setSubId(subId);
    setMain(pageIds.slice(0, 4));
    const regular = rows(subId).slice(1);
    setSecond(pageIds.slice(4, 6).map((id) => ({ id, row: regular.findIndex((s) => s.perks.includes(id)) })).filter((x) => x.row >= 0));
    setStats(pageIds.slice(6, 9));
  }

  function edit(page: Snapshot<RunePage> | null) {
    setTarget(page?.id ?? null);
    setName(page?.name ?? `${champName(championId) || 'Nuova'} pagina`.trim());
    if (page) load(page.selectedPerkIds, page.primaryStyleId, page.subStyleId);
    else setPrimary(c.runeStyles[0]?.id ?? 0);
  }

  function setPrimary(id: number) {
    setPrimaryId(id);
    setMain([]);
    if (sub === id || !style(id)?.allowedSubStyles.includes(sub)) setSub(style(id)?.allowedSubStyles[0] ?? 0);
  }

  function setSub(id: number) {
    setSubId(id);
    setSecond([]);
  }

  function pickSecond(row: number, id: number) {
    // One rune per row, two rows in all: a third choice pushes out the oldest.
    setSecond((list) => [...list.filter((x) => x.row !== row), { row, id }].slice(-2));
  }

  // slice, not spread: a row left unpicked stays a hole, as assigning by index always did.
  const at = (list: number[], i: number, id: number) => { const next = list.slice(); next[i] = id; return next; };

  useImperativeHandle(ref, () => ({
    open() {
      edit(c.runes.find((p) => p.current && p.isEditable) ?? null);
      dialog.current!.showModal();
      setIsOpen(true);
    },
  }));

  // Recommendations follow the champion in hand while the editor is open.
  useEffect(() => {
    if (!isOpen || !championId) { setRecommended([]); return; }
    let live = true;
    recommendedRunes(championId, position).then((pages) => { if (live) setRecommended(pages); });
    return () => { live = false; };
  }, [isOpen, championId, position]);

  async function save() {
    if (await saveRunes(target, { name: name.trim(), primaryStyleId: primary, subStyleId: sub, selectedPerkIds: ids, current: true })) dialog.current!.close();
  }

  const rune = (id: number, checked: boolean, pick: () => void, big = false) => (
    <button key={id} className={big ? 'rune big' : 'rune'} role="radio" aria-checked={checked} aria-label={perk(id)?.name} title={tip(id)} onClick={pick}>
      {perk(id)?.iconPath ? <img src={asset(perk(id)!.iconPath)} alt="" /> : perk(id)?.name ?? id}
    </button>
  );

  const paths = (list: readonly Snapshot<RuneStyle>[], current: number, pick: (id: number) => void, label: string) => (
    <div className="paths" role="radiogroup" aria-label={label}>
      {list.map((s) => (
        <button key={s.id} role="radio" aria-checked={s.id === current} aria-label={s.name} title={s.name} onClick={() => pick(s.id)}>
          <img src={asset(s.iconPath)} alt="" />
        </button>
      ))}
    </div>
  );

  return (
    <dialog ref={dialog} aria-labelledby="h-runes" onClose={() => setIsOpen(false)}>
      <div className="top">
        <h2 id="h-runes">Rune</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome della pagina" maxLength={25} autoComplete="off" spellCheck="false" />
        <button className="icon" aria-label="Chiudi senza salvare" onClick={() => dialog.current!.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="cols">
        <div className="side">
          <h3>Salva in</h3>
          <div className="pages" role="radiogroup" aria-label="Pagina in cui salvare">
            <button role="radio" aria-checked={target === null} onClick={() => edit(null)}>Nuova pagina</button>
            {c.runes.filter((p) => p.isEditable).map((p) => (
              <button key={p.id} role="radio" aria-checked={target === p.id} title={`Modifica e sovrascrivi ${p.name}`} onClick={() => edit(p)}>{p.name}</button>
            ))}
          </div>

          <h3>Consigliate{champName(championId) && ` per ${champName(championId)}`}</h3>
          {recommended.length ? recommended.map((r, i) => (
            <button key={i} className="advice" title="Riempi la pagina con queste rune" onClick={() => load(r.perks.map((p) => p.id), r.primaryPerkStyleId, r.secondaryPerkStyleId)}>
              {r.keystone?.iconPath && <img src={asset(r.keystone.iconPath)} alt="" />}
              <span><b>{r.keystone?.name}</b><small>{style(r.primaryPerkStyleId)?.name} · {style(r.secondaryPerkStyleId)?.name}</small></span>
            </button>
          )) : (
            <p className="hint">{championId ? 'Nessun consiglio per questo campione.' : 'Scegli un campione per vedere le rune consigliate.'}</p>
          )}
        </div>

        <div className="tree">
          {paths(c.runeStyles, primary, setPrimary, 'Percorso primario')}
          {rows(primary).map((slot, i) => (
            <div key={i} className="row" role="radiogroup" aria-label={slot.slotLabel || `Riga ${i + 1}`}>
              {slot.perks.map((id) => rune(id, main[i] === id, () => setMain((list) => at(list, i, id)), i === 0))}
            </div>
          ))}
        </div>

        <div className="tree">
          {paths(subs, sub, setSub, 'Percorso secondario')}
          {rows(sub).slice(1).map((slot, i) => (
            <div key={i} className="row" role="radiogroup" aria-label={slot.slotLabel || `Riga ${i + 1}`}>
              {slot.perks.map((id) => rune(id, second.some((x) => x.id === id), () => pickSecond(i, id)))}
            </div>
          ))}
          <div className="shards">
            {shards.map((slot, i) => (
              <div key={i} className="row" role="radiogroup" aria-label={slot.slotLabel || `Frammento ${i + 1}`}>
                {slot.perks.map((id) => rune(id, stats[i] === id, () => setStats((list) => at(list, i, id))))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="foot">
        <p className="hint">{complete ? (target ? 'Sovrascrive la pagina scelta e la rende attiva.' : 'Crea una pagina nuova e la rende attiva.') : 'Completa tutte le righe: 4 rune primarie, 2 secondarie, 3 frammenti.'}</p>
        <button className="quiet" onClick={() => dialog.current!.close()}>Annulla</button>
        <button className="primary" disabled={!complete || c.busy} onClick={save}>Salva e usa</button>
      </div>
    </dialog>
  );
});
