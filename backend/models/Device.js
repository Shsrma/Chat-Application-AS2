import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceIdentifier: {
      type: String, // a hash or unique ID generated on frontend
      required: true,
    },
    deviceType: {
      type: String, // e.g., 'mobile', 'desktop', 'tablet'
      default: 'unknown'
    },
    os: {
      type: String,
    },
    browser: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

const Device = mongoose.model('Device', deviceSchema);
export default Device;
