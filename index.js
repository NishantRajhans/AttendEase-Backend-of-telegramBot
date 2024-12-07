import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import { message } from "telegraf/filters";
import database from "./utils/database.js";
import User from "./models/User.js";
import axios from "axios";
import moment from "moment";

// Load environment variables
dotenv.config();

// Initialize database connection
database();

// Initialize the bot
const bot = new Telegraf(process.env.TELEGRAM_BOT);

// Start command
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
      "An error occurred while processing your request. Please try again from /start."
    );
  }
});

// Handle text messages
bot.on(message("text"), async (ctx) => {
  try {
    const TelegramId = ctx.from.id;
    const Uservalue = await User.findOne({ TelegramId: TelegramId });
    if (!Uservalue.Email) {
      const Email = ctx.update.message.text;
      await User.findOneAndUpdate(
        { TelegramId },
        { Email }
      );
      await ctx.reply("Email saved. Please enter your password.");
    } else if (!Uservalue.Password) {
      const Password = ctx.update.message.text;
      const UpdateUser = await User.findOneAndUpdate(
        { TelegramId },
        { Password },
        { new: true }
      );
      try {
        const response = await axios.post(
          `http://localhost:4000/api/v1/Teacher/SignIn`,
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
            { Token }
          );
          try {
            const subjectResponse = await axios.get(
              "http://localhost:4000/api/v1/Teacher/FetchSubject",
              {
                headers: {
                  Authorization: "Bearer " + Token,
                  "Content-Type": "application/json",
                },
              }
            );
            const subjectData = subjectResponse.data.response;
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
            await User.findOneAndDelete({ TelegramId });
            await ctx.reply(
              "Error in fetching subjects. Please try again from /start."
            );
          }
        } else {
          await User.findOneAndDelete({ TelegramId });
          await ctx.reply(
            `${response.data.message}. Please try again from /start.`
          );
        }
      } catch (err) {
        await User.findOneAndDelete({ TelegramId });
        await ctx.reply(
          "An error occurred while signing in. Please try again from /start."
        );
      }
    } else {
      const Token = Uservalue.Token;
      try {
        const response = await axios.get(
          "http://localhost:4000/api/v1/Teacher/FetchSubject",
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
        await User.findOneAndDelete({ TelegramId });
        await ctx.reply(
          "Error in fetching subjects. Please try again from /start."
        );
      }
    }
  } catch (err) {
    await ctx.reply("Error in login. Please try again from /start.");
  }
});

// Handle callback queries
bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const TelegramId = ctx.callbackQuery.from.id;

    if (data.startsWith("subject")) {
      const Subject_id = data.split(" ")[1];
      const Uservalue = await User.findOneAndUpdate(
        { TelegramId },
        { CurrentSubjectId: Subject_id },
        { new: true }
      );
      const Token = Uservalue.Token;
      try {
        const response = await axios.get(
          `http://localhost:4000/api/v1/Teacher/FetchStudentOfParticularSubject?SUBJECT_ID=${Subject_id}`,
          {
            headers: {
              Authorization: "Bearer " + Token,
              "Content-Type": "application/json",
            },
          }
        );
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
        await ctx.reply("Select students who are present.", {
          reply_markup: {
            inline_keyboard: StudentList,
          },
        });
      } catch (error) {
        await User.findOneAndDelete({ TelegramId });
        await ctx.reply(
          "Error in fetching students. Please try again from /start."
        );
      }
    } else if (data.startsWith("student")) {
      // Handle student selection
    } else {
      // Handle attendance submission
    }
  } catch (error) {
    await ctx.reply("An error occurred while processing your selection.");
  }
});

// Express server to handle webhooks
const app = express();
app.use(express.json());
app.use(bot.webhookCallback("/webhook"));

app.get("/", (req, res) => res.send("Bot is running!"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  const webhookUrl = `${process.env.HOST}/webhook`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook set to: ${webhookUrl}`);
  } catch (err) {
    console.error("Error setting webhook:", err);
  }
});
