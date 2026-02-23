const express = require("express");
const router = express.Router();
const customAvailabilityController = require("../controllers/custom_availability_requests.contoller");

// Créer une demande
router.post("/custom-request", customAvailabilityController.createCustomRequest);

// Récupérer par ID de réservation
router.get("/booking/:bookingId", customAvailabilityController.getCustomRequestByBooking);

// Modifier une demande existante par son ID
router.patch("/:id", customAvailabilityController.updateCustomRequest);

// Récupérer les demandes personnalisées réservées
router.get("/reserved", customAvailabilityController.getReservedCustomRequests);

module.exports = router;