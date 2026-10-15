// Live state of the League client plus the actions the interface can take.
// The client is the source of truth: everything here mirrors what it reports.
import { proxy, subscribe } from 'valtio';
import { lcu, onEvent, type LcuEvent } from './lcu.ts';
import { summarize } from './usage.ts';
import * as win from './win.ts';

// What the client sends, reduced to the fields read here and in the components.
export interface Summoner { summonerId: number; puuid: string; gameName: string; tagLine: string; summonerLevel: number; profileIconId: number }
export interface Member {
  summonerId: number; puuid?: string; summonerName?: string; summonerIconId: number; isLeader: boolean;
  firstPositionPreference: string; secondPositionPreference: string;
  allowedStartActivity?: boolean; allowedChangeActivity?: boolean; allowedInviteOthers?: boolean; allowedKickOthers?: boolean;
}
export interface Lobby {
  members: Member[]; localMember: Member; canStartActivity: boolean; multiUserChatId?: string;
  invitations?: { toSummonerId: number; state: string }[];
  gameConfig: {
    queueId: number; isCustom: boolean; showPositionSelector: boolean; maxLobbySize?: number;
    customTeam100?: { puuid: string }[]; customTeam200?: { puuid: string }[];
  };
}
export interface ReadyCheck { state: string; playerResponse: string; timer: number }
export interface Search {
  timeInQueue: number; estimatedQueueTime: number; readyCheck?: ReadyCheck;
  lowPriorityData?: { penaltyTimeRemaining: number };
  errors?: { id: number; message: string; penaltyTimeRemaining: number }[];
}
export interface Invite { invitationId: string; fromPuuid: string; fromSummonerName?: string; state: string; canAcceptInvitation: boolean; gameConfig?: { queueId: number } }
export interface Friend { id: string; puuid: string; summonerId: number; gameName: string; name: string; icon: number; availability: string; product: string }
export interface FriendRequest { puuid: string; direction: string; gameName: string; name: string }
export interface Conversation { id: string; type: string; gameName?: string; unreadMessageCount?: number }
export interface Message { id: string; type: string; body: string; fromPuuid: string }
export interface Player {
  cellId: number; championId: number; championPickIntent: number; assignedPosition: string;
  spell1Id: number; spell2Id: number; gameName: string; puuid: string;
}
export interface Action { id: number; actorCellId: number; type: string; championId: number; completed: boolean; isInProgress: boolean; isAllyAction: boolean }
export interface Session {
  queueId: number; localPlayerCellId: number; myTeam: Player[]; theirTeam: Player[]; actions: Action[][];
  timer: { phase: string; adjustedTimeLeftInPhase: number; totalTimeInPhase: number; internalNowInEpochMs: number; isInfinite: boolean };
  trades: { id: number; cellId: number; state: string }[]; chatDetails?: { multiUserChatId?: string };
  benchEnabled: boolean; benchChampions: { championId: number }[]; allowRerolling: boolean; rerollsRemaining: number;
  allowDuplicatePicks: boolean; isCustomGame?: boolean; showQuitButton?: boolean;
}
export interface Champion { id: number; name: string }
export interface Spell { id: number; name: string; iconPath: string; gameModes?: string[] }
export interface RunePage {
  id: number; name: string; current: boolean; isValid: boolean; isEditable?: boolean;
  primaryStyleId: number; subStyleId: number; selectedPerkIds: number[]; primaryStyleIconPath?: string; secondaryStyleIconPath?: string;
}
export interface RuneStyle { id: number; name: string; iconPath: string; allowedSubStyles: number[]; slots: { type: string; slotLabel: string; perks: number[] }[] }
export interface Perk { id: number; name: string; iconPath: string; shortDesc?: string }
export interface RecommendedPage { perks: { id: number }[]; primaryPerkStyleId: number; secondaryPerkStyleId: number; keystone?: { name: string; iconPath: string } }
interface RawQueue {
  id: number; name: string; description: string; category: string; gameMode: string; mapId: number;
  queueAvailability: string; isVisible: boolean; showPositionSelector: boolean; maximumParticipantListSize: number;
}
interface GameMap { id: number; gameMode: string; name: string; gameModeShortName?: string; assets?: Record<string, string> }
/** A queue as the interface shows it. */
export interface Queue {
  id: number; label: string; custom: boolean; gameMode: string; mapId: number;
  mode: { key: number | string; name: string; bg: string | null; icon: string | null; video: string | null };
  roles: boolean; max: number; count: number;
}

