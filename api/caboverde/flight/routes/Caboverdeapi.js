const express = require("express");
const { getAvailability } = require("../controller/Caboverdecontroller");
const router = express.Router();

router.post("/caboverdeavailability", getAvailability);

module.exports = router;
