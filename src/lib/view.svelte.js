// What several parts of the interface need to know about the client's state, worked out once.
import { c, queue, roles } from './client.svelte.js';
import { asset } from './lcu.js';

// Interface state shared between components: the party's empty seats open the friends list.
export const ui = $state({ friendsOpen: false });

export const view = {
  get stage() {
    return !c.connected ? 'off'
      : c.phase === 'ReadyCheck' ? 'ready'
      : c.phase === 'Matchmaking' ? 'queue'
      : c.phase === 'None' || c.phase === 'Lobby' ? 'lobby'
      : 'game';
  },
  get q() { return queue(); },
  get myRoles() { return roles(); },
  get me() { return c.lobby?.localMember; },
  // Before a lobby exists the party is just you, shown the way it will look once created.
  get members() {
    const [first, second] = roles();
    return c.lobby?.members ?? (c.me ? [{
      summonerId: c.me.summonerId, summonerIconId: c.me.profileIconId, isLeader: true,
      firstPositionPreference: first, secondPositionPreference: second,
    }] : []);
  },
  get size() { return c.lobby?.gameConfig?.maxLobbySize ?? queue()?.max ?? 5; },
  get response() { return c.ready?.playerResponse ?? 'None'; },
};

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const icon = (id) => asset(`/lol-game-data/assets/v1/profile-icons/${id}.jpg`);
export const unread = (id) => id !== c.chatOpen && (c.conversations.find((v) => v.id === id)?.unreadMessageCount ?? 0);
export const nameOf = (m) => m.summonerId === c.me?.summonerId ? c.me.gameName : c.names[m.puuid] ?? m.summonerName ?? '';
