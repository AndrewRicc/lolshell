import type { Session } from './client.ts';

export type Moment = { kind: 'pick' | 'ban'; cellId: number; championId: number; mine: boolean; ally: boolean };

export function moments(prev: Session | null, next: Session | null): Moment[] {
  if (!prev || !next) return [];
  const done = new Set(prev.actions.flat().filter((a) => a.completed).map((a) => a.id));
  return next.actions.flat()
    .filter((a) => a.completed && !done.has(a.id) && a.championId > 0 && (a.type === 'pick' || a.type === 'ban'))
    .map((a) => ({ kind: a.type as Moment['kind'], cellId: a.actorCellId, championId: a.championId, mine: a.actorCellId === next.localPlayerCellId, ally: a.isAllyAction }));
}

const listeners = new Set<(m: Moment) => void>();
export const onMoment = (cb: (m: Moment) => void) => (listeners.add(cb), () => void listeners.delete(cb));
export const emitMoments = (list: Moment[]) => list.forEach((m) => listeners.forEach((cb) => cb(m)));
