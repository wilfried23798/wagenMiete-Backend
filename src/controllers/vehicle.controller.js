const db = require("../config/db");

module.exports = {
    // GET /api/vehicle
    getVehicle: async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT 
          id,
          make, model, year, fuelType, horsepower, color,
          plateNumber, seats, transmission, pricePerDay
        FROM vehicle
        ORDER BY id ASC
        LIMIT 1`
            );

            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }

            return res.json(rows[0]);
        } catch (err) {
            console.error("getVehicle error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

    // PUT /api/vehicle
    updateVehicle: async (req, res) => {
        try {
            // ✅ Supporte les 2 noms (frontend: brand/fuel, backend: make/fuelType)
            const make = req.body.make ?? req.body.brand;
            const model = req.body.model;
            const year = req.body.year;
            const fuelType = req.body.fuelType ?? req.body.fuel;
            const horsepower = req.body.horsepower;
            const color = req.body.color;

            // ✅ Champs additionnels (si présents)
            const plateNumber = req.body.plateNumber ?? null;
            const seats = req.body.seats ?? null;
            const transmission = req.body.transmission ?? null;
            const pricePerDay = req.body.pricePerDay ?? null;

            // règles minimales
            if (!make || !model || year === undefined || !fuelType || horsepower === undefined || !color) {
                return res.status(400).json({
                    message: "make, model, year, fuelType, horsepower, color are required",
                });
            }

            // une seule voiture -> on update la première
            const [current] = await db.query("SELECT id FROM vehicle ORDER BY id ASC LIMIT 1");
            if (!current || current.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }

            const id = current[0].id;

            const [result] = await db.query(
                `UPDATE vehicle
         SET 
           make = ?, model = ?, year = ?, fuelType = ?, horsepower = ?, color = ?,
           plateNumber = ?, seats = ?, transmission = ?, pricePerDay = ?
         WHERE id = ?`,
                [
                    make,
                    model,
                    Number(year),
                    fuelType,
                    Number(horsepower),
                    color,
                    plateNumber,
                    seats !== null ? Number(seats) : null,
                    transmission,
                    pricePerDay !== null ? Number(pricePerDay) : null,
                    Number(id),
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }

            return res.json({
                id,
                make,
                model,
                year: Number(year),
                fuelType,
                horsepower: Number(horsepower),
                color,
                plateNumber,
                seats: seats !== null ? Number(seats) : null,
                transmission,
                pricePerDay: pricePerDay !== null ? Number(pricePerDay) : null,
            });
        } catch (err) {
            console.error("updateVehicle error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },
};