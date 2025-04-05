const express = require('express');
const {accessChat, fetchChats,getChat} = require('../controllers/chat')
const {protect}=require('../middleware/auth');

const router = express.Router();

router.route('/').post(protect,accessChat,);
router.route('/').get(protect,fetchChats);
router.route('/:id').get(protect,getChat);
// router.route('/group').post(protect,createGroupChat);
// router.route('/rename').put(protect,renameGroup);
// router.route('/groupremove').put(protect,renameFromGroup);
// router.route('/groupadd').put(protect,addToGroup);

module.exports=router;