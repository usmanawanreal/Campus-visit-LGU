/**
 * Build a walkable graph only along saved corridor polylines (NavigationLocation kind=corridor).
 * Used so routes follow marked corridors instead of cutting across open areas via sparse graph edges.
 */

function euclidean(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Vertices this close (any pair) merge — corners / T-junctions nudged onto the same click. */
const DEFAULT_COINCIDENT_MERGE = 4;
/**
 * Cross-corridor only: **both** vertices must be polyline endpoints (different chains). Otherwise
 * an endpoint could link to an internal vertex on another chain within this radius and A* would
 * pick that chord through rooms instead of walking the orange perimeter. T-junctions should use
 * coincident merge (≤ mergeCoincidentMax) so the branch endpoint sits on/near the main polyline.
 */
const DEFAULT_CROSS_CORRIDOR_ENDPOINT_MERGE = 10;
/**
 * Per chain-pair closest vertex link: connects the two nearest vertices across different corridors
 * even if neither is an endpoint. Handles closed-loop corridors whose endpoints are far apart
 * but whose walkable paths pass close to each other.
 */
const DEFAULT_CROSS_CORRIDOR_NEAREST_PAIR = 25;

/**
 * Closest point on segment AB to P. Returns { x, y }.
 */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return { x: ax, y: ay };
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * abx, y: ay + t * aby };
}

function addUndirectedEdge(adjacency, a, b, dist) {
  if (!adjacency.has(a)) adjacency.set(a, []);
  if (!adjacency.has(b)) adjacency.set(b, []);
  const la = adjacency.get(a);
  const lb = adjacency.get(b);
  if (!la.some((e) => e.to === b)) la.push({ to: b, distance: dist });
  if (!lb.some((e) => e.to === a)) lb.push({ to: a, distance: dist });
}

/**
 * @param {Array<object>} corridors - lean NavigationLocation docs with kind corridor
 * @param {{ mergeCoincidentMax?: number, crossCorridorEndpointMergeMax?: number }} [opts]
 * @returns {{
 *   nodeMap: Map<string, { x: number, y: number }>,
 *   adjacencyMap: Map<string, Array<{ to: string, distance: number }>>,
 *   nodeDetailsById: Map<string, object>,
 *   segments: Array<{ a: string, b: string }>
 * }}
 */
function corridorChainIdFromNodeId(nodeId) {
  const m = /^cor:([^:]+):/.exec(String(nodeId));
  return m ? m[1] : null;
}

/** cor:<mongoId>:<vertexIndex> */
function parseCorridorVertexIndex(nodeId) {
  const m = /^cor:[^:]+:(\d+)$/.exec(String(nodeId));
  return m ? Number(m[1]) : null;
}

/**
 * Coincident merge on the **same** polyline must not link non-consecutive vertices, or rectangles
 * in tight map coords get a diagonal edge &lt; mergeMax and A* cuts through the room block.
 * Allow: adjacent indices, or both ends (0 and n−1) only when the gap is tiny (closing the loop).
 */
const SAME_CHAIN_CLOSING_GAP_MAX = 3;

function sameChainCoincidentAllowed(uId, vId, vertexCount, euclideanD) {
  const iu = parseCorridorVertexIndex(uId);
  const iv = parseCorridorVertexIndex(vId);
  if (iu == null || iv == null || vertexCount < 2) return false;
  const diff = Math.abs(iu - iv);
  if (diff === 1) return true;
  const bothEnds =
    (iu === 0 || iu === vertexCount - 1) && (iv === 0 || iv === vertexCount - 1);
  if (!bothEnds) return false;
  return Number(euclideanD) <= SAME_CHAIN_CLOSING_GAP_MAX;
}

