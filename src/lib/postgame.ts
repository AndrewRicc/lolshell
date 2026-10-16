// The end-of-game summary: what the client reports after a game, shaped for the screen.

// Only the fields the screen reads. `stats` has no schema in the client's API: the keys used here
// were read off a real game (patch 16.20).
export interface EogPlayer {
  puuid: string; summonerId: number; riotIdGameName: string; summonerName: string; championId: number; championName: string;
  items: readonly number[]; spell1Id: number; spell2Id: number; isLocalPlayer: boolean; skinSplashPath: string; leaver: boolean;
  stats: Readonly<Record<string, number>>;
}
export interface Eog {
  gameId: number; gameLength: number; gameMode: string; queueType: string; ranked: boolean; gameEndedInEarlySurrender: boolean;
  teams: readonly { teamId: number; isPlayerTeam: boolean; isWinningTeam: boolean; players: readonly EogPlayer[] }[];
}
export interface HonorTarget { puuid: string; summonerId: number; championId: number; championName: string }
// votePool.votes is the whole pool for the game: it stays the same as votes are cast.
export interface Ballot {
  gameId: number; eligibleAllies: readonly HonorTarget[]; eligibleOpponents: readonly HonorTarget[];
  honoredPlayers: readonly { honorType: string; recipientPuuid: string }[]; votePool: { votes: number };
}
export interface Mastery { championId: number; grade: string; level: number; pointsGained: number; hasLeveledUp: boolean }

export interface Line {
  puuid: string; summonerId: number; name: string; championId: number; champion: string;
  kills: number; deaths: number; assists: number; cs: number; gold: number; damage: number;
  items: number[]; spells: [number, number]; me: boolean; left: boolean;
}

const line = (p: EogPlayer): Line => ({
  puuid: p.puuid, summonerId: p.summonerId, name: p.riotIdGameName || p.summonerName, championId: p.championId, champion: p.championName,
  kills: p.stats.CHAMPIONS_KILLED ?? 0, deaths: p.stats.NUM_DEATHS ?? 0, assists: p.stats.ASSISTS ?? 0,
  cs: (p.stats.MINIONS_KILLED ?? 0) + (p.stats.NEUTRAL_MINIONS_KILLED ?? 0),
  gold: p.stats.GOLD_EARNED ?? 0, damage: p.stats.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS ?? 0,
  items: p.items.filter(Boolean), spells: [p.spell1Id, p.spell2Id], me: p.isLocalPlayer, left: p.leaver,
});

export function postGame(e: Eog) {
  const teams = [...e.teams]
    .sort((a, b) => Number(b.isPlayerTeam) - Number(a.isPlayerTeam))
    .map((t) => {
      const players = t.players.map(line);
      return { mine: t.isPlayerTeam, win: t.isWinningTeam, kills: players.reduce((n, p) => n + p.kills, 0), players };
    });
  const all = teams.flatMap((t) => t.players);
  return {
    win: !!teams.find((t) => t.mine)?.win, length: e.gameLength, surrender: e.gameEndedInEarlySurrender,
    teams, me: all.find((p) => p.me)!, topDamage: Math.max(1, ...all.map((p) => p.damage)),
  };
}

export const votesLeft = (b: Ballot | null) => b ? Math.max(0, b.votePool.votes - b.honoredPlayers.length) : 0;
