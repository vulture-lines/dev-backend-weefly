const express = require("express");
const router = express.Router();
const PaymentController = require("../controller/SISPController");
router.post("/start-payment", PaymentController.startPayment);
router.post("/payment-response", PaymentController.Paymentresponse);

module.exports = router ;
