import assert from 'node:assert/strict';
import test from 'node:test';
import { groundConnectorMapIdFor } from './groundConnectorMap.js';

test('groundConnectorMapIdFor maps floor-* to floor-ground', () => {
  assert.equal(groundConnectorMapIdFor('floor-first'), 'floor-ground');
  assert.equal(groundConnectorMapIdFor('floor-ground'), null);
  assert.equal(groundConnectorMapIdFor('main-campus'), null);
});
