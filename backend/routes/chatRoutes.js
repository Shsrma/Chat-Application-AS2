import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import chatController from '../controllers/chatController.js';

const router = express.Router();

router.route('/').post(protect, chatController.accessChat);
router.route('/').get(protect, chatController.fetchChats);
router.route('/group').post(protect, chatController.createGroupChat);
router.route('/rename').put(protect, chatController.renameGroup);
router.route('/groupremove').put(protect, chatController.removeFromGroup);
router.route('/groupadd').put(protect, chatController.addToGroup);

export default router;
