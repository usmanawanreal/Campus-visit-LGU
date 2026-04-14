import Building from '../models/Building.js';
import { createError } from '../utils/errors.js';

export const list = async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search && typeof search === 'string') {
    const re = new RegExp(search.trim(), 'i');
    filter.name = re;
  }
  const buildings = await Building.find(filter).sort({ name: 1 }).lean();
  res.json(buildings);
};

export const getById = async (req, res) => {
  const building = await Building.findById(req.params.id).lean();
  if (!building) throw createError('Building not found', 404);
  res.json(building);
};

export const create = async (req, res) => {
  const building = await Building.create(req.body);
  res.status(201).json(building);
};

export const remove = async (req, res) => {
  const building = await Building.findByIdAndDelete(req.params.id);
  if (!building) throw createError('Building not found', 404);
  res.json({ message: 'Building deleted' });
};
