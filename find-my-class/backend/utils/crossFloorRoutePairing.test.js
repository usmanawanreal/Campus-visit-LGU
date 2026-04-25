import test from 'node:test';
import assert from 'node:assert/strict';
import { searchBestCrossFloorPair } from './crossFloorRoutePairing.js';

const okPath = [{ x: 0, y: 0 }, { x: 1, y: 1 }];

test('searchBestCrossFloorPair calls start→ws only once per start waypoint (not per pair)', async () => {
  let startToWsCalls = 0;
  const ws1 = { _id: 'w1', name: 'Stairs A', x: 0, y: 0 };
  const ws2 = { _id: 'w2', name: 'Stairs B', x: 1, y: 1 };
  const we1 = { _id: 'e1', name: 'Stairs 1', x: 2, y: 2 };
  const we2 = { _id: 'e2', name: 'Stairs 2', x: 3, y: 3 };
  const end = { _id: 'end', mapId: 'm2', x: 10, y: 10 };

  const runDetailedFromStartToWs = async (ws) => {
    startToWsCalls += 1;
    if (ws._id === 'w1' || ws._id === 'w2') return { path: [...okPath] };
    return { path: [] };
  };

  const runDetailedOnEndFloor = async (from, to) => {
    if (String(to._id) === 'end') return { path: [...okPath], routingGraph: 'corridor' };
    return { path: [] };
  };

  const { best } = await searchBestCrossFloorPair({
    rankedStart: [ws1, ws2],
    rankedEnd: [we1, we2],
    endLocation: end,
    linkedDoorsEnd: [],
    runDetailedFromStartToWs,
    runDetailedOnEndFloor,
    searchAllCrossFloorPairs: true
  });

  assert.ok(best);
  assert.equal(startToWsCalls, 2, '2 start waypoints → 2 start legs, not 2×2=4');
});

test('searchBestCrossFloorPair stops outer loop on first success when searchAll is false', async () => {
  let startToWsCalls = 0;
  const ws1 = { _id: 'w1', name: 'Stairs A', x: 0, y: 0 };
  const ws2 = { _id: 'w2', name: 'Stairs B', x: 1, y: 1 };
  const we1 = { _id: 'e1', name: 'Stairs 1', x: 2, y: 2 };
  const end = { _id: 'end', mapId: 'm2', x: 10, y: 10 };

  const runDetailedFromStartToWs = async (ws) => {
    startToWsCalls += 1;
    return { path: [...okPath] };
  };

  const runDetailedOnEndFloor = async (_from, to) => {
    if (String(to._id) === 'end') return { path: [...okPath], routingGraph: 'corridor' };
    return { path: [] };
  };

  const { best } = await searchBestCrossFloorPair({
    rankedStart: [ws1, ws2],
    rankedEnd: [we1],
    endLocation: end,
    linkedDoorsEnd: [],
    runDetailedFromStartToWs,
    runDetailedOnEndFloor,
    searchAllCrossFloorPairs: false
  });

  assert.ok(best);
  assert.equal(startToWsCalls, 1);
});

test('searchBestCrossFloorPair caches destination-leg pathfinding per end waypoint across start waypoints', async () => {
  let endLegCalls = 0;
  const ws1 = { _id: 'w1', name: 'Stairs A', x: 0, y: 0 };
  const ws2 = { _id: 'w2', name: 'Stairs B', x: 1, y: 1 };
  const we1 = { _id: 'e1', name: 'Stairs 1', x: 2, y: 2 };
  const end = { _id: 'end', mapId: 'm2', x: 10, y: 10 };

  const runDetailedFromStartToWs = async () => ({ path: [...okPath] });

  const runDetailedOnEndFloor = async (_from, to) => {
    endLegCalls += 1;
    if (String(to._id) === 'end') return { path: [...okPath], routingGraph: 'corridor' };
    return { path: [] };
  };

  await searchBestCrossFloorPair({
    rankedStart: [ws1, ws2],
    rankedEnd: [we1],
    endLocation: end,
    linkedDoorsEnd: [],
    runDetailedFromStartToWs,
    runDetailedOnEndFloor,
    searchAllCrossFloorPairs: true
  });

  assert.equal(endLegCalls, 1, 'we→end direct leg computed once for the same we across two ws');
});
