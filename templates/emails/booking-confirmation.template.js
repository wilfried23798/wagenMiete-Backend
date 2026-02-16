/**
 * Formate le prix avec la devise
 */
function money(val, currency = "EUR") {
  const n = Number(val ?? 0);
  const fixed = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return currency === "EUR" ? `${fixed} €` : `${fixed} ${currency}`;
}

/**
 * Traduit le label du package
 */
function packageLabel(p) {
  const labels = {
    "go-direct": "Liaison Directe (GO-Direct)",
    "standard": "Formule Standard",
    "celebration": "Événement & Célébration",
    "nightlife": "Sortie Nocturne (Nightlife)"
  };
  return labels[p] || String(p || "");
}

module.exports = function bookingDetailsTemplate({
  brandName = "GO-Shütle",
  bookingId,
  packageType,
  packagePrice,
  options = [],
  optionsTotal = 0,
  totalPrice = 0,
  currency = "EUR",
} = {}) {
  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Construction de la liste des options
  const optionsRows = options.length
    ? options.map((o) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${String(o.name || "Option")}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; text-align: right; font-weight: 600;">${money(o.price, currency)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="2" style="padding: 12px 0; color: #94a3b8; font-size: 13px; font-style: italic;">Aucune option supplémentaire</td></tr>`;

  return `
  <!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Facture ${brandName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        body { font-family: 'Inter', Arial, sans-serif !important; }
      </style>
    </head>

    <body style="margin:0;padding:0;background-color:#f8fafc;color:#0f172a;">
      <div style="width:100%;padding:40px 0;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:0px;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          
          <div style="padding: 40px; border-bottom: 2px solid #f1f5f9;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #003087;">${brandName.toUpperCase()}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px;">Service de transport privé</div>
                </td>
                <td style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 700; color: #0f172a;">FACTURE</div>
                  <div style="font-size: 13px; color: #64748b;">#${String(bookingId).padStart(6, '0')}</div>
                  <div style="font-size: 13px; color: #64748b;">${dateStr}</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding: 40px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th style="text-align: left; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; padding-bottom: 15px;">Description</th>
                  <th style="text-align: right; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; padding-bottom: 15px;">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${packageLabel(packageType)}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Prestation de transport principale</div>
                  </td>
                  <td style="padding: 15px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; font-size: 15px;">
                    ${money(packagePrice, currency)}
                  </td>
                </tr>
                
                ${optionsRows}
              </tbody>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
              <tr>
                <td width="60%"></td>
                <td width="40%">
                  <table width="100%">
                    <tr>
                      <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Sous-total</td>
                      <td style="padding: 5px 0; text-align: right; font-size: 14px; font-weight: 600;">${money(totalPrice, currency)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #64748b; font-size: 14px;">TVA (0%)</td>
                      <td style="padding: 5px 0; text-align: right; font-size: 14px; font-weight: 600;">0,00 €</td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 0 0; color: #0f172a; font-size: 16px; font-weight: 800;">TOTAL</td>
                      <td style="padding: 20px 0 0; text-align: right; font-size: 22px; font-weight: 800; color: #003087;">${money(totalPrice, currency)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin: 0 40px 40px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 10px; letter-spacing: 0.5px;">Conditions d'annulation</div>
            <table width="100%" style="font-size: 11px; color: #64748b; line-height: 1.5;">
              <tr>
                <td style="padding-bottom: 5px;"><strong>+24h avant :</strong> Remboursement 100%</td>
              </tr>
              <tr>
                <td style="padding-bottom: 5px;"><strong>24h à 6h avant :</strong> Frais d'annulation 50%</td>
              </tr>
              <tr>
                <td><strong>-6h ou No-show :</strong> Non remboursable (100% frais)</td>
              </tr>
            </table>
          </div>

          <div style="padding: 30px 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
            <div style="font-size: 13px; font-weight: 600; opacity: 0.9;">Merci de votre confiance, ${brandName}</div>
            <div style="font-size: 11px; opacity: 0.6; margin-top: 10px;">
              Ceci est une facture électronique générée automatiquement.<br/>
              &copy; ${year} ${brandName} • Tous droits réservés.
            </div>
          </div>

        </div>
      </div>
    </body>
  </html>
  `;
};