const express = require("express");
const { getAvailability } = require("../controller/Caboverdecontroller");
const router = express.Router();

router.get("/caboverdeavailability", getAvailability);

module.exports = router;
