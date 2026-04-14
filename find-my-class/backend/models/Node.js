import mongoose from 'mongoose';

const NODE_TYPES = ['hallway', 'entrance', 'stairs', 'elevator'];

const nodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    /** Matches frontend `campusMaps` id (floor plan or site map) for routing on the image map. */
    mapId: { type: String, required: true, trim: true, default: 'main-campus' },
    floor: { type: Number, required: true, min: -2 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: { type: String, required: true, enum: NODE_TYPES }
  },
  { timestamps: true }
);

nodeSchema.index({ mapId: 1, buildingId: 1, floor: 1 });
nodeSchema.index({ buildingId: 1, floor: 1 });
nodeSchema.index({ type: 1 });

export default mongoose.model('Node', nodeSchema);
