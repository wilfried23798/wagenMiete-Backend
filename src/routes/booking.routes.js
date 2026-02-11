const express = require("express");
const router = express.Router();

const bookingController = require("../controllers/booking.controller");

// Step 1
router.post("/draft/step1", bookingController.createBookingDraftStep1);

// Step 2
router.put("/draft/step2", bookingController.setBookingPackage);

// STEP 3 – options + total
router.post("/draft/step3", bookingController.setBookingOptionsAndPrice);

router.get('/availability/next-date', bookingController.getNextAvailableDate);

router.post("/finalize-payment", bookingController.finalizeBookingForPayment);

module.exports = router;