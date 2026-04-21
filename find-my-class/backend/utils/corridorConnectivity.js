import { buildCorridorWalkGraph } from '../services/corridorWalkGraph.js';

/** Same defaults as pathfindingService.tryCorridorPathfinding graph build. */
const ROUTING_GRAPH_OPTS = {
  crossCorridorEndpointMergeMax: 10,
  mergeCoincidentMax: 4
};

function countComponents(adjacencyMap) {
  if (!adjacencyMap?.size) return 0;
  const visited = new Set();
  let components = 0;
  for (const start of adjacencyMap.keys()) {
    if (visited.has(start)) continue;
    components += 1;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const u = stack.pop();
      for (const e of adjacencyMap.get(u) || []) {
        if (!visited.has(e.to)) {
          visited.add(e.to);
          stack.push(e.to);
        }
      }
    }
  }
  return components;
}

/**
 * @param {object[]} corridors - NavigationLocation lean docs, kind corridor
 * @param {object} [graphOpts] - passed to buildCorridorWalkGraph
 * @returns {{
 *   chainCount: number,
 *   vertexCount: number,
 *   segmentCount: number,
 *   componentCount: number,
 *   connected: boolean,
 *   chainNames: string[],
 *   mergeUsed: object,
 *   whatToDoNext: string[]
 * }}
 */
/**
 * One representative {x,y} map coordinate per connected corridor component (same graph rules as routing).
 * Used to test whether a room pin can reach at least one walkable corridor island.
 */
export function corridorComponentRepresentatives(corridors, graphOpts = ROUTING_GRAPH_OPTS) {
  const list = Array.isArray(corridors) ? corridors : [];
  const validChains = list.filter(
    (c) => Array.isArray(c.corridorPoints) && c.corridorPoints.length >= 2
  );
  if (!validChains.length) return [];
  const { adjacencyMap, nodeMap } = buildCorridorWalkGraph(validChains, graphOpts);
  if (!adjacencyMap.size) return [];
  const visited = new Set();
  const reps = [];
  for (const start of adjacencyMap.keys()) {
    if (visited.has(start)) continue;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const u = stack.pop();
      for (const e of adjacencyMap.get(u) || []) {
        if (!visited.has(e.to)) {
          visited.add(e.to);
          stack.push(e.to);
        }
      }
    }
    const pos = nodeMap.get(start);
    if (pos && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y))) {
      reps.push({ x: Number(pos.x), y: Number(pos.y) });
    }
  }
  return reps;
}

export function analyzeCorridorConnectivity(corridors, graphOpts = ROUTING_GRAPH_OPTS) {
  const list = Array.isArray(corridors) ? corridors : [];
  const validChains = list.filter(
    (c) => Array.isArray(c.corridorPoints) && c.corridorPoints.length >= 2
  );
  const chainNames = validChains.map((c) => c.name || 'Unnamed corridor').filter(Boolean);

  const { adjacencyMap, segments } = buildCorridorWalkGraph(validChains, graphOpts);
  const vertexCount = adjacencyMap.size;
  const segmentCount = segments.length;
  const componentCount = countComponents(adjacencyMap);
  const connected = vertexCount === 0 ? false : componentCount <= 1;

  const whatToDoNext = [];

  if (validChains.length === 0) {
    whatToDoNext.push(
      'Add at least one corridor: on the map admin, choose Corridor, click along the hallway (2+ points), and save.'
    );
    return {
      chainCount: 0,
      vertexCount: 0,
      segmentCount: 0,
      componentCount: 0,
      connected: false,
      chainNames: [],
      mergeUsed: graphOpts,
      whatToDoNext
    };
  }

  if (componentCount <= 1) {
    whatToDoNext.push(
      'Corridor graph is connected with current routing rules. You can draw routes between rooms that snap to these lines.'
    );
    whatToDoNext.push(
      'Optional: add Door pins at thresholds (linked to each room) so paths start/end at doorways.'
    );
  } else {
    whatToDoNext.push(
      `Found ${componentCount} separate walkable pieces. They must connect into one network for cross-room routing.`
    );
    whatToDoNext.push(
      'Fix: extend a polyline so its end sits on another corridor’s corner, or add a short connecting segment.'
    );
    whatToDoNext.push(
      `Endpoints of different orange lines should meet within about ${graphOpts.mergeCoincidentMax ?? 4} map units (same corner), or both ends within about ${graphOpts.crossCorridorEndpointMergeMax ?? 10} units when joining two open chains endpoint-to-endpoint.`
    );
    whatToDoNext.push(
      'Easiest: redraw as one continuous corridor along the whole hallway (many clicks, one save).'
    );
  }

  return {
    chainCount: validChains.length,
    vertexCount,
    segmentCount,
    componentCount,
    connected,
    chainNames,
    mergeUsed: {
      mergeCoincidentMax: graphOpts.mergeCoincidentMax ?? 4,
      crossCorridorEndpointMergeMax: graphOpts.crossCorridorEndpointMergeMax ?? 10
    },
    whatToDoNext
  };
}
