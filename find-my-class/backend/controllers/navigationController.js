import Location from '../models/Location.js';
import Node from '../models/Node.js';
import NavigationLocation from '../models/NavigationLocation.js';
import {
  findShortestPathDetailed,
  loadCorridorsForMap
} from '../services/pathfindingService.js';
import { createError } from '../utils/errors.js';
import {
  appendLegPoints,
  coerceCrossFloorLegMapIds,
  rawPointsToSegments
} from '../utils/navigationRouteMerge.js';
import { pickBestRouteWithOptionalDoors, routingPathNodeCount } from '../utils/doorRouting.js';
import {
  analyzeCorridorConnectivity,
  getComponentRepresentativeVertexIds,
  ROUTING_GRAPH_OPTS
} from '../utils/corridorConnectivity.js';
import {
  crossFloorWaypointNamePenalty,
  looksLikeStairsName,
  looksLikeVerticalTransitionName,
  rankCrossFloorWaypointCandidates
} from '../utils/crossFloorWaypointPenalty.js';
import { searchBestCrossFloorPair } from '../utils/crossFloorRoutePairing.js';
import { groundConnectorMapIdFor } from '../utils/groundConnectorMap.js';
import {
  buildFlatSegmentsFromCorridors,
  minDistancePointToCorridorSegments
} from '../utils/corridorPathGeometry.js';
import { auditStairsReachabilityForMap } from '../utils/stairsReachabilityAudit.js';
import { auditCrossFloorConnectivityBuilding } from '../utils/crossFloorConnectivityAudit.js';
import { normalizeFootprintPoints, footprintBoundaryCandidates } from '../utils/footprintRouting.js';
import {
  buildCorridorWalkGraph,
  attachPointToCorridorGraph,
  detachEphemeralSnapNode
} from '../services/corridorWalkGraph.js';

function routingFootprint(loc) {
  const fp = Array.isArray(loc.footprintPoints) ? loc.footprintPoints : [];
  const pts = fp
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  return pts.length >= 3 ? pts : [];
}

function buildingObjectId(loc) {
  if (loc?.building) {
    const b = loc.building;
    return b._id ?? b;
  }
  return loc?.buildingId ?? null;
}

async function loadLinkedDoorsForDestination(endLoc) {
  if (!endLoc?._id || endLoc.kind === 'door' || endLoc.kind === 'corridor') return [];
  const doors = await NavigationLocation.find({
    kind: 'door',
    linksToLocation: endLoc._id,
    mapId: endLoc.mapId
  }).lean();
  return Promise.all(doors.map((d) => hydrateNavigationLocation({ ...d })));
}

/** Doors that lead into this room/place (same map); omit floor so bad room `floor` values still match. */
async function loadLinkedDoorsForOrigin(startLoc) {
  if (!startLoc?._id || startLoc.kind === 'door' || startLoc.kind === 'corridor') return [];
  const doors = await NavigationLocation.find({
    kind: 'door',
    linksToLocation: startLoc._id,
    mapId: startLoc.mapId
  }).lean();
  return Promise.all(doors.map((d) => hydrateNavigationLocation({ ...d })));
}

async function hydrateNavigationLocation(loc) {
  if (!loc) return null;
  const copy = { ...loc };
  const nodeId = copy.nodeId ? String(copy.nodeId) : null;
  if (!nodeId) return copy;
  const node = await Node.findById(nodeId).lean();
  if (!node) return copy;

  return applyNodeFallbackToNavigationLocation(copy, node);
}

/** Same coordinate fallback as hydrateNavigationLocation, without a DB round-trip (uses preloaded nodes). */
function hydrateNavigationLocationSync(loc, nodeById) {
  if (!loc) return null;
  const copy = { ...loc };
  const nodeId = copy.nodeId ? String(copy.nodeId) : null;
  if (!nodeId) return copy;
  const node = nodeById.get(nodeId);
  if (!node) return copy;
  return applyNodeFallbackToNavigationLocation(copy, node);
}

function applyNodeFallbackToNavigationLocation(copy, node) {
  if (!Number.isFinite(Number(copy.x))) copy.x = node.x;
  if (!Number.isFinite(Number(copy.y))) copy.y = node.y;
  if (!copy.mapId) copy.mapId = node.mapId;
  if (copy.floor == null) copy.floor = node.floor;
  if (!copy.building && !copy.buildingId && node.buildingId) copy.buildingId = node.buildingId;
  return copy;
}

