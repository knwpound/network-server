const Message = require("../models/Message"); // ✅ Import Model
const User = require("../models/User");
const Chat = require("../models/Chat");
const { getIO }  = require("../socket");

exports.sendMessage= async(req,res)=>{
    const {content, chatId} = req.body;

    if(!content||!chatId){
        console.log("Invalid data passed into request");
        return res.status(400).json({success:false});
    }

    var newMessage = {
        sender: req.user._id,
        content: content,
        chat: chatId
    };

    try{
        var message = await Message.create(newMessage);

        message = await message.populate("sender","name profileColor");
        message = await message.populate("chat");
        message = await User.populate(message,{
            path:'chat.user',
            select: 'name email profileColor'
        })

        await Chat.findByIdAndUpdate(req.body.chatId,{
            latestMessage: message,
        })

        res.status(200).json({ success: true, data: message });

    }catch(error){
        res.status(400).json({success:false});
    }
};

exports.allMessages= async(req,res)=>{
    try{
        const messages = await Message.find({chat:req.params.chatId}).populate("sender","name email profileColor")
        .populate("chat");
        res.status(200).json({ success: true, data: messages });

    }catch(error){
        res.status(400).json({success:false});
        throw new Error(error.message);
    }
}
// make sure this exports your io instance

exports.markMessagesAsRead = async (req, res) => {
  try {
 
   io=getIO();
    const chatId = req.params.chatId;
    const userId = req.user._id;

    // Update all unread messages in this chat
    const updatedMessages = await Message.updateMany(
      { chat: chatId, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    // Push real-time update to everyone in this chat
    io.to(chatId).emit("messages read", {
      chatId,
      readerId: userId,
    });
      //console.log("User Joined Room: "+room);

    res.status(200).json({ success: true, updatedCount: updatedMessages.modifiedCount });
  } catch (error) {
    console.error("Failed to mark messages as read:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};