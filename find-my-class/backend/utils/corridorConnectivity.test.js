import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeCorridorConnectivity,
  corridorComponentRepresentatives
} from './corridorConnectivity.js';

const opts = { crossCorridorEndpointMergeMax: 10, mergeCoincidentMax: 4 };

test('analyzeCorridorConnectivity: single chain is connected', () => {
  const corridors = [
    {
      _id: 'a',
      name: 'Main',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]
    }
  ];
  const r = analyzeCorridorConnectivity(corridors, opts);
  assert.equal(r.connected, true);
  assert.equal(r.componentCount, 1);
  assert.equal(r.chainCount, 1);
});

test('analyzeCorridorConnectivity: two far chains are disconnected', () => {
  const corridors = [
    {
      _id: 'a',
      name: 'East',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    },
    {
      _id: 'b',
      name: 'West',
      corridorPoints: [
        { x: 500, y: 500 },
        { x: 510, y: 500 }
      ]
    }
  ];
  const r = analyzeCorridorConnectivity(corridors, opts);
  assert.equal(r.connected, false);
  assert.ok(r.componentCount >= 2);
});

test('corridorComponentRepresentatives: one component → one anchor', () => {
  const corridors = [
    {
      _id: 'a',
      name: 'Main',
      corridorPoints: [
        { x: 10, y: 20 },
        { x: 100, y: 20 }
      ]
    }
  ];
  const reps = corridorComponentRepresentatives(corridors, opts);
  assert.equal(reps.length, 1);
  assert.ok(Number.isFinite(reps[0].x) && Number.isFinite(reps[0].y));
});

test('corridorComponentRepresentatives: two far chains → two anchors', () => {
  const corridors = [
    {
      _id: 'a',
      name: 'East',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    },
    {
      _id: 'b',
      name: 'West',
      corridorPoints: [
        { x: 500, y: 500 },
        { x: 510, y: 500 }
      ]
    }
  ];
  const reps = corridorComponentRepresentatives(corridors, opts);
  assert.equal(reps.length, 2);
});

test('analyzeCorridorConnectivity: T-junction within cross-merge links', () => {
  const corridors = [
    {
      _id: 'a',
      name: 'Main',
      corridorPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ]
    },
    {
      _id: 'b',
      name: 'Branch',
      corridorPoints: [
        { x: 50, y: 3 },
        { x: 50, y: 80 }
      ]
    }
  ];
  const r = analyzeCorridorConnectivity(corridors, opts);
  assert.equal(r.connected, true);
  assert.equal(r.componentCount, 1);
});
