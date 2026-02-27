import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import logger from '../config/logger.js';
import jwt from 'jsonwebtoken';

let io;

export const initializeSockets = async (server) => {
  io = new Server(server, {
    pingTimeout: 60000,
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173", // Vite default
      credentials: true,
    },
  });

  // Redis setup for horizontal scaling
  try {
    // const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    // const subClient = pubClient.duplicate();
    // io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis Adapter bypassed for local test (Docker unavailable)');
  } catch (error) {
    logger.error('Failed to connect Redis Adapter:', error);
  }

  // Socket authentication middleware
  io.use(async (socket, next) => {
      try {
          const token = socket.handshake.auth.token;
          if (!token) throw new Error("Authentication error");

          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = await User.findById(decoded.id).select("-password -twoFactorSecret");
          
          if (!socket.user) throw new Error("User not found");
          
          next();
      } catch (err) {
          next(new Error("Authentication error"));
      }
  });

  const connectedUsers = new Map(); // Global memory map (Consider Redis Hash for real multi-node)

  io.on('connection', (socket) => {
    logger.info(`User Connected: ${socket.user.username} - Socket ID: ${socket.id}`);
    
    // Store connection
    connectedUsers.set(socket.user._id.toString(), socket.id);

    socket.on('setup', async () => {
      socket.join(socket.user._id.toString());
      
      // Mark user online
      await User.findByIdAndUpdate(socket.user._id, {
          isOnline: true,
          socketId: socket.id
      });

      socket.broadcast.emit('user_presence_update', {
          userId: socket.user._id,
          isOnline: true
      });
      
      socket.emit('connected');
    });

    socket.on('join_chat', (room) => {
      socket.join(room);
      logger.debug(`User ${socket.user.username} Joined Room: ${room}`);
    });

    socket.on('leave_chat', (room) => {
        socket.leave(room);
    });

    socket.on('typing', (room) => socket.in(room).emit('typing', socket.user._id));
    socket.on('stop_typing', (room) => socket.in(room).emit('stop_typing', socket.user._id));

    // Receiving new messages and delivering them
    socket.on('new_message', async (newMessageRecieved) => {
      const chat = newMessageRecieved.chat;
      if (!chat.participants) return logger.warn("chat.participants not defined");

      // Mark as delivered for others in room (Simplified representation)
      // Realistically this requires a DB bulk Write.
      await Message.findByIdAndUpdate(newMessageRecieved._id, { status: 'delivered' });
      newMessageRecieved.status = 'delivered';

      chat.participants.forEach((participant) => {
        if (participant._id === newMessageRecieved.sender._id) return;
        
        socket.in(participant._id).emit('message_received', newMessageRecieved);
      });
    });

    // Mark as seen
    socket.on('mark_seen', async ({ messageId, chatId }) => {
        // Update DB
        await Message.findByIdAndUpdate(messageId, { status: 'seen' });
        
        // Notify sender
        socket.in(chatId).emit('message_status_update', {
            messageId,
            status: 'seen',
            seenBy: socket.user._id
        });
    });

    // WebRTC Signaling
    socket.on('call_user', (data) => {
        io.to(data.userToCall).emit('incoming_call', {
            signal: data.signalData, 
            from: data.from, 
            name: data.name
        });
    });

    socket.on('answer_call', (data) => {
        io.to(data.to).emit('call_accepted', data.signal);
    });

    socket.on('end_call', (data) => {
        io.to(data.to).emit('call_ended');
    });

    socket.on('disconnect', async () => {
      logger.info(`User Disconnected: ${socket.user.username}`);
      connectedUsers.delete(socket.user._id.toString());
      
      // Mark offline and update lastSeen
      await User.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastSeen: new Date(),
          socketId: null
      });

      socket.broadcast.emit('user_presence_update', {
          userId: socket.user._id,
          isOnline: false,
          lastSeen: new Date()
      });
      
      socket.leave(socket.user._id.toString());
    });
  });
};
