import NavigationLocation from '../models/NavigationLocation.js';
import { auditStairsReachabilityForMap } from './stairsReachabilityAudit.js';

function stairGraphReady(row) {
  return (row?.stairTargetsOnGraph || 0) > 0;
}

/**
 * Augments per-map stair reachability rows with cross-floor context: a building with multiple
 * floor images needs at least one other floor whose stair/elevator landmarks snap to corridors.
 * Pins that walk to stairs locally but have no such peer floor are listed as disconnected.
 *
 * @param {object[]} stairRows - rows from {@link auditStairsReachabilityForMap} (must include `reachablePins`)
 * @returns {object[]} same length, each row gains `disconnected`, `crossFloorReady`, `peerFloorsWithStairsOnGraph`
 */
export function mergeCrossFloorDisconnectedRows(stairRows) {
  const rows = Array.isArray(stairRows) ? stairRows : [];
  const mapIds = rows.map((r) => r.mapId);
  const multiFloor = mapIds.length >= 2;

  return rows.map((row) => {
    const disconnected = (row.missing || []).map((m) => ({ ...m }));
    let peerFloorsWithStairsOnGraph = 0;
    let crossFloorReady = true;

    if (!multiFloor) {
      return {
        ...row,
        disconnected,
        disconnectedCount: disconnected.length,
        crossFloorReady: true,
        peerFloorsWithStairsOnGraph: 0
      };
    }

    const thisStairOk = stairGraphReady(row);
    for (const mid of mapIds) {
      if (mid === row.mapId) continue;
      const other = rows.find((x) => x.mapId === mid);
      if (stairGraphReady(other)) peerFloorsWithStairsOnGraph += 1;
    }
    const peerOk = peerFloorsWithStairsOnGraph > 0;
    crossFloorReady = thisStairOk && peerOk;

    if (thisStairOk && !peerOk) {
      for (const p of row.reachablePins || []) {
        disconnected.push({
          id: p.id,
          name: p.name,
          kind: p.kind,
          reason: 'no_peer_floor_with_stairs_on_corridor'
        });
      }
    }

    return {
      ...row,
      disconnected,
      disconnectedCount: disconnected.length,
      crossFloorReady,
      peerFloorsWithStairsOnGraph
    };
  });
}

/**
 * @param {string|null|undefined} buildingId - Mongo building id or falsy for all buildings
 */
export async function auditCrossFloorConnectivityBuilding(buildingId) {
  const mapDistFilter = {};
  if (buildingId) mapDistFilter.building = buildingId;

  const mapIdsRaw = await NavigationLocation.distinct('mapId', mapDistFilter);
  const mapIds = [...new Set(mapIdsRaw.map((m) => String(m).trim()).filter(Boolean))].sort();

  const stairRows = [];
  for (const mid of mapIds) {
    stairRows.push(await auditStairsReachabilityForMap(mid, buildingId || null));
  }

  const maps = mergeCrossFloorDisconnectedRows(stairRows);
  let disconnectedTotal = 0;
  for (const m of maps) disconnectedTotal += m.disconnectedCount || 0;

  return {
    buildingId: buildingId || null,
    mapsAudited: maps.length,
    totals: {
      pinsDisconnectedForCrossFloor: disconnectedTotal,
      floorPlansChecked: maps.length
    },
    maps
  };
}
