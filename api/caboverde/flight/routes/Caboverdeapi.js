const express = require("express");
const { getAvailability ,getExtraChargesAndProducts} = require("../controller/Caboverdecontroller");
const router = express.Router();

router.post("/caboverdeavailability", getAvailability);
router.post("/caboverdeairextracharges",getExtraChargesAndProducts);

module.exports = router;
