import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);
