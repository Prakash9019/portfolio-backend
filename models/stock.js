const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
    ticker: { type: String, required: true, unique: true },
    exchange: { type: String, required: true },            
    name: { type: String, required: true },
    purchasePrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    sector: { type: String, required: true }               
});

module.exports = mongoose.model('Stock', StockSchema);