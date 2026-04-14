import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closestPointOnSegment,
  buildCorridorWalkGraph,
  attachPointToCorridorGraph
} from './corridorWalkGraph.js';
import { aStarShortestPath } from '../utils/aStarPathfinding.js';

test('closestPointOnSegment: midpoint of horizontal segment', () => {
  const p = closestPointOnSegment(5, 1, 0, 0, 10, 0);
  assert.equal(p.x, 5);
  assert.equal(p.y, 0);
});

test('closestPointOnSegment: clamps to segment ends', () => {
  const p = closestPointOnSegment(-5, 0, 0, 0, 10, 0);
  assert.equal(p.x, 0);
  assert.equal(p.y, 0);
});

test('buildCorridorWalkGraph: polyline edges only along vertices', () => {
  const corridors = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'Main',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]
    }
  ];
  const { nodeMap, adjacencyMap, segments } = buildCorridorWalkGraph(corridors);
  assert.equal(segments.length, 2);
  const id0 = 'cor:507f1f77bcf86cd799439011:0';
  const id1 = 'cor:507f1f77bcf86cd799439011:1';
  const id2 = 'cor:507f1f77bcf86cd799439011:2';
  assert.ok(nodeMap.has(id0));
  const n1 = adjacencyMap.get(id1) || [];
  const neighbors = n1.map((e) => e.to).sort();
  assert.deepEqual(neighbors, [id0, id2].sort());
});

test('attachPointToCorridorGraph + A* stays on corridor polyline', () => {
  const corridors = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'East-West',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 50 },
        { x: 100, y: 50 }
      ]
    },
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'North-South',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 100, y: 50 },
        { x: 100, y: 150 }
      ]
    }
  ];
  const { nodeMap, adjacencyMap, nodeDetailsById, segments } =
    buildCorridorWalkGraph(corridors);
  const s = attachPointToCorridorGraph(
    nodeMap,
    adjacencyMap,
    segments,
    { x: 10, y: 60 },
    'start',
    nodeDetailsById
  );
  const e = attachPointToCorridorGraph(
    nodeMap,
    adjacencyMap,
    segments,
    { x: 100, y: 140 },
    'end',
    nodeDetailsById
  );
  assert.ok(s && e);
  const pathIds = aStarShortestPath(adjacencyMap, nodeMap, s, e);
  assert.ok(pathIds && pathIds.length >= 2);
  for (const id of pathIds) {
    const c = nodeMap.get(id);
    assert.ok(c);
    if (!id.startsWith('__snap_')) {
      assert.ok(c.x >= 0 && c.x <= 100);
      if (Math.abs(c.x - 100) > 1) assert.ok(Math.abs(c.y - 50) < 2);
    }
  }
});

test('same-chain: no coincident diagonal chord across rectangle interior', () => {
  const corridors = [
    {
      _id: 'sq',
      name: 'Loop',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    }
  ];
  const { adjacencyMap, nodeMap } = buildCorridorWalkGraph(corridors, {
    mergeCoincidentMax: 4,
    crossCorridorEndpointMergeMax: 10
  });
  const id0 = 'cor:sq:0';
  const id2 = 'cor:sq:2';
  const nbr0 = adjacencyMap.get(id0) || [];
  assert.ok(
    !nbr0.some((e) => e.to === id2),
    'opposite corners within mergeMax must not short-circuit across the block'
  );
  const pathIds = aStarShortestPath(adjacencyMap, nodeMap, id0, id2);
  assert.ok(pathIds && pathIds.length >= 3, 'must walk along perimeter');
});

test('cross-corridor: no shortcut edge from endpoint to internal vertex on other chain', () => {
  const corridors = [
    {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Main',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ]
    },
    {
      _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      name: 'Branch',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 50, y: 8 },
        { x: 50, y: 80 }
      ]
    }
  ];
  const { adjacencyMap } = buildCorridorWalkGraph(corridors, {
    mergeCoincidentMax: 4,
    crossCorridorEndpointMergeMax: 10
  });
  const branchTop = 'cor:bbbbbbbbbbbbbbbbbbbbbbbb:0';
  const mainMid = 'cor:aaaaaaaaaaaaaaaaaaaaaaaa:1';
  const nbr = adjacencyMap.get(branchTop) || [];
  assert.ok(
    !nbr.some((e) => e.to === mainMid),
    'endpoint of branch must not link to internal vertex on main (would chord through space)'
  );
});

test('cross-corridor endpoint merge links T-junction within gap', () => {
  const corridors = [
    {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Main',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ]
    },
    {
      _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      name: 'Branch',
      mapId: 'ground',
      floor: 0,
      building: '507f1f77bcf86cd799439012',
      corridorPoints: [
        { x: 50, y: 3 },
        { x: 50, y: 80 }
      ]
    }
  ];
  const { adjacencyMap, nodeMap } = buildCorridorWalkGraph(corridors);
  const branchTop = 'cor:bbbbbbbbbbbbbbbbbbbbbbbb:0';
  const mainMid = 'cor:aaaaaaaaaaaaaaaaaaaaaaaa:1';
  const nbr = adjacencyMap.get(branchTop) || [];
  assert.ok(
    nbr.some((e) => e.to === mainMid),
    'branch endpoint should merge to nearby main-chain vertex'
  );
  const pathIds = aStarShortestPath(
    adjacencyMap,
    nodeMap,
    'cor:aaaaaaaaaaaaaaaaaaaaaaaa:0',
    'cor:bbbbbbbbbbbbbbbbbbbbbbbb:1'
  );
  assert.ok(pathIds && pathIds.length >= 2);
});
