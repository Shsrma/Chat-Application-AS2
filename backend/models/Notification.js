import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: ['message', 'mention', 'call_missed', 'group_invite', 'system_alert'],
      required: true,
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['Message', 'Chat', 'Group', 'User'],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'relatedEntity.entityType',
      }
    },
    content: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for getting user notifications quickly
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
