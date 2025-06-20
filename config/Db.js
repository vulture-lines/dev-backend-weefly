const db = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
async function connectDB() {
    try {
      await db.connect(process.env.TESTDBURL);
      console.log("Database connected successfully");
    } catch (err) {
      console.log("Database connection error:", err);
    }
  }
module.exports = connectDB;
