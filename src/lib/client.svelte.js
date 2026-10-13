// Live state of the League client plus the actions the lobby screen can take.
// The client is the source of truth: everything here mirrors what it reports.
import { lcu, onEvent } from './lcu.js';
import { summarize } from './usage.js';
import * as win from './win.js';

export const ROLES = [
  ['TOP', 'Top'], ['JUNGLE', 'Jungle'], ['MIDDLE', 'Mid'],
  ['BOTTOM', 'Bot'], ['UTILITY', 'Support'], ['FILL', 'Fill'],
];
export const roleName = (id) => ROLES.find((r) => r[0] === id)?.[1] ?? '';

function stored() {
  try { return JSON.parse(localStorage.getItem('settings')) ?? {}; } catch { return {}; }
}
export const settings = $state({ autoAccept: false, sound: true, glass: true, ...stored() });
export function saveSettings() {
  try { localStorage.setItem('settings', JSON.stringify(settings)); } catch { /* private mode */ }
}

export const c = $state({
  connected: false,
  me: null,
  phase: 'None',
  lobby: null,
  search: null,
  ready: null,
  invites: [],
  friends: [],
  requests: [], // friend requests, both directions
  conversations: [],
  chats: {}, // conversation id -> messages, loaded when a chat is opened
  chatOpen: null,
  roomHidden: null, // party chat whose tab the user closed
  queues: [],
  games: 0,
  suggested: null, // [first, second] from match history
  splash: null,
  names: {}, // puuid -> Riot ID name; neither the lobby nor chat messages carry names
  queuePick: null, // chosen before a lobby exists
  rolesPick: null,
  autoAccepted: false,
  riotUi: true,
  error: null,
  busy: false,
});

const get = (p) => lcu('GET', p);
const opt = (p) => get(p).catch(() => null);

export async function refresh() {
  try {
    c.me = await get('/lol-summoner/v1/current-summoner');
  } catch {
    c.connected = false;
    return;
  }
  c.connected = true;
  const [phase, lobby, search, invites, friends, conversations, requests] = await Promise.all([
    opt('/lol-gameflow/v1/gameflow-phase'), opt('/lol-lobby/v2/lobby'), opt('/lol-matchmaking/v1/search'),
    opt('/lol-lobby/v2/received-invitations'), opt('/lol-chat/v1/friends'),
    opt('/lol-chat/v1/conversations'), opt('/lol-chat/v2/friend-requests'),
  ]);
  c.phase = phase ?? 'None';
  c.search = search;
  c.ready = search?.readyCheck ?? null;
  c.invites = invites ?? [];
  c.friends = friends ?? [];
  c.conversations = conversations ?? [];
  c.requests = requests ?? [];
  setLobby(lobby);
  showLobbyChat();
  autoAccept();
  if (!c.queues.length) loadDefaults();
}

async function loadDefaults() {
  const [queues, maps, history, profile] = await Promise.all([
    opt('/lol-game-queues/v1/queues'),
    opt('/lol-maps/v2/maps'),
    opt('/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=49'),
    opt('/lol-summoner/v1/current-summoner/summoner-profile'),
  ]);
  const s = summarize(history?.games?.games ?? []);
  c.games = s.games;
  c.suggested = s.roles;
  c.queues = (queues ?? [])
    .filter((q) => q.queueAvailability === 'Available' && q.isVisible && ['PvP', 'Custom'].includes(q.category) && q.gameMode !== 'TFT')
    .map((q) => {
      const custom = q.category === 'Custom';
      // The map a queue is played on names its card in the mode picker and lends it the client's own art.
      const map = (maps ?? []).find((m) => m.id === q.mapId && m.gameMode === q.gameMode) ?? (maps ?? []).find((m) => m.id === q.mapId);
      const art = (key) => map?.assets?.[key] ? `/${map.assets[key].replace(/^\//, '')}` : null;
      return {
        id: q.id, label: q.description || q.name, custom, gameMode: q.gameMode, mapId: q.mapId,
        mode: {
          key: custom ? 'custom' : q.mapId,
          name: custom ? 'Custom' :map?.gameModeShortName || map?.name || q.name,
          bg: art('parties-background'), icon: art('game-select-icon-active'), video: art('game-select-icon-active-video'),
        },
        roles: q.showPositionSelector && !custom,
        // A custom queue's own limit also counts spectators; the two teams hold ten.
        max: custom ? 10 : q.maximumParticipantListSize, count: s.usage[q.id] ?? 0,
      };
    })
    .sort((a, b) => a.custom - b.custom || b.count - a.count || a.label.localeCompare(b.label));
  syncRoles();

  const skin = profile?.backgroundSkinId;
  if (skin) {
    const champ = await opt(`/lol-game-data/assets/v1/champions/${Math.floor(skin / 1000)}.json`);
    c.splash = champ?.skins?.find((k) => k.id === skin)?.uncenteredSplashPath ?? null;
  }
}

