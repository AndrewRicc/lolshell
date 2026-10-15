import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './usage.ts';

const game = (queueId: number, lane: string, role: string) => ({ queueId, participants: [{ timeline: { lane, role } }] });

test('counts queues and proposes the two most played lanes', () => {
  const s = summarize([
    game(400, 'JUNGLE', 'NONE'), game(420, 'JUNGLE', 'NONE'), game(400, 'NONE', 'SUPPORT'),
    game(2400, 'NONE', 'SUPPORT'), game(2400, 'NONE', 'SUPPORT'), // ARAM lanes are noise
  ]);
  assert.deepEqual(s.usage, { 400: 2, 420: 1, 2400: 2 });
  assert.equal(s.games, 5);
  assert.deepEqual(s.roles, ['JUNGLE', 'UTILITY']);
});

test('no lane games means no proposal; one lane pairs with fill', () => {
  assert.equal(summarize([game(2400, 'NONE', 'SUPPORT')]).roles, null);
  assert.deepEqual(summarize([game(400, 'MIDDLE', 'SOLO')]).roles, ['MIDDLE', 'FILL']);
});
