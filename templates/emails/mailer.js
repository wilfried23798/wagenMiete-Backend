const bookingMinimalTemplate = require("../emails/templates/booking-minimal.template");

const html = bookingMinimalTemplate({ brandName: "GO-Shuttle" });

// subject exemple (sans emoji)
const subject = "GO-Shuttle – Informations importantes";