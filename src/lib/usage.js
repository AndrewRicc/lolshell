// Turns recent match history into the defaults the lobby proposes.

const RIFT = new Set([400, 420, 440]); // the queues where a lane is actually chosen

function position(t) {
  if (!t) return null;
  if (t.lane === 'JUNGLE') return 'JUNGLE';
  if (/SUPPORT/.test(t.role)) return 'UTILITY';
  if (t.lane === 'TOP') return 'TOP';
  if (/^MID/.test(t.lane)) return 'MIDDLE';
  if (/^BOT/.test(t.lane)) return 'BOTTOM';
  return null;
}

const ranked = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map((e) => e[0]);

/** @returns {{ usage: Record<number, number>, games: number, roles: [string, string] | null }} */
export function summarize(games) {
  const usage = {}, pos = {};
  for (const g of games) {
    usage[g.queueId] = (usage[g.queueId] ?? 0) + 1;
    const p = RIFT.has(g.queueId) && position(g.participants?.[0]?.timeline);
    if (p) pos[p] = (pos[p] ?? 0) + 1;
  }
  const top = ranked(pos);
  return { usage, games: games.length, roles: top.length ? [top[0], top[1] ?? 'FILL'] : null };
}
