const Stock = require('../models/Stock');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const axios = require('axios');
const cheerio = require('cheerio');

const scrapeGoogleFinance = async (ticker, exchange) => {
    try {
        let googleExchange = exchange;
        if (exchange === 'BSE' && /^\d+$/.test(ticker)) {
            googleExchange = 'BOM';
        }

        const url = `https://www.google.com/finance/quote/${ticker}:${googleExchange}`;
        
        const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
            }
        });
        
        const $ = cheerio.load(data);
        let peRatio = null; 
        let earnings = "N/A";
        let scrapedPrice = 0;
        const priceText = $('.YMlKec.fxKbKc').first().text().replace(/[^\d.]/g, '');
        if (priceText) {
            scrapedPrice = parseFloat(priceText);
        }

        $('div').each((i, el) => {
            const text = $(el).text().trim();
            if (text === 'P/E ratio') {
                const nextVal = $(el).next().text().trim(); 
                if (nextVal && nextVal.length < 10) peRatio = nextVal;
            }
            if (text === 'EPS (TTM)') {
                const nextVal = $(el).next().text().trim();
                if (nextVal && nextVal.length < 10) earnings = nextVal;
            }
        });

        return { price: scrapedPrice, peRatio, earnings };
    } catch (err) {
        return { price: 0, peRatio: null, earnings: "N/A" };
    }
};

exports.getPortfolioData = async (req, res) => {
    try {
        const stocks = await Stock.find();
        if (stocks.length === 0) return res.json([]);

        const detailedStocks = await Promise.all(stocks.map(async (stock) => {
            const yahooTicker = `${stock.ticker}.${stock.exchange === 'NSE' ? 'NS' : 'BO'}`;
            
            let cmp = 0;
            let yahooPE = null;

            try {
                const quoteResult = await yahooFinance.quote(yahooTicker);
                if (quoteResult && quoteResult.regularMarketPrice) {
                    cmp = quoteResult.regularMarketPrice;
                }
                
                if (cmp > 500000) cmp = 0; 
                
            } catch (e) {
            }

            // Yahoo for Backup P/E
            try {
                const summaryResult = await yahooFinance.quoteSummary(yahooTicker, { modules: ["summaryDetail"] });
                if (summaryResult.summaryDetail && summaryResult.summaryDetail.trailingPE) {
                    yahooPE = summaryResult.summaryDetail.trailingPE.toFixed(2);
                }
            } catch (e) { }

            // Scrape Google (Price + P/E)
            const googleData = await scrapeGoogleFinance(stock.ticker, stock.exchange);

            if (cmp === 0 && googleData.price > 0) {
                cmp = googleData.price;
            }

            const finalPE = googleData.peRatio || yahooPE || "N/A";
            const investment = stock.purchasePrice * stock.quantity;
            const presentValue = cmp * stock.quantity;
            const gainLoss = presentValue - investment;

            return {
                ...stock._doc,
                cmp,
                investment,
                presentValue,
                gainLoss,
                peRatio: finalPE,     
                latestEarnings: googleData.earnings 
            };
        }));

        const totalPortfolioValue = detailedStocks.reduce((sum, s) => sum + s.presentValue, 0);

        const finalData = detailedStocks.map(stock => ({
            ...stock,
            portfolioWeight: totalPortfolioValue > 0 
                ? ((stock.presentValue / totalPortfolioValue) * 100).toFixed(2) 
                : "0.00"
        }));

        res.json(finalData);

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

exports.addStock = async (req, res) => {
    try {
        const newStock = new Stock(req.body);
        await newStock.save();
        res.status(201).json(newStock);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};