const { transporter } = require("../../templates/emails/transporter");

exports.sendContactMessage = async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
    }

    try {
        const sender = `"${process.env.MAIL_FROM_NAME || 'GO-Shuttle Support'}" <${process.env.MAIL_USER}>`;

        // --- TEMPLATE : Notification pour vous (Direction) ---
        const adminHtml = `
            <div style="background-color: #f9f9f9; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
                    <div style="background: #1a1a1a; padding: 20px; text-align: center;">
                        <h2 style="color: #d4af37; margin: 0; text-transform: uppercase; letter-spacing: 2px;">GO-Shuttle</h2>
                    </div>
                    <div style="padding: 30px;">
                        <h3 style="color: #1a1a1a; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">Nouveau message de contact</h3>
                        <p style="margin: 15px 0;"><strong>Client :</strong> ${name}</p>
                        <p style="margin: 15px 0;"><strong>Email :</strong> <a href="mailto:${email}" style="color: #d4af37; text-decoration: none;">${email}</a></p>
                        <p style="margin: 15px 0;"><strong>Sujet :</strong> ${subject}</p>
                        <div style="background: #f4f4f4; padding: 20px; border-radius: 4px; margin-top: 20px; font-style: italic;">
                            ${message.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        Ce message a été envoyé depuis le formulaire de contact du site Go-Shuttle.
                    </div>
                </div>
            </div>
        `;

        // --- TEMPLATE : Accusé de réception pour le Client ---
        const clientHtml = `
            <div style="background-color: #f9f9f9; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="background: #1a1a1a; padding: 30px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 3px;">GO-Shuttle</h1>
                    </div>
                    <div style="padding: 40px; text-align: center;">
                        <h2 style="color: #1a1a1a; margin-bottom: 20px;">Merci de nous avoir contactés</h2>
                        <p style="font-size: 16px; line-height: 1.6; color: #555;">Bonjour <strong>${name}</strong>,</p>
                        <p style="font-size: 16px; line-height: 1.6; color: #555;">
                            Nous avons bien reçu votre demande concernant "<strong>${subject}</strong>". 
                            Notre équipe étudie votre message et reviendra vers vous dans les plus brefs délais.
                        </p>
                        <div style="margin: 30px 0;">
                            <hr style="border: 0; border-top: 1px solid #eee;">
                        </div>
                        <p style="font-size: 14px; color: #888;">
                            Ceci est un message automatique, merci de ne pas y répondre directement.
                        </p>
                    </div>
                    <div style="background: #1a1a1a; padding: 20px; text-align: center; color: #d4af37; font-size: 14px;">
                        <strong>GO-Shuttle</strong> | Kehl - Strasbourg - Europe<br>
                        <span style="color: #fff; font-size: 12px;">Premium Transportation Services</span>
                    </div>
                </div>
            </div>
        `;

        // 1. Envoi à la Direction
        await transporter.sendMail({
            from: sender,
            to: process.env.MAIL_USER,
            subject: `Nouveau message : ${subject} (${name})`,
            html: adminHtml,
        });

        // 2. Envoi au Client
        await transporter.sendMail({
            from: sender,
            to: email,
            subject: `Confirmation de réception - GO-Shuttle`,
            html: clientHtml,
        });

        res.status(200).json({ message: "Votre message a été envoyé avec succès !" });
    } catch (error) {
        console.error("Erreur envoi email contact:", error);
        res.status(500).json({ message: "Une erreur est survenue lors de l'envoi de votre message." });
    }
};