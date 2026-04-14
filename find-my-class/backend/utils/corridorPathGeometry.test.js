import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areCorridorPolylineNeighbors,
  buildFlatSegmentsFromCorridors,
  maxDeviationAlongEdgeToSegments,
  pathIdsStayNearSavedCorridorSegments
} from './corridorPathGeometry.js';

test('areCorridorPolylineNeighbors: same chain adjacent indices only', () => {
  assert.equal(areCorridorPolylineNeighbors('cor:abc:0', 'cor:abc:1'), true);
  assert.equal(areCorridorPolylineNeighbors('cor:abc:0', 'cor:abc:2'), false);
  assert.equal(areCorridorPolylineNeighbors('cor:abc:0', 'cor:def:1'), false);
});

test('maxDeviationAlongEdgeToSegments: on-segment edge is tight', () => {
  const segs = [{ ax: 0, ay: 0, bx: 100, by: 0 }];
  const d = maxDeviationAlongEdgeToSegments(0, 0, 50, 0, segs, 5);
  assert.ok(d < 0.001);
});

test('maxDeviationAlongEdgeToSegments: diagonal across rectangle is far from perimeter', () => {
  const corridors = [
    {
      _id: 'r',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ]
    }
  ];
  const flat = buildFlatSegmentsFromCorridors(corridors);
  const d = maxDeviationAlongEdgeToSegments(0, 0, 100, 50, flat, 9);
  assert.ok(d > 15, `expected large deviation, got ${d}`);
});

test('pathIdsStayNearSavedCorridorSegments: rejects straight chord through block', () => {
  const corridors = [
    {
      _id: 'r',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ]
    }
  ];
  const flat = buildFlatSegmentsFromCorridors(corridors);
  const nodeMap = new Map([
    ['cor:r:0', { x: 0, y: 0 }],
    ['cor:r:2', { x: 100, y: 50 }]
  ]);
  assert.equal(
    pathIdsStayNearSavedCorridorSegments(['cor:r:0', 'cor:r:2'], nodeMap, flat, 6),
    false
  );
});

test('pathIdsStayNearSavedCorridorSegments: accepts walk along perimeter', () => {
  const corridors = [
    {
      _id: 'r',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ]
    }
  ];
  const flat = buildFlatSegmentsFromCorridors(corridors);
  const nodeMap = new Map([
    ['cor:r:0', { x: 0, y: 0 }],
    ['cor:r:1', { x: 100, y: 0 }],
    ['cor:r:2', { x: 100, y: 50 }]
  ]);
  assert.equal(
    pathIdsStayNearSavedCorridorSegments(
      ['cor:r:0', 'cor:r:1', 'cor:r:2'],
      nodeMap,
      flat,
      6
    ),
    true
  );
});
