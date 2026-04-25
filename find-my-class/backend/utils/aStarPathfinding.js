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

/* ── Binary min-heap keyed by f-score ── */

class MinHeap {
  constructor() {
    /** @type {{ id: string, f: number }[]} */
    this._heap = [];
    /** id → index inside _heap */
    this._idx = new Map();
  }

  get size() {
    return this._heap.length;
  }

  push(id, f) {
    const existing = this._idx.get(id);
    if (existing !== undefined) {
      // decrease-key
      if (f < this._heap[existing].f) {
        this._heap[existing].f = f;
        this._bubbleUp(existing);
      }
      return;
    }
    this._heap.push({ id, f });
    this._idx.set(id, this._heap.length - 1);
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    if (this._heap.length === 0) return null;
    const top = this._heap[0];
    this._idx.delete(top.id);
    const last = this._heap.pop();
    if (this._heap.length > 0 && last) {
      this._heap[0] = last;
      this._idx.set(last.id, 0);
      this._sinkDown(0);
    }
    return top.id;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._heap[i].f >= this._heap[parent].f) break;
      this._swap(i, parent);
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this._heap[left].f < this._heap[smallest].f) smallest = left;
      if (right < n && this._heap[right].f < this._heap[smallest].f) smallest = right;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    this._idx.set(this._heap[i].id, i);
    this._idx.set(this._heap[j].id, j);
  }
}

/**
 * A* shortest-path algorithm on adjacency graph.
 * Uses a binary min-heap for O(V log V) instead of O(V²) linear scan.
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

  const goalCoord = nodeMap.get(goal);
  const openHeap = new MinHeap();
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();

  gScore.set(start, 0);
  openHeap.push(start, euclideanHeuristic(nodeMap.get(start), goalCoord));

  while (openHeap.size > 0) {
    const current = openHeap.pop();
    if (!current) break;
    if (current === goal) return reconstructPath(cameFrom, current);

    closedSet.add(current);
    const neighbors = adjacencyMap.get(current) || [];

    for (const { to, distance } of neighbors) {
      if (closedSet.has(to)) continue;
      const tentativeG = (gScore.get(current) ?? Infinity) + Number(distance);
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tentativeG);
        const h = euclideanHeuristic(nodeMap.get(to), goalCoord);
        openHeap.push(to, tentativeG + h);
      }
    }
  }

  return null;
}
