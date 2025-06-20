const express = require("express");
const router = express.Router();
const otpController = require("../controller/Otpcontroller");
router.post("/sendotp", otpController.sendOTP);
router.post("/validateotp", otpController.validateOTP);
module.exports = router;
