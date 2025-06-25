// routes/routing.js
const express = require("express");
const router = express.Router();
const { startRouting ,checkRouting,processDetails,startBooking,processTerms} = require("../controller/Startrouting");

// POST /api/start-routing
router.post("/start-routing", startRouting);
router.post('/check-routing', checkRouting);
router.post('/process-details', processDetails);
router.post('/process-terms',processTerms);
router.post("/start-booking", startBooking);
module.exports = router;
