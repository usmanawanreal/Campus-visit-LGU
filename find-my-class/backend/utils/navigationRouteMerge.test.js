import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLegPoints,
  coerceCrossFloorLegMapIds,
  rawPointsToSegments,
  resolvePrimaryMapId
} from './navigationRouteMerge.js';

test('resolvePrimaryMapId picks first mapId from endpoints or path nodes', () => {
  assert.equal(
    resolvePrimaryMapId(
      { mapId: '' },
      { mapId: 'm-a' },
      { mapId: 'm-b' },
      [{ x: 1, y: 1, mapId: 'm-c' }]
    ),
    'm-a'
  );
});

test('appendLegPoints adds start, nodes, end and dedupes consecutive identical points', () => {
  const raw = [];
  const startLoc = { x: 0, y: 0, mapId: 'm1', floor: 0, building: 'b1' };
  const endLoc = { x: 10, y: 10, mapId: 'm1', floor: 0, building: 'b1' };
  appendLegPoints(raw, startLoc, endLoc, {
    path: [
      { x: 1, y: 1, mapId: 'm1', floor: 0, buildingId: 'b1' },
      { x: 5, y: 5, mapId: 'm1', floor: 0, buildingId: 'b1' }
    ],
    startAnchor: null,
    endAnchor: null
  });
  assert.equal(raw.length, 4);
  assert.equal(raw[0].x, 0);
  assert.equal(raw[3].x, 10);
});

test('appendLegPoints uses anchors when present', () => {
  const raw = [];
  const startLoc = { x: 0, y: 0, mapId: 'm1', floor: 0, building: 'b1' };
  const endLoc = { x: 99, y: 99, mapId: 'm1', floor: 0, building: 'b1' };
  appendLegPoints(raw, startLoc, endLoc, {
    path: [],
    startAnchor: { x: 0.5, y: 0.5 },
    endAnchor: { x: 9.5, y: 9.5 }
  });
  assert.equal(raw.length, 2);
  assert.equal(raw[0].x, 0.5);
  assert.equal(raw[1].x, 9.5);
});

test('rawPointsToSegments splits when mapId changes', () => {
  const raw = [
    { x: 0, y: 0, mapId: 'a', floor: 0, buildingId: 'b' },
    { x: 1, y: 0, mapId: 'a', floor: 0, buildingId: 'b' },
    { x: 0, y: 0, mapId: 'b', floor: 1, buildingId: 'b' },
    { x: 2, y: 0, mapId: 'b', floor: 1, buildingId: 'b' }
  ];
  const segs = rawPointsToSegments(raw);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].mapId, 'a');
  assert.equal(segs[0].points.length, 2);
  assert.equal(segs[1].mapId, 'b');
  assert.equal(segs[1].points.length, 2);
});

test('coerceCrossFloorLegMapIds yields two segments when both legs shared one mapId', () => {
  const raw = [
    { x: 0, y: 0, mapId: 'floor-a', floor: 2, buildingId: 'b' },
    { x: 1, y: 1, mapId: 'floor-a', floor: 2, buildingId: 'b' },
    { x: 2, y: 2, mapId: 'floor-a', floor: 2, buildingId: 'b' },
    { x: 3, y: 3, mapId: 'floor-a', floor: 3, buildingId: 'b' }
  ];
  coerceCrossFloorLegMapIds(raw, 2, 'floor-a', 'floor-b');
  const segs = rawPointsToSegments(raw);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].mapId, 'floor-a');
  assert.equal(segs[1].mapId, 'floor-b');
});

test('appendLegPoints prepends start door and appends end door when snaps differ from pins', () => {
  const raw = [];
  const room = { x: 50, y: 50, mapId: 'm1', floor: 0, building: 'b1', kind: 'point' };
  const doorStart = { x: 12, y: 20, mapId: 'm1', floor: 0, building: 'b1', kind: 'door' };
  const doorEnd = { x: 88, y: 20, mapId: 'm1', floor: 0, building: 'b1', kind: 'door' };
  appendLegPoints(
    raw,
    room,
    doorEnd,
    {
      path: [
        { x: 15, y: 22, mapId: 'm1', floor: 0, buildingId: 'b1' },
        { x: 85, y: 22, mapId: 'm1', floor: 0, buildingId: 'b1' }
      ],
      startAnchor: { x: 15, y: 22 },
      endAnchor: { x: 85, y: 22 }
    },
    doorStart
  );
  assert.equal(raw[0].x, 12);
  assert.equal(raw[0].y, 20);
  assert.equal(raw[raw.length - 1].x, 88);
  assert.equal(raw[raw.length - 1].y, 20);
});

test('appendLegPoints second leg skips duplicate joint point on same map', () => {
  const raw = [];
  const a = { x: 0, y: 0, mapId: 'm1', floor: 0, building: 'b1' };
  const mid = { x: 5, y: 5, mapId: 'm1', floor: 0, building: 'b1' };
  const b = { x: 8, y: 8, mapId: 'm1', floor: 0, building: 'b1' };
  appendLegPoints(raw, a, mid, {
    path: [{ x: 3, y: 3, mapId: 'm1', floor: 0, buildingId: 'b1' }],
    startAnchor: null,
    endAnchor: null
  });
  appendLegPoints(raw, mid, b, {
    path: [{ x: 6, y: 6, mapId: 'm1', floor: 0, buildingId: 'b1' }],
    startAnchor: null,
    endAnchor: null
  });
  const atMid = raw.filter((p) => p.x === 5 && p.y === 5);
  assert.equal(atMid.length, 1);
});
