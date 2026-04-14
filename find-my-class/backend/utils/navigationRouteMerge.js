function endLocationBuildingId(endLoc, routeNodes) {
  const tail = routeNodes[routeNodes.length - 1];
  return String(endLoc.building || endLoc.buildingId || tail?.buildingId || '');
}

/** First non-empty mapId from leg endpoints or path nodes so corridor vertices are not dropped in pushPt. */
export function resolvePrimaryMapId(startLoc, physicalStartLoc, endLoc, routeNodes) {
  const ids = [];
  if (startLoc?.mapId) ids.push(String(startLoc.mapId).trim());
  if (physicalStartLoc?.mapId) ids.push(String(physicalStartLoc.mapId).trim());
  if (endLoc?.mapId) ids.push(String(endLoc.mapId).trim());
  if (Array.isArray(routeNodes)) {
    for (const n of routeNodes) {
      if (n?.mapId) ids.push(String(n.mapId).trim());
    }
  }
  return ids.find(Boolean) || null;
}

/** In normalized map coords (e.g. 0–1000): pins this close are treated as the same vertex. */
const PIN_SNAP_EPS = 0.75;

function dist2D(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.hypot(dx, dy);
}

/**
 * Append one pathfinding leg (startLoc → endLoc on the same map image) into rawPoints.
 * @param {object} [physicalStartLoc] - When routing from a linked door, include that pin before the corridor snap when it differs.
 */
export function appendLegPoints(rawPoints, startLoc, endLoc, detailed, physicalStartLoc) {
  const routeNodes = Array.isArray(detailed?.path) ? detailed.path : [];
  const startForXY = physicalStartLoc || startLoc;
  const routeStartXY =
    detailed?.startAnchor && Number.isFinite(Number(detailed.startAnchor.x))
      ? { x: Number(detailed.startAnchor.x), y: Number(detailed.startAnchor.y) }
      : {
          x: Number(startForXY.x),
          y: Number(startForXY.y)
        };
  const routeEndXY =
    detailed?.endAnchor && Number.isFinite(Number(detailed.endAnchor.x))
      ? { x: Number(detailed.endAnchor.x), y: Number(detailed.endAnchor.y) }
      : {
          x: Number(endLoc.x),
          y: Number(endLoc.y)
        };

  const mapA = resolvePrimaryMapId(startLoc, physicalStartLoc, endLoc, routeNodes);
  const pushPt = (x, y, mapId, floor, buildingId) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !mapId) return;
    const last = rawPoints[rawPoints.length - 1];
    if (last && last.mapId === mapId && last.x === x && last.y === y) {
      return;
    }
    rawPoints.push({
      x,
      y,
      mapId,
      floor: floor ?? null,
      buildingId: String(buildingId || '')
    });
  };

  const firstOnPath =
    routeNodes.length > 0
      ? { x: Number(routeNodes[0].x), y: Number(routeNodes[0].y) }
      : null;
  const logicalStart = { x: Number(startForXY.x), y: Number(startForXY.y) };
  const startIsDoor = physicalStartLoc && physicalStartLoc.kind === 'door';

  if (
    startIsDoor &&
    firstOnPath &&
    dist2D(logicalStart, firstOnPath) > PIN_SNAP_EPS
  ) {
    pushPt(
      logicalStart.x,
      logicalStart.y,
      mapA,
      startForXY.floor ?? startLoc.floor ?? routeNodes[0]?.floor ?? null,
      startForXY.building ||
        startForXY.buildingId ||
        startLoc.building ||
        startLoc.buildingId ||
        routeNodes[0]?.buildingId
    );
  }

  pushPt(
    routeStartXY.x,
    routeStartXY.y,
    mapA,
    startForXY.floor ?? startLoc.floor ?? routeNodes[0]?.floor ?? null,
    startForXY.building ||
      startForXY.buildingId ||
      startLoc.building ||
      startLoc.buildingId ||
      routeNodes[0]?.buildingId
  );

  routeNodes.forEach((n) => {
    pushPt(
      Number(n.x),
      Number(n.y),
      n.mapId || mapA,
      n.floor ?? startLoc.floor ?? null,
      n.buildingId
    );
  });

  const endIsDoor = endLoc && endLoc.kind === 'door';
  const lastAfterNodes = rawPoints[rawPoints.length - 1];
  const logicalEnd = { x: Number(endLoc.x), y: Number(endLoc.y) };

  if (endIsDoor && lastAfterNodes) {
    if (dist2D(logicalEnd, { x: lastAfterNodes.x, y: lastAfterNodes.y }) > PIN_SNAP_EPS) {
      pushPt(
        logicalEnd.x,
        logicalEnd.y,
        endLoc.mapId || routeNodes[routeNodes.length - 1]?.mapId || mapA,
        endLoc.floor ?? routeNodes[routeNodes.length - 1]?.floor ?? null,
        endLocationBuildingId(endLoc, routeNodes)
      );
    }
  } else {
    pushPt(
      routeEndXY.x,
      routeEndXY.y,
      endLoc.mapId || routeNodes[routeNodes.length - 1]?.mapId || mapA,
      endLoc.floor ?? routeNodes[routeNodes.length - 1]?.floor ?? null,
      endLocationBuildingId(endLoc, routeNodes)
    );
  }
}

export function rawPointsToSegments(rawPoints) {
  const segments = [];
  for (const p of rawPoints) {
    const current = segments[segments.length - 1];
    const point = { x: p.x, y: p.y };
    if (!current || current.mapId !== p.mapId) {
      segments.push({
        mapId: p.mapId,
        floor: p.floor ?? null,
        buildingId: p.buildingId || null,
        points: [point]
      });
      continue;
    }
    const prev = current.points[current.points.length - 1];
    if (!prev || prev.x !== point.x || prev.y !== point.y) {
      current.points.push(point);
    }
  }
  return segments.filter((s) => s.points.length >= 1);
}
