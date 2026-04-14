/**
 * Euclidean distance heuristic between two graph nodes.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
export function euclideanHeuristic(a, b) {
  if (!a || !b) return Infinity;
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let cursor = current;
  while (cameFrom.has(cursor)) {
    cursor = cameFrom.get(cursor);
    path.push(cursor);
  }
  return path.reverse();
}

function getLowestFScore(openSet, fScore) {
  let bestNode = null;
  let bestValue = Infinity;
  for (const nodeId of openSet) {
    const score = fScore.get(nodeId) ?? Infinity;
    if (score < bestValue) {
      bestValue = score;
      bestNode = nodeId;
    }
  }
  return bestNode;
}

/**
 * A* shortest-path algorithm on adjacency graph.
 * @param {Map<string, Array<{to:string,distance:number}>>} adjacencyMap
 * @param {Map<string, {x:number,y:number}>} nodeMap
 * @param {string} startNodeId
 * @param {string} endNodeId
 * @returns {string[] | null} Ordered node ids or null
 */
export function aStarShortestPath(adjacencyMap, nodeMap, startNodeId, endNodeId) {
  const start = String(startNodeId);
  const goal = String(endNodeId);
  if (start === goal) return [start];
  if (!nodeMap.has(start) || !nodeMap.has(goal)) return null;

  const openSet = new Set([start]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(start, 0);
  fScore.set(start, euclideanHeuristic(nodeMap.get(start), nodeMap.get(goal)));

  while (openSet.size > 0) {
    const current = getLowestFScore(openSet, fScore);
    if (!current) break;
    if (current === goal) return reconstructPath(cameFrom, current);

    openSet.delete(current);
    const neighbors = adjacencyMap.get(current) || [];

    for (const { to, distance } of neighbors) {
      const tentativeG = (gScore.get(current) ?? Infinity) + Number(distance);
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tentativeG);
        const h = euclideanHeuristic(nodeMap.get(to), nodeMap.get(goal));
        fScore.set(to, tentativeG + h);
        openSet.add(to);
      }
    }
  }

  return null;
}

