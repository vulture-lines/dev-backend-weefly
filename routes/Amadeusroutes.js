// API Routes
const express = require("express");
const router = express.Router();
const flightController = require("../controller/Amadeuscontroller");

router.post("/search", flightController.getFlightOffers); //Flight Search API
router.post("/filter", flightController.filterFlight); //Flight Filter API
router.post("/seatmap", flightController.getSeatMap); //Seat Map API
module.exports = router;
