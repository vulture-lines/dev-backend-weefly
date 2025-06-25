// routes/routing.js
const express = require("express");
const router = express.Router();
const { startRouting ,checkRouting} = require("../controller/Startrouting");

// POST /api/start-routing
router.post("/start-routing", startRouting);
router.post('/check-routing', checkRouting);
module.exports = router;
