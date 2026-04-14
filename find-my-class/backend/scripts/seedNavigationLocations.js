import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import Building from '../models/Building.js';
import NavigationLocation from '../models/NavigationLocation.js';

dotenv.config();

async function seedNavigationLocations() {
  await connectDB();

  const mainBuilding = await Building.findOneAndUpdate(
    { name: 'Main Hall' },
    {
      name: 'Main Hall',
      code: 'MAIN_HALL',
      description: 'Primary campus building',
      floors: 3
    },
    { upsert: true, new: true }
  );

  const scienceBuilding = await Building.findOneAndUpdate(
    { name: 'Science Block' },
    {
      name: 'Science Block',
      code: 'SCIENCE_BLOCK',
      description: 'Science labs and classrooms',
      floors: 3
    },
    { upsert: true, new: true }
  );

  // mapId values match `id` in frontend `src/data/campusMaps.js` (floor PNGs + site layout).
  const sampleLocations = [
    { name: 'Main Entrance', building: mainBuilding._id, floor: 0, mapId: 'main-campus', x: 340, y: 1220 },
    { name: 'Admissions Desk', building: mainBuilding._id, floor: 0, mapId: 'main-campus', x: 510, y: 1180 },
    { name: 'Library', building: mainBuilding._id, floor: 1, mapId: 'floor-first', x: 760, y: 610 },
    { name: 'Room A-101', building: mainBuilding._id, floor: 1, mapId: 'floor-first', x: 420, y: 540 },
    { name: 'Room A-201', building: mainBuilding._id, floor: 2, mapId: 'floor-second', x: 410, y: 360 },
    { name: 'Cafeteria', building: mainBuilding._id, floor: 0, mapId: 'floor-ground', x: 880, y: 790 },
    { name: 'Room B-105', building: mainBuilding._id, floor: 1, mapId: 'floor-first', x: 630, y: 520 },
    { name: 'Lab S-1', building: scienceBuilding._id, floor: 1, mapId: 'floor-first', x: 540, y: 470 },
    { name: 'Lab S-2', building: scienceBuilding._id, floor: 2, mapId: 'floor-second', x: 560, y: 320 },
    { name: 'Seminar Hall', building: scienceBuilding._id, floor: 1, mapId: 'floor-first', x: 980, y: 520 }
  ];

  await NavigationLocation.deleteMany({
    name: { $in: sampleLocations.map((item) => item.name) }
  });
  await NavigationLocation.insertMany(sampleLocations);

  console.log(`Seed complete: ${sampleLocations.length} navigation locations inserted.`);
  process.exit(0);
}

seedNavigationLocations().catch((error) => {
  console.error('Navigation location seed failed:', error);
  process.exit(1);
});

