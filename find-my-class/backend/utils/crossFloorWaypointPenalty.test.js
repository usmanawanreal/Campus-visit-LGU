import assert from 'node:assert/strict';
import {
  crossFloorWaypointNamePenalty,
  crossFloorWaypointPairPenalty,
  looksLikeStairsName
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
