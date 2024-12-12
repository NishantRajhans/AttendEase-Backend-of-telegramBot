import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { message } from "telegraf/filters";
import database from "./utils/database.js";
import User from "./models/User.js";
import axios from "axios";
import moment from "moment";
import express from "express";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Connect to Database
database();

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT);

// Express setup for Webhook
app.use(express.json());
app.get("/", (req, res) => res.send("Bot is running!"));
app.use(bot.webhookCallback("/bot"));

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await bot.telegram.setWebhook(`${WEBHOOK_URL}/bot`);
  console.log(`Webhook set to ${WEBHOOK_URL}/bot`);
});

// Handle /start command
bot.start(async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    let user = await User.findOne({ TelegramId });

    if (!user) {
      user = await User.create({ TelegramId });
      ctx.reply("User not found. Please enter your email.");
    }
  } catch (error) {
    console.error("Error in /start:", error);
    ctx.reply("An error occurred. Please try again.");
  }
});

// Handle text messages
bot.on(message("text"), async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    const user = await User.findOne({ TelegramId });

    if (!user.Email) {
      user.Email = ctx.message.text;
      await user.save();
      ctx.reply("Email saved. Please enter your password.");
    } else if (!user.Password) {
      user.Password = ctx.message.text;
      await user.save();

      // Sign-in API Call
      try {
        const response = await axios.post("http://localhost:4000/api/v1/Teacher/SignIn", {
          EMAIL: user.Email,
          PASSWORD: user.Password,
          ROLE: "Teacher",
        });

        if (response.data.success) {
          user.Token = response.data.token;
          await user.save();

          // Fetch Subjects
          const subjectsResponse = await axios.get(
            "http://localhost:4000/api/v1/Teacher/FetchSubject",
            {
              headers: {
                Authorization: `Bearer ${user.Token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const subjects = subjectsResponse.data.response;
          const subjectButtons = subjects.map((subject) => [
            {
              text: subject.SUBJECT_NAME,
              callback_data: `subject ${subject.SUBJECT_ID}`,
            },
          ]);

          ctx.reply("Sign-in successful! Please select your subject.", {
            reply_markup: { inline_keyboard: subjectButtons },
          });
        } else {
          await user.deleteOne();
          ctx.reply("Invalid credentials. Please try again from /start.");
        }
      } catch (err) {
        console.error("Error during sign-in:", err);
        await user.deleteOne();
        ctx.reply("Error during sign-in. Please try again from /start.");
      }
    } else {
      ctx.reply("You're already signed in. Please select your subject.");
    }
  } catch (err) {
    console.error("Error in message handler:", err);
    ctx.reply("An error occurred. Please try again.");
  }
});

// Handle callback queries
bot.on("callback_query", async (ctx) => {
  try {
    const TelegramId = ctx.callbackQuery.from.id;
    const data = ctx.callbackQuery.data;
    const user = await User.findOne({ TelegramId });

    if (data.startsWith("subject")) {
      const SubjectId = data.split(" ")[1];
      user.CurrentSubjectId = SubjectId;
      await user.save();

      // Fetch Students
      try {
        const response = await axios.get(
          `http://localhost:4000/api/v1/Teacher/FetchStudentOfParticularSubject?SUBJECT_ID=${SubjectId}`,
          {
            headers: {
              Authorization: `Bearer ${user.Token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const students = response.data.response;
        const studentButtons = students.map((student) => [
          {
            text: student.NAME,
            callback_data: `student ${student.NAME} ${student.STUDENT_ID}`,
          },
        ]);
        studentButtons.push([
          { text: "Submit", callback_data: "submit" },
        ]);

        ctx.reply("Select students who are present:", {
          reply_markup: { inline_keyboard: studentButtons },
        });
      } catch (error) {
        console.error("Error fetching students:", error);
        ctx.reply("Error fetching students. Please try again.");
      }
    } else if (data.startsWith("student")) {
      const StudentId = data.split(" ").pop();

      if (user.StudentPresentList.includes(StudentId)) {
        user.StudentPresentList.pull(StudentId);
        ctx.reply("Student removed from the present list.");
      } else {
        user.StudentPresentList.push(StudentId);
        ctx.reply("Student added to the present list.");
      }

      await user.save();
    } else if (data === "submit") {
      try {
        const AttendanceList = user.StudentPresentList;
        const SubjectId = user.CurrentSubjectId;
        const Date = moment().format("YYYY-MM-DD");

        for (const StudentId of AttendanceList) {
          await axios.put(
            "http://localhost:4000/api/v1/Teacher/PutAttendance",
            {
              STUDENT_ID: Number(StudentId),
              SUBJECT_ID: Number(SubjectId),
              PRESENT: true,
              ATTENDANCE_DATE: Date,
            },
            {
              headers: {
                Authorization: `Bearer ${user.Token}`,
                "Content-Type": "application/json",
              },
            }
          );
        }

        ctx.reply("Attendance submitted successfully! Please restart with /start if needed.");
        await user.deleteOne();
      } catch (error) {
        console.error("Error submitting attendance:", error);
        ctx.reply("Error submitting attendance. Please try again.");
      }
    }
  } catch (error) {
    console.error("Error handling callback query:", error);
    ctx.reply("An error occurred while processing your request.");
  }
});

// Launch bot
bot.launch().then(() => console.log("Bot is running!"));
