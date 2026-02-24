const express = require("express");
const router = express.Router();

const bookingController = require("../controllers/booking.controller");

// Step 1
router.post("/draft/step1", bookingController.createBookingDraftStep1);

// Step 2
router.put("/draft/step2", bookingController.setBookingAvailabilityAndDetails);

// STEP 3 – options + total
router.post("/draft/step3", bookingController.setBookingOptionsAndPrice);

// STEP 4 – arrival time + km
router.post("/draft/personal-info", bookingController.savePersonalInfo);

router.get('/availability/next-date', bookingController.getNextAvailableDate);

router.post("/finalize-payment", bookingController.finalizeBookingForPayment);

// Récupérer les réservations en cours (Payées)
router.get("/in-progress", bookingController.getInProgressBookings);

// Récupérer les détails d'une réservation spécifique
router.get("/details/:id", bookingController.getBookingDetails);

// Annuler une réservation (révoquer la course)
router.patch("/cancel/:id", bookingController.cancelBooking);

router.post('/verify-distance', bookingController.verifyDistance);


module.exports = router;