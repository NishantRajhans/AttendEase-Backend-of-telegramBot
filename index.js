import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { message } from "telegraf/filters";
import database from "./utils/database.js";
import User from "./models/User.js";
import axios from "axios";
import moment from "moment";
import express from "express";
const expressApp = express()
const port = process.env.PORT || 3000;
expressApp.use(express.static('static'))
expressApp.use(express.json());
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT);
expressApp.use(bot.webhookCallback('/secret-path'))
bot.telegram.setWebhook('https://attendease-backend-of-telegrambot.onrender.com/secret-path')
expressApp.listen(port, () => console.log(`Listening on ${port}`));
database();
bot.start(async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    const Uservalue = await User.findOne({ TelegramId: TelegramId });
    if (!Uservalue) {
      ctx.reply("User not found. Please Enter Your Email");
      await User.create({
        TelegramId: TelegramId,
      });
    }
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
          `http:/localhost:4000/api/v1/Teacher/SignIn`,
          {
            EMAIL: UpdateUser.Email,
            PASSWORD: UpdateUser.Password,
            ROLE: "Teacher",
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
              "http:/localhost:4000/api/v1/Teacher/FetchSubject",
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
                text: subject.SUBJECT_NAME,
                callback_data: `subject ${subject.SUBJECT_ID}`,
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
    } else {
      const TelegramId = ctx.from.id;
      const Uservalue = await User.findOne({ TelegramId });
      const Token = Uservalue.Token;
      try {
        const response = await axios.get(
          "http:/localhost:4000/api/v1/Teacher/FetchSubject",
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
            text: subject.SUBJECT_NAME,
            callback_data: `subject ${subject.SUBJECT_ID}`,
          },
        ]);
        await ctx.reply("Please select your subject.", {
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
          `http://localhost:4000/api/v1/Teacher/FetchStudentOfParticularSubject?SUBJECT_ID=${Subject_id}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + Token,
            },
          }
        );
        if (response.data.success == true) {
          const Students = response.data.response;
          const StudentList = Students.map((student) => [
            {
              text: student.NAME,
              callback_data: `student ${student.NAME} ${student.STUDENT_ID}`,
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
      const currentDate=new Date();
      const formatDate=moment(currentDate).format("YYYY-MM-DD")
      AttendanceList.map(async (STUDENT_ID)=>{
        try{
          const response = await axios.put(
            "http://localhost:4000/api/v1/Teacher/PutAttendance",
            {
              STUDENT_ID: Number(STUDENT_ID),
              SUBJECT_ID: Number(selectedSubject),
              PRESENT: true,
              ATTENDANCE_DATE:formatDate,
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
      })
      await User.findOneAndDelete({TelegramId:TelegramId})
      await ctx.reply("Successfully Update Attendance.To Take Attendance again Please /start again")
    }
  } catch (error) {
    await ctx.reply("An error occurred while processing your selection.");
  }
});
