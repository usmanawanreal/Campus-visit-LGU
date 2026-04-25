import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crossFloorWaypointNamePenalty,
  crossFloorWaypointPairPenalty,
  looksLikeStairsName,
  looksLikeVerticalTransitionName,
  rankCrossFloorWaypointCandidates
} from './crossFloorWaypointPenalty.js';

assert.equal(crossFloorWaypointNamePenalty('Main stairs'), 0);
assert.equal(crossFloorWaypointNamePenalty('Stairway B'), 0);
assert.equal(crossFloorWaypointNamePenalty('Elevator lobby'), 22);
assert.equal(crossFloorWaypointNamePenalty('Lobby connector'), 55);

assert.ok(looksLikeStairsName('Stairs — ground'));
assert.ok(!looksLikeStairsName('Hallway A'));

const stairPair = crossFloorWaypointPairPenalty('Stairs ground', 'Stairs floor 1');
const mixedPair = crossFloorWaypointPairPenalty('Classroom 101', 'Random hall');
assert.ok(stairPair < mixedPair);

test('looksLikeVerticalTransitionName: stairs and elevator', () => {
  assert.ok(looksLikeVerticalTransitionName('Main stairs NB'));
  assert.ok(looksLikeVerticalTransitionName('Elevator lobby'));
  assert.ok(!looksLikeVerticalTransitionName('Office sport'));
});

test('rankCrossFloorWaypointCandidates prefers stairs then proximity', () => {
  const anchor = { x: 0, y: 0 };
  const ranked = rankCrossFloorWaypointCandidates(
    [
      { name: 'Office A', x: 5, y: 0 },
      { name: 'Main stairs', x: 900, y: 900 },
      { name: 'Kitchen', x: 1, y: 0 }
    ],
    anchor,
    2
  );
  assert.equal(ranked.length, 2);
  assert.match(ranked[0].name, /stairs/i);
});
