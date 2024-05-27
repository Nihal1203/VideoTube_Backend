// require('dotenv').config({path:'./env'})
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";

import express from "express";
const app=express()
import dotenv from "dotenv"
import connectDB from "./db/index.js";

dotenv.config({
  path:'./env'
})

connectDB()
.then(()=>{
  app.listen(process.env.PORT || 8000,()=>{
    console.log(`Server is running on port:${process.env.PORT}`)
  })
})
.catch((err)=>{
  console.log("MongoDB connection Failed !!!",err)
})

