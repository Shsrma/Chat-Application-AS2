import Message from '../models/Message.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import catchAsync from '../utils/catchAsync.js';
import { ApiError } from '../middlewares/errorMiddleware.js';

/**
 * Send a generic Message (Text/Media)
 * POST /api/messages
 */
export const sendMessage = catchAsync(async (req, res, next) => {
  const { content, chatId, messageType, mediaUrl, replyTo } = req.body;

  if (!chatId || (!content && !mediaUrl)) {
    return next(new ApiError(400, "Invalid data passed into request"));
  }

  // Ensure user is part of the chat
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.participants.includes(req.user._id)) {
      return next(new ApiError(403, "You are not a participant of this chat"));
  }

  var newMessage = {
    sender: req.user._id,
    content: content || "",
    chat: chatId,
    messageType: messageType || "text",
    mediaUrl: mediaUrl || "",
    replyTo: replyTo || null,
    status: 'sent'
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "username avatar");
    message = await message.populate("chat");
    message = await message.populate({
        path: "replyTo",
        select: "content sender messageType mediaUrl",
        populate: { path: "sender", select: "username avatar" }
    });

    message = await User.populate(message, {
      path: "chat.participants",
      select: "username avatar email",
    });

    await Chat.findByIdAndUpdate(chatId, { lastMessage: message });

    res.json(message);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
});

/**
 * Fetch all messages for a chat with Cursor Pagination
 * GET /api/messages/:chatId
 */
export const allMessages = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const { cursor, limit = 20 } = req.query; // Cursor is the timestamp/ID of the oldest loaded message

  // Ensure user is part of chat
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.participants.includes(req.user._id)) {
      return next(new ApiError(403, "Unauthorized"));
  }

  let query = { chat: chatId };
  
  if (cursor) {
      // Find messages older than the cursor (infinite scroll up)
      query._id = { $lt: cursor }; 
  }

  try {
    const messages = await Message.find(query)
      .populate("sender", "username avatar email")
      .populate({
          path: "replyTo",
          select: "content sender messageType mediaUrl",
          populate: { path: "sender", select: "username avatar" }
      })
      .sort({ createdAt: -1 }) // Get newest first
      .limit(parseInt(limit));

    // Return messages in correct chronological order for UI insertion
    res.json(messages.reverse());
  } catch (error) {
    next(new ApiError(400, error.message));
  }
});

/**
 * Edit a specific message
 * PUT /api/messages/:messageId
 */
export const editMessage = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return next(new ApiError(404, "Message not found"));

    if (message.sender.toString() !== req.user._id.toString()) {
        return next(new ApiError(403, "You can only edit your own messages"));
    }

    if (message.isDeleted || message.deletedForEveryone) {
        return next(new ApiError(400, "Cannot edit a deleted message"));
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    const updated = await Message.findById(messageId)
        .populate("sender", "username avatar")
        .populate({
            path: "replyTo",
            select: "content sender messageType mediaUrl",
            populate: { path: "sender", select: "username avatar" }
        });

    res.json(updated);
});

/**
 * Delete a specific message (for everyone or self)
 * DELETE /api/messages/:messageId
 */
export const deleteMessage = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const { forEveryone = false } = req.query;

    const message = await Message.findById(messageId);
    if (!message) return next(new ApiError(404, "Message not found"));

    if (forEveryone === 'true') {
        if (message.sender.toString() !== req.user._id.toString()) {
            return next(new ApiError(403, "You can only delete your own messages for everyone"));
        }
        message.deletedForEveryone = true;
        message.content = "This message was deleted";
        message.mediaUrl = "";
        message.messageType = "system";
    } else {
        // Soft delete logic for self would normally involve a `deletedBy: [userId]` array on the schema, 
        // to simplify, this standard implementation just flags isDeleted = true globally for standard delete
        message.isDeleted = true;
    }

    await message.save();
    
    // Refresh to send updated empty shell
    const updated = await Message.findById(messageId).populate("sender", "username avatar");

    res.json(updated);
});

/**
 * Toggle Reaction on Message
 * POST /api/messages/:messageId/react
 */
export const toggleReaction = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return next(new ApiError(404, "Message not found"));

    const existingReactionIndex = message.reactions.findIndex(
        (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingReactionIndex > -1) {
        // Remove reaction if exists
        message.reactions.splice(existingReactionIndex, 1);
    } else {
        // Add reaction
        message.reactions.push({ emoji, user: req.user._id });
    }

    await message.save();
    const updated = await Message.findById(messageId)
        .populate("sender", "username avatar")
        .populate("reactions.user", "username avatar");

    res.json(updated);
});

export default {
    sendMessage,
    allMessages,
    editMessage,
    deleteMessage,
    toggleReaction
};
