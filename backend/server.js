import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';
import logger from './config/logger.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { initializeSockets } from './sockets/socketHandler.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Load env
dotenv.config();

// Connect DB
connectDB();

// App & Server Init
const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // Vite default
    credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());
app.use(apiLimiter); // General rate limiting

// Static Folders
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io architecture
initializeSockets(server);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
