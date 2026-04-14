import { COMPOSITE_KEY_SEPARATOR } from './navigationAdjacency.config.js';

function euclidean(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build a stable composite key for the adjacency config file.
 * @param {string} mapId
 * @param {string} nodeName
 * @returns {string}
 */
export function compositeKey(mapId, nodeName) {
  return `${String(mapId).trim()}${COMPOSITE_KEY_SEPARATOR}${String(nodeName).trim()}`;
}

/**
 * Map composite key → MongoDB node _id string for the given node list.
 * @param {Array<{ _id: unknown, mapId?: string, name?: string }>} nodes
 * @returns {Map<string, string>}
 */
export function indexNodesByCompositeKey(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const id = String(node._id ?? '');
    const mid = node.mapId != null ? String(node.mapId).trim() : '';
    const name = node.name != null ? String(node.name).trim() : '';
    if (!id || !mid || !name) continue;
    map.set(compositeKey(mid, name), id);
  }
  return map;
}

/**
 * Add or replace neighbor edge keeping the smaller distance if duplicate `to`.
 * @param {Record<string, Array<{ to: string, distance: number }>>} adj
 * @param {string} fromId
 * @param {string} toId
 * @param {number} distance
 */
function addBidirectional(adj, fromId, toId, distance) {
  if (!fromId || !toId || fromId === toId) return;
  const d = Number(distance);
  if (Number.isNaN(d) || d < 0) return;

  if (!adj[fromId]) adj[fromId] = [];
  if (!adj[toId]) adj[toId] = [];

  const pushOrMin = (list, to, dist) => {
    const i = list.findIndex((e) => e.to === to);
    if (i === -1) list.push({ to, distance: dist });
    else if (dist < list[i].distance) list[i].distance = dist;
  };

  pushOrMin(adj[fromId], toId, d);
  pushOrMin(adj[toId], fromId, d);
}

/**
 * Turn RAW_ADJACENCY (composite keys) into Mongo id-keyed adjacency with Euclidean edge weights.
 * @param {Array<{ _id: unknown, mapId?: string, name?: string, x: number, y: number }>} nodes
 * @param {Record<string, string[]>} rawAdjacency
 * @returns {Record<string, Array<{ to: string, distance: number }>>}
 */
export function buildAdjacencyFromRaw(nodes, rawAdjacency) {
  const keyToId = indexNodesByCompositeKey(nodes);
  const byId = new Map(nodes.map((n) => [String(n._id), n]));

  /** @type {Record<string, Array<{ to: string, distance: number }>>} */
  const adj = {};
  for (const n of nodes) {
    adj[String(n._id)] = [];
  }

  if (!rawAdjacency || typeof rawAdjacency !== 'object') return adj;

  for (const [fromKey, neighborKeys] of Object.entries(rawAdjacency)) {
    const fromId = keyToId.get(fromKey);
    const fromNode = fromId ? byId.get(fromId) : null;
    if (!fromNode || !Array.isArray(neighborKeys)) continue;

    for (const toKey of neighborKeys) {
      const toId = keyToId.get(toKey);
      const toNode = toId ? byId.get(toId) : null;
      if (!toNode) continue;
      const dist = euclidean(fromNode, toNode);
      addBidirectional(adj, fromId, toId, dist);
    }
  }

  return adj;
}

/**
 * Merge two adjacency objects (Mongo id keys). Duplicate edges to the same `to` keep the minimum distance.
 * @param {Record<string, Array<{ to: string, distance: number }>>} a
 * @param {Record<string, Array<{ to: string, distance: number }>>} b
 * @returns {Record<string, Array<{ to: string, distance: number }>>}
 */
export function mergeAdjacencyObjects(a, b) {
  /** @type {Record<string, Array<{ to: string, distance: number }>>} */
  const out = {};
  const allIds = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const id of allIds) {
    out[id] = [];
  }

  const ingest = (src) => {
    if (!src) return;
    for (const [id, list] of Object.entries(src)) {
      if (!out[id]) out[id] = [];
      for (const { to, distance } of list || []) {
        addBidirectional(out, id, to, distance);
      }
    }
  };

  ingest(a);
  ingest(b);
  return out;
}

/**
 * Attach `neighbors` (array of { id, name?, distance }) to each node for APIs / debugging.
 * @param {Array<{ _id: unknown, name?: string }>} nodes
 * @param {Map<string, Array<{ to: string, distance: number }>>} adjacencyMap
 * @returns {Array<Record<string, unknown>>}
 */
export function attachNeighborsToNodes(nodes, adjacencyMap) {
  const byId = new Map(nodes.map((n) => [String(n._id), n]));
  return nodes.map((n) => {
    const id = String(n._id);
    const raw = adjacencyMap.get(id) || [];
    const neighbors = raw.map(({ to, distance }) => ({
      id: to,
      name: byId.get(to)?.name,
      distance
    }));
    return { ...n, neighbors };
  });
}
