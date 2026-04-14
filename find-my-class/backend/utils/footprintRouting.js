/**
 * Room / building footprints (polygon corners) for routing: pick boundary points nearest the
 * walkable graph and choose the shortest combined path across candidate pairs.
 */

import {
  rankCorridorSegmentSnaps,
  attachSnapOnCorridorSegment
} from '../services/corridorWalkGraph.js';
import { pathIdsStayNearSavedCorridorSegments } from './corridorPathGeometry.js';

function euclidean(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalizeFootprintPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/**
 * Vertices + edge midpoints of a closed polygon (last edge closes to first).
 */
export function footprintBoundaryCandidates(footprint, fallbackXY) {
  const fb = {
    x: Number(fallbackXY?.x),
    y: Number(fallbackXY?.y)
  };
  if (!Number.isFinite(fb.x) || !Number.isFinite(fb.y)) {
    return [];
  }
  if (!footprint || footprint.length < 3) {
    return [fb];
  }
  const c = [];
  for (let i = 0; i < footprint.length; i++) {
    const p = footprint[i];
    const j = (i + 1) % footprint.length;
    const p2 = footprint[j];
    c.push({ x: p.x, y: p.y });
    const dx = p2.x - p.x;
    const dy = p2.y - p.y;
    for (const t of [0.25, 0.5, 0.75]) {
      c.push({ x: p.x + t * dx, y: p.y + t * dy });
    }
  }
  return c;
}

export function graphPathLength(adjacencyMap, pathIds) {
  if (!pathIds || pathIds.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i];
    const b = pathIds[i + 1];
    const neighbors = adjacencyMap.get(a) || [];
    const edge = neighbors.find((n) => n.to === b);
    if (!edge) return Infinity;
    sum += Number(edge.distance);
  }
  return sum;
}

/**
 * Tries several nearest corridor segments for start/end (not only the closest projection).
 * Snapping to the single nearest segment often locks A* onto a longer branch.
 *
 * @param {Function} buildGraph - () => { nodeMap, adjacencyMap, nodeDetailsById, segments }
 * @param {Function} runAStar - (adjacencyMap, nodeMap, startId, endId) => string[]|null
 * @param {{ segmentSnapK?: number }} [options]
 */
export function bestPathOverFootprintPairs(
  buildGraph,
  runAStar,
  startCandidates,
  endCandidates,
  options = {}
) {
  const pairCount = Math.max(1, startCandidates.length * endCandidates.length);
  let segmentSnapK = options.segmentSnapK;
  if (segmentSnapK == null) {
    if (pairCount > 64) segmentSnapK = 4;
    else if (pairCount > 25) segmentSnapK = 5;
    else segmentSnapK = 7;
  }

  let best = null;
  let bestTotal = Infinity;
  let snapCounter = 0;

  for (const s of startCandidates) {
    const gRank = buildGraph();
    if (!gRank.segments.length) continue;
    const rankedS = rankCorridorSegmentSnaps(
      gRank.segments,
      gRank.nodeMap,
      s,
      segmentSnapK
    );
    if (!rankedS.length) continue;

    for (const e of endCandidates) {
      const rankedE = rankCorridorSegmentSnaps(
        gRank.segments,
        gRank.nodeMap,
        e,
        segmentSnapK
      );
      if (!rankedE.length) continue;

      for (const rs of rankedS) {
        for (const re of rankedE) {
          const { nodeMap, adjacencyMap, nodeDetailsById, segments } = buildGraph();
          if (!segments.length) continue;

          const sid = `__snap_start_${snapCounter++}__`;
          const eid = `__snap_end_${snapCounter++}__`;
          attachSnapOnCorridorSegment(
            nodeMap,
            adjacencyMap,
            nodeDetailsById,
            sid,
            rs.a,
            rs.b,
            rs.proj,
            true
          );
          attachSnapOnCorridorSegment(
            nodeMap,
            adjacencyMap,
            nodeDetailsById,
            eid,
            re.a,
            re.b,
            re.proj,
            false
          );

          const pathIds = runAStar(adjacencyMap, nodeMap, sid, eid);
          if (!pathIds?.length) continue;

          const geomSegs = options.corridorGeometrySegments;
          const geomMax = options.corridorPathMaxDeviation;
          if (Array.isArray(geomSegs) && geomSegs.length > 0 && Number.isFinite(geomMax)) {
            if (!pathIdsStayNearSavedCorridorSegments(pathIds, nodeMap, geomSegs, geomMax)) {
              continue;
            }
          }

          const snapS = nodeMap.get(sid);
          const snapE = nodeMap.get(eid);
          if (!snapS || !snapE) continue;

          const entry = euclidean(s, snapS);
          const mid = graphPathLength(adjacencyMap, pathIds);
          const exit = euclidean(e, snapE);
          if (!Number.isFinite(mid) || mid === Infinity) continue;

          const OFF_CORRIDOR_PENALTY = 5;
          const total = mid + OFF_CORRIDOR_PENALTY * (entry + exit);
          if (total < bestTotal) {
            bestTotal = total;
            best = {
              pathIds,
              nodeMap,
              nodeDetailsById,
              /** Snap points on the corridor polyline — NOT room centers (those draw through walls). */
              startAnchor: { x: snapS.x, y: snapS.y },
              endAnchor: { x: snapE.x, y: snapE.y },
              startSnapId: sid,
              endSnapId: eid
            };
          }
        }
      }
    }
  }

  if (!best) return null;

  const path = best.pathIds
    .map((id) => best.nodeDetailsById.get(String(id)))
    .filter(Boolean);

  return {
    pathIds: best.pathIds,
    path,
    startAnchor: best.startAnchor,
    endAnchor: best.endAnchor
  };
}

/**
 * Shortest path on a node graph over footprint candidate pairs (entry/exit legs + graph edges).
 */
export function bestNodePathOverFootprintPairs(
  adjacencyMap,
  nodeMap,
  nodeDetailsById,
  nearestNodeIdFn,
  runAStar,
  startCandidates,
  endCandidates
) {
  let best = null;
  let bestTotal = Infinity;

  for (const s of startCandidates) {
    for (const e of endCandidates) {
      const startStr = nearestNodeIdFn(nodeMap, s);
      const endStr = nearestNodeIdFn(nodeMap, e);
      if (!startStr || !endStr || !nodeMap.has(startStr) || !nodeMap.has(endStr)) continue;

      const pathIds = runAStar(adjacencyMap, nodeMap, startStr, endStr);
      if (!pathIds?.length) continue;

      const ns = nodeMap.get(startStr);
      const ne = nodeMap.get(endStr);
      if (!ns || !ne) continue;

      const entry = euclidean(s, ns);
      const mid = graphPathLength(adjacencyMap, pathIds);
      const exit = euclidean(e, ne);
      if (!Number.isFinite(mid) || mid === Infinity) continue;

      const total = entry + mid + exit;
      if (total < bestTotal) {
        bestTotal = total;
        best = { pathIds, startAnchor: s, endAnchor: e };
      }
    }
  }

  if (!best) return null;

  const path = best.pathIds
    .map((id) => nodeDetailsById.get(String(id)))
    .filter(Boolean);

  return {
    pathIds: best.pathIds,
    path,
    startAnchor: best.startAnchor,
    endAnchor: best.endAnchor
  };
}
