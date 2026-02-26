// controllers/vehicleImages.controller.js
const db = require("../config/db");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

module.exports = {
    // ==========================================
    // VEHICLE IMAGES (Galerie de 6 images max par véhicule)
    // ==========================================
    getVehicleImages: async (req, res) => {
        try {
            const [vehRows] = await db.query("SELECT id FROM vehicle ORDER BY id ASC LIMIT 1");
            if (!vehRows || vehRows.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }
            const vehicleId = vehRows[0].id;

            const [rows] = await db.query(
                `SELECT id, vehicle_id AS vehicleId, position, url, public_id AS publicId
         FROM vehicle_images
         WHERE vehicle_id = ?
         ORDER BY position ASC`,
                [vehicleId]
            );

            return res.json(rows);
        } catch (err) {
            console.error("getVehicleImages error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

    // ==========================================
    // POST /api/vehicle/images  (UPSERT complet de la galerie, max 6 images)
    // ==========================================
    updateVehicleImages: async (req, res) => {
        try {
            const { images } = req.body;

            if (!Array.isArray(images)) {
                return res.status(400).json({ message: "images must be an array" });
            }
            if (images.length > 6) {
                return res.status(400).json({ message: "Maximum 6 images allowed" });
            }

            const positions = new Set();
            for (const img of images) {
                const pos = Number(img.position);
                const url = String(img.url || "").trim();

                if (!pos || pos < 1 || pos > 6) {
                    return res.status(400).json({ message: "position must be between 1 and 6" });
                }
                if (!url) {
                    return res.status(400).json({ message: "url is required for each image" });
                }
                if (positions.has(pos)) {
                    return res.status(400).json({ message: `Duplicate position ${pos}` });
                }
                positions.add(pos);
            }

            const [vehRows] = await db.query("SELECT id FROM vehicle ORDER BY id ASC LIMIT 1");
            if (!vehRows || vehRows.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }
            const vehicleId = vehRows[0].id;

            await db.query("START TRANSACTION");
            await db.query("DELETE FROM vehicle_images WHERE vehicle_id = ?", [vehicleId]);

            for (const img of images) {
                await db.query(
                    `INSERT INTO vehicle_images (vehicle_id, position, url, public_id)
           VALUES (?, ?, ?, ?)`,
                    [
                        vehicleId,
                        Number(img.position),
                        String(img.url).trim(),
                        img.publicId ? String(img.publicId).trim() : null
                    ]
                );
            }

            await db.query("COMMIT");

            const [rows] = await db.query(
                `SELECT id, vehicle_id AS vehicleId, position, url, public_id AS publicId
         FROM vehicle_images
         WHERE vehicle_id = ?
         ORDER BY position ASC`,
                [vehicleId]
            );

            return res.json({ message: "Vehicle images updated", images: rows });
        } catch (err) {
            console.error("updateVehicleImages error:", err);
            try { await db.query("ROLLBACK"); } catch (_) { }
            return res.status(500).json({ message: "Server error" });
        }
    },

    // ==========================================
    // POST /api/vehicle/images/upload  (Upload d’une image à une position précise, remplace l’image existante si déjà présente)
    // ==========================================
    uploadVehicleImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image provided" });
            }

            const position = Number(req.body.position);
            if (!position || position < 1 || position > 6) {
                return res.status(400).json({ message: "position is required (1..6)" });
            }

            const [vehRows] = await db.query("SELECT id FROM vehicle ORDER BY id ASC LIMIT 1");
            if (!vehRows || vehRows.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }
            const vehicleId = vehRows[0].id;

            const folder = process.env.CLOUDINARY_FOLDER || "wagenmiete/vehicle";

            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder, resource_type: "image" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

            const url = uploadResult.secure_url;
            const publicId = uploadResult.public_id;

            // ✅ UPSERT: si image déjà sur cette position, on remplace
            // (Optionnel: supprimer l’ancienne image Cloudinary si old public_id existe)
            const [existing] = await db.query(
                `SELECT id, public_id AS publicId FROM vehicle_images WHERE vehicle_id = ? AND position = ? LIMIT 1`,
                [vehicleId, position]
            );

            if (existing && existing.length > 0) {
                const oldPublicId = existing[0].publicId;

                // optionnel: delete ancienne image cloudinary
                if (oldPublicId) {
                    try { await cloudinary.uploader.destroy(oldPublicId); } catch (_) { }
                }

                await db.query(
                    `UPDATE vehicle_images 
           SET url = ?, public_id = ?, updated_at = NOW()
           WHERE vehicle_id = ? AND position = ?`,
                    [url, publicId, vehicleId, position]
                );
            } else {
                await db.query(
                    `INSERT INTO vehicle_images (vehicle_id, position, url, public_id)
           VALUES (?, ?, ?, ?)`,
                    [vehicleId, position, url, publicId]
                );
            }

            // renvoyer la galerie mise à jour
            const [rows] = await db.query(
                `SELECT id, vehicle_id AS vehicleId, position, url, public_id AS publicId
         FROM vehicle_images
         WHERE vehicle_id = ?
         ORDER BY position ASC`,
                [vehicleId]
            );

            return res.json({
                message: "Image uploaded & saved",
                images: rows
            });
        } catch (err) {
            console.error("uploadVehicleImage error:", err);
            return res.status(500).json({ message: "Cloudinary upload failed" });
        }
    },

    // ==========================================
    // GET /api/vehicle/images/:position (Récupère une image spécifique par sa position)
    // ==========================================
    getVehicleImageByPosition: async (req, res) => {
        try {
            const position = Number(req.params.position);
            if (!position || position < 1 || position > 6) {
                return res.status(400).json({ message: "Invalid position (1..6)" });
            }

            // On récupère l'ID du premier véhicule
            const [vehRows] = await db.query("SELECT id FROM vehicle ORDER BY id ASC LIMIT 1");
            if (!vehRows || vehRows.length === 0) {
                return res.status(404).json({ message: "Vehicle not found" });
            }
            const vehicleId = vehRows[0].id;

            // Requête pour l'image spécifique
            const [rows] = await db.query(
                `SELECT id, vehicle_id AS vehicleId, position, url, public_id AS publicId
             FROM vehicle_images
             WHERE vehicle_id = ? AND position = ?
             LIMIT 1`,
                [vehicleId, position]
            );

            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: `No image found at position ${position}` });
            }

            return res.json(rows[0]);
        } catch (err) {
            console.error("getVehicleImageByPosition error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

};