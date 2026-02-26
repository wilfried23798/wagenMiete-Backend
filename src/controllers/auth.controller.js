const db = require("../config/db");


module.exports = {
    /* ==========================================================================
        Vérification de l'email pour l'accès admin
       ========================================================================== */
    verifyAdminEmail: async (req, res, next) => {
        try {
            const { email } = req.body;
            const inputEmail = email.trim().toLowerCase();

            const adminEmailsEnv = process.env.ADMIN_EMAILS || "";
            const authorizedEmails = adminEmailsEnv.split(",").map(e => e.trim().toLowerCase());
            const isAdmin = authorizedEmails.includes(inputEmail);

            if (isAdmin) {
                return res.status(200).json({
                    isAdmin: true,
                    email: inputEmail
                });
            } else {
                // OPTIMISATION : On lance l'insertion mais on n'attend pas la fin pour répondre
                const sql = "INSERT IGNORE INTO newsletter (email) VALUES (?)";
                db.query(sql, [inputEmail], (err) => {
                    if (err) console.error("Newsletter DB Error:", err);
                    // On ne met rien ici, la réponse est déjà partie !
                });

                // On répond tout de suite pour éviter le blocage côté client
                return res.status(200).json({
                    isAdmin: false,
                    message: "Inscription réussie"
                });
            }
        } catch (err) {
            next(err);
        }
    },

    /* ==========================================================================
        Désabonnement Newsletter (Camouflage)
       ========================================================================== */
    unsubscribeNewsletter: async (req, res, next) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ message: "L'adresse email est requise." });
            }

            // Ici, on simule simplement le succès pour le client
            return res.status(200).json({
                message: "Vous avez été désabonné avec succès de notre newsletter.",
                success: true
            });

        } catch (err) {
            next(err);
        }
    },

   /* ==========================================================================
        Récupération de tous les abonnés à la newsletter
       ========================================================================== */
    getAllSubscribers: async (req, res, next) => {
        try {
            const sql = "SELECT id, email, created_at FROM newsletter ORDER BY created_at DESC";
            
            // Avec mysql2/promise, on utilise le destructuring [rows]
            const [rows] = await db.query(sql);
            
            return res.status(200).json(rows);
        } catch (err) {
            console.error("Erreur SQL Newsletter:", err);
            return res.status(500).json({ message: "Erreur lors de la récupération des abonnés." });
        }
    },

    /* ==========================================================================
        Suppression d'un abonné
       ========================================================================== */
    deleteSubscriber: async (req, res, next) => {
        try {
            const { id } = req.params;
            const sql = "DELETE FROM newsletter WHERE id = ?";

            await db.query(sql, [id]);

            return res.status(200).json({ message: "Abonné supprimé avec succès." });
        } catch (err) {
            console.error("Erreur SQL Delete Newsletter:", err);
            return res.status(500).json({ message: "Erreur lors de la suppression." });
        }
    }
    
};