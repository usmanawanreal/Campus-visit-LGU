/**
 * Manual navigation graph (adjacency list) for pathfinding.
 *
 * Format: composite key → list of neighbor composite keys (undirected edges are
 * implied once: each connection is stored both ways when you run the builder).
 *
 * Composite key: `${mapId}${SEP}${nodeName}`
 * - `mapId` must match Node.mapId in MongoDB (e.g. floor-first, main-campus).
 * - `nodeName` must match Node.name exactly (trimmed on lookup).
 *
 * Example (uncomment / adapt after you create nodes with these names):
 *
 * import { compositeKey } from './buildAdjacencyFromConfig.js';
 * export const RAW_ADJACENCY = {
 *   [compositeKey('floor-first', 'Entrance')]: [
 *     compositeKey('floor-first', 'Hall A1'),
 *     compositeKey('floor-first', 'Stairs 1')
 *   ],
 *   [compositeKey('floor-first', 'Hall A1')]: [compositeKey('floor-first', 'Entrance')]
 * };
 *
 * Scaling: split by map in multiple files and Object.assign, or generate this from a spreadsheet.
 */

/** Separator between mapId and node name (avoid `|` in map ids or names). */
export const COMPOSITE_KEY_SEPARATOR = '|';

/**
 * Adjacency list using composite keys. Empty = rely only on MongoDB Edge collection.
 * @type {Record<string, string[]>}
 */
export const RAW_ADJACENCY = {};
