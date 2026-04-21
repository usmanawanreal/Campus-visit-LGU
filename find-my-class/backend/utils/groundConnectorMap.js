/**
 * When two places share a floor-plan `mapId` but belong to different buildings, routing may need
 * to leave that image at stairs, cross the **ground** floor plan, then re-enter the same floor image
 * in the other building. This returns the ground-floor `mapId` used as the connector, or null.
 */
export function groundConnectorMapIdFor(floorPlanMapKey) {
  const k = String(floorPlanMapKey || '').trim();
  if (!k || k === 'floor-ground' || k === 'main-campus' || k === 'complex-upper') return null;
  if (!k.startsWith('floor-')) return null;
  return 'floor-ground';
}

/** First corridor polyline vertex on a map — used only as a fixed graph target for reachability checks. */
export function firstCorridorAnchor(corridors) {
  if (!Array.isArray(corridors)) return null;
  for (const c of corridors) {
    const pts = c.corridorPoints;
    if (Array.isArray(pts) && pts.length) {
      const p = pts[0];
      const x = Number(p.x);
      const y = Number(p.y);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
  }
  return null;
}