function setLobby(lobby) {
  c.lobby = lobby;
  if (!lobby) return;
  syncRoles();
  learnNames(lobby.members.map((m) => m.puuid));
}

// Players are identified by puuid everywhere: party chat messages carry no summoner id at all.
async function learnNames(puuids) {
  const missing = [...new Set(puuids)].filter((p) => p && !c.names[p]);
  if (!missing.length) return;
  const found = await lcu('POST', '/lol-summoner/v2/summoners/puuid', missing).catch(() => null);
  for (const s of found ?? []) c.names[s.puuid] = s.gameName || s.displayName;
}

export const queueId = () => c.lobby?.gameConfig?.queueId ?? c.queuePick ?? c.queues[0]?.id ?? null;
export const queue = () => c.queues.find((q) => q.id === queueId()) ?? null;

/** Roles in effect: what the lobby holds, else the user's pick, else the proposal from history. */
export function roles() {
  const me = c.lobby?.localMember;
  if (me && me.firstPositionPreference !== 'UNSELECTED') {
    return [me.firstPositionPreference, me.secondPositionPreference];
  }
  return c.rolesPick ?? c.suggested ?? ['UNSELECTED', 'UNSELECTED'];
}

const putRoles = ([firstPreference, secondPreference]) =>
  lcu('PUT', '/lol-lobby/v2/lobby/members/localMember/position-preferences', { firstPreference, secondPreference });

// A lobby that needs lanes and has none gets the ones shown on screen, so what the user
// sees is what the client holds.
function syncRoles() {
  const l = c.lobby;
  if (!l?.gameConfig?.showPositionSelector || l.localMember.firstPositionPreference !== 'UNSELECTED') return;
  const want = c.rolesPick ?? c.suggested;
  if (want) putRoles(want).catch(() => {});
}

function setPhase(next) {
  const prev = c.phase;
  c.phase = next ?? 'None';
  if (c.phase === prev) return;
  if (c.phase === 'ReadyCheck') {
    c.autoAccepted = false;
    win.summon();
    if (settings.sound) win.chime();
  } else if (c.phase === 'ChampSelect') {
    // Champion select is not ours yet: hand over to Riot's interface.
    lcu('POST', '/riotclient/ux-show').catch(() => {});
    c.riotUi = true;
  }
}

function autoAccept() {
  const r = c.ready;
  if (!settings.autoAccept || c.autoAccepted || r?.state !== 'InProgress' || r.playerResponse !== 'None') return;
  c.autoAccepted = true;
  accept();
}

