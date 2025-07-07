// routes/routing.js
const express = require("express");
const router = express.Router();
const {
  startRoutingHotel,
  checkRoutingHotel,

} = require("../controller/Travelfusionhotel");

// POST /api/start-routing
router.post("/start-routing", startRoutingHotel);
router.post("/check-routing", checkRoutingHotel);

module.exports = router;
