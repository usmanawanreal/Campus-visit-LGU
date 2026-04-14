import NavigationLocation from '../models/NavigationLocation.js';
import { createError } from '../utils/errors.js';

function normalizeCorridorPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function normalizeKind(body) {
  const k = body?.kind;
  if (k === 'corridor') return 'corridor';
  if (k === 'door') return 'door';
  return 'point';
}

function normalizeLinksToLocation(body, kind) {
  if (kind !== 'door') return null;
  const id = body?.linksToLocation;
  if (id == null || id === '') return null;
  const s = String(id).trim();
  return s === '' ? null : s;
}

export const list = async (req, res) => {
  const { mapId, building, floor } = req.query;
  const filter = {};

  if (mapId) filter.mapId = mapId.trim();
  if (building) filter.building = building;
  if (floor !== undefined && floor !== '') filter.floor = Number(floor);

  const locations = await NavigationLocation.find(filter)
    .populate('building', 'name description floors')
    .populate('linksToLocation', 'name mapId floor')
    .sort({ mapId: 1, floor: 1, name: 1 })
    .lean();

  res.json({
    success: true,
    count: locations.length,
    data: locations
  });
};

export const create = async (req, res) => {
  const kind = normalizeKind(req.body);
  const corridorPoints = normalizeCorridorPoints(req.body.corridorPoints);
  if (kind === 'corridor' && corridorPoints.length < 2) {
    throw createError('Corridor requires at least 2 points', 400);
  }
  const anchor = kind === 'corridor' ? corridorPoints[0] : null;
  const footprintRaw = normalizeCorridorPoints(req.body.footprintPoints);
  const footprintPoints = kind === 'point' && footprintRaw.length >= 3 ? footprintRaw : [];
  const linksToLocation = normalizeLinksToLocation(req.body, kind);
  const payload = {
    name: req.body.name.trim(),
    mapId: req.body.mapId.trim(),
    building: req.body.building,
    kind,
    floor: Number(req.body.floor),
    x:
      kind === 'corridor'
        ? Number(anchor.x)
        : Number(req.body.x),
    y:
      kind === 'corridor'
        ? Number(anchor.y)
        : Number(req.body.y),
    corridorPoints: kind === 'corridor' ? corridorPoints : [],
    footprintPoints,
    linksToLocation: kind === 'door' ? linksToLocation : null
  };

  const created = await NavigationLocation.create(payload);
  const location = await NavigationLocation.findById(created._id)
    .populate('building', 'name description floors')
    .populate('linksToLocation', 'name mapId floor')
    .lean();

  res.status(201).json({
    success: true,
    data: location
  });
};

export const update = async (req, res) => {
  const kind = normalizeKind(req.body);
  const corridorPoints = normalizeCorridorPoints(req.body.corridorPoints);
  if (kind === 'corridor' && corridorPoints.length < 2) {
    throw createError('Corridor requires at least 2 points', 400);
  }
  const anchor = kind === 'corridor' ? corridorPoints[0] : null;
  const footprintRaw = normalizeCorridorPoints(req.body.footprintPoints);
  const footprintPoints = kind === 'point' && footprintRaw.length >= 3 ? footprintRaw : [];
  const linksToLocation = normalizeLinksToLocation(req.body, kind);
  const payload = {
    name: String(req.body.name || '').trim(),
    mapId: String(req.body.mapId || '').trim(),
    building: req.body.building,
    kind,
    floor: Number(req.body.floor),
    x:
      kind === 'corridor'
        ? Number(anchor.x)
        : Number(req.body.x),
    y:
      kind === 'corridor'
        ? Number(anchor.y)
        : Number(req.body.y),
    corridorPoints: kind === 'corridor' ? corridorPoints : [],
    footprintPoints,
    linksToLocation: kind === 'door' ? linksToLocation : null
  };
  const updated = await NavigationLocation.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  })
    .populate('building', 'name description floors')
    .populate('linksToLocation', 'name mapId floor')
    .lean();
  if (!updated) throw createError('Navigation location not found', 404);
  res.json({ success: true, data: updated });
};

export const remove = async (req, res) => {
  const removed = await NavigationLocation.findByIdAndDelete(req.params.id).lean();
  if (!removed) throw createError('Navigation location not found', 404);
  res.json({ success: true, message: 'Navigation location deleted' });
};

