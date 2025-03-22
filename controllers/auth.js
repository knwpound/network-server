const User =require('../models/User');


exports.register=async(req,res,next)=>{
    try{
        const {name, email, password, role}= req.body;
        const user = await User.create({
            name,
            email,
            password,
            role
        });
        
        sendTokenResponse(user,200,res);

    }catch(err){
        console.log(err.stack);
        res.status(400).json({success:false, error:err.message});
    }

}

//@desc Login user
//@route POST /api/v1/auth/login

exports.login=async (req,res,next)=>{
    const {email, password}=req.body;

    //Validate email & password
    if(!email || !password){
        return res.status(400).json({
            success:false,
            msg:'Please provide an email and password'
        });
    }
    const user = await User.findOne({email}).select('+password');

    if(!user){
        return res.status(400).json({success:false,
            mas:'Invalid credentails'
        });
    }

    const isMatch = await user.matchPassword(password);

    if(!isMatch){
        return res.status(401).json({success:false,
            msg:'Invalid credentails'
        });

    }
    
    sendTokenResponse(user,200,res);

};

const sendTokenResponse=(user, statusCode, res)=>{
    // Create Token
    const token = user.getSignedJwtToken();

    const options = {
        expires:new Date(Date.now()+process.env.JWT_COOKIE_EXPIRE*24*60*60*1000),
        httpOnly : true
    };

    if(process.env.NODE_ENV ==='production'){
        options.secure = true;
    }

    res.status(statusCode).cookie('token',token,options).json({
        success:true,
        token
    })
}

//@desc Get current login user
//@route POST /api/v1/auth/me
//@access Private
exports.getMe=async (req,res,next)=>{
    const user=await User.findById(req.user.id);
    res.status(200).json({success:true, data:user});
}