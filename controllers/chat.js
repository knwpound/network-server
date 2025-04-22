const Chat = require("../models/Chat");
const User = require("../models/User");
const { getIO }  = require("../socket");

exports.accessChat = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: "UserId missing" });
  }

  try {
    let isChat = await Chat.find({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user._id } } },
        { users: { $elemMatch: { $eq: userId } } },
      ],
    })
      .populate("users", "-password")
      .populate("latestMessage");

    isChat = await User.populate(isChat, {
      path: "latestMessage.sender",
      select: "name email profileColor",
    });

    if (isChat.length > 0) {
      return res.status(200).json({ success: true, data: isChat[0] });
    }

    const chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    const createdChat = await Chat.create(chatData);
    const fullChat = await Chat.findById(createdChat._id).populate("users", "-password");
    const io = getIO();
    fullChat.users.forEach((user) => {
      io.to(user._id.toString()).emit("private chat created", {
        chatId: fullChat._id,
        chat: fullChat,
      });
    });

    return res.status(200).json({ success: true, data: fullChat });
  } catch (error) {
    console.error("Chat access error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const Message = require("../models/Message"); // import if not already

exports.fetchChats = async (req, res) => {
  try {
    const searchFilter = req.query.search
      ? {
          chatName: { $regex: `^${req.query.search}`, $options: "i" },
        }
      : {};

    const query = {
      $or: [
        {
          isGroupChat: true,
          ...searchFilter,
        },
        {
          isGroupChat: false,
          users: { $elemMatch: { $eq: req.user._id } },
        },
      ],
    };

    let results = await Chat.find(query)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    results = await User.populate(results, {
      path: "latestMessage.sender",
      select: "name email profileColor",
    });

    // 🔢 Add unread count per chat
    const finalResults = await Promise.all(
      results.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          readBy: { $ne: req.user._id },
        });

        return {
          ...chat.toObject(), // convert Mongoose doc to plain object
          unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: finalResults.length,
      data: finalResults,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(400).json({ success: false, message: "Failed to fetch chats" });
  }
};




//@desc Get single chat
//@route GET /api/v1/chat/:id
//@access Public
exports.getChat=async(req,res,next)=>{
    console.log("Getting chat with ID:", req.params.id);
    try{
        
        const chat = await Chat.findById(req.params.id);

        if(!chat)
            return res.status(400).json({success:false});

        res.status(200).json({success:true, data:chat});

    }catch(err){
        
        res.status(400).json({success:false});
    }
    
}

exports.createGroupChat = async (req, res, next) => {
    if (!req.body.users || !req.body.name) {
      return res.status(400).send({ message: "Please fill all fields" });
    }
  
    let users;
    try {
      users = JSON.parse(req.body.users);
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid users format" });
    }
  
    users.push(req.user); // add current user
  
    const isGroup = users.length > 2;
  
    const chatData = {
      chatName: isGroup ? req.body.name : "sender",
      users,
      isGroupChat: isGroup,
      ...(isGroup && { groupAdmin: req.user }) // add groupAdmin only if it's a group
    };
  
    try {
      const createdChat = await Chat.create(chatData);
  
      const fullChat = await Chat.findById(createdChat._id)
        .populate("users", "-password")
        .populate("groupAdmin", "-password");
        const io = getIO();
        io.emit("group created", {
            chatId: fullChat._id,
            chat: fullChat,
          });
          console.log("yay");
     
      res.status(200).json({ success: true, data: fullChat });
    } catch (error) {
      return res.status(400).json({ success: false, message: "Failed to create chat", error: error.message });
    }
  };
  

  exports.renameGroup = async (req, res, next) => {
    const { chatId, chatName } = req.body;
  
    if (!chatId || !chatName) {
      return res.status(400).json({
        success: false,
        message: "chatId and chatName are required",
      });
    }
  
    try {
      // ✅ Update the chat name
      await Chat.findByIdAndUpdate(chatId, { chatName });
  
      // ✅ Re-fetch full chat with populated users
      const updatedChat = await Chat.findById(chatId)
        .populate("users", "-password")
        .populate("groupAdmin", "-password");
  
      if (!updatedChat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found after update",
        });
      }
  
      const io = getIO();
  
      // ✅ Emit updated users + chatName in your format
      io.to(chatId).emit("group updated", {
        chatId,
        users: updatedChat.users,
        chatName: updatedChat.chatName,
      });
  
      return res.status(200).json({ success: true, data: updatedChat });
    } catch (error) {
      console.error("Rename group error:", error);
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
    }
  };
  


  exports.addToGroup = async (req, res, next) => {
    const { chatId, userId } = req.body;
  
    if (!chatId || !userId) {
      return res.status(400).json({
        success: false,
        message: "chatId and userId are required",
      });
    }
  
    try {
      const chat = await Chat.findById(chatId);
  
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        });
      }
  
      if (chat.users.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: "User already in group",
        });
      }
  
      chat.users.push(userId);
      await chat.save();
  
      const updatedChat = await Chat.findById(chatId)
        .populate("users", "-password")
        .populate("groupAdmin", "-password");
  
      const io = getIO();
      io.to(chatId).emit("group updated", {
        chatId,
        users: updatedChat.users,
        chatName: updatedChat.chatName,
      });
  
      return res.status(200).json({
        success: true,
        data: updatedChat,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
    }
  };
  
  
  

exports.removeFromGroup = async (req, res, next) => {
    const { chatId, userId } = req.body;
  
    if (!chatId || !userId) {
      return res.status(400).json({
        success: false,
        message: "chatId and userId are required",
      });
    }
  
    try {
      const chat = await Chat.findById(chatId);
  
      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat not found" });
      }
  
      chat.users = chat.users.filter((u) => u.toString() !== userId.toString());
  
      if (chat.groupAdmin.toString() === userId.toString()) {
        chat.groupAdmin = chat.users.length > 0 ? chat.users[0] : null;
      }
  
      const updatedChat = await chat
        .save()
        .then((c) =>
          Chat.findById(c._id)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
        );
  
      const io = getIO();
      io.to(chatId).emit("group updated", {
        chatId,
        users: updatedChat.users,
        chatName: updatedChat.chatName,
      });
  
      return res.status(200).json({ success: true, data: updatedChat });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
    }
  };
  


