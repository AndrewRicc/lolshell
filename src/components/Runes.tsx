import { useRef } from 'react';
import { pickRunes } from '../lib/client.ts';
import { asset } from '../lib/lcu.ts';
import { useClient } from '../lib/view.ts';
import RuneEditor, { type RuneEditorHandle } from './RuneEditor.tsx';
import './Runes.css';

export default function Runes({ championId, position }: { championId?: number; position?: string }) {
  const c = useClient();
  const editor = useRef<RuneEditorHandle>(null);

  const current = c.runes.find((p) => p.current);

  return <>
    <RuneEditor ref={editor} championId={championId} position={position} />
    <button className="chip runes" popoverTarget="runes" style={{ anchorName: '--runes' }} disabled={c.busy} aria-label={`Pagina di rune: ${current?.name ?? 'nessuna'}`}>
      {current?.primaryStyleIconPath && <img src={asset(current.primaryStyleIconPath)} alt="" />}
      <span>{current?.name ?? 'Rune'}</span>
    </button>
    <div className="role-menu rune-menu" popover="" id="runes" role="radiogroup" aria-label="Pagine di rune" style={{ positionAnchor: '--runes' }}>
      {c.runes.map((p) => (
        <button key={p.id} role="radio" aria-checked={p.current} disabled={c.busy || !p.isValid} title={p.isValid ? p.name : 'Pagina incompleta'}
          onClick={(e) => { e.currentTarget.parentElement!.hidePopover(); pickRunes(p.id); }}
        >
          {p.primaryStyleIconPath && <img src={asset(p.primaryStyleIconPath)} alt="" />}
          {p.secondaryStyleIconPath && <img src={asset(p.secondaryStyleIconPath)} alt="" />}
          <span>{p.name}</span>
        </button>
      ))}
      <button className="edit" onClick={(e) => { e.currentTarget.parentElement!.hidePopover(); editor.current!.open(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>Crea o modifica…</span>
      </button>
    </div>
  </>;
}
