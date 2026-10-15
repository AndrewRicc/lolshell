import { myAction, hover, benchSwap } from '../lib/client.ts';
import { champIcon, champName, useClient } from '../lib/view.ts';
import Team from './Team.tsx';
import ChampGrid from './ChampGrid.tsx';
import Spells from './Spells.tsx';
import Runes from './Runes.tsx';
import './Select.css';

export default function Select() {
  const c = useClient();
  const s = c.select!;
  const action = myAction();
  const me = s.myTeam.find((p) => p.cellId === s.localPlayerCellId);
  const done = s.actions.flat().filter((a) => a.completed && a.championId);
  const bans = (ally: boolean) => done.filter((a) => a.type === 'ban' && a.isAllyAction === ally).map((a) => a.championId);
  // Banned for everyone; picked ones too, unless this mode lets champions repeat.
  const taken = new Set(done.filter((a) => a.type === 'ban' || !s.allowDuplicatePicks).map((a) => a.championId));

  return (
    <div className={s.theirTeam.length ? 'select' : 'select solo'}>
      <Team title="Alleati" players={s.myTeam} bans={bans(true)} />

      <section className="center" aria-labelledby="h-center">
        <div className="head">
          <h2 id="h-center">
            {action ? (action.type === 'ban' ? 'Banna un campione' : action.isInProgress ? 'Scegli il campione' : 'Mostra la tua scelta') : 'Il tuo campione'}
          </h2>
          <span className="loadout"><Runes championId={me?.championId || me?.championPickIntent || action?.championId} position={me?.assignedPosition} />{me && <Spells me={me} />}</span>
        </div>
        {action ? (
          <ChampGrid ids={action.type === 'ban' ? c.bannable : c.pickable} taken={taken} selected={action.championId} onpick={hover} label="Campioni" />
        ) : <>
          <div className="my-champ">
            <img src={champIcon(me?.championId)} alt="" width="96" height="96" />
            <b>{champName(me?.championId) || 'In attesa degli altri giocatori'}</b>
          </div>
          {s.benchEnabled && <>
            <h2>Panchina</h2>
            <div className="champs bench">
              {s.benchChampions.length ? s.benchChampions.map((b) => (
                <button key={b.championId} title={`Prendi ${champName(b.championId)}`} disabled={c.busy} onClick={() => benchSwap(b.championId)}>
                  <img src={champIcon(b.championId)} alt="" />
                  <span>{champName(b.championId)}</span>
                </button>
              )) : (
                <p className="hint">Vuota: qui finiscono i campioni scartati dalla squadra.</p>
              )}
            </div>
          </>}
        </>}
      </section>

      {!!s.theirTeam.length && <Team title="Nemici" players={s.theirTeam} bans={bans(false)} enemy />}
    </div>
  );
}
