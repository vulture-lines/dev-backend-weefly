const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const flightsRoute = require("./routes/Amadeusroutes");
const userRoute = require("./routes/Userdetails.js");
const otpRoute = require("./routes/Otproute.js");
const connectDb = require("./config/Db.js");
dotenv.config();
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "https://weefly-frontend.vercel.app"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/api", flightsRoute);
app.use("/api", userRoute);
app.use("/api", otpRoute);
connectDb();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
