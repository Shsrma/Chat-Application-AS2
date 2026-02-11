import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import User from './models/User.js';
import Chat from './models/Chat.js';
import Message from './models/Message.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join('uploads')));

// Routes
app.use('/api/users', userRoutes);

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their userId
  socket.on('join', async (userId) => {
    try {
      socket.userId = userId;
      connectedUsers.set(userId, socket.id);

      // Update user online status
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Join user to their personal room
      socket.join(userId);

      // Notify friends that user is online
      const userChats = await Chat.find({
        participants: userId
      }).populate('participants', '_id');

      const friendIds = new Set();
      userChats.forEach(chat => {
        chat.participants.forEach(participant => {
          if (participant._id.toString() !== userId) {
            friendIds.add(participant._id.toString());
          }
        });
      });

      friendIds.forEach(friendId => {
        io.to(friendId).emit('user_online', userId);
      });

      console.log(`User ${userId} joined with socket ${socket.id}`);
    } catch (error) {
      console.error('Error in join event:', error);
    }
  });

  // Join chat room
  socket.on('join_chat', async (chatId) => {
    try {
      // Verify user is participant in chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (chat) {
        socket.join(chatId);
        console.log(`User ${socket.userId} joined chat ${chatId}`);
      }
    } catch (error) {
      console.error('Error joining chat:', error);
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, messageType = 'text', replyTo } = data;

      // Verify user is participant in chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (!chat) {
        socket.emit('error', 'You are not a participant in this chat');
        return;
      }

      // Create new message
      const message = new Message({
        content,
        sender: socket.userId,
        chat: chatId,
        messageType,
        replyTo,
        status: 'sent'
      });

      await message.save();
      await message.populate('sender', 'username avatar');

      // Update chat's last message
      chat.lastMessage = message._id;
      await chat.save();

      // Send message to all participants in chat
      io.to(chatId).emit('receive_message', message);

      // Update message status to delivered for other participants
      const otherParticipants = chat.participants.filter(
        p => p.toString() !== socket.userId
      );

      for (const participantId of otherParticipants) {
        const participantSocket = connectedUsers.get(participantId.toString());
        if (participantSocket) {
          message.status = 'delivered';
          await message.save();
          io.to(participantId.toString()).emit('message_delivered', message._id);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  // Mark messages as seen
  socket.on('mark_seen', async (data) => {
    try {
      const { chatId, messageId } = data;

      const message = await Message.findById(messageId);
      if (!message) return;

      // Check if user is participant in chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (!chat) return;

      // Add user to readBy array if not already there
      const alreadyRead = message.readBy.some(
        read => read.user.toString() === socket.userId
      );

      if (!alreadyRead && message.sender.toString() !== socket.userId) {
        message.readBy.push({
          user: socket.userId,
          readAt: new Date()
        });
        message.status = 'seen';
        await message.save();

        // Notify sender that message was seen
        io.to(message.sender.toString()).emit('message_seen', {
          messageId: message._id,
          seenBy: socket.userId
        });
      }

    } catch (error) {
      console.error('Error marking message as seen:', error);
    }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      isTyping: true
    });
  });

  socket.on('stop_typing', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      isTyping: false
    });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    if (socket.userId) {
      try {
        connectedUsers.delete(socket.userId);

        // Update user offline status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Notify friends that user is offline
        const userChats = await Chat.find({
          participants: socket.userId
        }).populate('participants', '_id');

        const friendIds = new Set();
        userChats.forEach(chat => {
          chat.participants.forEach(participant => {
            if (participant._id.toString() !== socket.userId) {
              friendIds.add(participant._id.toString());
            }
          });
        });

        friendIds.forEach(friendId => {
          io.to(friendId).emit('user_offline', socket.userId);
        });

        console.log(`User ${socket.userId} disconnected`);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });

  // WebRTC Voice Call Events
  socket.on('voice_call_request', (data) => {
    // Forward call request to target user in chat
    const targetUsers = getChatParticipants(data.chatId, socket.userId);
    targetUsers.forEach(userId => {
      io.to(userId).emit('voice_call_request', {
        ...data,
        from: socket.userId
      });
    });
  });

  socket.on('voice_call_answered', (data) => {
    // Forward call answer to caller
    io.to(data.to).emit('voice_call_answered', {
      ...data,
      from: socket.userId
    });
  });

  socket.on('voice_call_rejected', (data) => {
    // Forward call rejection to caller
    io.to(data.to).emit('voice_call_rejected', {
      ...data,
      from: socket.userId
    });
  });

  socket.on('voice_call_ended', (data) => {
    // Notify all participants in chat that call ended
    const participants = getChatParticipants(data.chatId, socket.userId);
    participants.forEach(userId => {
      io.to(userId).emit('voice_call_ended', {
        ...data,
        from: socket.userId
      });
    });
  });

  socket.on('offer', (data) => {
    // Forward WebRTC offer to target user
    io.to(data.to).emit('offer', {
      ...data,
      from: socket.userId
    });
  });

  socket.on('answer', (data) => {
    // Forward WebRTC answer to target user
    io.to(data.to).emit('answer', {
      ...data,
      from: socket.userId
    });
  });

  socket.on('ice_candidate', (data) => {
    // Forward ICE candidate to target user
    const participants = getChatParticipants(data.chatId, socket.userId);
    participants.forEach(userId => {
      if (userId !== socket.userId) {
        io.to(userId).emit('ice_candidate', {
          ...data,
          from: socket.userId
        });
      }
    });
  });

  // Helper function to get chat participants
  async function getChatParticipants(chatId, currentUserId) {
    try {
      const chat = await Chat.findById(chatId);
      if (chat) {
        return chat.participants
          .filter(p => p.toString() !== currentUserId)
          .map(p => p.toString());
      }
    } catch (error) {
      console.error('Error getting chat participants:', error);
    }
    return [];
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
