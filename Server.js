const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const bodyParser = require("body-parser");
const flightsRoute = require("./routes/Amadeusroutes");
const userRoute = require("./routes/Userdetails.js");
const otpRoute = require("./routes/Otproute.js");
const sisproutes=require("./routes/SISPRoutes.js");
const commissionRoutes=require("./routes/Commisionroutes.js");
const travelFusionRoute=require("./api/travelfusion/flight/routes/Travelfusionflightapi.js")
const connectDb = require("./config/Db.js");
dotenv.config();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// app.use(
//   cors({
//     origin: ["http://localhost:5173", "https://weefly-frontend.vercel.app","http://localhost:3000","http://localhost:5000"],
//     credentials: true,
//   })
// );

app.use(cors());

app.use(express.json());
app.use(cookieParser());
app.use("/api", flightsRoute);
app.use("/api", userRoute);
app.use("/api", otpRoute);
app.use("/flightapi", travelFusionRoute);
app.use("/transactionapi",sisproutes);
app.use("/transactionapi",commissionRoutes);
connectDb();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
