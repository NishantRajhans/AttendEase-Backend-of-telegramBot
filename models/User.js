import mongoose from "mongoose"
const UserSchema=mongoose.Schema({
    TelegramId:{
        type:Number,
        required:true,
        unique:true
    },
    Email:{
        type:String,
        trim:true
    },
    Password:{
        type:String,
        trim:true
    },
    CurrentSubjectId:{
        type:Number
    },
    StudentPresentList:[],
    StudentList:[],
    Token:{
        type:String
    },
    TEACHER_ID:{
        type:Number
    },
})
export default mongoose.model("User",UserSchema)