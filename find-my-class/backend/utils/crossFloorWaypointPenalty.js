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
