// src/app.js
const express = require("express");
const cors = require("cors");
require('dotenv').config();

// ✅ Import routes
const authRoutes = require("./routes/auth.routes");
const optionsRoutes = require("./routes/options.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const vehicleImagesRoutes = require("./routes/vehicleImages.routes");
const bookingRoutes = require("./routes/booking.routes");
const availabilityRoutes = require("./routes/availability.routes");
const pricingRoutes = require("./routes/pricing.routes");
const customAvailabilityRoutes = require("./routes/custom_availability_requests.routes");
const contactRoutes = require("./routes/contact.routes");

const app = express();

// ✅ Middlewares (body parsers)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:4200")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Autoriser Postman/curl (origin undefined)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) return callback(null, true);

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

// ✅ Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "WagenMiete API" });
});

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/options", optionsRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/vehicle/images", vehicleImagesRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/custom-availability", customAvailabilityRoutes);
app.use("/api/contact", contactRoutes);

// ✅ 404 API (si route inconnue)
app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found" });
});

// ✅ Global error handler (catch erreurs)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);

    const status = err.status || 500;
    const message = err.message || "Server error";

    res.status(status).json({ message });
});

module.exports = app;