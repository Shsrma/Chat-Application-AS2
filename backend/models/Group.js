import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    avatar: {
      type: String,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Role',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        }
      }
    ],
    channels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat', // Channels are essentially specialized chats inside a group
      }
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    inviteLink: {
      type: String,
      unique: true,
      sparse: true,
    }
  },
  {
    timestamps: true,
  }
);

// Group indices
groupSchema.index({ name: 'text', description: 'text' });

const Group = mongoose.model('Group', groupSchema);
export default Group;
