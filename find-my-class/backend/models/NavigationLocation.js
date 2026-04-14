import mongoose from 'mongoose';

const navigationLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    building: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    floor: { type: Number, required: true, min: -2 },
    mapId: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['point', 'corridor', 'door'], default: 'point' },
    /** For kind=door: optional link to a point location; routes to that place end at this door instead of the room wall. */
    linksToLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'NavigationLocation', default: null },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    corridorPoints: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      }
    ],
    /** Closed polygon (≥3 corners) for rooms/buildings; routing picks best edge point toward corridors/nodes. */
    footprintPoints: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      }
    ]
  },
  { timestamps: true }
);

// Fast lookup for switching maps and loading per-floor points quickly.
navigationLocationSchema.index({ mapId: 1, floor: 1 });
navigationLocationSchema.index({ building: 1, floor: 1 });
navigationLocationSchema.index({ mapId: 1, name: 1 });
navigationLocationSchema.index({ mapId: 1, x: 1, y: 1 });
navigationLocationSchema.index({ kind: 1, linksToLocation: 1 });

// Prevent duplicate location names inside the same map+floor.
navigationLocationSchema.index({ mapId: 1, floor: 1, name: 1 }, { unique: true });

export default mongoose.model('NavigationLocation', navigationLocationSchema);

