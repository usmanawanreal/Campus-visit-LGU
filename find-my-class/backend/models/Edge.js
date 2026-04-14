import mongoose from 'mongoose';

const edgeSchema = new mongoose.Schema(
  {
    fromNode: { type: mongoose.Schema.Types.ObjectId, ref: 'Node', required: true },
    toNode: { type: mongoose.Schema.Types.ObjectId, ref: 'Node', required: true },
    distance: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

edgeSchema.index({ fromNode: 1, toNode: 1 });

export default mongoose.model('Edge', edgeSchema);
