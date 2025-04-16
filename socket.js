// socket.js
let io;

const initSocket = (server) => {
    io = require("socket.io")(server, {
      pingTimeout: 60000,
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    const onlineUsers = {};

    function getOnlineUserList() {
      return Object.values(onlineUsers).map(entry => entry.userData);
    }
io.on("connection", (socket)=>{
  console.log('connected to socket.io');

  socket.on('setup',(userData)=>{
    socket.join(userData._id);
    onlineUsers[userData._id] = { socketId: socket.id, userData };
    //console.log(userData);
    socket.emit('connected');

    socket.broadcast.emit('online users', getOnlineUserList());
  });

  socket.on('get online users', () => {
    const users = Object.values(onlineUsers).map(entry => entry.userData);
    socket.emit('online users', users);
  });  

  socket.on('join chat',(room)=>{
    socket.join(room);
    //console.log("User Joined Room: "+room);
  });

  socket.on('new message',(newMessageRecieved)=>{
    var chat = newMessageRecieved.chat;

    if(!chat.users) return console.log('chat.users not defined');

    socket.in(chat._id).emit("message recieved", newMessageRecieved)
    //console.log("Reciever recieve",newMessageRecieved);

    // chat.users.forEach(user=>{
    //   if(user == newMessageRecieved.sender._id){
    //     // console.log("sender send " + newMessageRecieved.sender._id);
    //     return;
    //   }
        

      
    // })
  });


  socket.on("disconnect", () => {
    console.log("USER DISCONNECT", socket.id);
    for (const userId in onlineUsers) {
      if (onlineUsers[userId]?.socketId === socket.id) {
        delete onlineUsers[userId];
      }
    }

    io.emit('online users', getOnlineUserList());
  });

  socket.off("setup",()=>{
    console.log("USER DISCONNECT");
    socket.leave(userData._id);
  });
  
});
};
const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initSocket, getIO };