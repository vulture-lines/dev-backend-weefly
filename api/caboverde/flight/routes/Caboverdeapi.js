const express = require("express");
const { getAvailability ,getExtraChargesAndProducts, createBooking} = require("../controller/Caboverdecontroller");
const router = express.Router();

router.post("/caboverdeavailability", getAvailability);
router.post("/caboverdeairextracharges",getExtraChargesAndProducts);
router.post("/caboverdecreatebooking",createBooking);

module.exports = router;
