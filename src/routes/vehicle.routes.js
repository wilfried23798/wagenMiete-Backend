const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicle.controller");

// 🚗 Vehicle
router.get("/", vehicleController.getVehicle);

router.put("/", vehicleController.updateVehicle);

module.exports = router;