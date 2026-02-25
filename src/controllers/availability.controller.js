const db = require("../config/db");

module.exports = {

    // =========================
    // Create availability
    // =========================
    createAvailability: async (req, res, next) => {
        try {
            const {
                vehicleId = null,
                startDateTime,
                endDateTime,
                status = "available",
                note = null
            } = req.body;

            if (!startDateTime || !endDateTime) {
                return res.status(400).json({
                    message: "startDateTime et endDateTime sont requis."
                });
            }

            // validation dates
            const start = new Date(startDateTime);
            const end = new Date(endDateTime);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    message: "Format de date invalide (startDateTime/endDateTime)."
                });
            }

            if (end <= start) {
                return res.status(400).json({
                    message: "endDateTime doit être supérieur à startDateTime."
                });
            }

            if (!["available", "blocked"].includes(status)) {
                return res.status(400).json({
                    message: "status doit être 'available' ou 'blocked'."
                });
            }

            // Anti-chevauchement (par vehicle si vehicleId fourni, sinon global)
            // overlap: existing.start < newEnd AND existing.end > newStart
            const [conflicts] = await db.execute(
                `
        SELECT id
        FROM availabilities
        WHERE (? IS NULL OR vehicleId = ?)
          AND startDateTime < ?
          AND endDateTime > ?
        LIMIT 1
        `,
                [vehicleId, vehicleId, endDateTime, startDateTime]
            );

            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: "Ce créneau chevauche déjà une disponibilité existante.",
                    conflictId: conflicts[0].id
                });
            }

            const [insert] = await db.execute(
                `
        INSERT INTO availabilities (vehicleId, startDateTime, endDateTime, status, note)
        VALUES (?, ?, ?, ?, ?)
        `,
                [vehicleId, startDateTime, endDateTime, status, note]
            );

            const [rows] = await db.execute(
                `SELECT * FROM availabilities WHERE id = ? LIMIT 1`,
                [insert.insertId]
            );

            return res.status(201).json({
                message: "Disponibilité créée avec succès.",
                availability: rows[0]
            });

        } catch (err) {
            return next(err);
        }
    },

    getAvailabilitiesByDay: async (req, res, next) => {
        try {
            const { date, vehicleId } = req.query;

            if (!date) {
                return res.status(400).json({ message: "Le paramètre 'date' est requis (YYYY-MM-DD)." });
            }

            // Simple validation format YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return res.status(400).json({ message: "Format 'date' invalide. Exemple: 2026-02-10" });
            }

            const start = `${date} 00:00:00`;
            const end = `${date} 23:59:59`;

            let sql = `
        SELECT id, vehicleId, startDateTime, endDateTime, status, note, createdAt, updatedAt
        FROM availabilities
        WHERE startDateTime >= ? AND startDateTime <= ?
      `;
            const params = [start, end];

            if (vehicleId) {
                sql += ` AND vehicleId = ?`;
                params.push(vehicleId);
            }

            sql += ` ORDER BY startDateTime ASC`;

            const [rows] = await db.execute(sql, params);

            return res.status(200).json({
                date,
                count: rows.length,
                availabilities: rows
            });

        } catch (err) {
            return next(err);
        }
    },

    getAllAvailabilities: async (req, res, next) => {
        try {
            const { vehicleId, status, from, to } = req.query;

            let sql = `
        SELECT id, vehicleId, startDateTime, endDateTime, status, note, createdAt, updatedAt
        FROM availabilities
        WHERE 1=1
      `;
            const params = [];

            if (vehicleId) {
                sql += ` AND vehicleId = ?`;
                params.push(vehicleId);
            }

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            if (from) {
                sql += ` AND startDateTime >= ?`;
                params.push(from);
            }

            if (to) {
                sql += ` AND endDateTime <= ?`;
                params.push(to);
            }

            sql += ` ORDER BY startDateTime ASC`;

            const [rows] = await db.execute(sql, params);

            return res.status(200).json({
                count: rows.length,
                availabilities: rows
            });

        } catch (err) {
            return next(err);
        }
    },

    deleteAvailability: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Availability id is required" });
            }

            const [result] = await db.execute(
                `DELETE FROM availabilities WHERE id = ?`,
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Availability not found" });
            }

            return res.status(200).json({
                message: "Availability deleted successfully"
            });

        } catch (err) {
            return next(err);
        }
    },

    // =========================================================================
    // Récupérer les disponibilités 'available' ou 'pending' non bloquées
    // =========================================================================
    getUnreservedAvailabilities: async (req, res, next) => {
        try {
            const { vehicleId, date } = req.query;

            // MODIFICATION : On accepte désormais les statuts 'available' ET 'pending'
            let sql = `
            SELECT a.*
            FROM availabilities a
            WHERE a.status IN ('available', 'pending')
        `;
            const params = [];

            if (date) {
                sql += ` AND DATE(a.startDateTime) = ?`;
                params.push(date);
            }

            if (vehicleId) {
                sql += ` AND a.vehicleId = ?`;
                params.push(vehicleId);
            }

            /* LOGIQUE D'EXCLUSION :
               On n'exclut la disponibilité que si un booking "définitif" existe.
               Un booking est considéré comme définitif s'il n'est ni 'cancelled' ni 'pending' 
               (car un booking 'pending' ne doit pas encore bloquer la visibilité).
            */
            sql += `
            AND NOT EXISTS (
                SELECT 1 
                FROM bookings b 
                WHERE b.status NOT IN ('cancelled', 'pending', 'draft')
                AND b.arrival_time IS NOT NULL
                AND b.arrival_time = TIME(a.startDateTime)
                AND DATE(b.created_at) = DATE(a.startDateTime)
            )
        `;

            sql += ` ORDER BY a.startDateTime ASC`;

            const [rows] = await db.execute(sql, params);

            return res.status(200).json({
                count: rows.length,
                availabilities: rows
            });
        } catch (err) {
            return next(err);
        }
    },

    // =========================
    // Create NIGHT availability
    // =========================
    createNightAvailability: async (req, res, next) => {
        try {
            const {
                vehicleId = null,
                date,          // "YYYY-MM-DD"
                startTime,     // "HH:mm"
                endTime        // "HH:mm"
            } = req.body;

            if (!date || !startTime || !endTime) {
                return res.status(400).json({
                    message: "date, startTime et endTime sont requis."
                });
            }

            // Construire les datetime
            let startDateTime = `${date} ${startTime}:00`;
            let endDateTime = `${date} ${endTime}:00`;

            const start = new Date(startDateTime);
            let end = new Date(endDateTime);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    message: "Format date/heure invalide."
                });
            }

            // Si fin < début → on considère que ça traverse minuit
            if (end <= start) {
                end.setDate(end.getDate() + 1);
                endDateTime = end.toISOString().slice(0, 19).replace("T", " ");
            }

            // Validation NIGHT (après 20h ou traverse minuit)
            const startHour = start.getHours();

            if (startHour < 20 && end > start && end.getDate() === start.getDate()) {
                return res.status(400).json({
                    message: "Une disponibilité nuit doit commencer après 20h ou traverser minuit."
                });
            }

            // Anti-chevauchement
            const [conflicts] = await db.execute(
                `
            SELECT id
            FROM availabilities
            WHERE (? IS NULL OR vehicleId = ?)
              AND startDateTime < ?
              AND endDateTime > ?
            LIMIT 1
            `,
                [vehicleId, vehicleId, endDateTime, startDateTime]
            );

            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: "Ce créneau nuit chevauche une disponibilité existante.",
                    conflictId: conflicts[0].id
                });
            }

            const [insert] = await db.execute(
                `
            INSERT INTO availabilities 
            (vehicleId, startDateTime, endDateTime, status, note)
            VALUES (?, ?, ?, 'available', 'night')
            `,
                [vehicleId, startDateTime, endDateTime]
            );

            const [rows] = await db.execute(
                `SELECT * FROM availabilities WHERE id = ? LIMIT 1`,
                [insert.insertId]
            );

            return res.status(201).json({
                message: "Disponibilité nuit créée avec succès.",
                availability: rows[0]
            });

        } catch (err) {
            return next(err);
        }
    },

    // =========================
    // Delete NIGHT availability
    // =========================
    deleteNightAvailability: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Availability id is required" });
            }

            const [result] = await db.execute(
                `
            DELETE FROM availabilities 
            WHERE id = ? AND note = 'night'
            `,
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Night availability not found"
                });
            }

            return res.status(200).json({
                message: "Night availability deleted successfully"
            });

        } catch (err) {
            return next(err);
        }
    },

    // =====================================
    // Get all NIGHT availabilities
    // =====================================
    getNightAvailabilities: async (req, res, next) => {
        try {
            // On récupère les créneaux qui ont la note 'night'
            // OU ceux qui commencent après 20h (sécurité si la note est absente)
            const [rows] = await db.execute(
                `
            SELECT * FROM availabilities 
            WHERE note = 'night' 
               OR HOUR(startDateTime) >= 20 
               OR HOUR(startDateTime) < 5
            ORDER BY startDateTime ASC
            `
            );

            return res.status(200).json({
                count: rows.length,
                availabilities: rows
            });
        } catch (err) {
            return next(err);
        }
    },


};