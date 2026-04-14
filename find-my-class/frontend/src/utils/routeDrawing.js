/**
 * Utilities for turning A* path coordinates into Leaflet polyline points.
 */

function dedupeConsecutive(points) {
  return points.filter(
    (p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y
  );
}

/**
 * Build a polyline that runs from the start POI through the graph path to the destination POI.
 * @param {Array<{ x: number, y: number }>} graphPath - Backend A* path (≥2 points)
 * @param {{ x?: number, y?: number } | null} startLocation
 * @param {{ x?: number, y?: number } | null} endLocation
 * @returns {Array<{ x: number, y: number }>}
 */
export function buildRoutePolylinePoints(graphPath, startLocation, endLocation) {
  if (!Array.isArray(graphPath) || graphPath.length < 2) return [];

  const pts = [];

  if (
    startLocation &&
    Number.isFinite(Number(startLocation.x)) &&
    Number.isFinite(Number(startLocation.y))
  ) {
    pts.push({ x: Number(startLocation.x), y: Number(startLocation.y) });
  }

  for (const p of graphPath) {
    if (Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
      pts.push({ x: Number(p.x), y: Number(p.y) });
    }
  }

  if (
    endLocation &&
    Number.isFinite(Number(endLocation.x)) &&
    Number.isFinite(Number(endLocation.y))
  ) {
    pts.push({ x: Number(endLocation.x), y: Number(endLocation.y) });
  }

  return dedupeConsecutive(pts);
}

/**
 * Stable key so React-Leaflet replaces the Polyline when the path changes.
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string}
 */
export function routePathSignature(points) {
  if (!points?.length) return '';
  return points.map((p) => `${p.x},${p.y}`).join('|');
}
