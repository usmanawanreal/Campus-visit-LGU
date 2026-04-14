import Classroom from '../models/Classroom.js';
import Building from '../models/Building.js';

export const searchClassrooms = async (req, res) => {
  const q = req.query?.q;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json([]);
  }
  const re = new RegExp(q.trim(), 'i');
  const classrooms = await Classroom.find({ roomNumber: re })
    .populate('buildingId', 'name description floors')
    .limit(20)
    .lean();
  res.json(classrooms);
};

export const searchBuildings = async (req, res) => {
  const q = req.query?.q;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json([]);
  }
  const re = new RegExp(q.trim(), 'i');
  const buildings = await Building.find({ name: re })
    .limit(20)
    .lean();
  res.json(buildings);
};
