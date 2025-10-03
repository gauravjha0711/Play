import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefreshTokens = async (userId) => {
    const user = await User.findById(userId);
    if(!user){
        throw new ApiError(404, "User not found");
    }
    const accessToken = user.genrateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false});
    return {accessToken, refreshToken};
}

const registerUser = asyncHandler ( async (req,res) => {
    //get user details from frontend
    //validate user details
    //check if user already exists
    //check for image and avatar
    //upload image to cloudinary
    //create user object and save to db
    //remove password from user object before sending response
    //check if user is created successfully
    //respond to frontend

    const {username,email,password,fullName} = req.body;
    console.log("email:", email);

    if(
        [username,email,password,fullName].some((field)=>
            !field || field.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }


    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409, "User already exists with this username or email");
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if(!req.files && Array.isArray(req.files.coverImage && req.files.coverImage.length > 0)){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Could not upload avatar. Please try again");
    }

    const user = await User.create({
        username:username.toLowerCase(),
        email,
        password,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    })

    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );


    if(!createUser){
        throw new ApiError(500, "Could not create user. Please try again");
    }

    res.status(201).json(
        new ApiResponse(200, createUser, "User created successfully")
    )
});



const loginUser = asyncHandler( async (req,res) => {
    //req body -> data
    //username or email
    //validate data
    //check if user exists
    //compare password
    //generate access token and refresh token
    //cookies for refresh token and send access token in response

    const {username,email,password} = req.body;

    if(!username || !email){
        throw new ApiError(400, "Username or email is required");
    }

    const user = await User.findOne({
        $or: [{username: username?.toLowerCase()},{email: email?.toLowerCase()}]
    })
    if(!user){
        throw new ApiError(404, "User not found with this username or email");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure : true,
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    )
})


const logoutUser = asyncHandler ( async (req,res) => {
    
})
export {registerUser, loginUser};