import { validateBody, validateIdParam, validateQuery } from './validate.js';

export const validateBuildingCreate = validateBody([
  { key: 'name', required: true, type: 'string' },
  { key: 'description', type: 'string' },
  { key: 'floors', required: true, type: 'number', min: 1 }
]);

export const validateBuildingId = validateIdParam('id');

export const validateClassroomCreate = validateBody([
  { key: 'roomNumber', required: true, type: 'string' },
  { key: 'buildingId', required: true, mongoId: true },
  { key: 'floor', required: true, type: 'number', min: 0 }
]);

export const validateClassroomId = validateIdParam('id');

export const validateRouteCreate = validateBody([
  { key: 'startLocation', required: true, mongoId: true },
  { key: 'endLocation', required: true, mongoId: true }
]);

export const validateAuthRegister = validateBody([
  { key: 'name', required: true, type: 'string' },
  { key: 'email', required: true, type: 'email' },
  { key: 'password', required: true, type: 'string' }
]);

export const validateAuthLogin = validateBody([
  { key: 'email', required: true, type: 'string' },
  { key: 'password', required: true, type: 'string' }
]);

export const validateNodeCreate = validateBody([
  { key: 'name', required: true, type: 'string' },
  { key: 'buildingId', required: true, mongoId: true },
  { key: 'mapId', required: true, type: 'string' },
  { key: 'floor', required: true, type: 'number', min: -2 },
  { key: 'x', required: true, type: 'number' },
  { key: 'y', required: true, type: 'number' },
  { key: 'type', required: true, type: 'string' }
]);

export const validateNodeId = validateIdParam('id');

export const validateEdgeCreate = validateBody([
  { key: 'fromNode', required: true, mongoId: true },
  { key: 'toNode', required: true, mongoId: true },
  { key: 'distance', required: true, type: 'number', min: 0 }
]);

export const validateLocationCreate = validateBody([
  { key: 'name', required: true, type: 'string' },
  { key: 'buildingId', required: true, mongoId: true },
  { key: 'floor', required: true, type: 'number', min: 0 },
  { key: 'nodeId', required: true, mongoId: true },
  { key: 'type', required: true, type: 'string' }
]);

export const validateNavigationRouteQuery = validateQuery([
  { key: 'start', required: true, mongoId: true },
  { key: 'end', required: true, mongoId: true },
  /** Optional: floor-plan id (e.g. floor-third) when room rows have wrong/missing mapId — must match saved corridors. */
  { key: 'mapId', type: 'string' }
]);

export const validateCorridorHealthQuery = validateQuery([
  { key: 'mapId', required: true, type: 'string' }
]);

/** Optional building filter when auditing stair reachability across all floor plans. */
export const validateStairsReachabilityQuery = validateQuery([
  { key: 'buildingId', mongoId: true }
]);

/** Optional building filter — same as stairs audit — for cross-floor connectivity across floor images. */
export const validateCrossFloorConnectivityQuery = validateQuery([
  { key: 'buildingId', mongoId: true }
]);

export const validateNavigationLocationQuery = validateQuery([
  { key: 'mapId', type: 'string' },
  { key: 'building', mongoId: true },
  { key: 'floor', type: 'number', min: -2 }
]);

export const validateNavigationLocationCreate = validateBody([
  { key: 'name', required: true, type: 'string' },
  { key: 'building', required: true, mongoId: true },
  { key: 'floor', required: true, type: 'number', min: -2 },
  { key: 'mapId', required: true, type: 'string' },
  { key: 'x', required: true, type: 'number' },
  { key: 'y', required: true, type: 'number' }
]);

export const validateEdgeId = validateIdParam('id');
export const validateLocationId = validateIdParam('id');
