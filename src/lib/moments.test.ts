import test from 'node:test';
import assert from 'node:assert/strict';
import { moments } from './moments.ts';
import { recall, remember } from './rects.ts';
import type { Session } from './client.ts';

const act = (id: number, actorCellId: number, type: string, championId: number, completed: boolean) =>
  ({ id, actorCellId, type, championId, completed, isInProgress: !completed, isAllyAction: actorCellId < 5 });
const sess = (...actions: ReturnType<typeof act>[]) => ({ localPlayerCellId: 2, actions: [actions] }) as unknown as Session;

const open = sess(act(12, 2, 'pick', 0, false), act(13, 5, 'ban', 0, false));

test('no previous session or no change means no moments', () => {
  assert.deepEqual(moments(null, open), []);
  assert.deepEqual(moments(open, open), []);
});

test('own completed pick', () => {
  assert.deepEqual(moments(open, sess(act(12, 2, 'pick', 103, true), act(13, 5, 'ban', 0, false))),
    [{ kind: 'pick', cellId: 2, championId: 103, mine: true, ally: true }]);
});

test('enemy completed ban', () => {
  assert.deepEqual(moments(open, sess(act(12, 2, 'pick', 0, false), act(13, 5, 'ban', 222, true))),
    [{ kind: 'ban', cellId: 5, championId: 222, mine: false, ally: false }]);
});

test('skipped ban (champion 0) is not a moment', () => {
  assert.deepEqual(moments(open, sess(act(12, 2, 'pick', 0, false), act(13, 5, 'ban', 0, true))), []);
});

test('remember/recall consumes the rect once', () => {
  assert.equal(recall('pick'), null);
  const r = { x: 1 } as DOMRect;
  remember('pick', { getBoundingClientRect: () => r });
  assert.equal(recall('pick'), r);
  assert.equal(recall('pick'), null);
});
