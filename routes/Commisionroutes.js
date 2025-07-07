const express = require("express");
const router = express.Router();
const commissionController = require("../controller/Commissioncontroller");
router.get("/getcommissiondetails", commissionController.getCommisionDetails);
router.get("/getdetails", commissionController.getDetails);
router.post("/addcommissiondetail", commissionController.addCommissionAndTax);
module.exports = router;
