import NavigationLocation from '../models/NavigationLocation.js';
import Node from '../models/Node.js';
import {
  buildCorridorWalkGraph,
  attachPointToCorridorGraph,
  detachEphemeralSnapNode
} from '../services/corridorWalkGraph.js';
import { ROUTING_GRAPH_OPTS } from './corridorConnectivity.js';
import { normalizeFootprintPoints, footprintBoundaryCandidates } from './footprintRouting.js';
import { looksLikeVerticalTransitionName } from './crossFloorWaypointPenalty.js';

const MAX_CAND =
  Number(process.env.STAIRS_AUDIT_MAX_CANDIDATES) > 0
    ? Math.min(Number(process.env.STAIRS_AUDIT_MAX_CANDIDATES), 80)
    : 24;

function applyNodeFallback(copy, node) {
  if (!Number.isFinite(Number(copy.x))) copy.x = node.x;
  if (!Number.isFinite(Number(copy.y))) copy.y = node.y;
  if (!copy.mapId) copy.mapId = node.mapId;
  if (copy.floor == null) copy.floor = node.floor;
  if (!copy.building && !copy.buildingId && node.buildingId) copy.buildingId = node.buildingId;
  return copy;
}

function hydrateNavSync(loc, nodeById) {
  if (!loc) return null;
  const copy = { ...loc };
  const nid = copy.nodeId ? String(copy.nodeId) : null;
  if (!nid) return copy;
  const node = nodeById.get(nid);
  if (!node) return copy;
  return applyNodeFallback(copy, node);
}

function bfsReachesAnyTarget(adjacencyMap, startId, targetSet) {
  if (!startId || !targetSet?.size) return false;
  if (targetSet.has(startId)) return true;
  const queue = [startId];
  const seen = new Set(queue);
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    for (const e of adjacencyMap.get(u) || []) {
      if (seen.has(e.to)) continue;
      if (targetSet.has(e.to)) return true;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return false;
}

function pinReachesGoalsOnCorridorGraph(bundle, px, py, snapToken, goalSet) {
  const snapId = attachPointToCorridorGraph(
    bundle.nodeMap,
    bundle.adjacencyMap,
    bundle.segments,
    { x: Number(px), y: Number(py) },
    snapToken,
    bundle.nodeDetailsById
  );
  if (!snapId) return false;
  const ok = bfsReachesAnyTarget(bundle.adjacencyMap, snapId, goalSet);
  detachEphemeralSnapNode(bundle.adjacencyMap, bundle.nodeMap, bundle.nodeDetailsById, snapId);
  return ok;
}

function isStairWaypointDoc(doc) {
  return (doc.kind || 'point') === 'point' && looksLikeVerticalTransitionName(doc.name);
}

/**
 * Audits whether each room/door pin can reach at least one stair or elevator landmark on the corridor graph.
 */
export async function auditStairsReachabilityForMap(mapId, buildingId = null) {
  const mapKey = String(mapId || '').trim();
  const locFilter = { mapId: mapKey, kind: { $in: ['point', 'door'] } };
  if (buildingId) locFilter.building = String(buildingId);

  const rawLocs = await NavigationLocation.find(locFilter).lean();
  const corridors = await NavigationLocation.find({ mapId: mapKey, kind: 'corridor' }).lean();

  const validChains = corridors.filter((c) => Array.isArray(c.corridorPoints) && c.corridorPoints.length >= 2);

  const nodeIds = [...new Set(rawLocs.map((r) => r.nodeId).filter(Boolean).map((id) => String(id)))];
  const nodes = nodeIds.length ? await Node.find({ _id: { $in: nodeIds } }).lean() : [];
  const nodeById = new Map(nodes.map((n) => [String(n._id), n]));

  const synthetic = (r) => r?.name === '__corridor_reachability__';

  const stairDocs = rawLocs.filter((r) => !synthetic(r) && isStairWaypointDoc(r));
  const pinsToCheck = rawLocs.filter(
    (r) => !synthetic(r) && (r.kind || 'point') !== 'corridor' && !isStairWaypointDoc(r)
  );

  if (validChains.length === 0) {
    return {
      mapId: mapKey,
      checkedCount: pinsToCheck.length,
      stairsWaypointCount: stairDocs.length,
      stairTargetsOnGraph: 0,
      missing: pinsToCheck.map((r) => ({
        id: String(r._id),
        name: r.name || null,
        kind: r.kind || 'point',
        reason: 'no_corridor_on_map'
      })),
      reachablePins: [],
      skipped: false
    };
  }

  const bundle = buildCorridorWalkGraph(validChains, ROUTING_GRAPH_OPTS);

  const stairHydrated = stairDocs.map((d) => hydrateNavSync(d, nodeById));
  const stairSnapIds = [];
  const safeMapToken = mapKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  for (let i = 0; i < stairHydrated.length; i++) {
    const s = stairHydrated[i];
    if (!Number.isFinite(Number(s.x)) || !Number.isFinite(Number(s.y))) continue;
    const id = attachPointToCorridorGraph(
      bundle.nodeMap,
      bundle.adjacencyMap,
      bundle.segments,
      { x: Number(s.x), y: Number(s.y) },
      `stv_${safeMapToken}_${i}`,
      bundle.nodeDetailsById
    );
    if (id) stairSnapIds.push(id);
  }

  const goalSet = new Set(stairSnapIds);

  if (goalSet.size === 0) {
    return {
      mapId: mapKey,
      checkedCount: pinsToCheck.length,
      stairsWaypointCount: stairDocs.length,
      stairTargetsOnGraph: 0,
      missing: pinsToCheck.map((r) => ({
        id: String(r._id),
        name: r.name || null,
        kind: r.kind || 'point',
        reason:
          stairDocs.length === 0
            ? 'no_stairs_or_elevator_marker'
            : 'stairs_not_on_corridor_graph'
      })),
      reachablePins: [],
      skipped: false
    };
  }

  const missing = [];
  const reachablePins = [];
  let pinSeq = 0;

  for (const raw of pinsToCheck) {
    const loc = hydrateNavSync(raw, nodeById);
    if (!Number.isFinite(Number(loc.x)) || !Number.isFinite(Number(loc.y))) {
      missing.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point',
        reason: 'missing_coordinates'
      });
      continue;
    }

    const fp = normalizeFootprintPoints(loc.footprintPoints);
    let cands = footprintBoundaryCandidates(fp.length >= 3 ? fp : null, {
      x: Number(loc.x),
      y: Number(loc.y)
    });
    if (cands.length > MAX_CAND) cands = cands.slice(0, MAX_CAND);

    let ok = false;
    const seq = pinSeq++;
    for (let ci = 0; ci < cands.length; ci++) {
      const c = cands[ci];
      if (
        pinReachesGoalsOnCorridorGraph(bundle, c.x, c.y, `sa_${safeMapToken}_${seq}_${ci}`, goalSet)
      ) {
        ok = true;
        break;
      }
    }

    if (!ok) {
      missing.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point',
        reason: 'no_path_to_stairs'
      });
    } else {
      reachablePins.push({
        id: String(loc._id),
        name: loc.name || null,
        kind: loc.kind || 'point'
      });
    }
  }

  for (const sid of stairSnapIds) {
    detachEphemeralSnapNode(bundle.adjacencyMap, bundle.nodeMap, bundle.nodeDetailsById, sid);
  }

  return {
    mapId: mapKey,
    checkedCount: pinsToCheck.length,
    stairsWaypointCount: stairDocs.length,
    stairTargetsOnGraph: goalSet.size,
    missing,
    reachablePins,
    skipped: false
  };
}
