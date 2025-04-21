const Chat = require("../models/Chat");
const User = require("../models/User");
const { getIO }  = require("../socket");

exports.accessChat = async(req,res)=>{
    const {userId}=req.body;
    if(!userId){
        console.log("User param not sent with request");
        return res.status(400).json({success:false});
    }

    var isChat = await Chat.find({
        isGroupChat: false,
        $and:[
            {users:{$elemMatch:{$eq:req.user._id}}},
            {users:{$elemMatch:{$eq:userId}}}
        ]
    }).populate("users","-password").populate("latestMessage");

    isChat = await User.populate(isChat,{
        path:"latestMessage.sender",
        select: "name email profileColor"
    })

    if(isChat.length > 0){
        res.send(isChat[0]);
    } else {
        var chatData = {
            chatName:"sender",
            isGroupChat: false,
            users:[req.user._id, userId]
        };
       
        try{
            const createChat = await Chat.create(chatData);

            const FullChat = await Chat.findOne({_id: createChat._id}).populate(
                "users",
                "-password"
            );

            res.status(200).json({success:true, data: FullChat});

        }catch(error){
            res.status(400).json({success:false});
            throw new Error(error);
        }

    }
};

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
                    ...searchFilter, // ✅ apply search only to group chats
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

        res.status(200).json({ success: true, count: results.length, data: results });
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
  
      res.status(200).json({ success: true, data: fullChat });
    } catch (error) {
      return res.status(400).json({ success: false, message: "Failed to create chat", error: error.message });
    }
  };
  

exports.renameGroup = async (req, res, next) => {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName) {
        return res.status(400).json({ success: false, message: "chatId and chatName are required" });
    }

    try {
        const updateChat = await Chat.findByIdAndUpdate(
            chatId,
            { chatName },
            { new: true }
        )
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        if (!updateChat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

        res.status(200).json({ success: true, data: updateChat });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
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

    // ✅ Check if user is already in the group
    if (chat.users.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "User already in group",
      });
    }

    // ✅ Add user and save
    chat.users.push(userId);
    await chat.save();

    // ✅ Re-fetch populated chat
    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    // ✅ Emit group update event
    const io = getIO();
    io.to(chatId).emit("group updated", { chatId });

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
      return res
        .status(400)
        .json({ success: false, message: "chatId and userId are required" });
    }
  
    try {
      // First, fetch the chat
      const chat = await Chat.findById(chatId);
  
      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat not found" });
      }
  
      // Remove userId from users array
      chat.users = chat.users.filter(
        (u) => u.toString() !== userId.toString()
      );
  
      // If the removed user was the groupAdmin
      if (chat.groupAdmin.toString() === userId.toString()) {
        if (chat.users.length > 0) {
          chat.groupAdmin = chat.users[0]; // promote next member as admin
        } else {
          chat.groupAdmin = null; // no members left
        }
      }
  
      const updatedChat = await chat
        .save()
        .then((c) =>
          Chat.findById(c._id)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
        );
  
      return res.status(200).json({ success: true, data: updatedChat });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
    }
  };
  



