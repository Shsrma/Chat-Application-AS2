import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import messageController from '../controllers/messageController.js';

const router = express.Router();

router.route('/:chatId').get(protect, messageController.allMessages);
router.route('/').post(protect, messageController.sendMessage);

// Advanced operations
router.route('/:messageId').put(protect, messageController.editMessage);
router.route('/:messageId').delete(protect, messageController.deleteMessage);
router.route('/:messageId/react').post(protect, messageController.toggleReaction);

export default router;
