// src/emails/templates/booking-details.template.js

function money(val, currency = "EUR") {
  const n = Number(val ?? 0);
  const fixed = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return currency === "EUR" ? `€ ${fixed}` : `${fixed} ${currency}`;
}

function packageLabel(p) {
  if (p === "go-direct") return "GO-Direct";
  if (p === "standard") return "Standard";
  if (p === "celebration") return "Celebration";
  if (p === "nightlife") return "Nightlife";
  return String(p || "");
}

module.exports = function bookingDetailsTemplate({
  brandName = "GO-Shuttle",
  bookingId,
  packageType,
  packagePrice,
  options = [],
  optionsTotal = 0,
  totalPrice = 0,
  currency = "EUR",
} = {}) {
  const year = new Date().getFullYear();

  const optionsHtml = options.length
    ? `
      <div style="margin-top:10px;border:1px solid rgba(15,23,42,.10);border-radius:12px;overflow:hidden;">
        <div style="padding:10px 12px;background:rgba(15,23,42,.03);font-size:12px;font-weight:700;">
          Options sélectionnées
        </div>
        <div style="padding:10px 12px;font-size:13px;line-height:1.6;">
          ${options
            .map(
              (o) => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(15,23,42,.06);">
              <div>${String(o.name || "Option")}</div>
              <div style="font-weight:700;">${money(o.price, currency)}</div>
            </div>
          `
            )
            .join("")}
          <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;">
            <div style="font-weight:700;">Total options</div>
            <div style="font-weight:900;">${money(optionsTotal, currency)}</div>
          </div>
        </div>
      </div>
    `
    : `
      <div style="margin-top:10px;padding:10px 12px;border:1px solid rgba(15,23,42,.10);border-radius:12px;background:rgba(15,23,42,.02);font-size:13px;">
        Aucune option sélectionnée.
      </div>
    `;

  return `
  <!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${brandName}</title>
    </head>

    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="width:100%;padding:24px 12px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(15,23,42,.12);border-radius:14px;overflow:hidden;">

          <!-- Header -->
          <div style="padding:18px 18px 14px;background:#ffffff;border-bottom:1px solid rgba(15,23,42,.08);">
            <div style="font-size:14px;font-weight:700;letter-spacing:.2px;color:#0f172a;">
              ${brandName}
            </div>
            <div style="margin-top:6px;font-size:12px;line-height:1.5;color:rgba(15,23,42,.65);">
              Confirmation et informations importantes
            </div>
          </div>

          <!-- Content -->
          <div style="padding:18px;">

            <h2 style="margin:0 0 10px;font-size:16px;line-height:1.3;color:#0f172a;">
              Détails de votre réservation
            </h2>

            <div style="padding:12px 12px;border:1px solid rgba(15,23,42,.10);border-radius:12px;background:rgba(15,23,42,.02);font-size:13px;line-height:1.7;">
              <div><strong>Réservation :</strong> #${Number(bookingId || 0)}</div>
              <div style="margin-top:6px;"><strong>Formule :</strong> ${packageLabel(packageType)}</div>
              <div style="margin-top:6px;"><strong>Prix formule :</strong> ${money(packagePrice, currency)}</div>
              <div style="margin-top:6px;"><strong>Total :</strong> ${money(totalPrice, currency)}</div>
            </div>

            ${optionsHtml}

            <h2 style="margin:18px 0 10px;font-size:16px;line-height:1.3;color:#0f172a;">
              Politique d’annulation
            </h2>

            <div style="font-size:13px;line-height:1.7;color:rgba(15,23,42,.78);">
              <div style="padding:12px 12px;border:1px solid rgba(15,23,42,.10);border-radius:12px;background:rgba(15,23,42,.02);">
                <div style="margin:0 0 8px;">
                  <strong>&gt; 24h avant le départ</strong><br/>
                  Remboursement 100%
                </div>

                <div style="margin:0 0 8px;">
                  <strong>Entre 24h et 6h</strong><br/>
                  Frais d’annulation 50%
                </div>

                <div style="margin:0;">
                  <strong>&lt; 6h ou No-show</strong><br/>
                  Frais d’annulation 100%<br/>
                  En cas de No-show (absence), le trajet est considéré comme dû et non remboursable.
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding:14px 18px;background:#ffffff;border-top:1px solid rgba(15,23,42,.08);">
            <div style="font-size:11px;line-height:1.6;color:rgba(15,23,42,.60);">
              Cet email est un message automatique. Merci de ne pas répondre directement.
            </div>
            <div style="margin-top:6px;font-size:11px;line-height:1.6;color:rgba(15,23,42,.60);">
              © ${year} ${brandName}. Tous droits réservés.
            </div>
          </div>

        </div>
      </div>
    </body>
  </html>
  `;
};