require("dotenv").config();
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require('./config/db');
const cookieParser=require('cookie-parser');

dotenv.config({path:'./config/config.env'})

connectDB();

const app = express();


app.use(express.json());

app.use(cookieParser());

const auth = require('./routes/auth');
app.use('/api/v1/auth',auth);

const PORT = process.env.PORT || 5000;
const server = app.listen(
  PORT,
  console.log("Server running in ",process.env.NODE_ENV, " mode on port ", PORT)
);
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error:${err.message}`);
  server.close(() => process.exit(1));
});
