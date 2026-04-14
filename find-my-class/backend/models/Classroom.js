import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    floor: { type: Number, required: true, min: 0 },
    coordinates: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

classroomSchema.index({ buildingId: 1, floor: 1 });

export default mongoose.model('Classroom', classroomSchema);
