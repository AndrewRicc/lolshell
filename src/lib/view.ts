// What several parts of the interface need to know about the client's state, worked out once.
import { useEffect, useSyncExternalStore } from 'react';
import { proxy, snapshot, subscribe } from 'valtio';
import { c, queue, roles, POST_GAME, type Member } from './client.ts';
import { asset } from './lcu.ts';

// Interface state shared between components: the party's empty seats open the friends list; a scene
// (an LCU image path) stands in for the profile splash behind everything.
export const ui = proxy({ friendsOpen: false, scene: null as string | null });

// Any change to the client's state re-renders the component. Not useSnapshot: it tracks only what
// render reads off the snapshot, and the helpers here and in client.ts read `c` itself.
const watch = (cb: () => void) => subscribe(c, cb);
export const useClient = () => useSyncExternalStore(watch, () => snapshot(c));

// Closes a panel when a press lands outside it. `inside` also lists the buttons that open it, so they are not a press away.
export function useClickAway(open: boolean, inside: string, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest?.(inside)) close(); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open, inside, close]);
}

export const view = {
  get stage() {
    return !c.connected ? 'off'
      : c.phase === 'ReadyCheck' ? 'ready'
      : c.phase === 'Matchmaking' ? 'queue'
      : c.phase === 'None' || c.phase === 'Lobby' ? 'lobby'
      : c.phase === 'ChampSelect' && c.select ? 'select'
      : POST_GAME.includes(c.phase) ? 'post'
      : 'game';
  },
  get q() { return queue(); },
  get myRoles() { return roles(); },
  get me() { return c.lobby?.localMember; },
  // Before a lobby exists the party is just you, shown the way it will look once created.
  get members(): Member[] {
    const [first, second] = roles();
    return c.lobby?.members ?? (c.me ? [{
      summonerId: c.me.summonerId, summonerIconId: c.me.profileIconId, isLeader: true,
      firstPositionPreference: first, secondPositionPreference: second,
    }] : []);
  },
  get size() { return c.lobby?.gameConfig?.maxLobbySize ?? queue()?.max ?? 5; },
  // A ban is being made by someone right now: the whole screen turns red, as in Riot's client.
  get banning() { return !!c.select?.actions.flat().some((a) => a.type === 'ban' && a.isInProgress && !a.completed) && c.select?.timer?.phase !== 'PLANNING'; },
  get response() { return c.ready?.playerResponse ?? 'None'; },
};

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const icon = (id?: number) => asset(`/lol-game-data/assets/v1/profile-icons/${id}.jpg`);
export const champIcon = (id?: number) => asset(`/lol-game-data/assets/v1/champion-icons/${id || -1}.png`);
export const champName = (id?: number) => c.champions.find((x) => x.id === id)?.name ?? '';
// An LCU path, for ui.scene. The splash routes by id answer 400 here, so the path is built from the art folder.
// shortcut: the file name follows the alias for every champion but Xin Zhao and Hwei (the backdrop then just stays); the exact path needs champions/{id}.json, one more request per pick.
export const champSplash = (id: number) => {
  const a = c.champions.find((x) => x.id === id)?.alias;
  return a ? `/lol-game-data/assets/ASSETS/Characters/${a}/Skins/Base/Images/${a.toLowerCase()}_splash_uncentered_0.jpg` : null;
};
export const unread = (id: string) => id !== c.chatOpen && (c.conversations.find((v) => v.id === id)?.unreadMessageCount ?? 0);
export const nameOf = (m: Member) => m.summonerId === c.me?.summonerId ? c.me.gameName : c.names[m.puuid!] ?? m.summonerName ?? '';
