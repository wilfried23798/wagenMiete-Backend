const express = require("express");
const router = express.Router();

const bookingController = require("../controllers/booking.controller");

// Step 1
router.post("/customer-info", bookingController.createCustomerInfo);

// Step 2
router.post("/period", bookingController.createPeriod);

// Step 2.5 (draft booking)
router.post("/draft", bookingController.createBookingDraft);

// Step 3
router.post("/options", bookingController.saveOptions);

module.exports = router;