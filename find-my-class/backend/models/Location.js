import mongoose from 'mongoose';

const LOCATION_TYPES = ['classroom', 'lab', 'office', 'facility'];

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    floor: { type: Number, required: true, min: 0 },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Node', required: true },
    type: { type: String, required: true, enum: LOCATION_TYPES }
  },
  { timestamps: true }
);

locationSchema.index({ buildingId: 1, floor: 1 });
locationSchema.index({ nodeId: 1 });
locationSchema.index({ type: 1 });

export default mongoose.model('Location', locationSchema);
