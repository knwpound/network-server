const express = require('express');
const {sendMessage, allMessages,markMessagesAsRead} = require('../controllers/message')
const {protect}=require('../middleware/auth');

const router = express.Router();

router.route('/').post(protect,sendMessage);
router.route('/:chatId').get(protect,allMessages);
router.patch('/:chatId/read', protect, markMessagesAsRead);
module.exports=router;