const express = require('express');
const router = express.Router();

const optionsController = require('../controllers/options.controller');

// 📦 Options (Admin)

// ➜ Récupérer toutes les options
router.get('/', optionsController.getOptions);

// ➜ Ajouter une option
router.post('/', optionsController.addOption);

// ➜ Modifier une option
router.put('/:id', optionsController.editOption);

// ➜ Supprimer une option
router.delete('/:id', optionsController.deleteOption);

module.exports = router;