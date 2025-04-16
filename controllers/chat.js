const Chat = require("../models/Chat");
const User = require("../models/User");

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
        path:"lastestMessage.sender",
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
                  isGroupChat: true,
                  chatName: { $regex: `^${req.query.search}`, $options: "i" },
              }
            : {};

            const query = {
                $or: [
                  { isGroupChat: true }, // all group chats
                  {
                    isGroupChat: false, // non-group chats with current user
                    users: { $elemMatch: { $eq: req.user._id } },
                  },
                ],
                ...searchFilter, // apply search filter (if any) on group chats
              };
        Chat.find(query)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
            .sort({ updatedAt: -1 })
            .then(async (results) => {
                results = await User.populate(results, {
                    path: "latestMessage.sender",
                    select: "name email profileColor",
                });

                res.status(200).json({ success: true, count:results.length ,data: results });
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

exports.createGroupChat = async(req,res,next)=>{
    if(!req.body.users || !req.body.name){
        return res.status(400).send({message:"Please Fill all fields"});
    }

    var users = JSON.parse(req.body.users);

    if(users.length<1){
        return res.status(400).json({success:false, message:"More than 2 users are required to form a group chat"});
    }

    try{
        const groupChat = await Chat.create({
            chatName: req.body.name,
            users: users,
            isGroupChat: true,
            groupAdmin: req.user,
        });

        const fullGroupChat = await Chat.findOne({_id: groupChat._id})
        .populate("users","-password")
        .populate("groupAdmin","-password");

        res.status(200).json({success:true, data: fullGroupChat});
    }catch(error){
        return res.status(400).json({success:false, message:"Fail to create Group Chat"});
    }

}

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

exports.addToGroup = async(req,res,next)=>{
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
        return res.status(400).json({ success: false, message: "chatId and userId are required" });
    }


    try {
        const addedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $push: {users:userId} },
            { new: true }
        )
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        if (!addedChat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

        res.status(200).json({ success: true, data: addedChat });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
}

exports.removeFromGroup = async(req,res,next)=>{
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
        return res.status(400).json({ success: false, message: "chatId and userId are required" });
    }


    try {
        const removedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $pull: {users:userId} },
            { new: true }
        )
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        if (!removedChat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

        res.status(200).json({ success: true, data: removedChat });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
}



