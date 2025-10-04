import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


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

    if(!username && !email){
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
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200, null, "User logged out successfully")
    )
})


const refreshAccessToken = asyncHandler( async (req,res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request, token not found");
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401, "invalid refresh token, user not found");
        }
        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "expired refresh token, please login again");
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access token refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401, "Could not refresh access token");
    }
})


const changeCurrentPassword = asyncHandler( async (req,res) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user._id);
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordValid){
        throw new ApiError(400, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});
    return res.status(200).json(
        new ApiResponse(200, null, "Password changed successfully")
    )
})


const getCurrentUser = asyncHandler( async (req,res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    )
})


const updateAccountDetails = asyncHandler( async (req,res) => {
    const {fullName, email} = req.body;
    if(!(fullName || email)){
        throw new ApiError(400, "All fields are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email: email,
            }
        },
        {new: true}
    ).select("-password")
    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})


const updateUserAvatar = asyncHandler( async (req,res) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(500, "Could not upload avatar. Please try again");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password");
    return res.status(200).json(
        new ApiResponse(200, user, "User avatar updated successfully")
    );
})


const updateUserCoverImage = asyncHandler( async (req,res) => {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.url){
        throw new ApiError(500, "Could not upload cover image. Please try again");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password");
    return res.status(200).json(
        new ApiResponse(200, user, "User cover image updated successfully")
    );
})



const getUserChannelProfile = asyncHandler( async (req,res) => {
    const {username} = req.params;
    if(!username){
        throw new ApiError(400, "Username is missing");
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField : "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField : "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])

    if(!channel || channel.length === 0){
        throw new ApiError(404, "Channel not found with this username");
    }
    return res.status(200).json(
        new ApiResponse(200, channel[0], "Channel profile fetched successfully")
    )
})



export {
    registerUser, 
    loginUser,
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile
}