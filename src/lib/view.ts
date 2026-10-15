// What several parts of the interface need to know about the client's state, worked out once.
import { useSyncExternalStore } from 'react';
import { proxy, snapshot, subscribe } from 'valtio';
import { c, queue, roles, type Member } from './client.ts';
import { asset } from './lcu.ts';

// Interface state shared between components: the party's empty seats open the friends list.
export const ui = proxy({ friendsOpen: false });

// Any change to the client's state re-renders the component. Not useSnapshot: it tracks only what
// render reads off the snapshot, and the helpers here and in client.ts read `c` itself.
const watch = (cb: () => void) => subscribe(c, cb);
export const useClient = () => useSyncExternalStore(watch, () => snapshot(c));

export const view = {
  get stage() {
    return !c.connected ? 'off'
      : c.phase === 'ReadyCheck' ? 'ready'
      : c.phase === 'Matchmaking' ? 'queue'
      : c.phase === 'None' || c.phase === 'Lobby' ? 'lobby'
      : c.phase === 'ChampSelect' && c.select ? 'select'
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
export const unread = (id: string) => id !== c.chatOpen && (c.conversations.find((v) => v.id === id)?.unreadMessageCount ?? 0);
export const nameOf = (m: Member) => m.summonerId === c.me?.summonerId ? c.me.gameName : c.names[m.puuid!] ?? m.summonerName ?? '';
