let io;

const onlineUsers = {};

const initSocket = (server) => {
  io = require("socket.io")(server, {
    pingTimeout: 6000000,
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Utility function to get the list of online users
  function getOnlineUserList() {
    return Object.values(onlineUsers).map(entry => entry.userData);
  }

  io.on("connection", (socket) => {
    console.log('connected to socket.io');

    socket.on('setup', (userData) => {
      socket.join(userData._id);
      onlineUsers[userData._id] = { socketId: socket.id, userData };

      socket.emit('connected');
      socket.broadcast.emit('online users', getOnlineUserList());
    });

    socket.on('get online users', () => {
      // Emit the list of online users to the requesting client
      socket.emit('online users', getOnlineUserList());
    });

    socket.on('join chat', (room) => {
      socket.join(room);
    });

    socket.on('new message', (newMessageRecieved) => {
      var chat = newMessageRecieved.chat;

      if (!chat.users) return console.log('chat.users not defined');

      socket.in(chat._id).emit("message recieved", newMessageRecieved);
      socket.emit("message recieved", newMessageRecieved); 
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

    socket.off("setup", () => {
      console.log("USER DISCONNECT");
      socket.leave(userData._id);
    });
  });
};

// Export the socket.io instance and the onlineUsers object
const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

// Export onlineUsers and any other necessary functions for external use
module.exports = { initSocket, getIO, onlineUsers };