export const ROLES: [string, string][] = [
  ['TOP', 'Top'], ['JUNGLE', 'Jungle'], ['MIDDLE', 'Mid'],
  ['BOTTOM', 'Bot'], ['UTILITY', 'Support'], ['FILL', 'Fill'],
];
export const roleName = (id?: string) => ROLES.find((r) => r[0] === id)?.[1] ?? '';

const defaults = { autoAccept: false, sound: true, glass: true };
function stored(): Partial<typeof defaults> {
  try { return JSON.parse(localStorage.getItem('settings')!) ?? {}; } catch { return {}; }
}
export const settings = proxy({ ...defaults, ...stored() });
export function saveSettings() {
  try { localStorage.setItem('settings', JSON.stringify(settings)); } catch { /* private mode */ }
}
subscribe(settings, saveSettings);

export const c = proxy({
  connected: false,
  me: null as Summoner | null,
  phase: 'None',
  lobby: null as Lobby | null,
  search: null as Search | null,
  ready: null as ReadyCheck | null,
  invites: [] as Invite[],
  friends: [] as Friend[],
  requests: [] as FriendRequest[], // friend requests, both directions
  conversations: [] as Conversation[],
  chats: {} as Record<string, Message[]>, // conversation id -> messages, loaded when a chat is opened
  chatOpen: null as string | null,
  roomHidden: null as string | null, // party chat whose tab the user closed
  select: null as Session | null, // the champion select session, while there is one
  pickable: [] as number[], // champion ids the client lets you pick, and ban, right now
  bannable: [] as number[],
  champions: [] as Champion[], // every champion: id, name
  spells: [] as Spell[],
  runes: [] as RunePage[], // the saved rune pages; one of them is the current one
  runeStyles: [] as RuneStyle[], // the five paths, each with its rows of rune ids
  perks: [] as Perk[], // every rune and shard: id, name, iconPath, shortDesc
  queues: [] as Queue[],
  games: 0,
  suggested: null as [string, string] | null, // [first, second] from match history
  splash: null as string | null,
  names: {} as Record<string, string>, // puuid -> Riot ID name; neither the lobby nor chat messages carry names
  queuePick: null as number | null, // chosen before a lobby exists
  rolesPick: null as [string, string] | null,
  autoAccepted: false,
  riotUi: true,
  error: null as string | null,
  busy: false,
});

const get = (p: string) => lcu('GET', p);
const opt = (p: string) => get(p).catch(() => null);

export async function refresh() {
  try {
    c.me = await get('/lol-summoner/v1/current-summoner');
  } catch {
    c.connected = false;
    return;
  }
  c.connected = true;
  const [phase, lobby, search, invites, friends, conversations, requests, select] = await Promise.all([
    opt('/lol-gameflow/v1/gameflow-phase'), opt('/lol-lobby/v2/lobby'), opt('/lol-matchmaking/v1/search'),
    opt('/lol-lobby/v2/received-invitations'), opt('/lol-chat/v1/friends'),
    opt('/lol-chat/v1/conversations'), opt('/lol-chat/v2/friend-requests'), opt(SELECT),
  ]);
  c.phase = phase ?? 'None';
  c.search = search;
  c.ready = search?.readyCheck ?? null;
  c.invites = invites ?? [];
  c.friends = friends ?? [];
  c.conversations = conversations ?? [];
  c.requests = requests ?? [];
  setLobby(lobby);
  setSelect(select);
  showLobbyChat();
  autoAccept();
  if (!c.queues.length) loadDefaults();
  if (!c.champions.length) loadGameData();
}

async function loadRunes() {
  c.runes = (await opt('/lol-perks/v1/pages')) ?? [];
  if (c.runeStyles.length) return;
  [c.runeStyles, c.perks] = await Promise.all([opt('/lol-perks/v1/styles'), opt('/lol-perks/v1/perks')]).then((r) => r.map((x) => x ?? []));
}

// Names and pictures the client ships with: they only change with a patch.
async function loadGameData() {
  const [champions, spells] = await Promise.all([
    opt('/lol-game-data/assets/v1/champion-summary.json'), opt('/lol-game-data/assets/v1/summoner-spells.json'),
  ]);
  c.champions = ((champions ?? []) as Champion[]).filter((x) => x.id > 0).sort((a, b) => a.name.localeCompare(b.name));
  c.spells = spells ?? [];
}

