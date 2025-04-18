const express = require("express");
const {getUsers,getUser,putUser,deleteUser} = require('../controllers/user')

const router = express.Router();
const {protect,authorize} = require('../middleware/auth')

router.route('/').get(getUsers);
router.route('/:id').get(getUser).put(protect,authorize('admin','user'),putUser).delete(protect,authorize('admin','user'),deleteUser);

module.exports = router;