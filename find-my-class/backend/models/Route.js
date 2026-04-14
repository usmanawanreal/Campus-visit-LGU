import mongoose from 'mongoose';

const pathPointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    startLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    endLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    pathCoordinates: [pathPointSchema]
  },
  { timestamps: true }
);

routeSchema.index({ startLocation: 1, endLocation: 1 });

export default mongoose.model('Route', routeSchema);
