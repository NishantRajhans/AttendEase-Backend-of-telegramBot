# Telegram Bot for Teacher Attendance Management

This is a Telegram bot built with Node.js and Telegraf framework that allows teachers to log in, select their subjects, and take attendance for students. The bot interacts with a backend server to manage authentication, fetch data, and update attendance records.

---

## Features

- **User Authentication**: Teachers can log in using their email and password.
- **Subject Selection**: The bot fetches and displays subjects assigned to the teacher.
- **Student Attendance**: Teachers can mark students as present or absent.
- **Attendance Submission**: Finalizes attendance for a session and updates the backend.

---

## Requirements

- **Node.js** (v14 or later)
- **MongoDB** for storing user session data
- Backend server for handling API requests (`http://localhost:4000` in the code)
- **Telegraf**: A library for building Telegram bots
- **Dotenv**: For environment variable management
- **Axios**: For making HTTP requests
- **Moment.js**: For date formatting

---

## Installation

1.**Clone the Repository**:
   ```bash
   git clone https://github.com/your-repository-name.git
   cd your-repository-name
   ```
2.**Install Dependencies**:

```bash
npm install
```
3.**Environment Variables: Create a .env file in the project root and add the following**:
`env
TELEGRAM_BOT=your_telegram_bot_token
MONGO_URI=your_mongo_database_connection_string
`
4.**Start the MongoDB Server: Make sure your MongoDB server is running.Run the Bot:**
```bash
node index.js
```
5.**Start the Bot: On Telegram, find your bot using the username @Bit_Attendance_bot you set up and click "Start" to begin.**
## Login Process

1. **Provide your email address and password**:  
   The bot will prompt you to enter your email and password.

2. **Authentication**:  
   The bot authenticates with the backend and retrieves a list of subjects assigned to the teacher.

---

## Select a Subject

- After successful authentication, choose a subject from the inline keyboard displayed by the bot.

---

## Mark Attendance

1. **Select Students**:  
   - Choose students who are present from the list of names provided.
   - Students can be toggled as present or absent.

2. **Submit Attendance**:  
   - Once attendance is marked, submit it to finalize the session.

---

## Error Handling

- If any error occurs during the process:
  - The bot deletes the current session.
  - It requests you to restart the process using the `/start` command.

---

## Project Structure

- **`index.js`**: Main entry point of the bot.
- **`utils/database.js`**: Contains the database connection logic for MongoDB.
- **`models/User.js`**: Defines the Mongoose schema for storing user session data.
- **`.env`**: Holds environment variables for the bot and database.

---

## API Endpoints

The bot communicates with the following backend API endpoints:

1. **Sign In**:  
   **`POST /api/v1/Teacher/SignIn`**  
   - **Parameters**:  
     - `EMAIL`: Teacher's email address  
     - `PASSWORD`: Teacher's password  
     - `ROLE`: Role of the user (`Teacher`)  

2. **Fetch Subjects**:  
   **`GET /api/v1/Teacher/FetchSubject`**  
   - **Headers**:  
     - `Authorization`: Bearer `<Token>`  

3. **Fetch Students**:  
   **`GET /api/v1/Teacher/FetchStudentOfParticularSubject`**  
   - **Query Parameters**:  
     - `SUBJECT_ID`: ID of the selected subject  
   - **Headers**:  
     - `Authorization`: Bearer `<Token>`  

4. **Submit Attendance**:  
   **`PUT /api/v1/Teacher/PutAttendance`**  
   - **Body**:  
     - `STUDENT_ID`: ID of the student  
     - `SUBJECT_ID`: ID of the selected subject  
     - `PRESENT`: Boolean (`true` for present, `false` for absent)  
     - `ATTENDANCE_DATE`: Date of the attendance session in `YYYY-MM-DD` format  
   - **Headers**:  
     - `Authorization`: Bearer `<Token>`  
     - `Content-Type`: `application/json`
