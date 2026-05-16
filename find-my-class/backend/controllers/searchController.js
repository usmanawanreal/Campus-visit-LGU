import Classroom from '../models/Classroom.js';
import Building from '../models/Building.js';

import NavigationLocation from '../models/NavigationLocation.js';

export const searchClassrooms = async (req, res) => {
  const q = req.query?.q;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json([]);
  }
  const re = new RegExp(q.trim(), 'i');
  let classrooms = await Classroom.find({ roomNumber: re })
    .populate('buildingId', 'name description floors')
    .limit(20)
    .lean();

  if (classrooms.length === 0) {
    const navLocs = await NavigationLocation.find({ name: re, kind: 'point' })
      .populate('building', 'name description floors')
      .limit(20)
      .lean();
    classrooms = navLocs.map(navLoc => ({
      _id: navLoc._id,
      roomNumber: navLoc.name,
      buildingId: navLoc.building,
      floor: navLoc.floor,
      coordinates: { x: navLoc.x, y: navLoc.y }
    }));
  }
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