export function buildCorridorWalkGraph(corridors, opts = {}) {
  const mergeMax = opts.mergeCoincidentMax ?? DEFAULT_COINCIDENT_MERGE;
  const crossMerge =
    opts.crossCorridorEndpointMergeMax ?? DEFAULT_CROSS_CORRIDOR_ENDPOINT_MERGE;
  const nodeMap = new Map();
  const adjacencyMap = new Map();
  const nodeDetailsById = new Map();
  const segments = [];
  const vertexMeta = [];
  const endpointIds = new Set();
  /** Mongo corridor _id → number of valid vertices in that polyline */
  const chainVertexCount = new Map();

  for (const cor of corridors) {
    const pts = Array.isArray(cor.corridorPoints) ? cor.corridorPoints : [];
    if (pts.length < 2) continue;
    const cid = String(cor._id);
    chainVertexCount.set(cid, pts.length);
    const lastIdx = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      const id = `cor:${cid}:${i}`;
      const x = Number(pts[i].x);
      const y = Number(pts[i].y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      nodeMap.set(id, { x, y });
      nodeDetailsById.set(id, {
        id,
        name: `Corridor: ${cor.name || 'unnamed'}`,
        x,
        y,
        mapId: cor.mapId,
        floor: cor.floor,
        buildingId: cor.building ? String(cor.building) : null
      });
      vertexMeta.push({ id, x, y });
      if (i === 0 || i === lastIdx) {
        endpointIds.add(id);
      }
      if (i > 0) {
        const prev = `cor:${cid}:${i - 1}`;
        const d = euclidean(nodeMap.get(prev), { x, y });
        addUndirectedEdge(adjacencyMap, prev, id, d);
        segments.push({ a: prev, b: id });
      }
    }
  }

  const nearestCrossPairMax =
    opts.crossCorridorNearestPairMax ?? DEFAULT_CROSS_CORRIDOR_NEAREST_PAIR;
  const closestPairPerChain = new Map();

  for (let i = 0; i < vertexMeta.length; i++) {
    for (let j = i + 1; j < vertexMeta.length; j++) {
      const u = vertexMeta[i];
      const v = vertexMeta[j];
      if (u.id === v.id) continue;
      const d = euclidean(u, v);
      const cu = corridorChainIdFromNodeId(u.id);
      const cv = corridorChainIdFromNodeId(v.id);
      const crossCorridor = cu && cv && cu !== cv;
      const w = d > 0 ? d : 1e-6;

      if (d <= mergeMax) {
        if (cu && cv && cu === cv) {
          const n = chainVertexCount.get(cu) ?? 0;
          if (!sameChainCoincidentAllowed(u.id, v.id, n, d)) {
            continue;
          }
        }
        addUndirectedEdge(adjacencyMap, u.id, v.id, w);
        continue;
      }

      if (
        crossCorridor &&
        d <= crossMerge &&
        endpointIds.has(u.id) &&
        endpointIds.has(v.id)
      ) {
        addUndirectedEdge(adjacencyMap, u.id, v.id, w);
      }

      if (crossCorridor && d <= nearestCrossPairMax) {
        const pairKey = cu < cv ? `${cu}|${cv}` : `${cv}|${cu}`;
        const prev = closestPairPerChain.get(pairKey);
        if (!prev || d < prev.d) {
          closestPairPerChain.set(pairKey, { uId: u.id, vId: v.id, d, w });
        }
      }
    }
  }

  for (const { uId, vId, w } of closestPairPerChain.values()) {
    addUndirectedEdge(adjacencyMap, uId, vId, w);
  }

  return { nodeMap, adjacencyMap, nodeDetailsById, segments };
}

/**
 * Rank corridor segments by distance from `point` to its orthogonal projection on the segment.
 * @returns {Array<{ a: string, b: string, proj: {x:number,y:number}, dist: number }>}
 */
export function rankCorridorSegmentSnaps(segments, nodeMap, point, maxRank = 8) {
  const px = Number(point.x);
  const py = Number(point.y);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !segments?.length) return [];

  const scored = [];
  const seen = new Set();
  for (const { a, b } of segments) {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const A = nodeMap.get(a);
    const B = nodeMap.get(b);
    if (!A || !B) continue;
    const proj = closestPointOnSegment(px, py, A.x, A.y, B.x, B.y);
    const dist = euclidean({ x: px, y: py }, proj);
    scored.push({ a, b, proj, dist });
  }
  scored.sort((x, y) => x.dist - y.dist);
  const k = Math.max(1, Math.min(maxRank, scored.length));
  return scored.slice(0, k);
}

/**
 * Add a snap node on a specific segment at `proj` (must lie on segment a–b).
 * @returns {string} snap node id
 */
export function attachSnapOnCorridorSegment(
  nodeMap,
  adjacencyMap,
  nodeDetailsById,
  snapId,
  endpointA,
  endpointB,
  proj,
  labelStart
) {
  const bestProj = proj;
  nodeMap.set(snapId, { x: bestProj.x, y: bestProj.y });
  nodeDetailsById.set(snapId, {
    id: snapId,
    name: labelStart ? 'Route (from start)' : 'Route (to destination)',
    x: bestProj.x,
    y: bestProj.y,
    mapId: nodeDetailsById.get(endpointA)?.mapId ?? null,
    floor: nodeDetailsById.get(endpointA)?.floor ?? null,
    buildingId: nodeDetailsById.get(endpointA)?.buildingId ?? null
  });

  if (!adjacencyMap.has(snapId)) adjacencyMap.set(snapId, []);
  const dA = euclidean(bestProj, nodeMap.get(endpointA));
  const dB = euclidean(bestProj, nodeMap.get(endpointB));
  addUndirectedEdge(adjacencyMap, snapId, endpointA, dA);
  addUndirectedEdge(adjacencyMap, snapId, endpointB, dB);

  return snapId;
}

/**
 * Add a temporary snap node on the closest corridor segment; connect along the segment only.
 * @returns {string|null} new node id
 */
export function attachPointToCorridorGraph(
  nodeMap,
  adjacencyMap,
  segments,
  point,
  token,
  nodeDetailsById
) {
  const ranked = rankCorridorSegmentSnaps(segments, nodeMap, point, 1);
  if (!ranked.length) return null;
  const { a, b, proj } = ranked[0];
  const id = `__snap_${token}__`;
  return attachSnapOnCorridorSegment(
    nodeMap,
    adjacencyMap,
    nodeDetailsById,
    id,
    a,
    b,
    proj,
    token === 'start'
  );
}
