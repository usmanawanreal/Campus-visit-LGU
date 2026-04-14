import Location from '../models/Location.js';
import Node from '../models/Node.js';
import NavigationLocation from '../models/NavigationLocation.js';
import {
  findShortestPathDetailed,
  loadCorridorsForMap
} from '../services/pathfindingService.js';
import { createError } from '../utils/errors.js';
import { appendLegPoints, rawPointsToSegments } from '../utils/navigationRouteMerge.js';
import { pickBestRouteWithOptionalDoors } from '../utils/doorRouting.js';
import { analyzeCorridorConnectivity } from '../utils/corridorConnectivity.js';
import {
  crossFloorWaypointPairPenalty,
  looksLikeStairsName
} from '../utils/crossFloorWaypointPenalty.js';

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

  if (!Number.isFinite(Number(copy.x))) copy.x = node.x;
  if (!Number.isFinite(Number(copy.y))) copy.y = node.y;
  if (!copy.mapId) copy.mapId = node.mapId;
  if (copy.floor == null) copy.floor = node.floor;
  if (!copy.building && !copy.buildingId && node.buildingId) copy.buildingId = node.buildingId;
  return copy;
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

  const rawPoints = [];
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

  if (sameMap) {
    const runPair = (a, b) =>
      runDetailedForPair(a, b, { corridorMapIdHint: mapIdFromClient });
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
  } else {
    const startB = buildingObjectId(startLocation);
    const endB = buildingObjectId(endLocation);
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

    let best = null;
    let bestScore = Infinity;
    for (const wsRaw of candidatesStart) {
      const ws = await getHydrated(wsRaw);
      for (const weRaw of candidatesEnd) {
        const we = await getHydrated(weRaw);
        const d1 = await runDetailedForPair(startLocation, ws, {
          corridorMapIdHint: startMapKey
        });
        const runEndLeg = (from, to) =>
          runDetailedForPair(from, to, { corridorMapIdHint: endMapKey });
        const leg2 = await pickBestRouteWithOptionalDoors(
          we,
          endLocation,
          [],
          linkedDoorsEnd,
          runEndLeg
        );
        const d2 = leg2.detailed;
        const l1 = d1?.path?.length ?? 0;
        const l2 = d2?.path?.length ?? 0;
        if (l1 === 0 || l2 === 0) continue;
        const score =
          l1 + l2 + crossFloorWaypointPairPenalty(ws.name, we.name);
        if (score < bestScore) {
          bestScore = score;
          best = {
            wStart: ws,
            wEnd: we,
            d1,
            d2,
            leg2PhysicalEnd: leg2.physicalEnd,
            doorUsed: leg2.endDoorUsed
          };
        }
      }
    }

    if (!best) {
      throw createError(
        'No walkable cross-floor path found. Draw corridors on both floor plans so each leg can reach a transition point (stairs, lobby, etc.), and ensure those points are saved for this building.',
        404
      );
    }

    appendLegPoints(rawPoints, startLocation, best.wStart, best.d1);
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
        ? 'Use the stairs between floors. When you reach the stairs, continue as indicated, then tap “Next Pic” on the map to open the next floor image and continue the route.'
        : 'Use the stairs (or elevator) to change floors. When you are ready to continue indoors, tap “Next Pic” on the map to open the next floor image.',
      `On the next floor, the route continues from “${wEndLabel}” toward your destination — follow the blue line after you tap Next Pic.`
    ];
    if (best.doorUsed) {
      routeEndsAtDoor = { id: String(best.doorUsed._id), name: best.doorUsed.name || null };
    }
  }

  const points = rawPoints.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.mapId);
  const validSegments = rawPointsToSegments(points);
  const path = validSegments.flatMap((s, i) => (i === 0 ? s.points : s.points.slice(1)));

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
      crossMap: !sameMap,
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
