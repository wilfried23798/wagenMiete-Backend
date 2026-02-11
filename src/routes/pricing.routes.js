const express = require("express");
const router = express.Router();

const pricingController = require("../controllers/pricing.controller");

// GET + PUT sans id
router.get("/nightlife", pricingController.getNightlifePricing);
router.put("/nightlife", pricingController.upsertNightlifePricing);

router.get("/standard-smart", pricingController.getStandardSmartPricing);
router.put("/standard-smart", pricingController.upsertStandardSmartPricing);

router.get("/go-direct", pricingController.getGoDirectPricing);
router.put("/go-direct", pricingController.upsertGoDirectPricing);

router.get("/celebration", pricingController.getCelebrationPricing);
router.put("/celebration", pricingController.upsertCelebrationPricing);

module.exports = router;