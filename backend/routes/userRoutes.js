import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images, videos, and documents
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|ogg|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// File upload endpoint
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Avatar upload endpoint
router.post('/:userId/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar uploaded' });
    }

    // Verify user can only upload their own avatar
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    
    // Update user avatar in database
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { avatar: avatarUrl },
      { new: true }
    );

    res.json({ avatarUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join('uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (for creating chats)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.userId }
    }).select('username email avatar isOnline lastSeen');
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's chats
router.get('/chats', authenticateToken, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.userId
    })
    .populate('participants', 'username email avatar isOnline')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new chat
router.post('/chats', authenticateToken, async (req, res) => {
  try {
    const { participantId, isGroupChat, name } = req.body;

    if (isGroupChat && !name) {
      return res.status(400).json({ error: 'Group chat name is required' });
    }

    // Check if chat already exists (for one-to-one)
    if (!isGroupChat) {
      const existingChat = await Chat.findOne({
        isGroupChat: false,
        participants: {
          $all: [req.user.userId, participantId],
          $size: 2
        }
      });

      if (existingChat) {
        return res.json({ chat: existingChat });
      }
    }

    // Create new chat
    const chat = new Chat({
      name: isGroupChat ? name : '',
      isGroupChat,
      participants: [req.user.userId, ...(isGroupChat ? participantId : [participantId])],
      admin: isGroupChat ? req.user.userId : undefined
    });

    await chat.save();
    await chat.populate('participants', 'username email avatar');

    res.status(201).json({ chat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat messages
router.get('/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify user is participant in chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.userId
    });

    if (!chat) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
