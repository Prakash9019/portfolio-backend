const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockControllers');

router.get('/portfolio', stockController.getPortfolioData);

router.post('/stocks', stockController.addStock);

module.exports = router;