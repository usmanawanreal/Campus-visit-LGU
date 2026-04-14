import api from './api.js';

/**
 * Get shortest path between two locations (location IDs).
 * Returns { path: [{ x, y }, ...], segments: [{ mapId, points: [{x,y}] }] }.
 */
export const getRoute = (startLocationId, endLocationId, options = {}) => {
  const params = { start: startLocationId, end: endLocationId };
  if (options.mapId) params.mapId = options.mapId;
  return api.get('/navigation/route', { params });
};

/** Corridor graph check for the active floor plan (same connectivity rules as routing). */
export const getCorridorHealth = (mapId) =>
  api.get('/navigation/corridor-health', { params: { mapId } });

/**
 * Calls GET /api/navigation/route (A* shortest path on the server graph) and returns
 * normalized [{ x, y }, ...] node coordinates between the two locations.
 */
export const getRouteCoordinates = async (startLocationId, endLocationId, options = {}) => {
  const { data } = await getRoute(startLocationId, endLocationId, options);
  const path = Array.isArray(data?.path) ? data.path : [];
  return path
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
};

export const getRouteWithSegments = async (startLocationId, endLocationId, options = {}) => {
  const { data } = await getRoute(startLocationId, endLocationId, options);
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  const normalizedSegments = segments
    .map((segment) => {
      const points = Array.isArray(segment?.points) ? segment.points : [];
      const normalizedPoints = points
        .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      return {
        mapId: String(segment?.mapId || ''),
        floor: segment?.floor ?? null,
        buildingId: segment?.buildingId ?? null,
        points: normalizedPoints
      };
    })
    .filter((segment) => segment.mapId && segment.points.length >= 2);

  return {
    path: Array.isArray(data?.path) ? data.path : [],
    segments: normalizedSegments,
    meta: data?.meta || null
  };
};
