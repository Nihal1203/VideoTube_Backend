import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'

const registerUser=asyncHandler(async(req,res)=>{
  //get user details from the frontend
  //validation-not empty 
  //check if user already exists:username,email
  //check for images,check for avatar
  //upload images to cloudinary,check for avatar
  //create user object - create entry in Database 
  //remove password and refreshtoken field from the response 
  //check for user creation 
  //return response else send error 

  const {username,email,fullName,password}=req.body
  console.log(fullName,email,username,password)
  console.log("This is a req.body object")
  console.log(req.body)

  //We are checking which field is not provided by the user and accordingly we are sending error 
  if ([fullName, email, username, password].some((field) => field?.trim() === "")) 
    {
    throw new ApiError(400, "All fields are required")
    }

    const existedUser= await User.findOne({$or:[{username},{email}]})
      //IF user already exists throw error 
    if(existedUser){
      throw new ApiError(409, "User with this username or email already exists")
    }

/* 
   //we also have files(req.files,req.body) access beacuse we have added middleware in user route in user.routes.js file
    // router.route('/register').post(
    //   upload.fields([
    //     {name:"avatar",maxCount:1},
    //     {name:"coverImage",maxCount:1}
    //   ]),
    //   registerUser)
     
    //middleware add more fileds in our req
*/
    const avatarLocalPath=req.files?.avatar[0]?.path
    
    //we are checking the three conditions 
    //1.first either we will have req.files or not
    //2.second is req.files.coverImage is equal to array
    //3. Either the length of the array is grater the 0 or not     
    //Because at the time of the entry in the mongodb database we are inserting the url of the cloudinary object ad=nd if we don't have the object then we can't able to access the url of undefined so that we are checking this 
    //coverImage:coverImage?.url || ""
    //coverImage:undefined?.url || ""
    //This will cause the error 

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
      coverImageLocalPath=req.files?.coverImage[0]?.path
    }

    console.log("This is a req.files object")
    console.log(req.files)

    if(!avatarLocalPath)
        throw new ApiError(400,"Avatar is Required")
    
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar)
        throw new ApiError(400,"Avatar File is Required")
   
  const user=await User.create({
    fullName,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
    email,
    password,
    username:username.toLowerCase()
  })  

  const createdUser=await User.findById(user._id).select("-password -refreshToken")
  //we don't want  password and refreshToken in object(createdUser)

  if(!createdUser)
    throw new ApiError(500,"Something went wrong while registering the user")
  res.status(201).json(
    new ApiResponse(200,createdUser,"User Registered Successfully") 
  )
})

export {registerUser}