const SELECT = '/lol-champ-select/v1/session';
function setSelect(session: Session | null) {
  const fresh = session && !c.select;
  c.select = session ?? null;
  if (!session) return;
  learnNames([...session.myTeam, ...session.theirTeam].map((p) => p.puuid));
  if (!fresh) return;
  opt('/lol-champ-select/v1/pickable-champion-ids').then((ids) => { c.pickable = ids ?? []; });
  opt('/lol-champ-select/v1/bannable-champion-ids').then((ids) => { c.bannable = ids ?? []; });
  loadRunes();
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
  const all: GameMap[] = maps ?? [];
  c.queues = ((queues ?? []) as RawQueue[])
    .filter((q) => q.queueAvailability === 'Available' && q.isVisible && ['PvP', 'Custom'].includes(q.category) && q.gameMode !== 'TFT')
    .map((q): Queue => {
      const custom = q.category === 'Custom';
      // The map a queue is played on names its card in the mode picker and lends it the client's own art.
      const map = all.find((m) => m.id === q.mapId && m.gameMode === q.gameMode) ?? all.find((m) => m.id === q.mapId);
      const art = (key: string) => map?.assets?.[key] ? `/${map.assets[key].replace(/^\//, '')}` : null;
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
    .sort((a, b) => Number(a.custom) - Number(b.custom) || b.count - a.count || a.label.localeCompare(b.label));
  syncRoles();

  const skin = profile?.backgroundSkinId;
  if (skin) {
    const champ = await opt(`/lol-game-data/assets/v1/champions/${Math.floor(skin / 1000)}.json`);
    c.splash = champ?.skins?.find((k: { id: number }) => k.id === skin)?.uncenteredSplashPath ?? null;
  }
}

function setLobby(lobby: Lobby | null) {
  c.lobby = lobby;
  if (!lobby) return;
  syncRoles();
  learnNames(lobby.members.map((m) => m.puuid));
}

// Players are identified by puuid everywhere: party chat messages carry no summoner id at all.
async function learnNames(puuids: (string | undefined)[]) {
  const missing = [...new Set(puuids)].filter((p) => p && !c.names[p]);
  if (!missing.length) return;
  const found: { puuid: string; gameName: string; displayName: string }[] | null = await lcu('POST', '/lol-summoner/v2/summoners/puuid', missing).catch(() => null);
  for (const s of found ?? []) c.names[s.puuid] = s.gameName || s.displayName;
}

export const queueId = () => c.lobby?.gameConfig?.queueId ?? c.queuePick ?? c.queues[0]?.id ?? null;
export const queue = () => c.queues.find((q) => q.id === queueId()) ?? null;

/** Roles in effect: what the lobby holds, else the user's pick, else the proposal from history. */
export function roles(): [string, string] {
  const me = c.lobby?.localMember;
  if (me && me.firstPositionPreference !== 'UNSELECTED') {
    return [me.firstPositionPreference, me.secondPositionPreference];
  }
  return c.rolesPick ?? c.suggested ?? ['UNSELECTED', 'UNSELECTED'];
}

const putRoles = ([firstPreference, secondPreference]: [string, string]) =>
  lcu('PUT', '/lol-lobby/v2/lobby/members/localMember/position-preferences', { firstPreference, secondPreference });

// A lobby that needs lanes and has none gets the ones shown on screen, so what the user
// sees is what the client holds.
function syncRoles() {
  const l = c.lobby;
  if (!l?.gameConfig?.showPositionSelector || l.localMember.firstPositionPreference !== 'UNSELECTED') return;
  const want = c.rolesPick ?? c.suggested;
  if (want) putRoles(want).catch(() => {});
}

function setPhase(next: string | null) {
  const prev = c.phase;
  c.phase = next ?? 'None';
  if (c.phase === prev) return;
  if (c.phase === 'ReadyCheck') {
    c.autoAccepted = false;
    win.summon();
    if (settings.sound) win.chime();
  } else if (c.phase === 'ChampSelect') {
    win.summon();
    opt(SELECT).then((s) => { if (s && !c.select) setSelect(s); });
  }
}

function autoAccept() {
  const r = c.ready;
  if (!settings.autoAccept || c.autoAccepted || r?.state !== 'InProgress' || r.playerResponse !== 'None') return;
  c.autoAccepted = true;
  accept();
}

let friendsTimer: ReturnType<typeof setTimeout>, chatsTimer: ReturnType<typeof setTimeout>;
const CHAT = '/lol-chat/v1/conversations';
function handle({ uri, eventType, data }: LcuEvent) {
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
  } else if (uri === SELECT) {
    setSelect(gone ? null : data);
  } else if (uri === '/lol-champ-select/v1/pickable-champion-ids') {
    c.pickable = data ?? [];
  } else if (uri === '/lol-champ-select/v1/bannable-champion-ids') {
    c.bannable = data ?? [];
  } else if (uri.startsWith('/lol-perks/v1/pages') || uri === '/lol-perks/v1/currentpage') {
    if (c.select) loadRunes();
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

let errorTimer: ReturnType<typeof setTimeout>;
/** Runs an action; a failure becomes a message on screen for a few seconds. Resolves to whether it worked. */
async function act(fn: () => Promise<unknown>) {
  c.error = null;
  c.busy = true;
  try {
    await fn();
    return true;
  } catch (e) {
    c.error = (e as Error).message;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { c.error = null; }, 6000);
    return false;
  } finally {
    c.busy = false;
  }
}

// A custom game is asked for by its queue id plus the room it should open.
function lobbyRequest(id: number | null) {
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

const createLobby = async (id: number | null) => setLobby(await lcu('POST', '/lol-lobby/v2/lobby', lobbyRequest(id)));
const ensureLobby = async () => {
  if (!c.lobby) await createLobby(queueId());
};

export const pickQueue = (id: number) => act(async () => {
  if (c.lobby) await createLobby(id);
  else c.queuePick = id;
});

export const pickRoles = (first: string, second: string) => act(async () => {
  if (first === 'FILL') second = 'UNSELECTED';
  else if (second === first || second === 'UNSELECTED') second = 'FILL';
  c.rolesPick = [first, second];
  if (c.lobby?.gameConfig?.showPositionSelector) await putRoles(c.rolesPick);
});

export const play = () => act(async () => {
  const existed = !!c.lobby;
  await ensureLobby();
  const lobby = c.lobby!;
  if (lobby.gameConfig.isCustom) {
    // First press opens the room so friends can be invited; the next one starts the game.
    if (existed) await lcu('POST', '/lol-lobby/v1/lobby/custom/start-champ-select');
    return;
  }
  const me = lobby.localMember;
  if (lobby.gameConfig.showPositionSelector && me.firstPositionPreference === 'UNSELECTED') await putRoles(roles());
  await lcu('POST', '/lol-lobby/v2/lobby/matchmaking/search');
});

export const cancelSearch = () => act(() => lcu('DELETE', '/lol-lobby/v2/lobby/matchmaking/search'));
export const accept = () => act(() => lcu('POST', '/lol-matchmaking/v1/ready-check/accept'));
export const decline = () => act(() => lcu('POST', '/lol-matchmaking/v1/ready-check/decline'));
export const leave = () => act(() => lcu('DELETE', '/lol-lobby/v2/lobby'));

export const invite = (summonerId: number) => act(async () => {
  await ensureLobby();
  await lcu('POST', '/lol-lobby/v2/lobby/invitations', [{ toSummonerId: summonerId }]);
});
export const answerInvite = (id: string, yes: boolean) =>
  act(() => lcu('POST', `/lol-lobby/v2/received-invitations/${id}/${yes ? 'accept' : 'decline'}`));

export const toggleRiotUi = () => act(async () => {
  await lcu('POST', c.riotUi ? '/riotclient/kill-ux' : '/riotclient/launch-ux');
  c.riotUi = !c.riotUi;
});

// Chat

const messagesPath = (id: string) => `${CHAT}/${encodeURIComponent(id)}/messages`;

function addMessage(id: string, m: Message) {
  const list = c.chats[id];
  if (list && !list.some((x) => x.id === m.id)) list.push(m);
  learnNames([m.fromPuuid]);
}

// The party chat opens by itself when you are in a party; a chat whose room is gone closes.
let dismissed: string | null; // the party chat the user closed by hand: do not reopen it
function showLobbyChat() {
  if (c.chatOpen && !c.conversations.some((v) => v.id === c.chatOpen)) c.chatOpen = null;
  if (!c.chatOpen && lobbyChat() && lobbyChat() !== dismissed) openChat(lobbyChat()!);
}

/** The chat room of the moment, once the client has joined it: the team's in champion select, else the party's. */
export const lobbyChat = () => {
  const room = c.select?.chatDetails?.multiUserChatId || c.lobby?.multiUserChatId;
  return (room && c.conversations.find((v) => v.id.startsWith(room))?.id) || null;
};

export const openChat = (id: string) => act(async () => {
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
export const closeTab = (id: string) => act(async () => {
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

export const send = (body: string) => act(async () => {
  const id = c.chatOpen!;
  const room = c.conversations.find((v) => v.id === id)?.type !== 'chat';
  addMessage(id, await lcu('POST', messagesPath(id), { body, type: room ? 'groupchat' : 'chat' }));
});

// Champion select

/** What the local player can act on: the action in progress, else the coming pick, to declare an intent. */
export function myAction() {
  const s = c.select;
  const mine = s?.actions.flat().filter((a) => a.actorCellId === s.localPlayerCellId && !a.completed) ?? [];
  // Before the bans start the client may already flag the ban as in progress: that time is for showing a pick.
  const planning = s?.timer?.phase === 'PLANNING';
  return (!planning && mine.find((a) => a.isInProgress)) || mine.find((a) => a.type === 'pick') || null;
}

// The whole action goes back: the client reads a body without its type as a pick, so a ban hover is lost.
export const hover = (championId: number) => act(() => { const a = myAction()!; return lcu('PATCH', `${SELECT}/actions/${a.id}`, { ...a, championId }); });
// Not POST .../complete: in a real champ select it answers OK and leaves the action open.
export const lockIn = () => act(() => { const a = myAction()!; return lcu('PATCH', `${SELECT}/actions/${a.id}`, { ...a, completed: true }); });
export const benchSwap = (championId: number) => act(() => lcu('POST', `${SELECT}/bench/swap/${championId}`));
export const reroll = () => act(() => lcu('POST', `${SELECT}/my-selection/reroll`));
export const pickSpells = (spell1Id: number, spell2Id: number) => act(() => lcu('PATCH', `${SELECT}/my-selection`, { spell1Id, spell2Id }));
/** A champion swap with a teammate: verb is request, accept, decline or cancel. */
export const swap = (id: number, verb: string) => act(() => lcu('POST', `${SELECT}/champion-swaps/${id}/${verb}`));

/** Makes one of the saved rune pages the one the game will use. */
export const pickRunes = (id: number) => act(async () => {
  await lcu('PUT', '/lol-perks/v1/currentpage', id);
  await loadRunes();
});
/** Writes a rune page (over the saved page with that id, or as a new one) and makes it the current one. */
export const saveRunes = (id: number | null, page: Pick<RunePage, 'name' | 'primaryStyleId' | 'subStyleId' | 'selectedPerkIds' | 'current'>) => act(async () => {
  const saved = id ? await lcu('PUT', `/lol-perks/v1/pages/${id}`, page) : await lcu('POST', '/lol-perks/v1/pages', page);
  await lcu('PUT', '/lol-perks/v1/currentpage', saved?.id ?? id);
  await loadRunes();
});

/** The client's own suggested pages for a champion; without a lane it uses the one the champion is usually played in. */
export async function recommendedRunes(championId: number, position?: string): Promise<RecommendedPage[]> {
  const mapId = c.queues.find((q) => q.id === c.select?.queueId)?.mapId ?? 11;
  const lane = position || (await opt(`/lol-perks/v1/recommended-pages-position/champion/${championId}`)) || 'NONE';
  return (await opt(`/lol-perks/v1/recommended-pages/champion/${championId}/position/${lane}/map/${mapId}`)) ?? [];
}

/** Leaves champion select the way Riot's own Quit does; the custom-lobby call is the fallback for older clients. */
// cancel-champ-select alone leaves Riot's interface showing a search that never ends.
export const quitSelect = () => act(() => lcu('POST', '/lol-lobby-team-builder/champ-select/v1/session/quit')
  .catch(() => lcu('POST', '/lol-lobby/v1/lobby/custom/cancel-champ-select')));

// Friends and party management

export const addFriend = (riotId: string) => act(async () => {
  const at = riotId.lastIndexOf('#');
  const gameName = riotId.slice(0, at).trim(), tagLine = riotId.slice(at + 1).trim();
  if (at < 1 || !tagLine) throw new Error('Scrivi il Riot ID completo, ad esempio Nome#EUW.');
  await lcu('POST', '/lol-chat/v2/friend-requests', { gameName, tagLine });
});

export const answerRequest = (puuid: string, yes: boolean) => act(() => yes
  ? lcu('PUT', `/lol-chat/v2/friend-requests/${puuid}`, { direction: 'both' })
  : lcu('DELETE', `/lol-chat/v2/friend-requests/${puuid}`));

export const kick = (summonerId: number) => act(() => lcu('POST', `/lol-lobby/v2/lobby/members/${summonerId}/kick`));
export const promote = (summonerId: number) => act(() => lcu('POST', `/lol-lobby/v2/lobby/members/${summonerId}/promote`));
