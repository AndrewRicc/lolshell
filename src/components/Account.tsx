import { useState } from 'react';
import { useSnapshot } from 'valtio';
import { settings, toggleRiotUi } from '../lib/client.ts';
import { icon, useClient } from '../lib/view.ts';
import { minimize, close, desktop } from '../lib/win.ts';
import './Account.css';

export default function Account() {
  const c = useClient();
  const set = useSnapshot(settings);
  const [menuOpen, setMenuOpen] = useState(false);

  return <>
    {/* The window has no system frame: this strip is what you drag it by. */}
    <div className="titlebar" data-tauri-drag-region>
      {desktop && <>
        <button className="win" aria-label="Riduci a icona" onClick={minimize}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
        <button className="win" aria-label="Chiudi" onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </>}
    </div>
    <div className={menuOpen ? 'account open' : 'account'}>
      <button className="pill" aria-label="Account e opzioni" aria-expanded={menuOpen} aria-controls="menu" onClick={() => setMenuOpen(!menuOpen)}>
        {c.me ? <>
          <span className="who"><b>{c.me.gameName}</b><small>#{c.me.tagLine} · Liv. {c.me.summonerLevel}</small></span>
          <img src={icon(c.me.profileIconId)} alt="" width="40" height="40" />
        </> : (
          <span className="who"><b>Non collegato</b><small>Opzioni</small></span>
        )}
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      <div className="menu" id="menu" inert={!menuOpen}>
        <label><input type="checkbox" role="switch" checked={set.sound} onChange={(e) => { settings.sound = e.target.checked; }} /> Suono alla partita trovata</label>
        <label><input type="checkbox" role="switch" checked={set.glass} onChange={(e) => { settings.glass = e.target.checked; }} /> Pannelli sfocati</label>
        <button className="quiet" onClick={toggleRiotUi} disabled={!c.connected || c.busy}>
          {c.riotUi ? 'Spegni l’interfaccia di Riot' : 'Riaccendi l’interfaccia di Riot'}
        </button>
      </div>
    </div>
  </>;
}
