import Node from '../models/Node.js';
import Edge from '../models/Edge.js';
import NavigationLocation from '../models/NavigationLocation.js';
import { RAW_ADJACENCY } from '../graph/navigationAdjacency.config.js';
import {
  buildAdjacencyFromRaw,
  mergeAdjacencyObjects
} from '../graph/buildAdjacencyFromConfig.js';
import { buildNavigationGraph } from '../utils/navigationGraph.js';
import { aStarShortestPath } from '../utils/aStarPathfinding.js';
import { buildCorridorWalkGraph } from './corridorWalkGraph.js';
import {
  normalizeFootprintPoints,
  footprintBoundaryCandidates,
  bestPathOverFootprintPairs,
  bestNodePathOverFootprintPairs
} from '../utils/footprintRouting.js';
import { buildFlatSegmentsFromCorridors } from '../utils/corridorPathGeometry.js';

function euclidean(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function nearestNodeId(nodeMap, point) {
  let bestId = null;
  let best = Infinity;
  nodeMap.forEach((coords, id) => {
    const d = euclidean(coords, point);
    if (d < best) {
      best = d;
      bestId = id;
    }
  });
  return bestId;
}

function coordinateFallback(pointOrOptions, options, which) {
  if (pointOrOptions && typeof pointOrOptions === 'object' && Number.isFinite(Number(pointOrOptions.x))) {
    return { x: Number(pointOrOptions.x), y: Number(pointOrOptions.y) };
  }
  const p = which === 'start' ? options.startPoint : options.endPoint;
  if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
    return { x: Number(p.x), y: Number(p.y) };
  }
  return null;
}

async function loadGraphData(options = {}) {
  const mapId = options.mapId != null && String(options.mapId).trim() !== '' ? String(options.mapId).trim() : null;
  const nodeFilter = mapId ? { mapId } : {};
  const [nodes, edges] = await Promise.all([
    Node.find(nodeFilter).lean(),
    Edge.find({}).lean()
  ]);

  const nodeIds = new Set(nodes.map((n) => String(n._id)));
  const edgesForGraph = edges.filter(
    (e) => nodeIds.has(String(e.fromNode)) && nodeIds.has(String(e.toNode))
  );

  const graphJson = buildNavigationGraph(nodes, edgesForGraph);
  const fileAdjacency = buildAdjacencyFromRaw(nodes, RAW_ADJACENCY);
  const mergedAdjacency = mergeAdjacencyObjects(graphJson.adjacency, fileAdjacency);
  const adjacencyMap = new Map(Object.entries(mergedAdjacency));
  const nodeMap = new Map(Object.entries(graphJson.nodes));
  const nodeDetailsById = new Map(
    nodes.map((n) => [
      String(n._id),
      {
        id: String(n._id),
        name: n.name,
        x: Number(n.x),
        y: Number(n.y),
        mapId: n.mapId,
        floor: n.floor,
        buildingId: n.buildingId ? String(n.buildingId) : null
      }
    ])
  );

  return { adjacencyMap, nodeMap, nodeDetailsById };
}

function normalizedMapId(mapId) {
  if (mapId == null) return null;
  const s = String(mapId).trim();
  return s === '' ? null : s;
}

/** Short TTL cache of lean corridor docs per mapId — routing calls loadCorridors dozens of times per request. */
const corridorLeanCache = new Map(); // mapId → { ts: number, rows: [] }
const CORRIDOR_LEAN_CACHE_TTL_MS =
  Number(process.env.CORRIDOR_LEAN_CACHE_TTL_MS) > 0
    ? Number(process.env.CORRIDOR_LEAN_CACHE_TTL_MS)
    : 45000;

/**
 * Short-TTL cache of the built corridor walk graph per mapId+floor-set.
 * Cross-floor routing fires ~16 pathfinding calls on 2 floors — all sharing
 * the same corridor polylines.  Building the O(n²) graph once instead of 16×
 * is the single largest win for cross-floor requests.
 *
 * Safe to share because bestPathOverFootprintPairs now properly attaches/
 * detaches snap nodes (never leaks state between callers).
 */
const corridorGraphCache = new Map(); // cacheKey → { ts, graph }
const CORRIDOR_GRAPH_CACHE_TTL_MS =
  Number(process.env.CORRIDOR_GRAPH_CACHE_TTL_MS) > 0
    ? Number(process.env.CORRIDOR_GRAPH_CACHE_TTL_MS)
    : 30000;

function getCachedCorridorGraph(corridors, graphOpts, cacheKey) {
  const now = Date.now();
  const cached = corridorGraphCache.get(cacheKey);
  if (cached && now - cached.ts < CORRIDOR_GRAPH_CACHE_TTL_MS) {
    return cached.graph;
  }
  const graph = buildCorridorWalkGraph(corridors, graphOpts);
  corridorGraphCache.set(cacheKey, { ts: now, graph });
  return graph;
}

