import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import NavigationLocation from '../models/NavigationLocation.js';

dotenv.config();

const TEST_LOCATION_NAMES = [
  'Main Entrance',
  'Admissions Desk',
  'Library',
  'Room A-101',
  'Room A-201',
  'Cafeteria',
  'Room B-105',
  'Lab S-1',
  'Lab S-2',
  'Seminar Hall'
];

async function cleanup() {
  await connectDB();
  const result = await NavigationLocation.deleteMany({
    name: { $in: TEST_LOCATION_NAMES }
  });
  console.log(`Cleanup complete: removed ${result.deletedCount} test navigation locations.`);
  process.exit(0);
}

cleanup().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});

