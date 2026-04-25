/**
 * Prefer stair-like transition points when pairing cross-floor waypoints.
 * Lower penalty = more preferred. Added to path-length score (lower total wins).
 */
export function crossFloorWaypointNamePenalty(name) {
  const n = String(name ?? '').toLowerCase();
  if (/\bstairs?\b|stairway|stairwell|steps\b/.test(n)) return 0;
  if (/\belevator|lift\b/.test(n)) return 22;
  return 55;
}

export function crossFloorWaypointPairPenalty(startWaypointName, endWaypointName) {
  return (
    crossFloorWaypointNamePenalty(startWaypointName) +
    crossFloorWaypointNamePenalty(endWaypointName)
  );
}

export function looksLikeStairsName(name) {
  const n = String(name ?? '').toLowerCase();
  return /\bstairs?\b|stairway|stairwell|steps\b/.test(n);
}

/** Stairs/elevator/escalator points used for “can leave this floor” audits. */
export function looksLikeVerticalTransitionName(name) {
  const n = String(name ?? '').toLowerCase();
  if (looksLikeStairsName(name)) return true;
  if (/\belevator|lift\b/.test(n)) return true;
  if (/\bescalator\b/.test(n)) return true;
  return false;
}

function navAnchorDistance(loc, anchorLoc) {
  const ax = Number(anchorLoc?.x);
  const ay = Number(anchorLoc?.y);
  const lx = Number(loc?.x);
  const ly = Number(loc?.y);
  if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(lx) || !Number.isFinite(ly)) {
    return 0;
  }
  return Math.hypot(lx - ax, ly - ay);
}

/**
 * Limit cross-floor pairing work: prefer stair/elevator-named waypoints, then points closest to start/end pins.
 */
export function rankCrossFloorWaypointCandidates(hydratedLocations, anchorLoc, maxPerSide = 14) {
  const max =
    Number.isFinite(maxPerSide) && maxPerSide > 0 ? Math.min(Math.floor(maxPerSide), 80) : 14;
  if (!Array.isArray(hydratedLocations)) return [];
  const scored = hydratedLocations
    .filter(Boolean)
    .map((loc) => ({
      loc,
      pen: crossFloorWaypointNamePenalty(loc?.name),
      dist: navAnchorDistance(loc, anchorLoc)
    }));
  scored.sort((a, b) => a.pen - b.pen || a.dist - b.dist);
  return scored.slice(0, max).map((s) => s.loc);
}
