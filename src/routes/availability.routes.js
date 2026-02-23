const express = require("express");
const router = express.Router();
const availabilityController = require("../controllers/availability.controller");

router.post("/", availabilityController.createAvailability);

router.get("/day", availabilityController.getAvailabilitiesByDay);

router.get("/", availabilityController.getAllAvailabilities);

router.delete("/:id", availabilityController.deleteAvailability);

router.post("/night", availabilityController.createNightAvailability);

router.delete("/night/:id", availabilityController.deleteNightAvailability);

router.get("/unreserved", availabilityController.getUnreservedAvailabilities);

module.exports = router;