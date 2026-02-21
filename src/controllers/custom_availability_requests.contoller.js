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
    // Get CUSTOM request by Booking ID
    // =========================
    getCustomRequestByBooking: async (req, res, next) => {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({
                    message: "L'identifiant de réservation (bookingId) est requis."
                });
            }

            const [rows] = await db.execute(
                `SELECT * FROM custom_availability_requests WHERE booking_id = ? LIMIT 1`,
                [bookingId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Aucune demande personnalisée trouvée pour cette réservation."
                });
            }

            return res.status(200).json({
                request: rows[0]
            });

        } catch (err) {
            return next(err);
        }
    }

}