import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
const MONGODB_URL = process.env.MONGODB_URL;
export const database = () => {
  mongoose
    .connect(MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log("Database connection established");
    })
    .catch((err) => {
      console.log("Database connection error");
      console.log(err);
    });
};