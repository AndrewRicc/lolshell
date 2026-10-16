import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postGame, votesLeft, type Ballot, type Eog } from './postgame.ts';

// A real ARAM Mayhem game (patch 16.20), names and ids replaced.
const eog: Eog = JSON.parse(readFileSync(new URL('./fixtures/eog.json', import.meta.url), 'utf8'));
const ballot: Ballot = JSON.parse(readFileSync(new URL('./fixtures/honor-ballot.json', import.meta.url), 'utf8'));

test('your team comes first, with your own line marked', () => {
  const g = postGame(eog);
  assert.equal(g.win, false);
  assert.equal(g.length, 1389);
  assert.deepEqual(g.teams.map((t) => [t.mine, t.win, t.players.length]), [[true, false, 5], [false, true, 5]]);
  assert.deepEqual(
    { ...g.me, items: g.me.items.length },
    { puuid: 'puuid-1', summonerId: 1001, name: 'Giocatore 1', championId: 12, champion: 'Alistar', kills: 2, deaths: 10, assists: 36, cs: 9, gold: 19143, damage: 14326, items: 7, spells: [4, 32], me: true, left: false },
  );
  assert.equal(g.teams[0].kills, g.teams[0].players.reduce((n, p) => n + p.kills, 0));
  assert.equal(g.topDamage, Math.max(...g.teams.flatMap((t) => t.players.map((p) => p.damage))));
});

test('empty item slots are dropped', () => {
  const p = structuredClone(eog);
  p.teams[0].players[0].items = [3083, 0, 0, 2052];
  assert.deepEqual(postGame(p).teams.flatMap((t) => t.players).find((x) => x.puuid === p.teams[0].players[0].puuid)!.items, [3083, 2052]);
});

test('votes left are the pool minus the players already honored', () => {
  assert.equal(votesLeft(ballot), 4);
  assert.equal(votesLeft({ ...ballot, honoredPlayers: [{ honorType: 'HEART', recipientPuuid: 'puuid-1' }] }), 3);
  assert.equal(votesLeft(null), 0);
});
