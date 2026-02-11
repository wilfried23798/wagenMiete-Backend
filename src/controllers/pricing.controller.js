const db = require("../config/db");

module.exports = {

    // =========================
    // GET Nightlife pricing (single row)
    // GET /api/pricing/nightlife
    // =========================
    getNightlifePricing: async (req, res, next) => {
        try {
            const [rows] = await db.execute(
                `SELECT * FROM pricing_nightlife ORDER BY id ASC LIMIT 1`
            );

            // Si vide -> renvoyer un "default" (UI propre)
            if (!rows.length) {
                return res.status(200).json({
                    pricing: {
                        id: null,
                        title: "Nightlife",
                        startTime: "22:00:00",
                        endTime: "03:00:00",
                        price: 400.00,
                        radiusKm: 12,
                        extraKmPrice: 2.00,
                        isActive: 1,
                        createdAt: null,
                        updatedAt: null
                    }
                });
            }

            return res.status(200).json({ pricing: rows[0] });

        } catch (err) {
            return next(err);
        }
    },

    // =========================
    // UPSERT Nightlife pricing (no id)
    // PUT /api/pricing/nightlife
    // - If table empty -> INSERT
    // - Else -> UPDATE first row
    // =========================
    upsertNightlifePricing: async (req, res, next) => {
        try {
            const {
                title,
                startTime,
                endTime,
                price,
                radiusKm,
                extraKmPrice,
                isActive
            } = req.body;

            // 1) check existing row
            const [existing] = await db.execute(
                `SELECT id FROM pricing_nightlife ORDER BY id ASC LIMIT 1`
            );

            // helpers
            const safeTitle = title ?? "Nightlife";
            const safeStart = startTime ?? "22:00:00";
            const safeEnd = endTime ?? "03:00:00";
            const safePrice = price ?? 400.00;
            const safeRadius = radiusKm ?? 12;
            const safeExtra = extraKmPrice ?? 2.00;
            const safeActive = (isActive ?? 1);

            // 2A) INSERT if none
            if (!existing.length) {
                const insertSql = `
          INSERT INTO pricing_nightlife
            (title, startTime, endTime, price, radiusKm, extraKmPrice, isActive, createdAt, updatedAt)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

                const [insertResult] = await db.execute(insertSql, [
                    safeTitle,
                    safeStart,
                    safeEnd,
                    safePrice,
                    safeRadius,
                    safeExtra,
                    safeActive
                ]);

                const newId = insertResult.insertId;

                const [rows] = await db.execute(
                    `SELECT * FROM pricing_nightlife WHERE id = ? LIMIT 1`,
                    [newId]
                );

                return res.status(201).json({
                    message: "Nightlife pricing created",
                    pricing: rows[0]
                });
            }

            // 2B) UPDATE first row if exists
            const id = existing[0].id;

            const updateSql = `
        UPDATE pricing_nightlife
        SET
          title = COALESCE(?, title),
          startTime = COALESCE(?, startTime),
          endTime = COALESCE(?, endTime),
          price = COALESCE(?, price),
          radiusKm = COALESCE(?, radiusKm),
          extraKmPrice = COALESCE(?, extraKmPrice),
          isActive = COALESCE(?, isActive),
          updatedAt = NOW()
        WHERE id = ?
      `;

            await db.execute(updateSql, [
                title ?? null,
                startTime ?? null,
                endTime ?? null,
                price ?? null,
                radiusKm ?? null,
                extraKmPrice ?? null,
                isActive ?? null,
                id
            ]);

            const [rows] = await db.execute(
                `SELECT * FROM pricing_nightlife WHERE id = ? LIMIT 1`,
                [id]
            );

            return res.status(200).json({
                message: "Nightlife pricing updated",
                pricing: rows[0]
            });

        } catch (err) {
            return next(err);
        }
    },

     // =========================
  // GET Standard Smart pricing (single row)
  // GET /api/pricing/standard-smart
  // =========================
  getStandardSmartPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM pricing_standard_smart ORDER BY id ASC LIMIT 1`
      );

      // Si vide -> default
      if (!rows.length) {
        return res.status(200).json({
          pricing: {
            id: null,
            title: "Standard SMART",
            durationHours: 3,
            price: 270.00,
            includedKm: 60,
            extraKmPrice: 2.00,
            isActive: 1,
            createdAt: null,
            updatedAt: null
          }
        });
      }

      return res.status(200).json({ pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // =========================
  // UPSERT Standard Smart pricing (no id)
  // PUT /api/pricing/standard-smart
  // =========================
  upsertStandardSmartPricing: async (req, res, next) => {
    try {
      const {
        title,
        durationHours,
        price,
        includedKm,
        extraKmPrice,
        isActive
      } = req.body;

      // check existing row
      const [existing] = await db.execute(
        `SELECT id FROM pricing_standard_smart ORDER BY id ASC LIMIT 1`
      );

      // defaults (si table vide et payload partiel)
      const safeTitle = title ?? "Standard SMART";
      const safeDuration = durationHours ?? 3;
      const safePrice = price ?? 270.00;
      const safeIncluded = includedKm ?? 60;
      const safeExtra = extraKmPrice ?? 2.00;
      const safeActive = (isActive ?? 1);

      // INSERT si vide
      if (!existing.length) {
        const insertSql = `
          INSERT INTO pricing_standard_smart
            (title, durationHours, price, includedKm, extraKmPrice, isActive, createdAt, updatedAt)
          VALUES
            (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const [insertResult] = await db.execute(insertSql, [
          safeTitle,
          safeDuration,
          safePrice,
          safeIncluded,
          safeExtra,
          safeActive
        ]);

        const newId = insertResult.insertId;

        const [rows] = await db.execute(
          `SELECT * FROM pricing_standard_smart WHERE id = ? LIMIT 1`,
          [newId]
        );

        return res.status(201).json({
          message: "Standard SMART pricing created",
          pricing: rows[0]
        });
      }

      // UPDATE sinon
      const id = existing[0].id;

      const updateSql = `
        UPDATE pricing_standard_smart
        SET
          title = COALESCE(?, title),
          durationHours = COALESCE(?, durationHours),
          price = COALESCE(?, price),
          includedKm = COALESCE(?, includedKm),
          extraKmPrice = COALESCE(?, extraKmPrice),
          isActive = COALESCE(?, isActive),
          updatedAt = NOW()
        WHERE id = ?
      `;

      await db.execute(updateSql, [
        title ?? null,
        durationHours ?? null,
        price ?? null,
        includedKm ?? null,
        extraKmPrice ?? null,
        isActive ?? null,
        id
      ]);

      const [rows] = await db.execute(
        `SELECT * FROM pricing_standard_smart WHERE id = ? LIMIT 1`,
        [id]
      );

      return res.status(200).json({
        message: "Standard SMART pricing updated",
        pricing: rows[0]
      });
    } catch (err) {
      return next(err);
    }
  },

   // =========================
  // GET GO-DIRECT pricing (single row)
  // GET /api/pricing/go-direct
  // =========================
  getGoDirectPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM pricing_go_direct ORDER BY id ASC LIMIT 1`
      );

      // Table vide -> valeurs par défaut
      if (!rows.length) {
        return res.status(200).json({
          pricing: {
            id: null,
            pickupFee: 15.0,
            pricePerKm: 2.5,
            minimumPrice: 30.0,
            nightExtra: 15.0,
            nightStart: "23:00:00",
            nightEnd: "06:00:00",
            isActive: 1,
            createdAt: null,
            updatedAt: null
          }
        });
      }

      return res.status(200).json({ pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // =========================
  // UPSERT GO-DIRECT pricing (no id)
  // PUT /api/pricing/go-direct
  // =========================
  upsertGoDirectPricing: async (req, res, next) => {
    try {
      const {
        pickupFee,
        pricePerKm,
        minimumPrice,
        nightExtra,
        nightStart,
        nightEnd,
        isActive
      } = req.body;

      const [existing] = await db.execute(
        `SELECT id FROM pricing_go_direct ORDER BY id ASC LIMIT 1`
      );

      // ✅ INSERT si vide (avec defaults si payload incomplet)
      if (!existing.length) {
        const safePickupFee = pickupFee ?? 15.0;
        const safePricePerKm = pricePerKm ?? 2.5;
        const safeMinimumPrice = minimumPrice ?? 30.0;
        const safeNightExtra = nightExtra ?? 15.0;
        const safeNightStart = (nightStart ?? "23:00:00");
        const safeNightEnd = (nightEnd ?? "06:00:00");
        const safeIsActive = (isActive ?? 1);

        const insertSql = `
          INSERT INTO pricing_go_direct
            (pickupFee, pricePerKm, minimumPrice, nightExtra, nightStart, nightEnd, isActive, createdAt, updatedAt)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const [insertResult] = await db.execute(insertSql, [
          safePickupFee,
          safePricePerKm,
          safeMinimumPrice,
          safeNightExtra,
          safeNightStart,
          safeNightEnd,
          safeIsActive
        ]);

        const newId = insertResult.insertId;

        const [rows] = await db.execute(
          `SELECT * FROM pricing_go_direct WHERE id = ? LIMIT 1`,
          [newId]
        );

        return res.status(201).json({
          message: "GO-Direct pricing created",
          pricing: rows[0]
        });
      }

      // ✅ UPDATE sinon
      const id = existing[0].id;

      const updateSql = `
        UPDATE pricing_go_direct
        SET
          pickupFee = COALESCE(?, pickupFee),
          pricePerKm = COALESCE(?, pricePerKm),
          minimumPrice = COALESCE(?, minimumPrice),
          nightExtra = COALESCE(?, nightExtra),
          nightStart = COALESCE(?, nightStart),
          nightEnd = COALESCE(?, nightEnd),
          isActive = COALESCE(?, isActive),
          updatedAt = NOW()
        WHERE id = ?
      `;

      await db.execute(updateSql, [
        pickupFee ?? null,
        pricePerKm ?? null,
        minimumPrice ?? null,
        nightExtra ?? null,
        nightStart ?? null,
        nightEnd ?? null,
        isActive ?? null,
        id
      ]);

      const [rows] = await db.execute(
        `SELECT * FROM pricing_go_direct WHERE id = ? LIMIT 1`,
        [id]
      );

      return res.status(200).json({
        message: "GO-Direct pricing updated",
        pricing: rows[0]
      });
    } catch (err) {
      return next(err);
    }
  },

  // =========================
  // GET CELEBRATION pricing (single row)
  // GET /api/pricing/celebration
  // =========================
  getCelebrationPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM pricing_celebration ORDER BY id ASC LIMIT 1`
      );

      // Table vide -> valeurs par défaut
      if (!rows.length) {
        return res.status(200).json({
          pricing: {
            id: null,
            title: "Celebration",
            durationHours: 6,
            price: 480.0,
            includedKm: 100,
            isActive: 1,
            createdAt: null,
            updatedAt: null
          }
        });
      }

      return res.status(200).json({ pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // =========================
  // UPSERT CELEBRATION pricing (no id)
  // PUT /api/pricing/celebration
  // =========================
  upsertCelebrationPricing: async (req, res, next) => {
    try {
      const { title, durationHours, price, includedKm, isActive } = req.body;

      const [existing] = await db.execute(
        `SELECT id FROM pricing_celebration ORDER BY id ASC LIMIT 1`
      );

      // ✅ INSERT si vide
      if (!existing.length) {
        const safeTitle = title ?? "Celebration";
        const safeDuration = durationHours ?? 6;
        const safePrice = price ?? 480.0;
        const safeIncludedKm = includedKm ?? 100;
        const safeIsActive = isActive ?? 1;

        const insertSql = `
          INSERT INTO pricing_celebration
            (title, durationHours, price, includedKm, isActive, createdAt, updatedAt)
          VALUES
            (?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const [insertResult] = await db.execute(insertSql, [
          safeTitle,
          safeDuration,
          safePrice,
          safeIncludedKm,
          safeIsActive
        ]);

        const newId = insertResult.insertId;

        const [rows] = await db.execute(
          `SELECT * FROM pricing_celebration WHERE id = ? LIMIT 1`,
          [newId]
        );

        return res.status(201).json({
          message: "Celebration pricing created",
          pricing: rows[0]
        });
      }

      // ✅ UPDATE sinon
      const id = existing[0].id;

      const updateSql = `
        UPDATE pricing_celebration
        SET
          title = COALESCE(?, title),
          durationHours = COALESCE(?, durationHours),
          price = COALESCE(?, price),
          includedKm = COALESCE(?, includedKm),
          isActive = COALESCE(?, isActive),
          updatedAt = NOW()
        WHERE id = ?
      `;

      await db.execute(updateSql, [
        title ?? null,
        durationHours ?? null,
        price ?? null,
        includedKm ?? null,
        isActive ?? null,
        id
      ]);

      const [rows] = await db.execute(
        `SELECT * FROM pricing_celebration WHERE id = ? LIMIT 1`,
        [id]
      );

      return res.status(200).json({
        message: "Celebration pricing updated",
        pricing: rows[0]
      });
    } catch (err) {
      return next(err);
    }
  }

};