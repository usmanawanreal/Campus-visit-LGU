import Classroom from '../models/Classroom.js';
import { createError } from '../utils/errors.js';

export const list = async (req, res) => {
  const { search, buildingId, floor } = req.query;
  const filter = {};
  if (buildingId) filter.buildingId = buildingId;
  if (floor !== undefined) filter.floor = Number(floor);
  if (search && typeof search === 'string') {
    const re = new RegExp(search.trim(), 'i');
    filter.roomNumber = re;
  }
  const classrooms = await Classroom.find(filter)
    .populate('buildingId', 'name description floors')
    .sort({ floor: 1, roomNumber: 1 })
    .lean();
  res.json(classrooms);
};

import NavigationLocation from '../models/NavigationLocation.js';

export const getByRoomNumber = async (req, res) => {
  const searchTerm = req.params.roomNumber;
  const re = new RegExp(`^${searchTerm}$`, 'i');
  let classroom = await Classroom.findOne({ roomNumber: re })
    .populate('buildingId', 'name description floors')
    .lean();

  if (!classroom) {
    const navLoc = await NavigationLocation.findOne({
      name: new RegExp(searchTerm, 'i'),
      kind: 'point'
    }).populate('building', 'name description floors').lean();

    if (navLoc) {
      classroom = {
        _id: navLoc._id,
        roomNumber: navLoc.name,
        buildingId: navLoc.building,
        floor: navLoc.floor,
        coordinates: { x: navLoc.x, y: navLoc.y }
      };
    }
  }

  if (!classroom) throw createError('Classroom not found', 404);
  res.json(classroom);
};

export const create = async (req, res) => {
  const classroom = await Classroom.create(req.body);
  const populated = await Classroom.findById(classroom._id).populate('buildingId', 'name description floors');
  res.status(201).json(populated);
};

export const remove = async (req, res) => {
  const classroom = await Classroom.findByIdAndDelete(req.params.id);
  if (!classroom) throw createError('Classroom not found', 404);
  res.json({ message: 'Classroom deleted' });
};
