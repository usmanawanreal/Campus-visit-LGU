/**
 * Build a reusable JSON graph for campus navigation/pathfinding.
 *
 * Output shape:
 * {
 *   nodes: { [nodeId]: { x, y } },
 *   edges: [{ from, to, distance }],
 *   adjacency: { [nodeId]: [{ to, distance }] }
 * }
 */
export function buildNavigationGraph(nodes = [], edges = []) {
  const graph = {
    nodes: {},
    edges: [],
    adjacency: {}
  };

  for (const node of nodes) {
    const id = String(node._id ?? node.id);
    if (!id) continue;
    graph.nodes[id] = {
      x: Number(node.x),
      y: Number(node.y)
    };
    if (!graph.adjacency[id]) graph.adjacency[id] = [];
  }

  for (const edge of edges) {
    const from = String(edge.fromNode ?? edge.from);
    const to = String(edge.toNode ?? edge.to);
    const distance = Number(edge.distance);
    if (!from || !to || Number.isNaN(distance)) continue;

    graph.edges.push({ from, to, distance });

    if (!graph.adjacency[from]) graph.adjacency[from] = [];
    if (!graph.adjacency[to]) graph.adjacency[to] = [];

    // Undirected connections for bidirectional movement.
    graph.adjacency[from].push({ to, distance });
    graph.adjacency[to].push({ to: from, distance });
  }

  return graph;
}

export function graphToAdjacencyMap(graph) {
  const adjacencyMap = new Map();
  Object.entries(graph.adjacency || {}).forEach(([nodeId, neighbors]) => {
    adjacencyMap.set(nodeId, neighbors);
  });
  return adjacencyMap;
}

