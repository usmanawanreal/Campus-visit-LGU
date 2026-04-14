import Location from '../models/Location.js';
import { createError } from '../utils/errors.js';

export const list = async (req, res) => {
  const { buildingId, floor, type } = req.query;
  const filter = {};
  if (buildingId) filter.buildingId = buildingId;
  if (floor !== undefined) filter.floor = Number(floor);
  if (type) filter.type = type;
  const locations = await Location.find(filter)
    .populate('buildingId', 'name description floors')
    .populate('nodeId', 'name floor x y type')
    .sort({ name: 1 })
    .lean();
  res.json(locations);
};

export const search = async (req, res) => {
  const q = req.query?.q;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json([]);
  }
  const re = new RegExp(q.trim(), 'i');
  const locations = await Location.find({ name: re })
    .populate('buildingId', 'name description floors')
    .populate('nodeId', 'name floor x y type')
    .limit(20)
    .lean();
  res.json(locations);
};

export const create = async (req, res) => {
  const location = await Location.create(req.body);
  const populated = await Location.findById(location._id)
    .populate('buildingId', 'name description floors')
    .populate('nodeId', 'name floor x y type');
  res.status(201).json(populated);
};

export const remove = async (req, res) => {
  const location = await Location.findByIdAndDelete(req.params.id);
  if (!location) throw createError('Location not found', 404);
  res.json({ message: 'Location deleted' });
};