export async function loadCorridorsForMap(options = {}) {
  const mapId = normalizedMapId(options.mapId);
  if (!mapId) return [];

  const endMap = normalizedMapId(options.endMapId);
  const sameFloorPlanImage = !endMap || endMap === mapId;

  let corridors;
  if (sameFloorPlanImage) {
    const cached = corridorLeanCache.get(mapId);
    const now = Date.now();
    if (
      cached &&
      Array.isArray(cached.rows) &&
      now - cached.ts < CORRIDOR_LEAN_CACHE_TTL_MS
    ) {
      corridors = cached.rows;
    } else {
      corridors = await NavigationLocation.find({ mapId, kind: 'corridor' }).lean();
      corridorLeanCache.set(mapId, { ts: now, rows: corridors || [] });
      if (!corridors?.length) return [];
    }
  } else {
    corridors = await NavigationLocation.find({ mapId, kind: 'corridor' }).lean();
    if (!corridors?.length) return [];
  }

  const want = new Set();
  if (options.floor != null && !Number.isNaN(Number(options.floor))) {
    want.add(Number(options.floor));
  }
  if (options.endFloor != null && !Number.isNaN(Number(options.endFloor))) {
    want.add(Number(options.endFloor));
  }
  if (want.size > 0) {
    const narrowed = corridors.filter((c) => want.has(Number(c.floor)));
    if (narrowed.length > 0) corridors = narrowed;
  }

  return corridors;
}

/**
 * @returns {Promise<
 *   | { skip: true; hadCorridors: boolean }
 *   | { skip?: false; pathIds: string[]; path: object[]; routingGraph: 'corridor'; startAnchor: object; endAnchor: object; hadCorridors: true }
 * >}
 */
async function tryCorridorPathfinding(startPoint, endPoint, options = {}) {
  const skipNoData = () => ({ skip: true, hadCorridors: false });
  const skipFailed = () => ({ skip: true, hadCorridors: true });

  if (!options.resolveByCoordinate) return skipNoData();

  const mapId = normalizedMapId(options.mapId);
  if (!mapId) return skipNoData();

  const endMap = normalizedMapId(options.endMapId);
  if (endMap && endMap !== mapId) return skipNoData();

  const corridors = await loadCorridorsForMap(options);
  if (!corridors.length) return skipNoData();

  const startFp = normalizeFootprintPoints(options.startFootprint);
  const endFp = normalizeFootprintPoints(options.endFootprint);

  const startCands = footprintBoundaryCandidates(
    startFp.length >= 3 ? startFp : null,
    startPoint
  );
  const endCands = footprintBoundaryCandidates(
    endFp.length >= 3 ? endFp : null,
    endPoint
  );

  if (!startCands.length || !endCands.length) return skipFailed();

  const graphOpts = {
    /**
     * Max distance (same units as map x/y, e.g. 0–1000) to add a graph edge between two corridor
     * chains. Too large creates “shortcuts” through walls; too small breaks real T-junctions.
     */
    crossCorridorEndpointMergeMax: Number(options.crossCorridorMergeMax) || 10,
    mergeCoincidentMax: Number(options.mergeCoincidentMax) || 4
  };

  /* Build (or reuse cached) corridor walk graph — O(n²) build only once per mapId+floor */
  const floorKey = options.floor != null ? String(options.floor) : '_';
  const endFloorKey = options.endFloor != null ? String(options.endFloor) : '_';
  const graphCacheKey = `${mapId}|${floorKey}|${endFloorKey}`;

  const flatSegs = buildFlatSegmentsFromCorridors(corridors);
  const pathGeomMax = Number(options.corridorPathMaxDeviation);
  const corridorPathMaxDeviation = Number.isFinite(pathGeomMax) ? pathGeomMax : 18;

  const best = bestPathOverFootprintPairs(
    () => getCachedCorridorGraph(corridors, graphOpts, graphCacheKey),
    (adj, nm, a, b) => aStarShortestPath(adj, nm, a, b),
    startCands,
    endCands,
    {
      segmentSnapK: Number(options.corridorSegmentSnapK) || 24,
      corridorGeometrySegments: flatSegs,
      corridorPathMaxDeviation
    }
  );

  if (!best) {
    return skipFailed();
  }

  return {
    pathIds: best.pathIds,
    path: best.path,
    routingGraph: 'corridor',
    startAnchor: best.startAnchor,
    endAnchor: best.endAnchor,
    hadCorridors: true
  };
}

/**
 * Find shortest path and include node metadata for segmentation by map/floor.
 * Pass options.startPoint / options.endPoint as { x, y } when using footprints with node-id routing.
 */
