const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller"); // Assurez-vous du chemin

// Route pour l'accès discret admin
router.post("/verify-admin", authController.verifyAdminEmail);

// Route pour le désabonnement (Camouflage)
router.post("/unsubscribe", authController.unsubscribeNewsletter);

module.exports = router;