import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser};