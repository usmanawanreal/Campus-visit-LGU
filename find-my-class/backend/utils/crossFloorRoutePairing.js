import { pickBestRouteWithOptionalDoors, routingPathNodeCount } from './doorRouting.js';
import { crossFloorWaypointPairPenalty } from './crossFloorWaypointPenalty.js';

/** Hard time-limit for cross-floor pair search (ms). Prevents browser/proxy timeouts. */
const CROSS_FLOOR_SEARCH_TIME_LIMIT_MS =
  Number(process.env.CROSS_FLOOR_SEARCH_TIME_LIMIT_MS) > 0
    ? Number(process.env.CROSS_FLOOR_SEARCH_TIME_LIMIT_MS)
    : 45000;

/**
 * Pair start-floor waypoints with destination-floor waypoints and pick a feasible two-leg route.
 * Computes start→ws only once per ws (not once per (ws, we) pair).
 *
 * Includes an elapsed-time guard so the search returns the best result found so
 * far instead of hanging until the browser kills the request.
 *
 * @param {object} p
 * @param {object[]} p.rankedStart
 * @param {object[]} p.rankedEnd
 * @param {object} p.endLocation - hydrated destination
 * @param {object[]} p.linkedDoorsEnd
 * @param {(ws: object) => Promise<object>} p.runDetailedFromStartToWs
 * @param {(from: object, to: object) => Promise<object>} p.runDetailedOnEndFloor
 * @param {boolean} p.searchAllCrossFloorPairs
 * @returns {Promise<{ best: object|null, bestScore: number }>}
 */
export async function searchBestCrossFloorPair({
  rankedStart,
  rankedEnd,
  endLocation,
  linkedDoorsEnd,
  runDetailedFromStartToWs,
  runDetailedOnEndFloor,
  searchAllCrossFloorPairs
}) {
  let best = null;
  let bestScore = Infinity;
  const runEndLeg = (from, to) => runDetailedOnEndFloor(from, to);
  /** Second leg depends only on `we` and destination — reuse across all start waypoints `ws`. */
  const leg2ByWaypointKey = new Map();

  const searchStart = Date.now();

  outerCrossFloor: for (const ws of rankedStart) {
    /* ── Timeout guard: return best-so-far instead of hanging ── */
    if (Date.now() - searchStart > CROSS_FLOOR_SEARCH_TIME_LIMIT_MS) {
      break;
    }

    const d1 = await runDetailedFromStartToWs(ws);
    const l1 = d1?.path?.length ?? 0;
    if (l1 < 2) continue;

    for (const we of rankedEnd) {
      /* Check timeout inside the inner loop too */
      if (Date.now() - searchStart > CROSS_FLOOR_SEARCH_TIME_LIMIT_MS) {
        break outerCrossFloor;
      }

      const weKey = we?._id != null ? String(we._id) : `xy:${Number(we?.x)},${Number(we?.y)}`;
      let cached = leg2ByWaypointKey.get(weKey);
      if (!cached) {
        // One cheap leg first: stair/elevator pin → destination room. If it works, skip enumerating
        // every linked door (each door can trigger a full corridor A* on large floors).
        const d2Direct = await runEndLeg(we, endLocation);
        let leg2;
        if (routingPathNodeCount(d2Direct) >= 2) {
          leg2 = {
            detailed: d2Direct,
            physicalStart: we,
            physicalEnd: endLocation,
            startDoorUsed: null,
            endDoorUsed: null
          };
        } else {
          leg2 = await pickBestRouteWithOptionalDoors(
            we,
            endLocation,
            [],
            linkedDoorsEnd,
            runEndLeg,
            { earlyExitOnFirstSuccess: true, omitDirectFromTo: true }
          );
        }
        const l2c = routingPathNodeCount(leg2.detailed);
        cached = { leg2, l2: l2c };
        leg2ByWaypointKey.set(weKey, cached);
      }
      const { leg2, l2 } = cached;
      if (l2 < 2) continue;
      const score = l1 + l2 + crossFloorWaypointPairPenalty(ws.name, we.name);
      if (score < bestScore) {
        bestScore = score;
        best = {
          wStart: ws,
          wEnd: we,
          d1,
          d2: leg2.detailed,
          leg2PhysicalEnd: leg2.physicalEnd,
          doorUsed: leg2.endDoorUsed
        };
      }
      if (!searchAllCrossFloorPairs && best) {
        break outerCrossFloor;
      }
    }
  }

  return { best, bestScore };
}
