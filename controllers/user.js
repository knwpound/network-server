const User = require("../models/User"); // ✅ Import Model
const Chat = require('../models/Chat');

exports.getUsers = async (req, res, next) => {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "search"];
    removeFields.forEach((param) => delete reqQuery[param]);

    if (req.query.search) {
        const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        reqQuery.name = { $regex: escapedSearch, $options: "i" };
    }
    if (req.query.exclude) {
        const excludeId = req.query.exclude;
        reqQuery._id = { $ne: excludeId };
    }
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

    try {
        // Execute query
        query = User.find(JSON.parse(queryStr));

        // Select Fields
        if (req.query.select) {
            const fields = req.query.select.split(",").join(" ");
            query = query.select(fields);
        }
   
        // Sorting
        if (req.query.sort) {
            const sortBy = req.query.sort.split(",").join(" ");
            query = query.sort(sortBy);
        } else {
            query = query.sort("-createdAt");
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await User.countDocuments(JSON.parse(queryStr));


        query = query.skip(startIndex).limit(limit);
        const users = await query; 

        // Pagination result
        const pagination = {};
        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({ success: true, count: users.length, pagination, data: users });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ success: false, msg: "Server Error" });
    }
};


//@desc Get single users
//@route GET /api/v1/users/:id
//@access Public
exports.getUser=async(req,res,next)=>{
    try{
        
        const user = await User.findById(req.params.id);

        if(!user)
            return res.status(400).json({success:false});

        res.status(200).json({success:true, data:user});

    }catch(err){
        
        res.status(400).json({success:false});
    }
    
}

//@desc Update single user
//@route PUT /api/v1/users/:id
//@access Public
exports.putUser=async(req,res,next)=>{
    try{
        const user= await User.findByIdAndUpdate(req.params.id, req.body,{
            new:true,
            runValidators:true
        });
        if(!user)
            res.status(400).json({success:false});

        res.status(200).json({success:true,data:user});
    }catch(err){
        res.status(400).json({success:false});
    }
}



//@desc Delete single user and clean up related chats
//@route DELETE /api/v1/users/:id
//@access Public
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `User not found with id of ${req.params.id}`
            });
        }

        // 1. Pull user from all chats
        await Chat.updateMany(
            { users: req.params.id },
            { $pull: { users: req.params.id } }
        );

        // 2. Delete chats where no users remain
        await Chat.deleteMany({ users: { $size: 1 } });

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        console.error("Error deleting user and cleaning up chats:", err);
        res.status(400).json({ success: false, message: "Failed to delete user." });
    }
};
