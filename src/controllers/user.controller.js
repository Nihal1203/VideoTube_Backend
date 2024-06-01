import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

const generateAccessAndRefreshTokens=async(userId)=>{
  try {
    const user=await User.findById(userId)
    const accessToken=user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()

    //We also save refresh token in our database
    user.refreshToken=refreshToken
    //we are not checking the validation for the entire model because we are just adding refreshtoken in our created entry and if we check the validation it will ask for all fields(password,watchHistory,username,etc) while the time of the insertion and it will generate the error 
    await user.save({validateBeforeSave:false})
    return {accessToken,refreshToken}

  } catch (error) {
    throw new ApiError(500,"Something went wrong while generating refresh and access token")
  }
}


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


const loginUser=asyncHandler(async(req,res)=>{
  //req.body-data
  //username,email is provided or not 
  //find the user 
  //password check if user exists (password check)
  //Access and Refresh Token 
  //send cookies

  const {email,username,password}=req.body
  console.log(email)

  //In below code we can able to login via a username or email , if we don't provide both the fields then only we will get error
  if(!username && !email)
    throw new ApiError(400,"Username or Email is Required")

  
  //Alternative
  //if(!(username || email)){
    //  throw new ApiError(400,"Username or Email is Required")
  // }


  const user=await User.findOne({
    $or:[{username},{email}]
  })
  if(!user)
    throw new ApiError(404,"User Does not Exists")
  
  
  const isPasswordValid= await user.isPasswordCorrect(password)
  if(!isPasswordValid)
    throw new ApiError(401,"Password Incorrect")

  const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

  const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

  //By the field httpOnly:true , only server can modify the cookies not the frontend 
  const options={
    httpOnly:true,
    secure:true
  }
  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {user:loggedInUser,accessToken,refreshToken},
      "User Logged In Successfully"
    )
  )
})


const logoutUser=asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(req.user._id,
    {
      $unset:
      {
        refreshToken:1
      }
    },
    {
      new:true
    }
  )

  const options={
    httpOnly:true,
    secure:true
  }
  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User Logged Out"))

})


const refreshAccessToken= asyncHandler(async(req,res)=>{
  const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken)  
    throw new ApiError(401,"Unauthorized Request ,Error in refreshAccessTokenMethod")

 try {
   const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
 
   const user=await User.findById(decodedToken?._id)
 
   if(!user)
     throw new ApiError(401,"Invalid Refresh Token")
   
   if(incomingRefreshToken!==user?.refreshToken)
     throw new ApiError(401,"Refresh Token is Expired or Used ")
 
   const options={
     httpOnly:true,
     secure:true
   }
   
   const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
 
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",newRefreshToken,options)
   .json(
     new ApiResponse(
       200,
       {accessToken,refreshToken:newRefreshToken},
       "Access Token Refreshed Successfully"
     )
   )
 } catch (error) {
  throw new ApiError(401,error?.message || "Error while decoding the token")
  
 }


})


const changeCurrentPassword=asyncHandler(async(req,res)=>{
  
  const{oldPassword,newPassword}=req.body

  //when user is changing the password it means user is logged In and we have added user filed in our request in auth middleware so we have user object access in our request from that we can find user 

  const user=await User.findById(req.user?._id)
  const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect)
    throw new ApiError(400,"Invalid Old Password")

  user.password=newPassword
  await user.save({validateBeforeSave: false})

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})


const getCurrentUser=asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(new ApiResponse(
    200,
    req.user,
    "User fetched successfully"
))
})


const updateAccountDetails=asyncHandler(async(req,res)=>{
  const {fullName,email}=req.body

  if(!fullName || !email)
    throw new ApiError(400,"All field are required(fullName and email)")

  //By the providing new field we will get updated user information in user variable means in our object we will have updated fullName and email id 
  const user=User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName,
        email
      }
    },
    {
      new:true
    }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})


const updateUserAvatar=asyncHandler(async(req,res)=>{
  const avatarLocalPath=req.file?.path

  if(!avatarLocalPath)
    throw new ApiError(400,"Avatar File is missing ")

  const avatar=await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url)
    throw new ApiError(400,"Error while uploading avatar on cloudinary")

  const user=await User.findByIdAndUpdate(req.user?._id,{
    $set:{
      avatar:avatar.url
    }
  },{new:true}).select("-password")

  return res
  .status(200)
  .json(
      new ApiResponse(200, user, "Avatar image updated successfully"))
})


const updateUserCoverImage = asyncHandler(async(req, res) => {
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath) {
      throw new ApiError(400, "Cover image file is missing")
  }

  //TODO: delete old image - assignment


  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
      throw new ApiError(400, "Error while uploading CoverImage on cloudinary")
      
  }

  const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
          $set:{
              coverImage: coverImage.url
          }
      },
      {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
      new ApiResponse(200, user, "Cover-Image updated successfully")
  )
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
  const {username}=req.params
  if(!username?.trim())
    throw new ApiError(400,"Username does not exists")

  const channel=User.aggregate([
    {
      $match:{
        username:username?.toLowerCase()
      }
  },
  {
    $lookup:{
      from:"subscriptions",
      localField:"_id",
      foreignField:"channel",
      as:"subscribers"
    }
  },
  {
    $lookup:{
      from:"subscriptions",
      localField:"_id",
      foreignField:"subscriber",
      as:"subscribedTo"
    }
  },
  {
    $addFields:{
      subscribersCount:{
        $size:"$subscribers"
      },
      channelsSubscribedToCount:{
        $size:"$subscribedTo"
      },
      isSubscribed:{
        $cond:{
          if:{$in:[req.user?._id,"$subscribers.subscriber"]},
          then:true,
          else:false
        }
      }
    }
  },
  {
    $project:{
      fullName:1,
      username:1,
      subscribersCount:1,
      channelsSubscribedToCount:1,
      avatar:1,
      coverImage:1,
      email:1,
      
    }
  }
])

if(!channel?.length){
  throw new ApiError(404,"Channel does not exists ")
}

return res
        .status(200)
        .json(
          new ApiResponse(200,channel[0],"User channel fetched successfully")
        )


})

const getWatchHistory = asyncHandler(async(req,res)=>{
  const user=await User.aggregate([
    {
      $match:{
        _id:new mongoose.Types.ObjectId(req.user._id),

      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullName:1,
                    username:1,
                    avatar:1

                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(new ApiResponse(200,
    user[0].watchHistory,
    "Watch History Fetched successfully"
  ))

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
  getUserChannelProfile,
  getWatchHistory
}