function bfsReachesAnyCorridorRep(adjacencyMap, startId, repTargetSet) {
  if (!startId || !repTargetSet?.size) return false;
  if (repTargetSet.has(startId)) return true;
  const queue = [startId];
  const seen = new Set(queue);
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    for (const e of adjacencyMap.get(u) || []) {
      if (seen.has(e.to)) continue;
      if (repTargetSet.has(e.to)) return true;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return false;
}

/**
 * One BFS on the pre-built corridor graph (same merge rules as routing), instead of full A* for every anchor.
 */
function pinReachableViaCorridorGraph(bundle, px, py, snapToken, repTargetSet) {
  const snapId = attachPointToCorridorGraph(
    bundle.nodeMap,
    bundle.adjacencyMap,
    bundle.segments,
    { x: Number(px), y: Number(py) },
    snapToken,
    bundle.nodeDetailsById
  );
  if (!snapId) return false;
  const ok = bfsReachesAnyCorridorRep(bundle.adjacencyMap, snapId, repTargetSet);
  detachEphemeralSnapNode(bundle.adjacencyMap, bundle.nodeMap, bundle.nodeDetailsById, snapId);
  return ok;
}

async function runDetailedForPair(startLoc, endLoc, routeGraphOpts = {}) {
  const hintRaw = routeGraphOpts.corridorMapIdHint;
  const hint = hintRaw != null && String(hintRaw).trim() !== '' ? String(hintRaw).trim() : '';

  let mapKey = String(startLoc.mapId ?? endLoc.mapId ?? '').trim();

  const loadOpts = (mid) => ({
    mapId: mid,
    floor: startLoc.floor,
    endMapId: mid,
    endFloor: endLoc.floor
  });

  let corridorsOnMap = mapKey ? await loadCorridorsForMap(loadOpts(mapKey)) : [];
  if (corridorsOnMap.length === 0 && hint && hint !== mapKey) {
    const hinted = await loadCorridorsForMap(loadOpts(hint));
    if (hinted.length > 0) {
      corridorsOnMap = hinted;
      mapKey = hint;
    }
  }
  if (!mapKey) mapKey = hint;

  const opts = {
    mapId: mapKey,
    floor: startLoc.floor,
    endMapId: mapKey,
    endFloor: endLoc.floor,
    startPoint: { x: Number(startLoc.x), y: Number(startLoc.y) },
    endPoint: { x: Number(endLoc.x), y: Number(endLoc.y) },
    startFootprint: routingFootprint(startLoc),
    endFootprint: routingFootprint(endLoc)
  };
  const sn = startLoc.nodeId ?? null;
  const en = endLoc.nodeId ?? null;

  const strictCorridorOnly = corridorsOnMap.length > 0;

  const coordinateFirst = await findShortestPathDetailed(
    { x: Number(startLoc.x), y: Number(startLoc.y) },
    { x: Number(endLoc.x), y: Number(endLoc.y) },
    { resolveByCoordinate: true, strictCorridorOnly, ...opts }
  );
  const cLen = coordinateFirst?.path?.length ?? 0;

  if (coordinateFirst?.corridorUnreachable) {
    return coordinateFirst;
  }

  const corridorLike =
    coordinateFirst?.routingGraph === 'corridor' && cLen >= 2;

  if (corridorLike) {
    return coordinateFirst;
  }

  if (sn && en && !strictCorridorOnly) {
    const viaNodes = await findShortestPathDetailed(String(sn), String(en), {
      ...opts,
      resolveByCoordinate: false
    });
    const nLen = viaNodes?.path?.length ?? 0;
    if (nLen >= 2) {
      return viaNodes;
    }
  }

  return coordinateFirst;
}

function sortWaypointCandidatesByStairPreference(cands, max = 8) {
  if (!Array.isArray(cands) || !cands.length) return [];
  return [...cands]
    .sort(
      (a, b) =>
        crossFloorWaypointNamePenalty(a?.name) - crossFloorWaypointNamePenalty(b?.name)
    )
    .slice(0, max);
}

/** Limits brute-force combo count (caps keep requests from hanging the API / proxy). */
const CROSS_BUILDING_FLOOR_WAYPOINT_CAP = 4;
const CROSS_BUILDING_GROUND_WAYPOINT_CAP = 4;

/**
 * Same floor-plan image (`mapId`) but different buildings: route to stairs on start building,
 * cross **floor-ground** between buildings, then stairs on destination building back to this `mapId`.
 */
async function tryCrossSameFloorDifferentBuildingsViaGround({
  rawPoints,
  startLocation,
  endLocation,
  floorMapKey,
  groundMapId,
  startB,
  endB,
  linkedDoorsStart,
  linkedDoorsEnd,
  clientMapHint,
  hydrateNavigationLocation: hydrateFn,
  runDetailedForPair
}) {
  const floorHint =
    clientMapHint != null && String(clientMapHint).trim() !== ''
      ? String(clientMapHint).trim()
      : floorMapKey;
  const runFloor = (a, b) => runDetailedForPair(a, b, { corridorMapIdHint: floorHint });

  const [candA_f1, candB_f1, candA_g, candB_g] = await Promise.all([
    NavigationLocation.find({
      mapId: floorMapKey,
      building: startB,
      kind: 'point',
      _id: { $ne: startLocation._id }
    }).lean(),
    NavigationLocation.find({
      mapId: floorMapKey,
      building: endB,
      kind: 'point',
      _id: { $ne: endLocation._id }
    }).lean(),
    NavigationLocation.find({ mapId: groundMapId, building: startB, kind: 'point' }).lean(),
    NavigationLocation.find({ mapId: groundMapId, building: endB, kind: 'point' }).lean()
  ]);

  if (!candA_g.length || !candB_g.length) return null;

  const A1 = sortWaypointCandidatesByStairPreference(candA_f1, CROSS_BUILDING_FLOOR_WAYPOINT_CAP);
  const B1 = sortWaypointCandidatesByStairPreference(candB_f1, CROSS_BUILDING_FLOOR_WAYPOINT_CAP);
  const Ag = sortWaypointCandidatesByStairPreference(candA_g, CROSS_BUILDING_GROUND_WAYPOINT_CAP);
  const Bg = sortWaypointCandidatesByStairPreference(candB_g, CROSS_BUILDING_GROUND_WAYPOINT_CAP);
  if (!A1.length || !B1.length) return null;

  const cache = new Map();
  const hydrateLoc = async (loc) => {
    const id = String(loc._id);
    if (cache.has(id)) return cache.get(id);
    const h = await hydrateFn(loc);
    cache.set(id, h);
    return h;
  };

  let best = null;
  let bestScore = Infinity;
  /** Hard stop so pathfinding combinations cannot exhaust the Node process / proxy timeout. */
  const MAX_CROSS_BUILDING_COMBINATIONS = 120;
  let combinationsTried = 0;

  outerCrossBuilding: for (const wsARaw of A1) {
    for (const wgARaw of Ag) {
      for (const wgBRaw of Bg) {
        for (const wsBRaw of B1) {
          if (combinationsTried >= MAX_CROSS_BUILDING_COMBINATIONS) break outerCrossBuilding;
          combinationsTried += 1;
          const [wsA, wgA, wgB, wsB] = await Promise.all([
            hydrateLoc(wsARaw),
            hydrateLoc(wgARaw),
            hydrateLoc(wgBRaw),
            hydrateLoc(wsBRaw)
          ]);

          const leg1 = await pickBestRouteWithOptionalDoors(
            startLocation,
            wsA,
            linkedDoorsStart,
            [],
            runFloor,
            { earlyExitOnFirstSuccess: true }
          );
          if (routingPathNodeCount(leg1.detailed) < 2) continue;

          const d2 = await runDetailedForPair(wgA, wgB, { corridorMapIdHint: groundMapId });
          if (routingPathNodeCount(d2) < 2) continue;

          const leg3 = await pickBestRouteWithOptionalDoors(
            wsB,
            endLocation,
            [],
            linkedDoorsEnd,
            runFloor,
            { earlyExitOnFirstSuccess: true }
          );
          if (routingPathNodeCount(leg3.detailed) < 2) continue;

          const stairPenalty =
            crossFloorWaypointNamePenalty(wsA.name) +
            crossFloorWaypointNamePenalty(wsB.name) +
            crossFloorWaypointNamePenalty(wgA.name) * 0.25 +
            crossFloorWaypointNamePenalty(wgB.name) * 0.25;

          const score =
            routingPathNodeCount(leg1.detailed) +
            routingPathNodeCount(d2) +
            routingPathNodeCount(leg3.detailed) +
            stairPenalty;

          if (score < bestScore) {
            bestScore = score;
            best = { leg1, d2, leg3, wsA, wgA, wgB, wsB };
          }
        }
      }
    }
  }

  if (!best) return null;

  appendLegPoints(
    rawPoints,
    startLocation,
    best.leg1.physicalEnd,
    best.leg1.detailed,
    best.leg1.physicalStart
  );
  appendLegPoints(rawPoints, best.wgA, best.wgB, best.d2, null);
  appendLegPoints(rawPoints, best.wsB, best.leg3.physicalEnd, best.leg3.detailed, null);

  const metaRoutingGraph =
    best.leg1.detailed?.routingGraph === 'corridor' ||
    best.d2?.routingGraph === 'corridor' ||
    best.leg3.detailed?.routingGraph === 'corridor'
      ? 'corridor'
      : 'node';

  const usedAnchors =
    (routingFootprint(startLocation).length >= 3 || routingFootprint(endLocation).length >= 3) &&
    Boolean(best.leg1.detailed?.startAnchor && best.leg3.detailed?.endAnchor);

  return {
    success: true,
    metaRoutingGraph,
    usedAnchors,
    transitionWaypoints: {
      onStartFloorPlan: best.wsA?.name ?? 'Start-building stair / lobby pin',
      onDestinationFloorPlan: `${best.wgA?.name ?? 'Ground A'} → ${best.wgB?.name ?? 'Ground B'} (${groundMapId})`,
      onReturnFloorPlan: best.wsB?.name ?? 'Destination-building stair / lobby pin',
      viaGroundDetail: `${best.wgA?.name ?? ''} → ${best.wgB?.name ?? ''}`
    },
    multiFloorRouteHints: [
      `On this floor image, follow the blue line toward “${best.wsA?.name || 'your building’s stair or lobby pin'}”, then go down to the ground floor.`,
      `Tap “Next Pic” to open the ground floor plan. Follow the blue path between “${best.wgA?.name || 'your building’s ground pin'}” and “${best.wgB?.name || 'the other building’s ground pin'}”.`,
      `Go up to “${best.wsB?.name || 'the stair pin in the destination building'}”, tap “Next Pic” to return to this same floor image, then continue to your destination.`,
      `Requires saved point pins on “${groundMapId}” for each building (stairs / lobby). Prefer names containing “Stairs” so routing picks them first.`
    ],
    routeStartsAtDoor: best.leg1.startDoorUsed
      ? { id: String(best.leg1.startDoorUsed._id), name: best.leg1.startDoorUsed.name || null }
      : null,
    routeEndsAtDoor: best.leg3.endDoorUsed
      ? { id: String(best.leg3.endDoorUsed._id), name: best.leg3.endDoorUsed.name || null }
      : null,
    crossBuildingViaGround: true
  };
}

/**
 * GET /api/navigation/route?start=LOCATION_ID&end=LOCATION_ID
 * Returns shortest path between two locations as coordinates.
 * Cross-map: routes on the start map to a same-building waypoint, then on the destination map from a waypoint to the destination (corridors per floor).
 */
export const getRoute = async (req, res) => {
  const { start: startLocationId, end: endLocationId, mapId: mapIdFromClientRaw } = req.query;
  const mapIdFromClient =
    mapIdFromClientRaw != null && String(mapIdFromClientRaw).trim() !== ''
      ? String(mapIdFromClientRaw).trim()
      : '';

  let [startLocation, endLocation] = await Promise.all([
    NavigationLocation.findById(startLocationId).lean(),
    NavigationLocation.findById(endLocationId).lean()
  ]);

  if (!startLocation || !endLocation) {
    [startLocation, endLocation] = await Promise.all([
      Location.findById(startLocationId).lean(),
      Location.findById(endLocationId).lean()
    ]);
  }

  if (!startLocation) throw createError('Start location not found', 404);
  if (!endLocation) throw createError('End location not found', 404);

  [startLocation, endLocation] = await Promise.all([
    hydrateNavigationLocation(startLocation),
    hydrateNavigationLocation(endLocation)
  ]);

  const startMapKey =
    startLocation.mapId != null ? String(startLocation.mapId).trim() : '';
  const endMapKey = endLocation.mapId != null ? String(endLocation.mapId).trim() : '';

  /** Same (from,to,hint) is asked many times in one request (doors, cross-building loops). */
  const routePathfindCache = new Map();
  const runDetailedForPairRequestCached = async (startLoc, endLoc, routeGraphOpts = {}) => {
    const hintRaw = routeGraphOpts.corridorMapIdHint;
    const hint = hintRaw != null && String(hintRaw).trim() !== '' ? String(hintRaw).trim() : '';
    const keyPart = (loc) =>
      loc && loc._id != null ? `id:${String(loc._id)}` : `xy:${Number(loc?.x)},${Number(loc?.y)}`;
    const key = `${keyPart(startLoc)}|${keyPart(endLoc)}|${hint}`;
    if (routePathfindCache.has(key)) return routePathfindCache.get(key);
    const resolved = await runDetailedForPair(startLoc, endLoc, routeGraphOpts);
    routePathfindCache.set(key, resolved);
    return resolved;
  };

  const rawPoints = [];
  /** Index in `rawPoints` where the destination-floor leg begins (cross-floor only). */
  let crossFloorLegSplitAt = null;
  let metaRoutingGraph = 'node';
  let usedAnchors =
    (routingFootprint(startLocation).length >= 3 || routingFootprint(endLocation).length >= 3);
  let transitionWaypoints = null;
  let multiFloorRouteHints = null;

  const sameMap = startMapKey && endMapKey && startMapKey === endMapKey;
  const [linkedDoorsEnd, linkedDoorsStart] = await Promise.all([
    loadLinkedDoorsForDestination(endLocation),
    loadLinkedDoorsForOrigin(startLocation)
  ]);
  let routeEndsAtDoor = null;
  let routeStartsAtDoor = null;

  const startB = buildingObjectId(startLocation);
  const endB = buildingObjectId(endLocation);
  const sameBuilding = startB && endB && String(startB) === String(endB);
  const groundMapId = groundConnectorMapIdFor(startMapKey);
  let usedCrossBuildingViaGround = false;

  if (sameMap && startB && endB && !sameBuilding && groundMapId) {
    const via = await tryCrossSameFloorDifferentBuildingsViaGround({
      rawPoints,
      startLocation,
      endLocation,
      floorMapKey: startMapKey,
      groundMapId,
      startB,
      endB,
      linkedDoorsStart,
      linkedDoorsEnd,
      clientMapHint: mapIdFromClient,
      hydrateNavigationLocation: hydrateNavigationLocation,
      runDetailedForPair: runDetailedForPairRequestCached
    });
    if (via?.success) {
      usedCrossBuildingViaGround = true;
      metaRoutingGraph = via.metaRoutingGraph;
      usedAnchors = via.usedAnchors;
      transitionWaypoints = via.transitionWaypoints;
      multiFloorRouteHints = via.multiFloorRouteHints;
      routeEndsAtDoor = via.routeEndsAtDoor;
      routeStartsAtDoor = via.routeStartsAtDoor;
    }
  }

  if (sameMap && !usedCrossBuildingViaGround) {
    const runPair = (a, b) =>
      runDetailedForPairRequestCached(a, b, { corridorMapIdHint: mapIdFromClient });
    const leg = await pickBestRouteWithOptionalDoors(
      startLocation,
      endLocation,
      linkedDoorsStart,
      linkedDoorsEnd,
      runPair
    );
    const detailed = leg.detailed;
    const routeNodes = Array.isArray(detailed?.path) ? detailed.path : [];
    if (routeNodes.length === 0) {
      const corridorHint = detailed?.corridorUnreachable
        ? 'Saved corridors on this floor do not connect into one walkable network between these rooms (or room pins are too far from the orange lines). On the map admin, connect corridor polylines at corners and run segments along doorways; routing will not cut through walls when corridors are linked.'
        : 'No walkable path between these places on this map. Add corridors that connect start and end, or routing nodes and edges.';
      throw createError(corridorHint, 404);
    }
    metaRoutingGraph = detailed?.routingGraph ?? 'node';
    usedAnchors =
      usedAnchors && Boolean(detailed?.startAnchor && detailed?.endAnchor);
    appendLegPoints(rawPoints, startLocation, leg.physicalEnd, detailed, leg.physicalStart);
    if (leg.endDoorUsed) {
      routeEndsAtDoor = { id: String(leg.endDoorUsed._id), name: leg.endDoorUsed.name || null };
    }
    if (leg.startDoorUsed) {
      routeStartsAtDoor = { id: String(leg.startDoorUsed._id), name: leg.startDoorUsed.name || null };
    }
  } else if (!sameMap) {
    if (!startB || !endB || String(startB) !== String(endB)) {
      throw createError(
        'Routes between two different floor plans must start and end in the same building. Assign both places to that building in Admin, or pick two places on the same map.',
        400
      );
    }
    const bOid = endB;

    const [candidatesStart, candidatesEnd] = await Promise.all([
      NavigationLocation.find({
        mapId: startMapKey,
        building: bOid,
        kind: 'point',
        _id: { $ne: startLocation._id }
      })
        .lean(),
      NavigationLocation.find({
        mapId: endMapKey,
        building: bOid,
        kind: 'point',
        _id: { $ne: endLocation._id }
      })
        .lean()
    ]);

    if (!candidatesStart.length || !candidatesEnd.length) {
      throw createError(
        'Cross-floor routing needs at least one other point on the start floor plan and one on the destination floor plan for this building (for example "Stairs — ground" and "Stairs — 2nd"). Add those in Admin, then try again.',
        404
      );
    }

    const hydrateCache = new Map();
    const getHydrated = async (loc) => {
      const id = String(loc._id);
      if (hydrateCache.has(id)) return hydrateCache.get(id);
      const h = await hydrateNavigationLocation(loc);
      hydrateCache.set(id, h);
      return h;
    };

    const parsedMaxSide = Number(process.env.CROSS_FLOOR_MAX_WAYPOINTS_PER_SIDE);
    const maxWaypointsPerSide =
      Number.isFinite(parsedMaxSide) && parsedMaxSide > 0 ? Math.min(Math.floor(parsedMaxSide), 40) : 8;

    const parsedMaxEndDoors = Number(process.env.CROSS_FLOOR_MAX_DEST_DOORS);
    const maxEndDoorsForCross =
      Number.isFinite(parsedMaxEndDoors) && parsedMaxEndDoors > 0
        ? Math.min(Math.floor(parsedMaxEndDoors), 40)
        : 8;
    const linkedDoorsEndCross = linkedDoorsEnd.slice(0, maxEndDoorsForCross);

    const hydratedStartAll = await Promise.all(candidatesStart.map((raw) => getHydrated(raw)));
    const hydratedEndAll = await Promise.all(candidatesEnd.map((raw) => getHydrated(raw)));

    const startVertical = hydratedStartAll.filter((w) => looksLikeVerticalTransitionName(w?.name));
    const endVertical = hydratedEndAll.filter((w) => looksLikeVerticalTransitionName(w?.name));
    const useVerticalWaypointPools =
      startVertical.length > 0 &&
      endVertical.length > 0 &&
      process.env.CROSS_FLOOR_WAYPOINTS_ALL !== '1' &&
      process.env.CROSS_FLOOR_WAYPOINTS_ALL !== 'true';

    const poolStart = useVerticalWaypointPools ? startVertical : hydratedStartAll;
    const poolEnd = useVerticalWaypointPools ? endVertical : hydratedEndAll;

    const rankedStart = rankCrossFloorWaypointCandidates(
      poolStart,
      startLocation,
      maxWaypointsPerSide
    );
    const rankedEnd = rankCrossFloorWaypointCandidates(poolEnd, endLocation, maxWaypointsPerSide);

    const searchAllCrossFloorPairs =
      process.env.CROSS_FLOOR_SEARCH_ALL === '1' || process.env.CROSS_FLOOR_SEARCH_ALL === 'true';

    const { best } = await searchBestCrossFloorPair({
      rankedStart,
      rankedEnd,
      endLocation,
      linkedDoorsEnd: linkedDoorsEndCross,
      runDetailedFromStartToWs: (ws) =>
        runDetailedForPairRequestCached(startLocation, ws, { corridorMapIdHint: startMapKey }),
      runDetailedOnEndFloor: (from, to) =>
        runDetailedForPairRequestCached(from, to, { corridorMapIdHint: endMapKey }),
      searchAllCrossFloorPairs
    });

    if (!best) {
      throw createError(
        `No walkable cross-floor path found among up to ${maxWaypointsPerSide} transition candidate(s) per floor${
          useVerticalWaypointPools
            ? ' (only pins named like stairs/elevator on each floor — add those in Admin if missing)'
            : ' (stairs/elevators prioritized, then nearest points)'
        } and up to ${maxEndDoorsForCross} linked door(s) on the destination for the second leg. Draw corridors so each floor plan connects your start to a stair/elevator landing and that landing to the destination floor — or raise CROSS_FLOOR_MAX_WAYPOINTS_PER_SIDE / CROSS_FLOOR_MAX_DEST_DOORS temporarily. Set CROSS_FLOOR_WAYPOINTS_ALL=true to allow every point pin as a transition candidate (much slower). If you suspect a valid pair exists but was skipped, set CROSS_FLOOR_SEARCH_ALL=true to score every pairing (slower).`,
        404
      );
    }

    appendLegPoints(rawPoints, startLocation, best.wStart, best.d1);
    crossFloorLegSplitAt = rawPoints.length;
    appendLegPoints(rawPoints, best.wEnd, best.leg2PhysicalEnd, best.d2);
    if (best.d1?.routingGraph === 'corridor' || best.d2?.routingGraph === 'corridor') {
      metaRoutingGraph = 'corridor';
    }
    transitionWaypoints = {
      onStartFloorPlan: best.wStart?.name ?? null,
      onDestinationFloorPlan: best.wEnd?.name ?? null
    };
    const wStartLabel = best.wStart?.name ?? 'the transition point on this floor';
    const wEndLabel = best.wEnd?.name ?? 'the transition point on the next floor';
    const startLooksStairs = looksLikeStairsName(wStartLabel);
    const endLooksStairs = looksLikeStairsName(wEndLabel);
    multiFloorRouteHints = [
      `On this floor plan, follow the blue line toward “${wStartLabel}”.`,
      startLooksStairs && endLooksStairs
        ? 'Use the stairs between floors. When you reach the stairs, tap “Open … & show route” or “Next floor” (sidebar or bottom of map) to open the next floor image and continue the blue line.'
        : 'Use the stairs (or elevator) to change floors. When you are ready to continue indoors, tap “Open … & show route” or “Next floor” to open the next floor image.',
      `On the next floor, the route continues from “${wEndLabel}” toward your destination — follow the blue line after you switch maps.`
    ];
    if (best.doorUsed) {
      routeEndsAtDoor = { id: String(best.doorUsed._id), name: best.doorUsed.name || null };
    }
  }

  if (
    crossFloorLegSplitAt != null &&
    !sameMap &&
    !usedCrossBuildingViaGround &&
    startMapKey &&
    endMapKey &&
    startMapKey !== endMapKey
  ) {
    coerceCrossFloorLegMapIds(rawPoints, crossFloorLegSplitAt, startMapKey, endMapKey);
  }

  const points = rawPoints.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.mapId);
  const validSegments = rawPointsToSegments(points);
  const path = validSegments.flatMap((s, i) => (i === 0 ? s.points : s.points.slice(1)));

  const effectiveCrossMap = !sameMap || usedCrossBuildingViaGround;

  const corridorPolylinesOnStartMap = startMapKey
    ? await NavigationLocation.countDocuments({ mapId: startMapKey, kind: 'corridor' })
    : 0;
  const routingDiagnostics = {
    graphUsed: metaRoutingGraph,
    pathPointCount: path.length,
    corridorPolylinesOnStartMap,
    startMapId: startMapKey || null,
    destinationMapId: endMapKey || null,
    explain:
      metaRoutingGraph === 'corridor'
        ? 'The blue line runs only along saved corridor polylines (orange dashed guides). It starts and ends at the nearest point on those lines—not at room centers—so it should not cut through walls. Use your door pins to walk between rooms and the hallway.'
        : corridorPolylinesOnStartMap === 0
          ? 'No corridor polylines are saved for this floor plan (mapId). Add them in Map admin on the same floor image as your rooms, or routing cannot follow hallways.'
          : 'This route used the routing-node graph instead of corridors. Check that rooms and corridors share the same mapId and that orange lines form one connected network.'
  };

  res.json({
    path,
    segments: validSegments,
    meta: {
      routingGraph: metaRoutingGraph,
      crossMap: effectiveCrossMap,
      ...(usedCrossBuildingViaGround ? { crossBuildingViaGround: true } : {}),
      routingDiagnostics,
      ...(transitionWaypoints ? { transitionWaypoints } : {}),
      ...(multiFloorRouteHints ? { multiFloorRouteHints } : {}),
      ...(routeEndsAtDoor ? { routeEndsAtDoor } : {}),
      ...(routeStartsAtDoor ? { routeStartsAtDoor } : {}),
      usedRoutingAnchors: usedAnchors,
      start: {
        id: String(startLocation._id || ''),
        name: startLocation.name || null,
        buildingId: String(startLocation.building || startLocation.buildingId || ''),
        mapId: startLocation.mapId || null,
        floor: startLocation.floor ?? null
      },
      destination: {
        id: String(endLocation._id || ''),
        name: endLocation.name || null,
        buildingId: String(endLocation.building || endLocation.buildingId || ''),
        mapId: endLocation.mapId || null,
        floor: endLocation.floor ?? null
      }
    }
  });
};

