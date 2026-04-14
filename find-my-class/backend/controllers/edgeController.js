import Edge from '../models/Edge.js';
import { createError } from '../utils/errors.js';

export const getById = async (req, res) => {
  const edge = await Edge.findById(req.params.id)
    .populate('fromNode', 'name floor x y type buildingId mapId')
    .populate('toNode', 'name floor x y type buildingId mapId')
    .lean();
  if (!edge) throw createError('Edge not found', 404);
  res.json(edge);
};

export const list = async (req, res) => {
  const { fromNode, toNode } = req.query;
  const filter = {};
  if (fromNode) filter.fromNode = fromNode;
  if (toNode) filter.toNode = toNode;
  const edges = await Edge.find(filter)
    .populate('fromNode', 'name floor x y type buildingId')
    .populate('toNode', 'name floor x y type buildingId')
    .sort({ fromNode: 1, toNode: 1 })
    .lean();
  res.json(edges);
};

export const create = async (req, res) => {
  const edge = await Edge.create(req.body);
  const populated = await Edge.findById(edge._id)
    .populate('fromNode', 'name floor x y type buildingId')
    .populate('toNode', 'name floor x y type buildingId');
  res.status(201).json(populated);
};

export const update = async (req, res) => {
  const fromNode = req.body.fromNode;
  const toNode = req.body.toNode;
  if (String(fromNode) === String(toNode)) {
    throw createError('From and to nodes must be different', 400);
  }
  const payload = {
    fromNode,
    toNode,
    distance: Number(req.body.distance)
  };
  const edge = await Edge.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  })
    .populate('fromNode', 'name floor x y type buildingId')
    .populate('toNode', 'name floor x y type buildingId');
  if (!edge) throw createError('Edge not found', 404);
  res.json(edge);
};

export const remove = async (req, res) => {
  const edge = await Edge.findByIdAndDelete(req.params.id);
  if (!edge) throw createError('Edge not found', 404);
  res.json({ message: 'Edge deleted' });
};
