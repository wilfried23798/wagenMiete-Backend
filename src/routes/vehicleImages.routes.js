const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload");
const vehicleImagesController = require("../controllers/vehicleImages.controller");

// GET /api/vehicle/images
router.get("/", vehicleImagesController.getVehicleImages);

// PUT /api/vehicle/images
router.put("/", vehicleImagesController.updateVehicleImages);

// POST /api/vehicle/images/upload
router.post(
  "/upload",
  upload.single("image"),
  vehicleImagesController.uploadVehicleImage
);

module.exports = router;