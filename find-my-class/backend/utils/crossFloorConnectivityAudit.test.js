import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCrossFloorDisconnectedRows } from './crossFloorConnectivityAudit.js';

test('mergeCrossFloorDisconnectedRows marks reachable pins when no peer floor has stairs on graph', () => {
  const floorA = {
    mapId: 'floor-a',
    missing: [],
    reachablePins: [{ id: 'room1', name: 'Room 1', kind: 'point' }],
    stairTargetsOnGraph: 2,
    checkedCount: 1
  };
  const floorB = {
    mapId: 'floor-b',
    missing: [{ id: 'x', name: 'Bad', kind: 'point', reason: 'no_path_to_stairs' }],
    reachablePins: [],
    stairTargetsOnGraph: 0,
    checkedCount: 1
  };

  const [outA, outB] = mergeCrossFloorDisconnectedRows([floorA, floorB]);
  assert.equal(outA.crossFloorReady, false);
  assert.equal(outA.peerFloorsWithStairsOnGraph, 0);
  assert.equal(outA.disconnected.length, 1);
  assert.equal(outA.disconnected[0].reason, 'no_peer_floor_with_stairs_on_corridor');

  assert.equal(outB.crossFloorReady, false);
  assert.ok(outB.disconnected.some((d) => d.reason === 'no_path_to_stairs'));
});

test('mergeCrossFloorDisconnectedRows is satisfied when both floors have stairs on graph', () => {
  const a = {
    mapId: 'a',
    missing: [],
    reachablePins: [{ id: 'r', name: 'R', kind: 'point' }],
    stairTargetsOnGraph: 1
  };
  const b = {
    mapId: 'b',
    missing: [],
    reachablePins: [{ id: 's', name: 'S', kind: 'point' }],
    stairTargetsOnGraph: 1
  };
  const [oa, ob] = mergeCrossFloorDisconnectedRows([a, b]);
  assert.equal(oa.crossFloorReady, true);
  assert.equal(oa.peerFloorsWithStairsOnGraph, 1);
  assert.equal(oa.disconnected.length, 0);
  assert.equal(ob.crossFloorReady, true);
  assert.equal(ob.disconnected.length, 0);
});

test('mergeCrossFloorDisconnectedRows skips peer check for single floor', () => {
  const only = {
    mapId: 'only',
    missing: [],
    reachablePins: [{ id: 'r', name: 'R', kind: 'point' }],
    stairTargetsOnGraph: 1
  };
  const [o] = mergeCrossFloorDisconnectedRows([only]);
  assert.equal(o.crossFloorReady, true);
  assert.equal(o.peerFloorsWithStairsOnGraph, 0);
  assert.equal(o.disconnected.length, 0);
});
