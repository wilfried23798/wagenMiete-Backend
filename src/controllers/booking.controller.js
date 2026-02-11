const db = require("../config/db");
const { transporter, fromEmail } = require("../../templates/emails/transporter");
const bookingConfirmationTemplate = require("../../templates/emails/booking-confirmation.template");

function getDbMethod() {
  if (typeof db.execute === "function") return "execute";
  return "query";
}

module.exports = {

  // =========================
  // STEP 1 – Create booking draft + customer info
  // =========================
  createBookingDraftStep1: async (req, res, next) => {
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

      const method = getDbMethod();

      // 1) insert customer info
      const customerSql = `
        INSERT INTO booking_customer_info
        (first_name, last_name, street, city, postal_code, country, phone, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const customerValues = [
        firstName.trim(),
        lastName.trim(),
        street.trim(),
        city.trim(),
        postalCode.trim(),
        country.trim(),
        phone.trim(),
        email.trim().toLowerCase(),
      ];

      const [customerRes] = await db[method](customerSql, customerValues);
      const customerInfoId = customerRes.insertId;

      // 2) create booking draft immediately
      const bookingSql = `
        INSERT INTO bookings (customer_info_id, status)
        VALUES (?, 'draft')
      `;
      const [bookingRes] = await db[method](bookingSql, [Number(customerInfoId)]);
      const bookingId = bookingRes.insertId;

      return res.status(201).json({
        message: "Booking draft created (step 1).",
        bookingId,
        customerInfoId,
      });
    } catch (err) {
      next(err);
    }
  },

  // =========================
  // STEP 2 – Choose package
  // =========================
  setBookingPackage: async (req, res, next) => {
    try {
      const { bookingId, packageType } = req.body;

      if (!bookingId || !packageType) {
        return res.status(400).json({
          message: "bookingId and packageType are required.",
        });
      }

      const allowed = ["go-direct", "standard", "celebration", "nightlife"];
      if (!allowed.includes(packageType)) {
        return res.status(400).json({
          message: "Invalid packageType. Allowed: go-direct, standard, celebration, nightlife.",
        });
      }

      const method = getDbMethod();

      // 1) vérifier booking existe
      const [bkRows] = await db[method](
        `SELECT id, currency FROM bookings WHERE id = ? LIMIT 1`,
        [Number(bookingId)]
      );
      if (!bkRows || bkRows.length === 0) {
        return res.status(404).json({ message: "Booking not found." });
      }

      // 2) récupérer pricing actif selon packageType
      const map = {
        "go-direct": {
          table: "pricing_go_direct",
          priceField: "minimumPrice",
          where: "isActive = 1",
        },
        "standard": {
          table: "pricing_standard_smart",
          priceField: "price",
          where: "isActive = 1",
        },
        "celebration": {
          table: "pricing_celebration",
          priceField: "price",
          where: "isActive = 1",
        },
        "nightlife": {
          table: "pricing_nightlife",
          priceField: "price",
          where: "isActive = 1",
        },
      };

      const cfg = map[packageType];

      const [pRows] = await db[method](
        `SELECT * FROM ${cfg.table} WHERE ${cfg.where} ORDER BY id DESC LIMIT 1`
      );

      if (!pRows || pRows.length === 0) {
        return res.status(404).json({
          message: `No active pricing found for ${packageType}.`,
        });
      }

      const pricing = pRows[0];
      const pricingId = Number(pricing.id);

      // prix de base à enregistrer dans bookings.total_price
      const basePrice = pricing?.[cfg.priceField];
      const basePriceNumber = basePrice != null ? Number(basePrice) : null;

      // snapshot JSON (utile si les prix changent plus tard)
      const snapshot = JSON.stringify(pricing);

      // 3) upsert booking_packages (1 row par booking)
      const [existing] = await db[method](
        `SELECT id FROM booking_packages WHERE booking_id = ? LIMIT 1`,
        [Number(bookingId)]
      );

      let packageId = null;

      if (existing && existing.length > 0) {
        packageId = Number(existing[0].id);

        await db[method](
          `UPDATE booking_packages
         SET package_type = ?, pricing_table = ?, pricing_id = ?, pricing_snapshot = ?
         WHERE booking_id = ?`,
          [packageType, cfg.table, pricingId, snapshot, Number(bookingId)]
        );
      } else {
        const [ins] = await db[method](
          `INSERT INTO booking_packages (booking_id, package_type, pricing_table, pricing_id, pricing_snapshot)
         VALUES (?, ?, ?, ?, ?)`,
          [Number(bookingId), packageType, cfg.table, pricingId, snapshot]
        );
        packageId = ins.insertId;
      }

      // 4) update bookings.total_price (prix base)
      // (go-direct => minimumPrice, standard/celebration/nightlife => price)
      if (basePriceNumber != null) {
        await db[method](
          `UPDATE bookings
         SET total_price = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
          [basePriceNumber, Number(bookingId)]
        );
      }

      return res.status(200).json({
        message: "Booking package saved.",
        bookingId: Number(bookingId),
        packageId,
        packageType,
        pricing: {
          table: cfg.table,
          id: pricingId,
          snapshot: pricing, // renvoyé pour affichage côté front
        },
        totalPrice: basePriceNumber,
        currency: bkRows[0]?.currency || "EUR",
      });
    } catch (err) {
      next(err);
    }
  },

  // =========================
  // STEP 3 – Set options + update total price (update booking)
  // =========================
  setBookingOptionsAndPrice: async (req, res, next) => {
    try {
      const { bookingId, basePrice, optionIds } = req.body;

      if (!bookingId) {
        return res.status(400).json({ message: "bookingId is required." });
      }

      if (!Array.isArray(optionIds)) {
        return res.status(400).json({ message: "optionIds must be an array." });
      }

      const method = getDbMethod();

      // 1) booking exists + status check
      const [bkRows] = await db[method](
        `SELECT id, status FROM bookings WHERE id = ? LIMIT 1`,
        [Number(bookingId)]
      );

      if (!bkRows || bkRows.length === 0) {
        return res.status(404).json({ message: "Booking not found." });
      }

      const booking = bkRows[0];

      // ✅ SÉCURITÉ MÉTIER
      // Une réservation déjà payée ne doit PLUS être modifiable
      if (booking.status === 'in_progress') {
        return res.status(400).json({
          message: "Booking already paid. Options cannot be modified.",
        });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({
          message: "Cancelled booking cannot be modified.",
        });
      }

      // 2) sanitize option ids
      const uniqueOptionIds = [
        ...new Set(optionIds.map((x) => Number(x)).filter(Boolean))
      ];

      // 3) remove existing options
      await db[method](
        `DELETE FROM booking_options WHERE booking_id = ?`,
        [Number(bookingId)]
      );

      // 4) load prices + snapshot
      let optionsTotal = 0;
      const insertedOptions = [];

      if (uniqueOptionIds.length > 0) {
        const placeholders = uniqueOptionIds.map(() => "?").join(",");

        const [optRows] = await db[method](
          `SELECT id, price FROM options WHERE id IN (${placeholders})`,
          uniqueOptionIds
        );

        const priceMap = new Map(
          optRows.map((r) => [Number(r.id), Number(r.price)])
        );

        const insertSql = `
        INSERT INTO booking_options (booking_id, option_id, price, quantity)
        VALUES (?, ?, ?, ?)
      `;

        for (const optId of uniqueOptionIds) {
          const price = priceMap.get(optId);
          if (price == null) continue;

          optionsTotal += price;

          await db[method](insertSql, [
            Number(bookingId),
            optId,
            price,
            1
          ]);

          insertedOptions.push({
            optionId: optId,
            price,
            quantity: 1
          });
        }
      }

      // 5) compute total
      const base = basePrice != null ? Number(basePrice) : 0;
      const totalPrice = base + optionsTotal;

      // 6) ✅ STEP 3 = TOUJOURS pending (et jamais in_progress)
      await db[method](
        `
      UPDATE bookings
      SET total_price = ?, status = 'pending'
      WHERE id = ?
      `,
        [totalPrice, Number(bookingId)]
      );

      return res.status(200).json({
        message: "Booking updated with options.",
        bookingId: Number(bookingId),
        basePrice: base,
        optionsTotal,
        totalPrice,
        status: "pending",
        options: insertedOptions
      });

    } catch (err) {
      next(err);
    }
  },

  // FINALIZE – Prepare booking for payment (status: pending)
  // NOW: based on PACKAGE price (no period required)
