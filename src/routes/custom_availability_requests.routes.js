const express = require("express");
const router = express.Router();
const customAvailabilityController = require("../controllers/custom_availability_requests.contoller");

// Créer une demande
router.post("/custom-request", customAvailabilityController.createCustomRequest);

// Récupérer par ID de réservation
router.get("/booking/:bookingId", customAvailabilityController.getCustomRequestByBooking);

module.exports = router;