/**
 * GET /api/navigation/corridor-health?mapId=floor-third
 * Reports whether saved corridor polylines form one connected graph (same rules as routing).
 */
export const getCorridorHealth = async (req, res) => {
  const mapId = req.query.mapId != null ? String(req.query.mapId).trim() : '';
  if (!mapId) {
    throw createError('mapId query parameter is required', 400);
  }

  const corridors = await NavigationLocation.find({ mapId, kind: 'corridor' }).lean();
  const analysis = analyzeCorridorConnectivity(corridors);

  res.json({
    mapId,
    rawDocumentCount: corridors.length,
    ...analysis
  });
};

/**
 * GET /api/navigation/corridor-location-reachability?mapId=floor-first
 * Lists point/door pins that should be fixed for routing QA: (1) cannot reach the corridor walk graph
 * from any routing sample point, or (2) every sample lies farther than `corridorQaMaxDistance` from
 * drawn segments. Uses one pre-built corridor graph + BFS per sample (not full A* × anchors per pin).
 */
export const getCorridorLocationReachability = async (req, res) => {
  const mapId = req.query.mapId != null ? String(req.query.mapId).trim() : '';
  if (!mapId) {
    throw createError('mapId query parameter is required', 400);
  }

  const corridors = await NavigationLocation.find({ mapId, kind: 'corridor' }).lean();
  const validChains = corridors.filter(
    (c) => Array.isArray(c.corridorPoints) && c.corridorPoints.length >= 2
  );
  if (validChains.length === 0) {
    res.json({
      mapId,
      corridorComponentCount: 0,
      evaluatedCount: 0,
      unreachableCount: 0,
      unreachable: [],
      skipped: true,
      reason: 'no_valid_corridor_polylines'
    });
    return;
  }

  const corridorGraphBundle = buildCorridorWalkGraph(validChains, ROUTING_GRAPH_OPTS);
  const repVertexIds = getComponentRepresentativeVertexIds(corridorGraphBundle.adjacencyMap);
  if (repVertexIds.length === 0) {
    res.json({
      mapId,
      corridorComponentCount: 0,
      evaluatedCount: 0,
      unreachableCount: 0,
      unreachable: [],
      skipped: true,
      reason: 'no_valid_corridor_polylines'
    });
    return;
  }
  const repTargetSet = new Set(repVertexIds);

  const flatSegs = buildFlatSegmentsFromCorridors(corridors);
  const parsedQaMax = Number(process.env.CORRIDOR_QA_MAX_DISTANCE);
  const QA_MAX = Number.isFinite(parsedQaMax) && parsedQaMax > 0 ? parsedQaMax : 40;
  const parsedCandCap = Number(process.env.CORRIDOR_QA_MAX_CANDIDATES);
  const MAX_CANDS =
    Number.isFinite(parsedCandCap) && parsedCandCap > 0 ? Math.min(parsedCandCap, 80) : 24;

  const locs = await NavigationLocation.find({
    mapId,
    kind: { $in: ['point', 'door'] }
  }).lean();

  const nodeIds = [...new Set(locs.map((r) => r.nodeId).filter(Boolean).map((id) => String(id)))];
  const nodes = nodeIds.length ? await Node.find({ _id: { $in: nodeIds } }).lean() : [];
  const nodeById = new Map(nodes.map((n) => [String(n._id), n]));

  const unreachable = [];
  let evaluatedCount = 0;
  let pinSeq = 0;

  for (const raw of locs) {
    if (raw?.name === '__corridor_reachability__') continue;
    const loc = hydrateNavigationLocationSync(raw, nodeById);
    if (!Number.isFinite(Number(loc.x)) || !Number.isFinite(Number(loc.y))) {
      unreachable.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point',
        buildingId: String(loc.building || loc.buildingId || ''),
        reason: 'missing_coordinates'
      });
      continue;
    }

    const fp = normalizeFootprintPoints(loc.footprintPoints);
    let candidates = footprintBoundaryCandidates(fp.length >= 3 ? fp : null, {
      x: Number(loc.x),
      y: Number(loc.y)
    });
    if (candidates.length > MAX_CANDS) {
      candidates = candidates.slice(0, MAX_CANDS);
    }

    let minDistToDrawnCorridor = Infinity;
    if (flatSegs.length > 0) {
      for (const c of candidates) {
        const dist = minDistancePointToCorridorSegments(c.x, c.y, flatSegs);
        if (dist < minDistToDrawnCorridor) minDistToDrawnCorridor = dist;
      }
    }

    evaluatedCount += 1;

    const tooFarFromDrawn =
      flatSegs.length > 0 &&
      Number.isFinite(minDistToDrawnCorridor) &&
      minDistToDrawnCorridor > QA_MAX;

    if (tooFarFromDrawn) {
      unreachable.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point',
        buildingId: String(loc.building || loc.buildingId || ''),
        reason: 'far_from_drawn_corridor',
        minDistanceToCorridor: Math.round(minDistToDrawnCorridor * 100) / 100
      });
      continue;
    }

    let pathConnected = false;
    const seq = pinSeq++;
    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];
      const snapToken = `qa_${seq}_${ci}`;
      if (pinReachableViaCorridorGraph(corridorGraphBundle, c.x, c.y, snapToken, repTargetSet)) {
        pathConnected = true;
        break;
      }
    }

    if (!pathConnected) {
      unreachable.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point',
        buildingId: String(loc.building || loc.buildingId || ''),
        reason: 'no_corridor_path'
      });
    }
  }

  res.json({
    mapId,
    corridorComponentCount: repVertexIds.length,
    evaluatedCount,
    unreachableCount: unreachable.length,
    unreachable,
    corridorQaMaxDistance: QA_MAX,
    skipped: false
  });
};

