import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import Building from '../models/Building.js';
import Node from '../models/Node.js';
import Edge from '../models/Edge.js';
import Location from '../models/Location.js';

dotenv.config();

async function seed() {
  await connectDB();

  const building = await Building.findOneAndUpdate(
    { name: 'Main Hall' },
    {
      name: 'Main Hall',
      code: 'MAIN_HALL',
      description: 'Sample building for navigation',
      floors: 2
    },
    { upsert: true, new: true }
  );
  const buildingId = building._id;

  await Node.deleteMany({ buildingId });
  await Edge.deleteMany({});
  await Location.deleteMany({ buildingId });

  const nodes = await Node.insertMany([
    { name: 'Entrance', buildingId, mapId: 'floor-ground', floor: 0, x: 0, y: 0, type: 'entrance' },
    { name: 'Hall A1', buildingId, mapId: 'floor-ground', floor: 0, x: 100, y: 0, type: 'hallway' },
    { name: 'Hall A2', buildingId, mapId: 'floor-ground', floor: 0, x: 200, y: 0, type: 'hallway' },
    { name: 'Stairs 0', buildingId, mapId: 'floor-ground', floor: 0, x: 200, y: 50, type: 'stairs' },
    { name: 'Hall B1', buildingId, mapId: 'floor-ground', floor: 0, x: 100, y: 50, type: 'hallway' },
    { name: 'Stairs 1', buildingId, mapId: 'floor-first', floor: 1, x: 200, y: 50, type: 'stairs' },
    { name: 'Hall C1', buildingId, mapId: 'floor-first', floor: 1, x: 200, y: 0, type: 'hallway' },
    { name: 'Hall C2', buildingId, mapId: 'floor-first', floor: 1, x: 100, y: 0, type: 'hallway' },
    { name: 'Hall C3', buildingId, mapId: 'floor-first', floor: 1, x: 0, y: 0, type: 'hallway' },
    { name: 'Elevator', buildingId, mapId: 'floor-first', floor: 1, x: 150, y: 25, type: 'elevator' }
  ]);

  const [n0, n1, n2, n3, n4, n5, n6, n7, n8, n9] = nodes;

  await Edge.insertMany([
    { fromNode: n0._id, toNode: n1._id, distance: 1 },
    { fromNode: n1._id, toNode: n0._id, distance: 1 },
    { fromNode: n1._id, toNode: n2._id, distance: 1 },
    { fromNode: n2._id, toNode: n1._id, distance: 1 },
    { fromNode: n2._id, toNode: n3._id, distance: 1 },
    { fromNode: n3._id, toNode: n2._id, distance: 1 },
    { fromNode: n1._id, toNode: n4._id, distance: 1 },
    { fromNode: n4._id, toNode: n1._id, distance: 1 },
    { fromNode: n5._id, toNode: n6._id, distance: 1 },
    { fromNode: n6._id, toNode: n5._id, distance: 1 },
    { fromNode: n6._id, toNode: n7._id, distance: 1 },
    { fromNode: n7._id, toNode: n6._id, distance: 1 },
    { fromNode: n7._id, toNode: n8._id, distance: 1 },
    { fromNode: n8._id, toNode: n7._id, distance: 1 },
    { fromNode: n7._id, toNode: n9._id, distance: 1 },
    { fromNode: n9._id, toNode: n7._id, distance: 1 }
  ]);

  await Location.insertMany([
    { name: 'Room 101', buildingId, floor: 1, nodeId: n6._id, type: 'classroom' },
    { name: 'Room 102', buildingId, floor: 1, nodeId: n7._id, type: 'classroom' },
    { name: 'Room 103', buildingId, floor: 1, nodeId: n8._id, type: 'classroom' },
    { name: 'Room 104', buildingId, floor: 1, nodeId: n9._id, type: 'classroom' },
    { name: 'Room 105', buildingId, floor: 1, nodeId: n6._id, type: 'classroom' }
  ]);

  console.log('Seed complete: 1 building, 10 nodes, 16 edges, 5 classroom locations.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
