const db = require("../config/db");
const { transporter, fromEmail } = require("../../templates/emails/transporter");
const bookingConfirmationTemplate = require("../../templates/emails/booking-confirmation.template");
const googleMapsService = require("../../services/googleMaps.service");

function getDbMethod() {
  if (typeof db.execute === "function") return "execute";
  return "query";
}

module.exports = {

  // =========================
  // STEP 1 – Choose package
  // =========================
  createBookingDraftStep1: async (req, res, next) => {
    try {
      const { packageType } = req.body;

      if (!packageType) {
        return res.status(400).json({
          message: "Le type de forfait est requis."
        });
      }

      const method = getDbMethod();

      // Utilise les noms exacts des colonnes créées dans l'étape SQL ci-dessus
      const bookingSql = `
        INSERT INTO bookings (package_type, status, created_at)
        VALUES (?, 'draft', NOW())
      `;

      const [bookingRes] = await db[method](bookingSql, [packageType]);

      return res.status(201).json({
        message: "Brouillon initialisé.",
        bookingId: bookingRes.insertId,
        packageType
      });
    } catch (err) {
      console.error("Erreur SQL détaillée:", err.sqlMessage); // Pour debug
      next(err);
    }
  },

  // =========================
  // STEP 2 – Liaison Disponibilité (Standard ou Custom) et Détails
  // =========================
  setBookingAvailabilityAndDetails: async (req, res, next) => {
    try {
      const {
        bookingId,
        availabilityId,   // ID de la table availabilities (si choix standard)
        customRequestId,  // ID de la table custom_availability_requests (si choix personnalisé)
        pickupTime,
        pickupLocation
      } = req.body;

      if (!bookingId || (!availabilityId && !customRequestId) || !pickupTime || !pickupLocation) {
        return res.status(400).json({
          message: "Tous les champs (Booking, Disponibilité, Heure, Lieu) sont requis.",
        });
      }

      const method = getDbMethod();

      // 1) Vérifier le booking
      const [bkRows] = await db[method](
        `SELECT id, package_type FROM bookings WHERE id = ? LIMIT 1`,
        [Number(bookingId)]
      );

      if (!bkRows || bkRows.length === 0) {
        return res.status(404).json({ message: "Réservation introuvable." });
      }

      const packageType = bkRows[0].package_type;

      // 2) Validation de la disponibilité choisie
      if (availabilityId) {
        // Cas standard : Vérifier qu'elle est toujours libre
        const [avRows] = await db[method](
          `SELECT id FROM availabilities WHERE id = ? AND status = 'available' LIMIT 1`,
          [Number(availabilityId)]
        );

        if (!avRows || avRows.length === 0) {
          return res.status(404).json({ message: "Ce créneau n'est plus disponible." });
        }

        // Marquer la disponibilité standard comme 'pending'
        await db[method](
          `UPDATE availabilities SET status = 'pending', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
          [Number(availabilityId)]
        );
      } else if (customRequestId) {
        // Cas personnalisé : Vérifier que la requête existe
        const [custRows] = await db[method](
          `SELECT id FROM custom_availability_requests WHERE id = ? LIMIT 1`,
          [Number(customRequestId)]
        );

        if (!custRows || custRows.length === 0) {
          return res.status(404).json({ message: "Demande personnalisée introuvable." });
        }

        // Note : Le statut reste 'pending' dans custom_availability_requests par défaut
      }

      // 3) Récupération du prix (Pricing Map)
      const pricingMap = {
        "go-direct": { table: "pricing_go_direct", field: "pricePerKm" },
        "standard": { table: "pricing_standard_smart", field: "price" },
        "celebration": { table: "pricing_celebration", field: "price" },
        "nightlife": { table: "pricing_nightlife", field: "price" },
      };

      const cfg = pricingMap[packageType];
      const [pRows] = await db[method](`SELECT * FROM ${cfg.table} ORDER BY id DESC LIMIT 1`);

      if (!pRows || pRows.length === 0) {
        return res.status(404).json({ message: "Tarification introuvable." });
      }

      const basePrice = pRows[0][cfg.field];

      // 4) MISE À JOUR DU BOOKING
      // On enregistre l'availability_id (si standard) ou on laisse NULL (si custom)
      // On peut aussi mettre à jour le statut du booking en 'pending' ou 'draft'
      await db[method](
        `UPDATE bookings 
       SET arrival_time = ?, 
           pickup_location = ?, 
           total_price = ?, 
           availability_id = ?, 
           status = 'pending',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
        [pickupTime, pickupLocation, basePrice, availabilityId ? Number(availabilityId) : null, Number(bookingId)]
      );

      return res.status(200).json({
        message: "Détails enregistrés avec succès.",
        bookingId: Number(bookingId),
        packageType,
        totalPrice: basePrice,
        isCustom: !!customRequestId
      });

    } catch (err) {
      console.error("Error in setBookingAvailabilityAndDetails:", err);
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

  // =========================
  // STEP 4 – Personal Infos
  // =========================
  savePersonalInfo: async (req, res, next) => {
    try {
      const { bookingId, firstName, lastName, email, phone } = req.body;

      if (!bookingId || !firstName || !lastName || !email || !phone) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
      }

      const method = getDbMethod();

      // 1. Sauvegarde des infos client
      const [custRes] = await db[method](
        `INSERT INTO booking_customer_info (first_name, last_name, email, phone) 
         VALUES (?, ?, ?, ?)`,
        [firstName, lastName, email, phone]
      );

      const customerInfoId = custRes.insertId;

      // 2. Mise à jour du booking
      // On utilise 'pending' car 'confirmed_pending_payment' n'est pas dans votre ENUM actuel
      await db[method](
        `UPDATE bookings 
         SET customer_info_id = ?, 
             status = 'pending', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [customerInfoId, Number(bookingId)]
      );

      return res.status(200).json({
        message: "Informations enregistrées. Statut passé à 'pending'.",
        bookingId: Number(bookingId),
        customerInfoId: customerInfoId
      });

    } catch (err) {
      console.error("Erreur savePersonalInfo:", err);
      // Important : renvoyer une erreur 500 pour que le frontend sache que ça a échoué
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour du statut." });
    }
  },

  // ============================================================
  // FINALIZE – Prepare payment, Mark Availability/Request & Email
  // ============================================================
  finalizeBookingForPayment: async (req, res, next) => {
    try {
      const { bookingId } = req.body;

      if (!bookingId) {
        return res.status(400).json({ message: "bookingId is required." });
      }

      const method = getDbMethod();

      // 1) Charger la réservation, les infos client ET les liaisons de disponibilité
      const [bkRows] = await db[method](
        `
        SELECT 
          b.id,
          b.status,
          b.package_type,
          b.total_price,
          b.currency,
          b.availability_id,
          b.arrival_time,
          DATE(b.created_at) as booking_date,
          ci.first_name,
          ci.last_name,
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

      // 2) Sécurités sur les statuts
      if (bk.status === "in_progress") {
        return res.status(200).json({ message: "Booking already paid.", bookingId: bk.id, status: "in_progress" });
      }
      if (bk.status === "cancelled") {
        return res.status(400).json({ message: "Booking is cancelled." });
      }

      // 3) Logique de prix (Pricing Map)
      const pricingMap = {
        "go-direct": { table: "pricing_go_direct", field: "pricePerKm" },
        "standard": { table: "pricing_standard_smart", field: "price" },
        "celebration": { table: "pricing_celebration", field: "price" },
        "nightlife": { table: "pricing_nightlife", field: "price" },
      };

      const cfg = pricingMap[bk.package_type];
      if (!cfg) return res.status(400).json({ message: "Invalid package type." });

      const [pRows] = await db[method](`SELECT ${cfg.field} AS basePrice FROM ${cfg.table} ORDER BY id DESC LIMIT 1`);
      const basePrice = Number(pRows?.[0]?.basePrice || 0);

      // 4) Récupérer le détail des options
      const [optionRows] = await db[method](
        `
        SELECT o.name, bo.price, bo.quantity
        FROM booking_options bo
        JOIN options o ON o.id = bo.option_id
        WHERE bo.booking_id = ?
        `,
        [Number(bookingId)]
      );

      const options = (optionRows || []).map(r => ({
        name: r.name,
        price: Number(r.price) * Number(r.quantity || 1)
      }));

      const optionsTotal = options.reduce((sum, opt) => sum + opt.price, 0);
      const totalPrice = Number((basePrice + optionsTotal).toFixed(2));

      // 5) TRANSACTION ET MISES À JOUR DES STATUTS

      // A. Mettre à jour le statut du booking en 'in_progress'
      await db[method](
        `UPDATE bookings SET total_price = ?, status = 'in_progress', updated_at = NOW() WHERE id = ?`,
        [totalPrice, Number(bookingId)]
      );

      // B. LOGIQUE DE DISPONIBILITÉ (Standard ou Custom)
      let finalAvailId = bk.availability_id;

      // Cas 1 : Disponibilité Standard
      if (finalAvailId) {
        // On passe le statut de 'pending' à 'reserved'
        await db[method](
          `UPDATE availabilities SET status = 'reserved', updatedAt = NOW() WHERE id = ?`,
          [finalAvailId]
        );
      }

      // Cas 2 : Demande personnalisée (recherche par booking_id)
      // On passe le statut de 'pending' à 'approved'
      await db[method](
        `UPDATE custom_availability_requests 
         SET status = 'approved' 
         WHERE booking_id = ? AND status = 'pending'`,
        [Number(bookingId)]
      );

      // 6) ENVOI DE L'EMAIL DE CONFIRMATION
      let emailSent = false;
      const to = (bk.customerEmail || "").trim();

      if (to) {
        try {
          const html = bookingConfirmationTemplate({
            brandName: "GO-Shütle",
            customerName: `${bk.first_name} ${bk.last_name}`,
            bookingId: Number(bookingId),
            packageType: bk.package_type.toUpperCase(),
            packagePrice: basePrice,
            options: options,
            optionsTotal: optionsTotal,
            totalPrice: totalPrice,
            currency: bk.currency || "EUR"
          });

          await transporter.sendMail({
            from: fromEmail,
            to: to,
            subject: `Confirmation de réservation GO-Shüitle #${bookingId}`,
            html: html
          });
          emailSent = true;
        } catch (mailErr) {
          console.error("Mail sending failed:", mailErr);
        }
      }

      // 7) Réponse finale
      return res.status(200).json({
        message: "Finalization successful. Statuses updated to Reserved/Approved.",
        bookingId: Number(bookingId),
        totalPrice,
        status: "in_progress",
        emailSent
      });

    } catch (err) {
      console.error("Finalize error:", err);
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

  // ============================================================
  // GET ALL IN_PROGRESS BOOKINGS
  // Récupère toutes les réservations payées/en cours
  // ============================================================
  getInProgressBookings: async (req, res, next) => {
    try {
      const method = getDbMethod();

      const [rows] = await db[method](
        `
        SELECT 
          b.id,
          b.booking_code,
          b.package_type,
          b.total_price,
          b.currency,
          b.arrival_time,
          b.pickup_location,
          b.status,
          b.created_at,
          ci.first_name,
          ci.last_name,
          ci.email,
          ci.phone
        FROM bookings b
        LEFT JOIN booking_customer_info ci ON ci.id = b.customer_info_id
        WHERE b.status = 'in_progress'
        ORDER BY b.created_at DESC
        `
      );

      return res.status(200).json({
        count: rows.length,
        bookings: rows
      });

    } catch (err) {
      console.error("Error fetching in_progress bookings:", err);
      next(err);
    }
  },

  // ============================================================
  // GET BOOKING DETAILS BY ID
  // ============================================================
  getBookingDetails: async (req, res, next) => {
    try {
      const { id } = req.params;
      const method = getDbMethod();

      const [rows] = await db[method](
        `
      SELECT b.*, ci.first_name, ci.last_name, ci.email, ci.phone
      FROM bookings b
      LEFT JOIN booking_customer_info ci ON ci.id = b.customer_info_id
      WHERE b.id = ?
      `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Réservation introuvable." });
      }

      return res.status(200).json(rows[0]);
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // CANCEL BOOKING & RESET AVAILABILITY
  // ============================================================
  cancelBooking: async (req, res, next) => {
    const { id } = req.params;
    const method = getDbMethod();

    // Utilisation d'une transaction pour la sécurité des données
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Récupérer l'ID de disponibilité lié à cette réservation
      const [booking] = await connection.execute(
        "SELECT availability_id FROM bookings WHERE id = ?",
        [id]
      );

      if (booking.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Réservation introuvable." });
      }

      const availabilityId = booking[0].availability_id;

      // 2. Mettre à jour le statut de la réservation en 'cancelled'
      await connection.execute(
        "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
        [id]
      );

      // 3. Remettre la disponibilité en 'available'
      if (availabilityId) {
        await connection.execute(
          "UPDATE availabilities SET status = 'available' WHERE id = ?",
          [availabilityId]
        );
      }

      await connection.commit();
      res.status(200).json({
        message: "Réservation annulée et créneau libéré avec succès."
      });

    } catch (err) {
      await connection.rollback();
      console.error("Error during cancellation:", err);
      res.status(500).json({ message: "Erreur lors de l'annulation." });
    } finally {
      connection.release();
    }
  },

verifyDistance: async (req, res, next) => {
    try {
        const { pickupLocation } = req.body;

        if (!pickupLocation) {
            return res.status(400).json({ success: false, message: "Adresse requise." });
        }

        // --- TEST DE SÉCURITÉ SANS APPEL GOOGLE ---
        // Si vous voulez juste tester l'UI sans l'API Distance Matrix :
        /*
        return res.status(200).json({
            success: true,
            isEligible: true, // On accepte tout pour tester le flux
            distance: "5.0",
            message: "Lieu éligible (Mode Test)."
        });
        */

        // --- APPEL RÉEL ---
        const data = await googleMapsService.calculateDistance(pickupLocation);
        
        const MAX_DISTANCE = 12; 
        const isAllowed = data.distanceKm <= MAX_DISTANCE;

        return res.status(200).json({
            success: true,
            isEligible: isAllowed,
            distance: data.distanceKm.toFixed(1),
            message: isAllowed 
                ? "Lieu éligible." 
                : `Hors zone (${data.distanceKm.toFixed(1)}km).`
        });

    } catch (err) {
        // Si l'erreur persiste ici, regardez votre terminal Node :
        // Il affichera "Critical Distance Error: Google API Error: REQUEST_DENIED"
        console.error("Critical Distance Error:", err.message);
        
        res.status(200).json({ // On renvoie 200 pour ne pas bloquer l'UI Angular
            success: false,
            isEligible: false,
            message: "Vérification impossible : " + err.message
        });
    }
}



};