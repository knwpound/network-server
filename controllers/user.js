const { getIO, onlineUsers } = require("../socket");
const User = require("../models/User");
const Chat = require('../models/Chat');

// Get all users
exports.getUsers = async (req, res, next) => {
  let query;

  const reqQuery = { ...req.query };
  const removeFields = ["select", "sort", "page", "limit", "search"];
  removeFields.forEach((param) => delete reqQuery[param]);

  if (req.query.search) {
    const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    reqQuery.name = { $regex: escapedSearch, $options: "i" };
  }

  if (req.query.exclude) {
    const excludeId = req.query.exclude;
    reqQuery._id = { $ne: excludeId };
  }

  let queryStr = JSON.stringify(reqQuery);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

  try {
    query = User.find(JSON.parse(queryStr));

    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await User.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);
    const users = await query;

    const pagination = {};
    if (endIndex < total) pagination.next = { page: page + 1, limit };
    if (startIndex > 0) pagination.prev = { page: page - 1, limit };

    res.status(200).json({ success: true, count: users.length, pagination, data: users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// Get a single user
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(400).json({ success: false });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

// Update a single user
exports.putUser = async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
  
      if (!user) {
        return res.status(400).json({ success: false, message: "User not found" });
      }
  
      const io = getIO();
  
      // ✅ Update the online user cache
      if (onlineUsers[user._id]) {
        onlineUsers[user._id].userData = {
          _id: user._id,
          name: user.name,
          email: user.email,
          profileColor: user.profileColor,
        };
  
        io.emit("user updated", {
          userId: user._id,
          updatedUser: {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileColor: user.profileColor,
          },
        });
  
        io.emit("online users", getOnlineUserList());
      }
  
      // ✅ Find all group chats this user is part of
      const chats = await Chat.find({ users: user._id }).populate("users", "-password");
  
      // ✅ Emit to each room that includes the updated user
      chats.forEach(chat => {
        io.to(chat._id.toString()).emit("group updated", {
          chatId: chat._id,
          users: chat.users, // updated user list
          chatName: chat.chatName,
          updatedUser: {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileColor: user.profileColor,
          },
        });
      });
  
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      console.error("User update error:", err);
      return res.status(400).json({ success: false, message: err.message || "Unknown error" });
    }
  };
  

// Delete a single user and clean up related chats
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`,
      });
    }

    // 1. Pull user from all chats
    await Chat.updateMany(
      { users: req.params.id },
      { $pull: { users: req.params.id } }
    );

    // 2. Delete chats where no users remain
    await Chat.deleteMany({ users: { $size: 1 } });

    // Clean up the user from online users list
    delete onlineUsers[req.params.id];

    // Emit the updated online users list
    const io = getIO();
    io.emit('online users', getOnlineUserList());

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.error("Error deleting user and cleaning up chats:", err);
    res.status(400).json({ success: false, message: "Failed to delete user." });
  }
};

// Utility function to get the online user list
function getOnlineUserList() {
  return Object.values(onlineUsers).map(entry => entry.userData);
}
