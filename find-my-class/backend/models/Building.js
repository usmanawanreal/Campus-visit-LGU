import mongoose from 'mongoose';

const buildingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Short stable id for maps/API; must be unique when set (matches DB index `code_1`). */
    code: { type: String, trim: true },
    description: { type: String, default: '' },
    floors: { type: Number, required: true, min: 1 }
  },
  { timestamps: true }
);

export default mongoose.model('Building', buildingSchema);
