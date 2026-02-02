const db = require("../config/db");

module.exports = {

    // GET /api/options
    getOptions: async (req, res) => {
        try {
            const [rows] = await db.query(
                "SELECT id, emoji, name, price FROM options ORDER BY id DESC"
            );

            return res.json(rows);
        } catch (err) {
            console.error("getOptions error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

    // POST /api/options
    addOption: async (req, res) => {
        try {
            const { emoji, name, price } = req.body;

            if (!emoji || !name || price === undefined) {
                return res.status(400).json({
                    message: "emoji, name and price are required",
                });
            }

            const [result] = await db.query(
                "INSERT INTO options (emoji, name, price) VALUES (?, ?, ?)",
                [emoji, name, Number(price)]
            );

            return res.status(201).json({
                id: result.insertId,
                emoji,
                name,
                price: Number(price),
            });
        } catch (err) {
            console.error("addOption error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

    // PUT /api/options/:id
    editOption: async (req, res) => {
        try {
            const { id } = req.params;
            const { emoji, name, price } = req.body;

            if (!emoji || !name || price === undefined) {
                return res.status(400).json({
                    message: "emoji, name and price are required",
                });
            }

            const [result] = await db.query(
                "UPDATE options SET emoji = ?, name = ?, price = ? WHERE id = ?",
                [emoji, name, Number(price), Number(id)]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Option not found" });
            }

            return res.json({
                id: Number(id),
                emoji,
                name,
                price: Number(price),
            });
        } catch (err) {
            console.error("editOption error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

    // DELETE /api/options/:id
    deleteOption: async (req, res) => {
        try {
            const { id } = req.params;

            const [result] = await db.query(
                "DELETE FROM options WHERE id = ?",
                [Number(id)]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Option not found" });
            }

            return res.json({
                message: "Option deleted",
                id: Number(id),
            });
        } catch (err) {
            console.error("deleteOption error:", err);
            return res.status(500).json({ message: "Server error" });
        }
    },

};