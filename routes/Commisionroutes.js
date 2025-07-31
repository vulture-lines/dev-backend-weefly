const express = require("express");
const router = express.Router();
const commissionController = require("../controller/Commissioncontroller");
router.get("/getcommissiondetails", commissionController.getCommisionDetails);
router.get("/getdetails", commissionController.getDetails);
router.post("/addcommissiondetail", commissionController.addCommissionAndTax);
router.get("/getticketdetail/:ticketId",commissionController.getTicketDetail);
module.exports = router;
