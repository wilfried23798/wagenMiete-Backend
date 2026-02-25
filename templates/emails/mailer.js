const bookingMinimalTemplate = require("../emails/templates/booking-minimal.template");

const html = bookingMinimalTemplate({ brandName: "GO-Shüttle" });

// subject exemple (sans emoji)
const subject = "GO-Shuttle – Informations importantes";