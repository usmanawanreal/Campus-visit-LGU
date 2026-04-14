import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFootprintPoints,
  footprintBoundaryCandidates,
  graphPathLength,
  bestPathOverFootprintPairs
} from './footprintRouting.js';
import { buildCorridorWalkGraph } from '../services/corridorWalkGraph.js';
import { aStarShortestPath } from './aStarPathfinding.js';

test('normalizeFootprintPoints drops invalid entries', () => {
  assert.deepEqual(
    normalizeFootprintPoints([{ x: 1, y: 2 }, { x: 'a', y: 3 }]),
    [{ x: 1, y: 2 }]
  );
});

test('footprintBoundaryCandidates: polygon samples edges (vertices + quarters)', () => {
  const fp = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 }
  ];
  const c = footprintBoundaryCandidates(fp, { x: 0, y: 0 });
  assert.ok(c.length >= 9);
  assert.ok(c.some((p) => p.x === 5 && p.y === 0));
});

test('footprintBoundaryCandidates: no polygon uses fallback only', () => {
  const c = footprintBoundaryCandidates(null, { x: 3, y: 4 });
  assert.deepEqual(c, [{ x: 3, y: 4 }]);
});

test('graphPathLength sums edge weights', () => {
  const adj = new Map();
  adj.set('a', [{ to: 'b', distance: 2 }]);
  adj.set('b', [{ to: 'a', distance: 2 }]);
  assert.equal(graphPathLength(adj, ['a', 'b']), 2);
  assert.equal(graphPathLength(adj, ['a']), 0);
});

test('bestPathOverFootprintPairs picks shorter total over candidates', () => {
  const corridors = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'Low',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]
    }
  ];
  const startCands = [
    { x: 0, y: 10 },
    { x: 0, y: 1 }
  ];
  const endCands = [{ x: 100, y: 1 }];
  const best = bestPathOverFootprintPairs(
    () => buildCorridorWalkGraph(corridors),
    (adj, nm, a, b) => aStarShortestPath(adj, nm, a, b),
    startCands,
    endCands,
    { segmentSnapK: 8 }
  );
  assert.ok(best);
  assert.equal(best.startAnchor.y, 0, 'startAnchor snaps to corridor polyline, not room center y=10');
  assert.equal(best.endAnchor.y, 0);
});
