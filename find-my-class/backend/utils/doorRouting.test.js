import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickBestDoorEndpointOrFallback,
  pickBestRouteWithOptionalDoors
} from './doorRouting.js';

test('pickBestDoorEndpointOrFallback uses door with shorter path', async () => {
  const logicalEnd = { _id: 'room', x: 0, y: 0, kind: 'point' };
  const doorA = { _id: 'd1', x: 1, y: 1, kind: 'door' };
  const doorB = { _id: 'd2', x: 2, y: 2, kind: 'door' };
  const fromLoc = { _id: 'start', x: 10, y: 10, kind: 'point' };

  const runDetailedForPair = async (_from, to) => {
    if (to._id === 'd1') return { path: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] };
    if (to._id === 'd2') return { path: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
    if (to._id === 'room') return { path: [{ x: 9, y: 9 }, { x: 8, y: 8 }] };
    return { path: [] };
  };

  const r = await pickBestDoorEndpointOrFallback(fromLoc, logicalEnd, [doorA, doorB], runDetailedForPair);
  assert.equal(r.doorUsed._id, 'd2');
  assert.equal(r.physicalEnd._id, 'd2');
});

test('pickBestDoorEndpointOrFallback falls back to logical end when no door path works', async () => {
  const logicalEnd = { _id: 'room', x: 0, y: 0, kind: 'point' };
  const doorA = { _id: 'd1', x: 1, y: 1, kind: 'door' };
  const fromLoc = { _id: 'start', x: 10, y: 10, kind: 'point' };

  const runDetailedForPair = async (_from, to) => {
    if (to._id === 'd1') return { path: [] };
    if (to._id === 'room') return { path: [{ x: 5, y: 5 }] };
    return { path: [] };
  };

  const r = await pickBestDoorEndpointOrFallback(fromLoc, logicalEnd, [doorA], runDetailedForPair);
  assert.equal(r.doorUsed, null);
  assert.equal(r.physicalEnd._id, 'room');
  assert.equal(r.detailed.path.length, 1);
});

test('pickBestDoorEndpointOrFallback skips doors when list empty', async () => {
  const logicalEnd = { _id: 'room', x: 0, y: 0, kind: 'point' };
  const fromLoc = { _id: 'start', x: 10, y: 10, kind: 'point' };
  let calledWith = null;
  const runDetailedForPair = async (_from, to) => {
    calledWith = to._id;
    return { path: [{ x: 1, y: 1 }] };
  };

  const r = await pickBestDoorEndpointOrFallback(fromLoc, logicalEnd, [], runDetailedForPair);
  assert.equal(calledWith, 'room');
  assert.equal(r.doorUsed, null);
});

test('pickBestRouteWithOptionalDoors prefers start and end doors when hop count matches', async () => {
  const roomA = { _id: 'ra', x: 0, y: 0, kind: 'point' };
  const roomB = { _id: 'rb', x: 100, y: 100, kind: 'point' };
  const sd = { _id: 'sd', x: 1, y: 1, kind: 'door' };
  const ed = { _id: 'ed', x: 99, y: 99, kind: 'door' };

  const runDetailedForPair = async (from, to) => {
    if (from._id === 'ra' && to._id === 'rb') {
      return { path: [{ x: 0, y: 0 }, { x: 100, y: 100 }], routingGraph: 'corridor' };
    }
    if (from._id === 'sd' && to._id === 'ed') {
      return { path: [{ x: 1, y: 1 }, { x: 99, y: 99 }], routingGraph: 'corridor' };
    }
    return { path: [] };
  };

  const r = await pickBestRouteWithOptionalDoors(roomA, roomB, [sd], [ed], runDetailedForPair);
  assert.equal(r.startDoorUsed._id, 'sd');
  assert.equal(r.endDoorUsed._id, 'ed');
  assert.equal(r.physicalStart._id, 'sd');
  assert.equal(r.physicalEnd._id, 'ed');
});

test('pickBestRouteWithOptionalDoors earlyExitOnFirstSuccess returns first viable path in iteration order', async () => {
  const roomA = { _id: 'ra', x: 0, y: 0, kind: 'point' };
  const roomB = { _id: 'rb', x: 100, y: 100, kind: 'point' };
  const ed1 = { _id: 'e1', x: 1, y: 1, kind: 'door' };
  const ed2 = { _id: 'e2', x: 2, y: 2, kind: 'door' };

  const runDetailedForPair = async (_from, to) => {
    if (to._id === 'rb') return { path: [] };
    if (to._id === 'e1') return { path: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], routingGraph: 'corridor' };
    if (to._id === 'e2') return { path: [{ x: 1, y: 1 }, { x: 2, y: 2 }], routingGraph: 'corridor' };
    return { path: [] };
  };

  const r = await pickBestRouteWithOptionalDoors(roomA, roomB, [], [ed1, ed2], runDetailedForPair, {
    earlyExitOnFirstSuccess: true
  });
  assert.equal(r.endDoorUsed._id, 'e1');
  assert.equal(r.physicalEnd._id, 'e1');
});

test('pickBestRouteWithOptionalDoors omitDirectFromTo skips we→room and tries doors first', async () => {
  const roomB = { _id: 'rb', x: 100, y: 100, kind: 'point' };
  const we = { _id: 'we', x: 5, y: 5, kind: 'point' };
  const ed = { _id: 'ed', x: 99, y: 99, kind: 'door' };
  const pairs = [];
  const runDetailedForPair = async (from, to) => {
    pairs.push([from._id, to._id].join('→'));
    if (from._id === 'we' && to._id === 'rb') return { path: [] };
    if (from._id === 'we' && to._id === 'ed') {
      return { path: [{ x: 5, y: 5 }, { x: 99, y: 99 }], routingGraph: 'corridor' };
    }
    return { path: [] };
  };

  const r = await pickBestRouteWithOptionalDoors(we, roomB, [], [ed], runDetailedForPair, {
    earlyExitOnFirstSuccess: true,
    omitDirectFromTo: true
  });
  assert.equal(r.endDoorUsed._id, 'ed');
  assert.ok(!pairs.some((p) => p === 'we→rb'), 'direct leg should not be in pickBest when omitted');
  assert.ok(pairs.some((p) => p === 'we→ed'));
});
