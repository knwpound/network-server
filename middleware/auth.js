const jwt = require("jsonwebtoken");
const User = require('../models/User');

// Protect routes
exports.protect = async (req,res,next)=>{
    // console.log(req.headers.authorization);
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }

    if (req.cookies.token) {
        token = req.cookies.token;
    }

    if(!token){
        return res.status(401).json({success:false, msg:'Not authorize to access this route, No Token'});
    }

    try{

        const decoded = jwt.verify(token,process.env.JWT_SECRET);

        console.log(decoded);

        req.user = await User.findById(decoded.id);

        next();
    }catch(err){
        console.log(err.stack);
        return res.status(401).json({success:false,msg:'Not authorize to access this route'});
    }
}

exports.authorize=(...roles)=>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
            return res.status(403).json({success:false, message: `User role ${req.user.role} is not authorized to access` })
        }
        next();
    }
}