require("dotenv").config();
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require('./config/db');
const cookieParser=require('cookie-parser');

dotenv.config({path:'./config/config.env'})

const cors = require("cors");


connectDB();

const app = express();


app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true,               
}));

const auth = require('./routes/auth');
const user = require('./routes/user');
const chat = require('./routes/chat');
const message = require('./routes/message');

app.use('/api/v1/auth',auth);
app.use('/api/v1/users',user);
app.use('/api/v1/chat',chat);
app.use('/api/v1/message',message);

const PORT = process.env.PORT || 5000;
const server = app.listen(
  PORT,
  console.log("Server running in ",process.env.NODE_ENV, " mode on port ", PORT)
);
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error:${err.message}`);
  server.close(() => process.exit(1));
});

const io = require('socket.io')(server,{
  pingTimeout: 60000,
  cors:{
    origin: "http://localhost:3000",
  },
});

io.on("connection", (socket)=>{
  console.log('connected to socket.io');

  socket.on('setup',(userData)=>{
    socket.join(userData._id);
    console.log(userData);
    socket.emit('connected');
  });

  socket.on('join chat',(room)=>{
    socket.join(room);
    console.log("User Joined Room: "+room);
  });

  socket.on('new message',(newMessageRecieved)=>{
    var chat = newMessageRecieved.chat;

    if(!chat.users) return console.log('chat.users not defined');

    chat.users.forEach(user=>{
      if(user == newMessageRecieved.sender._id){
        // console.log("sender send " + newMessageRecieved.sender._id);
        return;
      }
        

      socket.in(user).emit("message recieved", newMessageRecieved)
      console.log("Reciever recieve" + newMessageRecieved);
    })
  });
});