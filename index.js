import { Telegraf, Telegram } from "telegraf";
import dotenv from "dotenv";
import { message } from "telegraf/filters";
import { database } from "./utils/database.js";
import User from "./models/User.js";
import axios from "axios";
import moment from "moment";
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT);
database();
bot.start(async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    const UserValue=await User.findOne({TelegramId: TelegramId})
    if(UserValue)await User.findOneAndDelete({ TelegramId: TelegramId });
      ctx.reply("User not found. Please Enter Your Email");
      await User.create({
        TelegramId: TelegramId,
      });
  } catch (err) {
    await ctx.reply(
      "An error occurred while processing your request.Please try again from /start"
    );
  }
});
bot.on(message("text"), async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    const Uservalue = await User.findOne({ TelegramId: TelegramId });
    if (!Uservalue.Email) {
      const Email = ctx.update.message.text;
      await User.findOneAndUpdate(
        {
          TelegramId: TelegramId,
        },
        {
          Email: Email,
        }
      );
      await ctx.reply("Email saved. Please enter your password.");
    } else if (!Uservalue.Password) {
      const Password = ctx.update.message.text;
      const UpdateUser = await User.findOneAndUpdate(
        {
          TelegramId: TelegramId,
        },
        {
          Password: Password,
        },
        { new: true }
      );
      try {
        const response = await axios.post(
          `https://attendease-backend-jom0.onrender.com/api/v1/Teacher/SignIn`,
          {
            email: UpdateUser.Email,
            password: UpdateUser.Password,
            role: "Teacher",
          }
        );
        if (response.data.success) {
          const Token = response.data.token;
          await User.findOneAndUpdate(
            { TelegramId },
            {
              Token: Token,
            }
          );
          try {
            const response = await axios.get(
              "https://attendease-backend-jom0.onrender.com/api/v1/Teacher/FetchSubject",
              {
                headers: {
                  Authorization: "Bearer " + Token,
                  "Content-Type": "application/json",
                },
              }
            );
            const subjectData = response.data.response;
            const SubjectButon = subjectData.map((subject) => [
              {
                text: subject.subjectName,
                callback_data: `subject ${subject.subjectId}`,
              },
            ]);
            await ctx.reply("Sign-in successful! Please select your subject.", {
              reply_markup: {
                inline_keyboard: SubjectButon,
              },
            });
          } catch (error) {
            await User.findOneAndDelete({TelegramId:TelegramId})
            await ctx.reply(
              "Error in fetching Subject.Please try again from /start"
            );
          }
        } else {
          await User.findOneAndDelete({
            TelegramId: TelegramId,
          });
          await ctx.reply(
            `${response.data.message} Please try again from /start`
          );
        }
      } catch (err) {
        await User.findOneAndDelete({
          TelegramId: TelegramId,
        });
        await ctx.reply(
          "An error occurred while signing in. Please try again from /start"
        );
      }
    }
  } catch (err) {
    await ctx.reply("Error in LogIn.Please try again from /start");
  }
});
bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    if (data.split(" ")[0] == "subject") {
      const TelegramId = ctx.callbackQuery.from.id;
      const Subject_id = data.split(" ")[1];
      const Uservalue = await User.findOneAndUpdate({ TelegramId: TelegramId },{
        CurrentSubjectId: Subject_id
      },{new:true});
      const Token = Uservalue.Token;
      try {
        const response = await axios.get(
          `https://attendease-backend-jom0.onrender.com/api/v1/Teacher/FetchStudentOfParticularSubject?subjectId=${Subject_id}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + Token,
            },
          }
        );
        if (response.data.success == true) {
          const Students = response.data.response;
          await Uservalue.findOneAndUpdate({TelegramId:TelegramId},{$set:{StudentList:Students}})
          const StudentList = Students.map(async(student) => [
            {
              text: student.name,
              callback_data: `student ${student.name} ${student.studentId}`,
            },
          ]);
          StudentList.push([
            {
              text: "Submit",
              callback_data: "Submit Student List",
            },
          ]);
          await ctx.reply("Select Students Those Are Present", {
            reply_markup: {
              inline_keyboard: StudentList,
            },
          });
        } else {
          await User.findOneAndDelete({TelegramId:TelegramId})
          await ctx.reply("Something is wrong. Please try again from /start");
        }
      } catch (error) {
        await User.findOneAndDelete({TelegramId:TelegramId})
        await ctx.reply(
          "Error in fetching Students.Please try again from /start"
        );
      }
    } else if (data.split(" ")[0] == "student") {
      const TelegramId = ctx.callbackQuery.from.id;
      const Student_id = data.split(" ").at(-1);
      const Uservalue = await User.findOne({ TelegramId: TelegramId });
      if (Uservalue.StudentPresentList.includes(Student_id)) {
        await User.findOneAndUpdate(
          { TelegramId: TelegramId },
          {
            $pull: {
              StudentPresentList: Student_id,
            },
          }
        );
        await ctx.reply(
          `${data.split(" ")[1]} Remove from Present List of Student`
        );
      } else {
        await User.findOneAndUpdate(
          { TelegramId: TelegramId },
          {
            $push: {
              StudentPresentList: Student_id,
            },
          }
        );
        await ctx.reply(
          `${data.split(" ")[1]} Added in Present List of Student`
        );
      }
    }else{
      const TelegramId = ctx.callbackQuery.from.id;
      const Uservalue = await User.findOne({ TelegramId: TelegramId });
      const Token = Uservalue.Token;
      const selectedSubject=Uservalue.CurrentSubjectId
      const AttendanceList=Uservalue.StudentPresentList;
      const StudentList=Uservalue.StudentList;
      const currentDate=new Date();
      const formatDate=moment(currentDate).format("YYYY-MM-DD")
      for (const studentId of StudentList ){
        try{
          const response = await axios.put(
            "https://attendease-backend-jom0.onrender.com/api/v1/Teacher/PutAttendance",
            {
              studentId: Number(studentId),
              pubjectId: Number(selectedSubject),
              present: AttendanceList.findOne(studentId)?true:false,
              attendanceDate:formatDate,
            },
            {
              headers: {
                Authorization: "Bearer " + Token,
                "Content-Type": "application/json",
              },
            }
          );
        }catch(error){
          await User.findOneAndDelete({TelegramId:TelegramId})
          await ctx.reply("Error in putting attendance. Please take attendance again")
        }
      }
      await User.findOneAndDelete({TelegramId:TelegramId})
      await ctx.reply("Successfully Update Attendance.To Take Attendance again Please /start again")
    }
  } catch (error) {
    await ctx.reply("An error occurred while processing your selection.");
  }
});
bot.launch({
  webhook: {
    domain: process.env.DOMAIN,
    port: process.env.PORT,
  },
});
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))