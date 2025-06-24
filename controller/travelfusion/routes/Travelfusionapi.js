// routes/routing.js
const express = require("express");
const router = express.Router();
const { startRouting } = require("../controller/Startrouting");

// POST /api/start-routing
router.post("/start-routing", startRouting);

module.exports = router;
