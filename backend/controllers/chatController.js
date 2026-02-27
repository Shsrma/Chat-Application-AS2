import Chat from '../models/Chat.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { ApiError } from '../middlewares/errorMiddleware.js';

/**
 * Access a 1-on-1 chat or create if doesn't exist
 * POST /api/chat
 */
export const accessChat = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new ApiError(400, "UserId param not sent with request"));
  }

  let isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { participants: { $elemMatch: { $eq: req.user._id } } },
      { participants: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("participants", "-password -twoFactorSecret")
    .populate("lastMessage");

  isChat = await User.populate(isChat, {
    path: "lastMessage.sender",
    select: "username avatar email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    // Create new chat
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      participants: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "participants",
        "-password -twoFactorSecret"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      next(new ApiError(400, error.message));
    }
  }
});

/**
 * Fetch all chats for a user
 * GET /api/chat
 */
export const fetchChats = catchAsync(async (req, res, next) => {
  try {
    let results = await Chat.find({ participants: { $elemMatch: { $eq: req.user._id } } })
      .populate("participants", "-password -twoFactorSecret")
      .populate("admins", "-password -twoFactorSecret")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    results = await User.populate(results, {
      path: "lastMessage.sender",
      select: "username avatar email",
    });

    res.status(200).send(results);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
});

/**
 * Create a New Group Chat
 * POST /api/chat/group
 */
export const createGroupChat = catchAsync(async (req, res, next) => {
  if (!req.body.users || !req.body.name) {
    return next(new ApiError(400, "Please Fill all the fields"));
  }

  var users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return next(new ApiError(400, "More than 2 users are required to form a group chat"));
  }

  users.push(req.user); // Add the creator

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      participants: users,
      isGroupChat: true,
      admins: [req.user], // The creator is the admin
      description: req.body.description || ""
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("participants", "-password -twoFactorSecret")
      .populate("admins", "-password -twoFactorSecret");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
});

/**
 * Rename Group Chat
 * PUT /api/chat/rename
 */
export const renameGroup = catchAsync(async (req, res, next) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { chatName: chatName },
    { new: true }
  )
    .populate("participants", "-password -twoFactorSecret")
    .populate("admins", "-password -twoFactorSecret");

  if (!updatedChat) {
    return next(new ApiError(404, "Chat Not Found"));
  } else {
    res.json(updatedChat);
  }
});

/**
 * Remove User from Group
 * PUT /api/chat/groupremove
 */
export const removeFromGroup = catchAsync(async (req, res, next) => {
  const { chatId, userId } = req.body;

  // Check if the requester is admin
  const chat = await Chat.findById(chatId);
  if (!chat.admins.includes(req.user._id) && req.user._id.toString() !== userId) {
     return next(new ApiError(403, "Only admins can remove someone"));
  }

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { participants: userId, admins: userId } },
    { new: true }
  )
    .populate("participants", "-password -twoFactorSecret")
    .populate("admins", "-password -twoFactorSecret");

  if (!removed) {
    return next(new ApiError(404, "Chat Not Found"));
  } else {
    res.json(removed);
  }
});

/**
 * Add User to Group
 * PUT /api/chat/groupadd
 */
export const addToGroup = catchAsync(async (req, res, next) => {
  const { chatId, userId } = req.body;

  // Check if the requester is admin
  const chat = await Chat.findById(chatId);
  if (!chat.admins.includes(req.user._id)) {
     return next(new ApiError(403, "Only admins can add someone"));
  }

  const added = await Chat.findByIdAndUpdate(
    chatId,
    { $push: { participants: userId } },
    { new: true }
  )
    .populate("participants", "-password -twoFactorSecret")
    .populate("admins", "-password -twoFactorSecret");

  if (!added) {
    return next(new ApiError(404, "Chat Not Found"));
  } else {
    res.json(added);
  }
});

export default {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup
};