export async function findShortestPathDetailed(startNodeOrPoint, endNodeOrPoint, options = {}) {
  const resolveByCoordinate = Boolean(options.resolveByCoordinate);

  if (resolveByCoordinate) {
    const startPt = coordinateFallback(startNodeOrPoint, options, 'start');
    const endPt = coordinateFallback(endNodeOrPoint, options, 'end');
    if (!startPt || !endPt) {
      return {
        pathIds: [],
        path: [],
        routingGraph: 'node',
        startAnchor: null,
        endAnchor: null
      };
    }

    const strictCorridorOnly = Boolean(options.strictCorridorOnly);
    let corridorRowCount = 0;
    if (strictCorridorOnly) {
      const rows = await loadCorridorsForMap(options);
      corridorRowCount = rows.length;
    }

    const corridor = await tryCorridorPathfinding(startPt, endPt, {
      ...options,
      resolveByCoordinate: true
    });
    const cPath = corridor?.path;

    if (corridor?.skip === true && corridor.hadCorridors === true) {
      return {
        pathIds: [],
        path: [],
        routingGraph: 'corridor',
        startAnchor: null,
        endAnchor: null,
        corridorUnreachable: true
      };
    }

    if (
      corridor &&
      corridor.skip !== true &&
      Array.isArray(cPath) &&
      cPath.length >= 2
    ) {
      return {
        pathIds: corridor.pathIds ?? [],
        path: cPath,
        routingGraph: corridor.routingGraph ?? 'corridor',
        startAnchor: corridor.startAnchor ?? null,
        endAnchor: corridor.endAnchor ?? null,
        corridorUnreachable: false
      };
    }

    /**
     * This map has saved corridor polylines: routing MUST stay on that graph.
     * Do not fall through to sparse routing nodes (straight segments through walls).
     */
    if (strictCorridorOnly && corridorRowCount > 0) {
      return {
        pathIds: [],
        path: [],
        routingGraph: 'corridor',
        startAnchor: null,
        endAnchor: null,
        corridorUnreachable: true
      };
    }
  }

  const { adjacencyMap, nodeMap, nodeDetailsById } = await loadGraphData(options);

  const startFp = normalizeFootprintPoints(options.startFootprint);
  const endFp = normalizeFootprintPoints(options.endFootprint);
  const startFallbackXY = coordinateFallback(startNodeOrPoint, options, 'start');
  const endFallbackXY = coordinateFallback(endNodeOrPoint, options, 'end');

  const startStr = resolveByCoordinate
    ? nearestNodeId(nodeMap, startNodeOrPoint)
    : String(startNodeOrPoint);
  const endStr = resolveByCoordinate
    ? nearestNodeId(nodeMap, endNodeOrPoint)
    : String(endNodeOrPoint);

  const useFootprintPairs =
    Boolean(startFallbackXY && endFallbackXY) &&
    (startFp.length >= 3 || endFp.length >= 3);

  if (useFootprintPairs) {
    const startCands = footprintBoundaryCandidates(
      startFp.length >= 3 ? startFp : null,
      startFallbackXY
    );
    const endCands = footprintBoundaryCandidates(
      endFp.length >= 3 ? endFp : null,
      endFallbackXY
    );
    if (startCands.length && endCands.length) {
      const best = bestNodePathOverFootprintPairs(
        adjacencyMap,
        nodeMap,
        nodeDetailsById,
        nearestNodeId,
        (adj, nm, a, b) => aStarShortestPath(adj, nm, a, b),
        startCands,
        endCands
      );
      if (best) {
        return {
          pathIds: best.pathIds,
          path: best.path,
          routingGraph: 'node',
          startAnchor: best.startAnchor,
          endAnchor: best.endAnchor
        };
      }
    }
  }

  if (!nodeMap.has(startStr) || !nodeMap.has(endStr)) {
    return {
      pathIds: [],
      path: [],
      routingGraph: 'node',
      startAnchor: null,
      endAnchor: null
    };
  }

  const pathIds = aStarShortestPath(adjacencyMap, nodeMap, startStr, endStr);
  if (!pathIds || pathIds.length === 0) {
    return {
      pathIds: [],
      path: [],
      routingGraph: 'node',
      startAnchor: null,
      endAnchor: null
    };
  }

  const path = pathIds
    .map((id) => nodeDetailsById.get(String(id)))
    .filter(Boolean);

  return {
    pathIds,
    path,
    routingGraph: 'node',
    startAnchor: null,
    endAnchor: null
  };
}

/**
 * Find shortest path between two nodes and return ordered list of node coordinates.
 */
export async function findShortestPath(startNodeOrPoint, endNodeOrPoint, options = {}) {
  const d = await findShortestPathDetailed(startNodeOrPoint, endNodeOrPoint, options);
  return (d.path ?? []).map((p) => ({
    x: Number(p.x),
    y: Number(p.y)
  }));
}
