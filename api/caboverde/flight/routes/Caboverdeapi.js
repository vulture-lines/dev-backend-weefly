const express = require("express");
const { getAvailability ,getExtraChargesAndProducts, createBooking, getSeatMap, getAvailableSpecialServices} = require("../controller/Caboverdecontroller");
const router = express.Router();

router.post("/caboverdeavailability", getAvailability);
router.post("/caboverdeairextracharges",getExtraChargesAndProducts);
router.post("/caboverdecreatebooking",createBooking);
router.post("/caboverdeseatmap",getSeatMap);
router.post("/caboverdeavailspl",getAvailableSpecialServices);


module.exports = router;
