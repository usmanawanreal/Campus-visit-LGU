/** PNG filenames live in `public/assets/maps/`. Same pixel size for all current plans. */
const MAP_W = 15360;
const MAP_H = 8640;
const NORM_X = 1000;
const NORM_Y = 1000;

/** Map ids that represent a single building floor (one image at a time in the viewer). */
export const FLOOR_PLAN_MAP_IDS = new Set([
  'floor-basement-2',
  'floor-basement-1',
  'floor-ground',
  'floor-first',
  'floor-second',
  'floor-third'
]);

const FLOOR_INDEX_TO_MAP_ID = {
  '-2': 'floor-basement-2',
  '-1': 'floor-basement-1',
  '0': 'floor-ground',
  '1': 'floor-first',
  '2': 'floor-second',
  '3': 'floor-third'
};

const MAP_ID_TO_FLOOR_KEY = {
  'floor-basement-2': '-2',
  'floor-basement-1': '-1',
  'floor-ground': '0',
  'floor-first': '1',
  'floor-second': '2',
  'floor-third': '3'
};

function mapAsset(filename) {
  return `/assets/maps/${encodeURIComponent(filename)}`;
}

/** Floor index (number or string) → campusMaps `id` for that floor plan. */
export function floorNumberToMapId(floor) {
  const n = Number(floor);
  if (Number.isNaN(n)) return '';
  return FLOOR_INDEX_TO_MAP_ID[String(n)] || '';
}

/** Floor plan map id → floor filter dropdown value (string), or `null` for site / overview maps. */
export function mapIdToFloorFilterValue(mapId) {
  if (!mapId || !MAP_ID_TO_FLOOR_KEY[mapId]) return null;
  return MAP_ID_TO_FLOOR_KEY[mapId];
}

export function isFloorPlanMapId(mapId) {
  return Boolean(mapId && FLOOR_PLAN_MAP_IDS.has(mapId));
}

export const campusMaps = [
  {
    id: 'main-campus',
    label: 'Site layout',
    imageUrl: mapAsset('Site layout plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'complex-upper',
    label: 'Complex (upper view)',
    imageUrl: mapAsset('LGU Complete Complex PLAN-Model 8th map uuper.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-basement-2',
    label: 'Basement 2',
    imageUrl: mapAsset('Basement-2 floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-basement-1',
    label: 'Basement 1',
    imageUrl: mapAsset('Basement-1 floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-ground',
    label: 'Ground floor',
    imageUrl: mapAsset('Ground Floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-first',
    label: 'First floor',
    imageUrl: mapAsset('First Floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-second',
    label: 'Second floor',
    imageUrl: mapAsset('Second floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  },
  {
    id: 'floor-third',
    label: 'Third floor',
    imageUrl: mapAsset('Third floor plan existing.png'),
    width: MAP_W,
    height: MAP_H,
    coordinateMaxX: NORM_X,
    coordinateMaxY: NORM_Y
  }
];
