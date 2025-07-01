// routes/routing.js
const express = require("express");
const router = express.Router();
const {
  startRouting,
  checkRouting,
  processDetails,
  startBooking,
  processTerms,
  checkBooking,
  getBookingDetails,
  getBookingDetailsForCancellation,
  startBookingCancelPlane,
  checkBookingCancelPlane,
  getBranchSupplierList,
  getCurrencyList,
} = require("../controller/Travelfusion");

// POST /api/start-routing
router.post("/start-routing", startRouting);
router.post("/check-routing", checkRouting);
router.post("/process-details", processDetails);
router.post("/process-terms", processTerms);
router.post("/start-booking", startBooking);
router.post("/check-booking", checkBooking);
router.post("/get-bookingdetails", getBookingDetails);
router.post(
  "/get-bookingdetailscancellation",
  getBookingDetailsForCancellation
);
router.post("/cancel-booking", startBookingCancelPlane);
router.post("/get-cancellationstatus", checkBookingCancelPlane);
router.get("/get-supplierlist", getBranchSupplierList);
router.get("/get-currencylist", getCurrencyList);
module.exports = router;
