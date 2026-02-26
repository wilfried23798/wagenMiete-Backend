const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller"); // Assurez-vous du chemin

// Route pour l'accès discret admin
router.post("/verify-admin", authController.verifyAdminEmail);

// Route pour le désabonnement (Camouflage)
router.post("/unsubscribe", authController.unsubscribeNewsletter);

// Routes supplémentaires pour la gestion des abonnés (optionnel, à sécuriser en production)
router.get("/subscribers", authController.getAllSubscribers);

// Route pour supprimer un abonné (optionnel, à sécuriser en production)
router.delete("/subscribers/:id", authController.deleteSubscriber);

module.exports = router;