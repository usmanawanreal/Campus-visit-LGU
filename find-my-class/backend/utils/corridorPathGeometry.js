/**
 * Reject A* paths that use graph shortcuts whose straight segments leave the drawn hallway centerlines.
 */

import { closestPointOnSegment } from '../services/corridorWalkGraph.js';

function euclidean(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Same polyline chain, consecutive vertex indices (walks only along saved segments). */
export function areCorridorPolylineNeighbors(nodeIdA, nodeIdB) {
  const m1 = /^cor:([^:]+):(\d+)$/.exec(String(nodeIdA));
  const m2 = /^cor:([^:]+):(\d+)$/.exec(String(nodeIdB));
  if (!m1 || !m2 || m1[1] !== m2[1]) return false;
  return Math.abs(Number(m1[2]) - Number(m2[2])) === 1;
}

export function buildFlatSegmentsFromCorridors(corridors) {
  const out = [];
  if (!Array.isArray(corridors)) return out;
  for (const cor of corridors) {
    const pts = Array.isArray(cor.corridorPoints) ? cor.corridorPoints : [];
    for (let i = 1; i < pts.length; i++) {
      const ax = Number(pts[i - 1].x);
      const ay = Number(pts[i - 1].y);
      const bx = Number(pts[i].x);
      const by = Number(pts[i].y);
      if ([ax, ay, bx, by].every(Number.isFinite)) {
        out.push({ ax, ay, bx, by });
      }
    }
  }
  return out;
}

/**
 * Furthest distance from any sample point on AB to the nearest saved corridor segment.
 */
export function maxDeviationAlongEdgeToSegments(ax, ay, bx, by, flatSegments, steps = 7) {
  if (!flatSegments?.length) return Infinity;
  const n = Math.max(2, steps);
  let worst = 0;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const px = ax + t * (bx - ax);
    const py = ay + t * (by - ay);
    let best = Infinity;
    for (const s of flatSegments) {
      const proj = closestPointOnSegment(px, py, s.ax, s.ay, s.bx, s.by);
      const d = euclidean({ x: px, y: py }, proj);
      if (d < best) best = d;
    }
    if (best > worst) worst = best;
  }
  return worst;
}

/**
 * Every path edge must either be a consecutive polyline step or stay within maxDev of some saved segment
 * (so chords through room interiors fail).
 */
function isCorridorSnapNodeId(id) {
  return /^__snap_/.test(String(id));
}

export function pathIdsStayNearSavedCorridorSegments(
  pathIds,
  nodeMap,
  flatSegments,
  maxDev = 6,
  samplesPerEdge = 7
) {
  if (!Array.isArray(pathIds) || pathIds.length < 2 || !flatSegments?.length) return false;
  for (let i = 0; i < pathIds.length - 1; i++) {
    const ua = pathIds[i];
    const ub = pathIds[i + 1];
    if (areCorridorPolylineNeighbors(ua, ub)) continue;
    if (isCorridorSnapNodeId(ua) || isCorridorSnapNodeId(ub)) continue;
    const a = nodeMap.get(ua);
    const b = nodeMap.get(ub);
    if (!a || !b) return false;
    const ax = Number(a.x);
    const ay = Number(a.y);
    const bx = Number(b.x);
    const by = Number(b.y);
    if (![ax, ay, bx, by].every(Number.isFinite)) return false;
    const dev = maxDeviationAlongEdgeToSegments(ax, ay, bx, by, flatSegments, samplesPerEdge);
    if (dev > maxDev) return false;
  }
  return true;
}