/**
 * GET /api/navigation/stairs-reachability?buildingId=
 * For every map (or one building), check that each room/door can walk the corridor graph to a
 * stair/elevator landmark. Used before cross-building / cross-floor routes.
 */
export const getStairsReachabilityAudit = async (req, res) => {
  const buildingRaw = req.query.buildingId;
  const buildingId =
    buildingRaw != null && String(buildingRaw).trim() !== '' ? String(buildingRaw).trim() : '';

  const mapDistFilter = {};
  if (buildingId) mapDistFilter.building = buildingId;

  const mapIdsRaw = await NavigationLocation.distinct('mapId', mapDistFilter);
  const mapIds = [...new Set(mapIdsRaw.map((m) => String(m).trim()).filter(Boolean))].sort();

  const maps = [];
  let locationsMissingStairConnection = 0;
  let locationsChecked = 0;

  for (const mid of mapIds) {
    const row = await auditStairsReachabilityForMap(mid, buildingId || null);
    maps.push(row);
    locationsMissingStairConnection += row.missing?.length || 0;
    locationsChecked += row.checkedCount || 0;
  }

  res.json({
    buildingId: buildingId || null,
    mapsAudited: maps.length,
    totals: {
      locationsChecked,
      locationsMissingStairConnection
    },
    maps
  });
};

/**
 * GET /api/navigation/cross-floor-connectivity?buildingId=
 * Lists room/door pins that cannot participate in a stair-linked cross-floor path: same checks as
 * stair reachability, plus “this floor has stairs on the graph but no other floor in the building does”.
 */
export const getCrossFloorConnectivityAudit = async (req, res) => {
  const buildingRaw = req.query.buildingId;
  const buildingId =
    buildingRaw != null && String(buildingRaw).trim() !== '' ? String(buildingRaw).trim() : '';
  const payload = await auditCrossFloorConnectivityBuilding(buildingId || null);
  res.json(payload);
};