let friendsTimer, chatsTimer;
const CHAT = '/lol-chat/v1/conversations';
function handle({ uri, eventType, data }) {
  const gone = eventType === 'Delete';
  if (uri === '/bridge') {
    if (data === 'connected') refresh(); else c.connected = false;
  } else if (uri === '/lol-summoner/v1/current-summoner') {
    if (!c.connected) refresh(); // login finished after we connected
  } else if (uri === '/lol-gameflow/v1/gameflow-phase') {
    setPhase(data);
  } else if (uri === '/lol-lobby/v2/lobby') {
    setLobby(gone ? null : data);
  } else if (uri === '/lol-matchmaking/v1/search') {
    c.search = gone ? null : data;
  } else if (uri === '/lol-matchmaking/v1/ready-check') {
    c.ready = gone ? null : data;
    autoAccept();
  } else if (uri === '/lol-lobby/v2/received-invitations') {
    c.invites = data ?? [];
    learnNames(c.invites.map((i) => i.fromPuuid));
  } else if (uri.startsWith('/lol-chat/v1/friends')) {
    // One event per friend: coalesce into a single re-read.
    clearTimeout(friendsTimer);
    friendsTimer = setTimeout(async () => { c.friends = (await opt('/lol-chat/v1/friends')) ?? c.friends; }, 400);
  } else if (uri.startsWith('/lol-chat/v2/friend-requests')) {
    opt('/lol-chat/v2/friend-requests').then((r) => { c.requests = r ?? []; });
  } else if (uri.startsWith(CHAT)) {
    const [id, part] = uri.slice(CHAT.length + 1).split('/').map(decodeURIComponent);
    if (part === 'messages' && !gone && data?.id) addMessage(id, data);
    // Unread counts and new conversations: coalesce into a single re-read.
    clearTimeout(chatsTimer);
    chatsTimer = setTimeout(async () => {
      c.conversations = (await opt(CHAT)) ?? c.conversations;
      showLobbyChat();
    }, 300);
  }
}

export function start() {
  onEvent(handle);
  refresh();
}

let errorTimer;
/** Runs an action; a failure becomes a message on screen for a few seconds. Resolves to whether it worked. */
async function act(fn) {
  c.error = null;
  c.busy = true;
  try {
    await fn();
    return true;
  } catch (e) {
    c.error = e.message;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { c.error = null; }, 6000);
    return false;
  } finally {
    c.busy = false;
  }
}

// A custom game is asked for by its queue id plus the room it should open.
function lobbyRequest(id) {
  const q = c.queues.find((x) => x.id === id);
  if (!q?.custom) return { queueId: id };
  return {
    queueId: id,
    customGameLobby: {
      lobbyName: `Partita di ${c.me?.gameName ?? ''}`.trim(),
      lobbyPassword: '',
      configuration: { gameMode: q.gameMode, mapId: q.mapId, mutators: { id }, spectatorPolicy: 'NotAllowed', teamSize: 5 },
    },
  };
}

const createLobby = async (id) => setLobby(await lcu('POST', '/lol-lobby/v2/lobby', lobbyRequest(id)));
const ensureLobby = async () => {
  if (!c.lobby) await createLobby(queueId());
};

export const pickQueue = (id) => act(async () => {
  if (c.lobby) await createLobby(id);
  else c.queuePick = id;
});

export const pickRoles = (first, second) => act(async () => {
  if (first === 'FILL') second = 'UNSELECTED';
  else if (second === first || second === 'UNSELECTED') second = 'FILL';
  c.rolesPick = [first, second];
  if (c.lobby?.gameConfig?.showPositionSelector) await putRoles(c.rolesPick);
});

export const play = () => act(async () => {
  const existed = !!c.lobby;
  await ensureLobby();
  if (c.lobby.gameConfig.isCustom) {
    // First press opens the room so friends can be invited; the next one starts the game.
    if (existed) await lcu('POST', '/lol-lobby/v1/lobby/custom/start-champ-select');
    return;
  }
  const me = c.lobby.localMember;
  if (c.lobby.gameConfig.showPositionSelector && me.firstPositionPreference === 'UNSELECTED') await putRoles(roles());
  await lcu('POST', '/lol-lobby/v2/lobby/matchmaking/search');
});

export const cancelSearch = () => act(() => lcu('DELETE', '/lol-lobby/v2/lobby/matchmaking/search'));
export const accept = () => act(() => lcu('POST', '/lol-matchmaking/v1/ready-check/accept'));
export const decline = () => act(() => lcu('POST', '/lol-matchmaking/v1/ready-check/decline'));
export const leave = () => act(() => lcu('DELETE', '/lol-lobby/v2/lobby'));

