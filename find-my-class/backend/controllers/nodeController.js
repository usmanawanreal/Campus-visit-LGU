import Node from '../models/Node.js';
import { createError } from '../utils/errors.js';

export const list = async (req, res) => {
  const { buildingId, floor, type, mapId } = req.query;
  const filter = {};
  if (buildingId) filter.buildingId = buildingId;
  if (mapId !== undefined && String(mapId).trim() !== '') filter.mapId = String(mapId).trim();
  if (floor !== undefined && req.query.floor !== '') filter.floor = Number(floor);
  if (type) filter.type = type;
  const nodes = await Node.find(filter)
    .populate('buildingId', 'name description floors')
    .sort({ buildingId: 1, floor: 1, name: 1 })
    .lean();
  res.json(nodes);
};

export const getById = async (req, res) => {
  const node = await Node.findById(req.params.id)
    .populate('buildingId', 'name description floors')
    .lean();
  if (!node) throw createError('Node not found', 404);
  res.json(node);
};

export const create = async (req, res) => {
  const node = await Node.create(req.body);
  const populated = await Node.findById(node._id).populate('buildingId', 'name description floors');
  res.status(201).json(populated);
};

export const update = async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    buildingId: req.body.buildingId,
    mapId: String(req.body.mapId || '').trim(),
    floor: Number(req.body.floor),
    x: Number(req.body.x),
    y: Number(req.body.y),
    type: String(req.body.type || '')
  };
  const node = await Node.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  }).populate('buildingId', 'name description floors');
  if (!node) throw createError('Node not found', 404);
  res.json(node);
};

export const remove = async (req, res) => {
  const node = await Node.findByIdAndDelete(req.params.id);
  if (!node) throw createError('Node not found', 404);
  res.json({ message: 'Node deleted' });
};
