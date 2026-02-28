const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Obligatoire pour le port 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // Le code de 16 caractères
  },
  tls: {
    // Indispensable si vous travaillez en local (localhost)
    rejectUnauthorized: false
  }
});

module.exports = { transporter };