export const invite = (summonerId) => act(async () => {
  await ensureLobby();
  await lcu('POST', '/lol-lobby/v2/lobby/invitations', [{ toSummonerId: summonerId }]);
});
export const answerInvite = (id, yes) =>
  act(() => lcu('POST', `/lol-lobby/v2/received-invitations/${id}/${yes ? 'accept' : 'decline'}`));

export const toggleRiotUi = () => act(async () => {
  await lcu('POST', c.riotUi ? '/riotclient/kill-ux' : '/riotclient/launch-ux');
  c.riotUi = !c.riotUi;
});

// Chat

const messagesPath = (id) => `${CHAT}/${encodeURIComponent(id)}/messages`;

function addMessage(id, m) {
  const list = c.chats[id];
  if (list && !list.some((x) => x.id === m.id)) list.push(m);
  learnNames([m.fromPuuid]);
}

// The party chat opens by itself when you are in a party; a chat whose room is gone closes.
let dismissed; // the party chat the user closed by hand: do not reopen it
function showLobbyChat() {
  if (c.chatOpen && !c.conversations.some((v) => v.id === c.chatOpen)) c.chatOpen = null;
  if (!c.chatOpen && lobbyChat() && lobbyChat() !== dismissed) openChat(lobbyChat());
}

/** The party's own chat room, once the client has joined it. */
export const lobbyChat = () => {
  const room = c.lobby?.multiUserChatId;
  return (room && c.conversations.find((v) => v.id.startsWith(room))?.id) || null;
};

export const openChat = (id) => act(async () => {
  // A friend we never wrote to has no conversation yet.
  if (!c.conversations.some((v) => v.id === id)) await lcu('POST', CHAT, { id, type: 'chat' });
  if (id === c.roomHidden) c.roomHidden = null;
  c.chatOpen = id;
  c.chats[id] = (await opt(messagesPath(id))) ?? [];
  learnNames(c.chats[id].map((m) => m.fromPuuid));
  // Telling the client which chat is on screen is what clears its unread count.
  lcu('PUT', `${CHAT}/active`, { id }).catch(() => {});
});

export function closeChat() {
  dismissed = lobbyChat();
  c.chatOpen = null;
  lcu('DELETE', `${CHAT}/active`).catch(() => {});
}

/** Closes one conversation. The party room cannot be left, so its tab is only put away. */
export const closeTab = (id) => act(async () => {
  if (id === lobbyChat()) {
    dismissed = c.roomHidden = id;
  } else {
    await lcu('DELETE', `${CHAT}/${encodeURIComponent(id)}`);
    c.conversations = c.conversations.filter((v) => v.id !== id);
    delete c.chats[id];
  }
  if (c.chatOpen !== id) return;
  const next = c.conversations.find((v) => v.type === 'chat' || (v.id === lobbyChat() && v.id !== c.roomHidden));
  if (next) openChat(next.id); else closeChat();
});

export const send = (body) => act(async () => {
  const id = c.chatOpen;
  const room = c.conversations.find((v) => v.id === id)?.type !== 'chat';
  addMessage(id, await lcu('POST', messagesPath(id), { body, type: room ? 'groupchat' : 'chat' }));
});

// Friends and party management

export const addFriend = (riotId) => act(async () => {
  const at = riotId.lastIndexOf('#');
  const gameName = riotId.slice(0, at).trim(), tagLine = riotId.slice(at + 1).trim();
  if (at < 1 || !tagLine) throw new Error('Scrivi il Riot ID completo, ad esempio Nome#EUW.');
  await lcu('POST', '/lol-chat/v2/friend-requests', { gameName, tagLine });
});

export const answerRequest = (puuid, yes) => act(() => yes
  ? lcu('PUT', `/lol-chat/v2/friend-requests/${puuid}`, { direction: 'both' })
  : lcu('DELETE', `/lol-chat/v2/friend-requests/${puuid}`));

export const kick = (summonerId) => act(() => lcu('POST', `/lol-lobby/v2/lobby/members/${summonerId}/kick`));
export const promote = (summonerId) => act(() => lcu('POST', `/lol-lobby/v2/lobby/members/${summonerId}/promote`));