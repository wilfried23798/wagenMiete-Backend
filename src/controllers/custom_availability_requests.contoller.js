const db = require("../config/db");

module.exports = {

    // =========================
    // Create CUSTOM availability request
    // =========================
    createCustomRequest: async (req, res, next) => {
        try {
            // On récupère les deux formats possibles pour éviter les erreurs 400
            const {
                bookingId,
                booking_id,
                requestedDate,
                requested_date,
                requestedTime,
                requested_time
            } = req.body;

            // On assigne la priorité au format SnakeCase (celui de la BDD et du front actuel)
            const finalBookingId = bookingId || booking_id;
            const finalDate = requestedDate || requested_date;
            const finalTime = requestedTime || requested_time;

            // Validation avec les variables unifiées
            if (!finalDate || !finalTime) {
                return res.status(400).json({
                    message: "La date et l'heure demandées sont requises."
                });
            }

            // Validation du format de date
            if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                return res.status(400).json({
                    message: "Format de date invalide. Utilisez YYYY-MM-DD."
                });
            }

            // Vérification du booking
            if (finalBookingId) {
                const [booking] = await db.execute(
                    `SELECT id FROM bookings WHERE id = ? LIMIT 1`,
                    [finalBookingId]
                );
                if (booking.length === 0) {
                    return res.status(404).json({ message: "Réservation parente introuvable." });
                }
            }

            // Insertion avec les variables unifiées
            const [insert] = await db.execute(
                `
            INSERT INTO custom_availability_requests 
            (booking_id, requested_date, requested_time, status)
            VALUES (?, ?, ?, 'pending')
            `,
                [finalBookingId || null, finalDate, finalTime]
            );

            const [rows] = await db.execute(
                `SELECT * FROM custom_availability_requests WHERE id = ? LIMIT 1`,
                [insert.insertId]
            );

            return res.status(201).json({
                message: "Demande de disponibilité personnalisée enregistrée.",
                request: rows[0]
            });

        } catch (err) {
            return next(err);
        }
    },

    // =========================
    // Get PENDING CUSTOM request by Booking ID
    // =========================
    getCustomRequestByBooking: async (req, res, next) => {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({
                    message: "L'identifiant de réservation (bookingId) est requis."
                });
            }

            // Mise à jour de la requête : On filtre strictement par le statut 'pending'
            const [rows] = await db.execute(
                `SELECT * FROM custom_availability_requests 
                 WHERE booking_id = ? 
                 AND status = 'pending' 
                 LIMIT 1`,
                [Number(bookingId)]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Aucune demande personnalisée en attente trouvée pour cette réservation."
                });
            }

            return res.status(200).json({
                request: rows[0]
            });

        } catch (err) {
            console.error("Error in getCustomRequestByBooking:", err);
            return next(err);
        }
    },

    // =========================
    // Update CUSTOM availability request
    // =========================
    updateCustomRequest: async (req, res, next) => {
        try {
            const { id } = req.params; // ID de la requête personnalisée
            const {
                requested_date,
                requested_time,
                status
            } = req.body;

            // 1. Vérifier si la requête existe
            const [existing] = await db.execute(
                `SELECT * FROM custom_availability_requests WHERE id = ? LIMIT 1`,
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({ message: "Demande personnalisée introuvable." });
            }

            // 2. Préparer les champs à mettre à jour dynamiquement
            const updates = [];
            const params = [];

            if (requested_date) {
                updates.push("requested_date = ?");
                params.push(requested_date);
            }
            if (requested_time) {
                updates.push("requested_time = ?");
                params.push(requested_time);
            }
            if (status) {
                updates.push("status = ?");
                params.push(status);
            }

            if (updates.length === 0) {
                return res.status(400).json({ message: "Aucune donnée fournie pour la mise à jour." });
            }

            // 3. Exécuter la mise à jour
            params.push(id);
            await db.execute(
                `UPDATE custom_availability_requests SET ${updates.join(", ")} WHERE id = ?`,
                params
            );

            // 4. Récupérer la version mise à jour
            const [updatedRow] = await db.execute(
                `SELECT * FROM custom_availability_requests WHERE id = ?`,
                [id]
            );

            return res.status(200).json({
                message: "Demande mise à jour avec succès.",
                request: updatedRow[0]
            });

        } catch (err) {
            return next(err);
        }
    },

    // =========================
    // Get all APPROVED (Reserved) custom requests
    // Useful for marking calendar days as busy
    // =========================
    getReservedCustomRequests: async (req, res, next) => {
        try {
            // On récupère les demandes 'approved' car elles font office de réservations
            const [rows] = await db.execute(
                `SELECT requested_date, requested_time, booking_id 
                 FROM custom_availability_requests 
                 WHERE status = 'approved'
                 ORDER BY requested_date ASC`
            );

            return res.status(200).json({
                count: rows.length,
                reservedRequests: rows
            });

        } catch (err) {
            console.error("Error in getReservedCustomRequests:", err);
            return next(err);
        }
    },

}