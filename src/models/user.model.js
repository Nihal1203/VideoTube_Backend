import mongoose,{Schema} from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken";

const userSchema=new Schema({
  username:{
    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    index:true
  },
  email:{
    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
  },
  fullName:{
    type:String,
    required:true,
    trim:true,
    index:true
  },
  avatar:{
    type:String, //we will use cloudinary url
    required:true,  
  },
  coverImage:{
    type:String,
    // required:true,

  },
  watchHistory:[
    {
      type:Schema.Types.ObjectId,
      ref:"Video"
    }
  ],
  password:{
    type:String,
    required:[true,'Password is Required']
  },
  refreshToken:{
    type:String
  }

},{timestamps:true})

//This is a mongoose middleware that will execute before the save operation happens in database 
userSchema.pre("save",async function(next){
  //We are encrypting the password only when we enter the password first time or change the password
  if(!this.isModified("password"))  
    return next();

  this.password=await bcrypt.hash(this.password,10)
  next()

})

//This is our custom method that will check that password enter by the user is same as the password that is stored in the database or not 
userSchema.methods.isPasswordCorrect=async function(password){
  //will return the boolean 
  return await bcrypt.compare(password,this.password)
}

userSchema.method.generateAccessToken=function(){
  return jwt.sign({
      _id:this._id,
      email:this.email,
      username:this.username,
      fullName:this.fullName,
  },
  process.env.ACCESS_TOKEN_SECRET,
  {
    expiresIn:process.env.ACCESS_TOKEN_EXPIRY
  }
)
}

userSchema.methods.generateRefreshToken = function(){
  return jwt.sign(
      {
          _id: this._id,
          
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
          expiresIn: process.env.REFRESH_TOKEN_EXPIRY
      }
  )
}


export const User=mongoose.model("User",userSchema)