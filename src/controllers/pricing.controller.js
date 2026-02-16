const db = require("../config/db");

module.exports = {
  // ==========================================
  // 1. GO-DIRECT (Logique au Kilomètre)
  // ==========================================
  getGoDirectPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT id, pricePerKm, createdAt, updatedAt FROM pricing_go_direct LIMIT 1`
      );
      return res.status(200).json({ pricing: rows.length ? rows[0] : null });
    } catch (err) {
      return next(err);
    }
  },

  upsertGoDirectPricing: async (req, res, next) => {
    try {
      const { pricePerKm } = req.body;

      if (!pricePerKm) {
        return res.status(400).json({ message: "Le champ pricePerKm est obligatoire." });
      }

      const [existing] = await db.execute(`SELECT id FROM pricing_go_direct LIMIT 1`);

      if (!existing.length) {
        const [result] = await db.execute(
          `INSERT INTO pricing_go_direct (pricePerKm, createdAt) VALUES (?, NOW())`,
          [pricePerKm]
        );
        const [rows] = await db.execute(`SELECT * FROM pricing_go_direct WHERE id = ?`, [result.insertId]);
        return res.status(201).json({ message: "GO-Direct pricing created", pricing: rows[0] });
      }

      const id = existing[0].id;
      await db.execute(
        `UPDATE pricing_go_direct SET pricePerKm = ?, updatedAt = NOW() WHERE id = ?`,
        [pricePerKm, id]
      );
      const [rows] = await db.execute(`SELECT * FROM pricing_go_direct WHERE id = ?`, [id]);
      return res.status(200).json({ message: "GO-Direct pricing updated", pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // ==========================================
  // 2. PREMIUM SMART (Logique au Forfait)
  // ==========================================
  getStandardSmartPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(`SELECT id, durationHours, price, extraHourPrice, updatedAt FROM pricing_standard_smart LIMIT 1`);
      return res.status(200).json({ pricing: rows.length ? rows[0] : null });
    } catch (err) {
      return next(err);
    }
  },

  upsertStandardSmartPricing: async (req, res, next) => {
    try {
      const { durationHours, price, extraHourPrice } = req.body;

      if (!durationHours || !price || !extraHourPrice) {
        return res.status(400).json({ message: "Tous les champs sont obligatoires." });
      }

      const [existing] = await db.execute(`SELECT id FROM pricing_standard_smart LIMIT 1`);

      if (!existing.length) {
        const [reslt] = await db.execute(
          `INSERT INTO pricing_standard_smart (durationHours, price, extraHourPrice, createdAt) VALUES (?, ?, ?, NOW())`,
          [durationHours, price, extraHourPrice]
        );
        const [rows] = await db.execute(`SELECT * FROM pricing_standard_smart WHERE id = ?`, [reslt.insertId]);
        return res.status(201).json({ message: "SMART pricing created", pricing: rows[0] });
      }

      const id = existing[0].id;
      await db.execute(
        `UPDATE pricing_standard_smart SET durationHours = ?, price = ?, extraHourPrice = ?, updatedAt = NOW() WHERE id = ?`,
        [durationHours, price, extraHourPrice, id]
      );
      const [rows] = await db.execute(`SELECT * FROM pricing_standard_smart WHERE id = ?`, [id]);
      return res.status(200).json({ message: "SMART pricing updated", pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // ==========================================
  // 3. PREMIUM CELEBRATION (Logique au Forfait)
  // ==========================================
  getCelebrationPricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(`SELECT id, durationHours, price, extraHourPrice, updatedAt FROM pricing_celebration LIMIT 1`);
      return res.status(200).json({ pricing: rows.length ? rows[0] : null });
    } catch (err) {
      return next(err);
    }
  },

  upsertCelebrationPricing: async (req, res, next) => {
    try {
      const { durationHours, price, extraHourPrice } = req.body;

      if (!durationHours || !price || !extraHourPrice) {
        return res.status(400).json({ message: "Tous les champs sont obligatoires." });
      }

      const [existing] = await db.execute(`SELECT id FROM pricing_celebration LIMIT 1`);

      if (!existing.length) {
        const [reslt] = await db.execute(
          `INSERT INTO pricing_celebration (durationHours, price, extraHourPrice, createdAt) VALUES (?, ?, ?, NOW())`,
          [durationHours, price, extraHourPrice]
        );
        const [rows] = await db.execute(`SELECT * FROM pricing_celebration WHERE id = ?`, [reslt.insertId]);
        return res.status(201).json({ message: "Celebration pricing created", pricing: rows[0] });
      }

      const id = existing[0].id;
      await db.execute(
        `UPDATE pricing_celebration SET durationHours = ?, price = ?, extraHourPrice = ?, updatedAt = NOW() WHERE id = ?`,
        [durationHours, price, extraHourPrice, id]
      );
      const [rows] = await db.execute(`SELECT * FROM pricing_celebration WHERE id = ?`, [id]);
      return res.status(200).json({ message: "Celebration pricing updated", pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },

  // ==========================================
  // 4. PREMIUM NIGHTLIFE (Logique au Forfait)
  // ==========================================
  getNightlifePricing: async (req, res, next) => {
    try {
      const [rows] = await db.execute(`SELECT id, durationHours, price, extraHourPrice, updatedAt FROM pricing_nightlife LIMIT 1`);
      return res.status(200).json({ pricing: rows.length ? rows[0] : null });
    } catch (err) {
      return next(err);
    }
  },

  upsertNightlifePricing: async (req, res, next) => {
    try {
      const { durationHours, price, extraHourPrice } = req.body;

      if (!durationHours || !price || !extraHourPrice) {
        return res.status(400).json({ message: "Tous les champs sont obligatoires." });
      }

      const [existing] = await db.execute(`SELECT id FROM pricing_nightlife LIMIT 1`);

      if (!existing.length) {
        const [reslt] = await db.execute(
          `INSERT INTO pricing_nightlife (durationHours, price, extraHourPrice, createdAt) VALUES (?, ?, ?, NOW())`,
          [durationHours, price, extraHourPrice]
        );
        const [rows] = await db.execute(`SELECT * FROM pricing_nightlife WHERE id = ?`, [reslt.insertId]);
        return res.status(201).json({ message: "Nightlife pricing created", pricing: rows[0] });
      }

      const id = existing[0].id;
      await db.execute(
        `UPDATE pricing_nightlife SET durationHours = ?, price = ?, extraHourPrice = ?, updatedAt = NOW() WHERE id = ?`,
        [durationHours, price, extraHourPrice, id]
      );
      const [rows] = await db.execute(`SELECT * FROM pricing_nightlife WHERE id = ?`, [id]);
      return res.status(200).json({ message: "Nightlife pricing updated", pricing: rows[0] });
    } catch (err) {
      return next(err);
    }
  },
};