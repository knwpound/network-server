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
        Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
            .sort({ updatedAt: -1 })
            .then(async (results) => {
                results = await User.populate(results, {
                    path: "latestMessage.sender",
                    select: "name email profileColor"
                });

                res.status(200).json({ success: true, data: results });
            });
    } catch (error) {
        res.status(400).json({ success: false });
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