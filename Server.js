const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const axios = require('axios');
const express = require("express");
const bodyParser = require("body-parser");
const flightsRoute = require("./routes/Amadeusroutes");
const userRoute = require("./routes/Userdetails.js");
const otpRoute = require("./routes/Otproute.js");
const sisproutes=require("./routes/SISPRoutes.js");
const commissionRoutes=require("./routes/Commisionroutes.js");
const travelFusionRoute=require("./api/travelfusion/flight/routes/Travelfusionflightapi.js")
const travelFusionHotelRoute=require("./api/travelfusion/hotel/routes/Travelfusionapi.js")
const caboVerdeApiRoute=require("./api/caboverde/flight/routes/Caboverdeapi.js")
const connectDb = require("./config/Db.js");
dotenv.config();
const app = express();


app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use(cors());

app.use(express.json());
app.use(cookieParser());
app.use("/api", flightsRoute);
app.use("/api", userRoute);
app.use("/api", otpRoute);
app.use("/flightapi", travelFusionRoute);
app.use("/flightapi",caboVerdeApiRoute );
app.use("/hotelapi", travelFusionHotelRoute);
app.use("/transactionapi",sisproutes);
app.use("/transactionapi",commissionRoutes);
connectDb();


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
