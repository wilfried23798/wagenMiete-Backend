const db = require("../config/db");

function getDbMethod() {
    if (typeof db.execute === "function") return "execute";
    return "query";
}

module.exports = {

    // =========================
    // STEP 1 – Customer info
    // =========================
    createCustomerInfo: async (req, res, next) => {
        try {
            const {
                firstName,
                lastName,
                street,
                city,
                postalCode,
                country,
                phone,
                email,
            } = req.body;

            if (
                !firstName ||
                !lastName ||
                !street ||
                !city ||
                !postalCode ||
                !country ||
                !phone ||
                !email
            ) {
                return res.status(400).json({ message: "All fields are required." });
            }

            const sql = `
                INSERT INTO booking_customer_info
                (first_name, last_name, street, city, postal_code, country, phone, email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                firstName.trim(),
                lastName.trim(),
                street.trim(),
                city.trim(),
                postalCode.trim(),
                country.trim(),
                phone.trim(),
                email.trim().toLowerCase(),
            ];

            const method = getDbMethod();
            const [result] = await db[method](sql, values);

            res.status(201).json({
                message: "Customer info saved.",
                customerInfoId: result.insertId,
            });
        } catch (err) {
            next(err);
        }
    },

    // =========================
    // STEP 2 – Booking period
    // =========================
    createPeriod: async (req, res, next) => {
        try {
            const {
                customerInfoId,
                startDate,
                endDate,
            } = req.body;

            // ✅ validations
            if (!customerInfoId || !startDate || !endDate) {
                return res.status(400).json({
                    message: "customerInfoId, startDate and endDate are required.",
                });
            }

            if (new Date(endDate) < new Date(startDate)) {
                return res.status(400).json({
                    message: "End date must be the same or after start date.",
                });
            }

            const sql = `
                INSERT INTO booking_periods
                (customer_info_id, start_date, end_date)
                VALUES (?, ?, ?)
            `;

            const values = [
                Number(customerInfoId),
                startDate,
                endDate,
            ];

            const method = getDbMethod();
            const [result] = await db[method](sql, values);

            res.status(201).json({
                message: "Booking period saved.",
                periodId: result.insertId,
            });
        } catch (err) {
            next(err);
        }
    },

    // =========================
    // STEP 2.5 – Create booking (draft)
    // =========================
    createBookingDraft: async (req, res, next) => {
        try {
            const { customerInfoId, periodId } = req.body;

            if (!customerInfoId || !periodId) {
                return res.status(400).json({
                    message: "customerInfoId and periodId are required.",
                });
            }

            const sql = `
      INSERT INTO bookings (customer_info_id, period_id, status)
      VALUES (?, ?, 'draft')
    `;

            const method = getDbMethod();
            const [result] = await db[method](sql, [Number(customerInfoId), Number(periodId)]);

            return res.status(201).json({
                message: "Booking draft created.",
                bookingId: result.insertId,
            });
        } catch (err) {
            next(err);
        }
    },

    // =========================
    // STEP 3 – Booking options
    // =========================
    saveOptions: async (req, res, next) => {
        try {
            const { bookingId, basePrice, optionIds } = req.body;

            if (!bookingId || !Array.isArray(optionIds)) {
                return res.status(400).json({
                    message: "bookingId and optionIds[] are required.",
                });
            }

            const method = getDbMethod();

            // 1) Vérifier que le booking existe
            const [bkRows] = await db[method](
                `SELECT id FROM bookings WHERE id = ? LIMIT 1`,
                [Number(bookingId)]
            );
            if (!bkRows || bkRows.length === 0) {
                return res.status(404).json({ message: "Booking not found." });
            }

            // 2) Nettoyer les ids (uniques, int)
            const uniqueOptionIds = [...new Set(optionIds.map((x) => Number(x)).filter(Boolean))];

            // 3) On efface les options actuelles (car "modifiable anytime")
            await db[method](`DELETE FROM booking_options WHERE booking_id = ?`, [Number(bookingId)]);

            // 4) Récupérer les options + prix depuis table options (snapshot)
            let optionsTotal = 0;

            if (uniqueOptionIds.length > 0) {
                const placeholders = uniqueOptionIds.map(() => "?").join(",");
                const [optRows] = await db[method](
                    `SELECT id, price FROM options WHERE id IN (${placeholders})`,
                    uniqueOptionIds
                );

                // créer map id->price
                const priceMap = new Map(optRows.map((r) => [Number(r.id), Number(r.price)]));

                // Insert rows booking_options
                const insertSql = `
        INSERT INTO booking_options (booking_id, option_id, price, quantity)
        VALUES (?, ?, ?, 1)
      `;

                for (const optId of uniqueOptionIds) {
                    const price = priceMap.get(optId);
                    if (price == null) continue; // ignore option inexistante
                    optionsTotal += price;
                    await db[method](insertSql, [Number(bookingId), optId, price]);
                }
            }

            // 5) total price
            const base = basePrice != null ? Number(basePrice) : 0;
            const totalPrice = base + optionsTotal;

            // 6) Update booking total + status pending (ou garde draft si tu préfères)
            await db[method](
                `UPDATE bookings SET total_price = ?, status = 'pending' WHERE id = ?`,
                [totalPrice, Number(bookingId)]
            );

            return res.status(200).json({
                message: "Options saved.",
                bookingId: Number(bookingId),
                basePrice: base,
                optionsTotal,
                totalPrice,
            });
        } catch (err) {
            next(err);
        }
    },

};