finalizeBookingForPayment: async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required." });
    }

    const method = getDbMethod();

    // 1) Load booking (status + currency + customer email)
    const [bkRows] = await db[method](
      `
      SELECT 
        b.id,
        b.status,
        b.currency,
        ci.email AS customerEmail
      FROM bookings b
      LEFT JOIN booking_customer_info ci ON ci.id = b.customer_info_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [Number(bookingId)]
    );

    if (!bkRows || bkRows.length === 0) {
      return res.status(404).json({ message: "Booking not found." });
    }

    const bk = bkRows[0];

    // 2) Blocking states
    if (bk.status === "in_progress") {
      return res.status(200).json({
        message: "Booking already in progress.",
        bookingId: Number(bookingId),
        status: "in_progress",
        currency: bk.currency || "EUR",
        email: { to: bk.customerEmail || null, sent: false },
      });
    }

    if (bk.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is cancelled and cannot be paid.",
        bookingId: Number(bookingId),
        status: "cancelled",
      });
    }

    if (bk.status === "terminated") {
      return res.status(400).json({
        message: "Booking already terminated.",
        bookingId: Number(bookingId),
        status: "terminated",
      });
    }

    // 3) Load selected package
    const [pkgRows] = await db[method](
      `
      SELECT 
        id,
        package_type,
        pricing_table,
        pricing_id,
        pricing_snapshot
      FROM booking_packages
      WHERE booking_id = ?
      LIMIT 1
      `,
      [Number(bookingId)]
    );

    if (!pkgRows || pkgRows.length === 0) {
      return res.status(400).json({
        message: "Booking package is missing. Please choose a package first.",
      });
    }

    const pkg = pkgRows[0];
    const packageType = (pkg.package_type || "").toString();
    const pricingTable = (pkg.pricing_table || "").toString();
    const pricingId = Number(pkg.pricing_id);

    // whitelist tables to avoid SQL injection
    const allowedTables = new Set([
      "pricing_go_direct",
      "pricing_standard_smart",
      "pricing_celebration",
      "pricing_nightlife",
    ]);

    if (!allowedTables.has(pricingTable) || !Number.isFinite(pricingId) || pricingId <= 0) {
      return res.status(400).json({ message: "Invalid package pricing reference." });
    }

    // 4) Load pricing row (source of truth)
    const [priceRows] = await db[method](
      `SELECT * FROM ${pricingTable} WHERE id = ? LIMIT 1`,
      [pricingId]
    );

    if (!priceRows || priceRows.length === 0) {
      return res.status(404).json({ message: "Package pricing not found." });
    }

    const pricing = priceRows[0];

    let packagePrice = null;
    if (pricingTable === "pricing_go_direct") packagePrice = pricing.minimumPrice;
    else packagePrice = pricing.price;

    const packagePriceNumber = packagePrice != null ? Number(packagePrice) : null;
    if (!Number.isFinite(packagePriceNumber) || packagePriceNumber < 0) {
      return res.status(400).json({ message: "Invalid package price." });
    }

    // 5) Options total
    const [optRows] = await db[method](
      `
      SELECT COALESCE(SUM(price * COALESCE(quantity, 1)), 0) AS optionsTotal
      FROM booking_options
      WHERE booking_id = ?
      `,
      [Number(bookingId)]
    );

    const optionsTotal = Number(optRows?.[0]?.optionsTotal || 0);

    // 6) Total
    const totalPrice = Number((packagePriceNumber + optionsTotal).toFixed(2));

    // 7) Finalize booking = in_progress
    await db[method](
      `
      UPDATE bookings
      SET total_price = ?, status = 'in_progress'
      WHERE id = ?
      `,
      [totalPrice, Number(bookingId)]
    );

    // 8) EMAIL (ne bloque jamais la finalisation) + infos réservation
    let emailSent = false;
    const to = (bk.customerEmail || "").toString().trim();

    try {
      if (to) {
        const { transporter, fromEmail } = require("../../templates/emails/transporter");
        const bookingDetailsTemplate = require("../../templates/emails/templates/booking-details.template");

        // ✅ récupérer les options (name + price + qty)
        const [optionRows] = await db[method](
          `
          SELECT 
            o.name,
            bo.price,
            bo.quantity
          FROM booking_options bo
          JOIN options o ON o.id = bo.option_id
          WHERE bo.booking_id = ?
          ORDER BY o.id ASC
          `,
          [Number(bookingId)]
        );

        const options = (optionRows || []).map((r) => ({
          name: r.name,
          price: Number(r.price) * Number(r.quantity || 1),
        }));

        const html = bookingDetailsTemplate({
          brandName: "GO-Shuttle",
          bookingId: Number(bookingId),
          packageType,
          packagePrice: Number(packagePriceNumber.toFixed(2)),
          options,
          optionsTotal: Number(optionsTotal.toFixed(2)),
          totalPrice: Number(totalPrice.toFixed(2)),
          currency: bk.currency || "EUR",
        });

        await transporter.sendMail({
          from: fromEmail,
          to,
          subject: "GO-Shuttle – Confirmation de réservation",
          html,
        });

        emailSent = true;
      }
    } catch (e) {
      emailSent = false;
      console.error("Email error:", e?.message || e);
    }

    return res.status(200).json({
      message: "Payment successful. Booking is now in progress.",
      bookingId: Number(bookingId),

      package: {
        packageId: Number(pkg.id),
        packageType,
        pricingTable,
        pricingId,
        snapshot: (() => {
          try {
            return pkg.pricing_snapshot ? JSON.parse(pkg.pricing_snapshot) : pricing;
          } catch {
            return pricing;
          }
        })(),
      },

      packagePrice: Number(packagePriceNumber.toFixed(2)),
      optionsTotal: Number(optionsTotal.toFixed(2)),
      totalPrice,

      status: "in_progress",
      currency: bk.currency || "EUR",

      email: {
        to: to || null,
        sent: emailSent,
      },
    });
  } catch (err) {
    next(err);
  }
},

  // =========================
  // GET – Next available date
  // =========================
  getNextAvailableDate: async (req, res, next) => {
    try {
      const method = getDbMethod();
      const excludeBookingId = Number(req.query.excludeBookingId) || null;

      const params = [];
      let excludeSql = '';

      if (excludeBookingId) {
        excludeSql = 'AND b.id != ?';
        params.push(excludeBookingId);
      }

      const [rows] = await db[method](
        `
      SELECT 
        MAX(
          COALESCE(p1.end_date, p2.end_date)
        ) AS lastEndDate
      FROM bookings b
      LEFT JOIN booking_periods p1 ON p1.id = b.period_id
      LEFT JOIN booking_periods p2 ON p2.booking_id = b.id
      WHERE b.status = 'in_progress'
      ${excludeSql}
      `,
        params
      );

      const lastEndDate = rows?.[0]?.lastEndDate;

      if (!lastEndDate) {
        return res.status(200).json({
          message: "No blocking bookings.",
          nextAvailableDate: new Date().toISOString().slice(0, 10),
        });
      }

      const d = new Date(lastEndDate);
      d.setDate(d.getDate() + 1);

      return res.status(200).json({
        message: "Next available date calculated.",
        nextAvailableDate: d.toISOString().slice(0, 10),
      });
    } catch (err) {
      next(err);
    }
  },

};