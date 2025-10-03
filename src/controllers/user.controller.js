import { asyncHandler } from "../utils/asyncHandler.js";

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
});

export {registerUser};