/**
 * When routing to a room/place, prefer ending at a linked door (exact coordinates)
 * instead of a footprint wall snap. Picks the door with the shortest successful graph path.
 */

export function routingPathNodeCount(detailed) {
  const p = detailed?.path;
  return Array.isArray(p) ? p.length : 0;
}

function pathLen(detailed) {
  return routingPathNodeCount(detailed);
}

/** Sum of Euclidean segments along the returned path (corridor graph geometry). */
function corridorPolylineLength(detailed) {
  const p = detailed?.path;
  if (!Array.isArray(p) || p.length < 2) return Infinity;
  let sum = 0;
  for (let i = 1; i < p.length; i++) {
    const ax = Number(p[i - 1].x);
    const ay = Number(p[i - 1].y);
    const bx = Number(p[i].x);
    const by = Number(p[i].y);
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    sum += Math.hypot(bx - ax, by - ay);
  }
  return sum;
}

/**
 * Lower is better. Corridor routes use true path length so a few long hops cannot beat
 * many short steps along hallways (hop-count scoring was picking graph shortcuts).
 */
function detailedRoutingScore(detailed, startDoorUsed, endDoorUsed) {
  if (pathLen(detailed) < 2) return Infinity;
  const preferDoor = 8;
  const doorAdj =
    (startDoorUsed ? 0 : preferDoor) + (endDoorUsed ? 0 : preferDoor);

  if (detailed.routingGraph === 'corridor') {
    return corridorPolylineLength(detailed) + doorAdj;
  }

  return pathLen(detailed) + (startDoorUsed ? 0 : 0.12) + (endDoorUsed ? 0 : 0.12);
}

/**
 * Prefer routes that use linked doors when the hop count is similar (bias toward door-to-corridor).
 *
 * @param {object} fromLoc - logical start (hydrated nav location)
 * @param {object} toLoc - logical end
 * @param {object[]} startDoors - doors with linksToLocation === fromLoc._id
 * @param {object[]} endDoors - doors with linksToLocation === toLoc._id
 * @param {(a: object, b: object) => Promise<object>} runDetailedForPair
 * @param {{ earlyExitOnFirstSuccess?: boolean, omitDirectFromTo?: boolean }} [options] - When true, return as soon as any candidate yields a path (iteration order); skips comparing remaining doors/legs. Used for cross-floor inner legs to avoid combinatorial slowdown. `omitDirectFromTo`: skip the initial from→to attempt (caller already tried it).
 * @returns {Promise<{ detailed: object, physicalStart: object, physicalEnd: object, startDoorUsed: object|null, endDoorUsed: object|null }>}
 */
export async function pickBestRouteWithOptionalDoors(
  fromLoc,
  toLoc,
  startDoors,
  endDoors,
  runDetailedForPair,
  options = {}
) {
  const sList = Array.isArray(startDoors) ? startDoors : [];
  const eList = Array.isArray(endDoors) ? endDoors : [];
  const earlyExitOnFirstSuccess = Boolean(options.earlyExitOnFirstSuccess);
  const omitDirectFromTo = Boolean(options.omitDirectFromTo);

  let best = null;
  let bestScore = Infinity;

  const consider = async (from, to, startDoorUsed, endDoorUsed) => {
    const detailed = await runDetailedForPair(from, to);
    if (pathLen(detailed) < 2) return false;
    const score = detailedRoutingScore(detailed, startDoorUsed, endDoorUsed);
    if (score < bestScore) {
      bestScore = score;
      best = {
        detailed,
        physicalStart: startDoorUsed || fromLoc,
        physicalEnd: endDoorUsed || toLoc,
        startDoorUsed,
        endDoorUsed
      };
    }
    return true;
  };

  const steps = [];
  if (!omitDirectFromTo) {
    steps.push(() => consider(fromLoc, toLoc, null, null));
  }
  for (const ed of eList) {
    steps.push(() => consider(fromLoc, ed, null, ed));
  }
  for (const sd of sList) {
    steps.push(() => consider(sd, toLoc, sd, null));
    for (const ed of eList) {
      steps.push(() => consider(sd, ed, sd, ed));
    }
  }

  for (const step of steps) {
    const ok = await step();
    if (earlyExitOnFirstSuccess && ok && best) {
      return best;
    }
  }

  if (best) {
    return best;
  }

  const detailed = await runDetailedForPair(fromLoc, toLoc);
  return {
    detailed,
    physicalStart: fromLoc,
    physicalEnd: toLoc,
    startDoorUsed: null,
    endDoorUsed: null
  };
}

/**
 * @param {object} fromLoc - start of this leg (hydrated nav location)
 * @param {object} logicalEnd - user-selected destination (point/corridor; not used when door wins)
 * @param {object[]} doorDocs - hydrated NavigationLocation docs with kind 'door'
 * @param {(a: object, b: object) => Promise<object>} runDetailedForPair
 * @returns {Promise<{ detailed: object, physicalEnd: object, doorUsed: object|null }>}
 */
export async function pickBestDoorEndpointOrFallback(fromLoc, logicalEnd, doorDocs, runDetailedForPair) {
  const r = await pickBestRouteWithOptionalDoors(fromLoc, logicalEnd, [], doorDocs, runDetailedForPair);
  return {
    detailed: r.detailed,
    physicalEnd: r.physicalEnd,
    doorUsed: r.endDoorUsed
  };
}
