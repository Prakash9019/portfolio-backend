const mongoose = require('mongoose');
const dotenv = require('dotenv');
const XLSX = require('xlsx');
const Stock = require('./models/Stock');

dotenv.config();

const FILE_NAME = 'E555815F_58D029050B.xlsx'; 

const seedExcel = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ DB Connected. Reading Excel file...");

        const workbook = XLSX.readFile(FILE_NAME);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const stocksToInsert = [];
        let currentSector = "General"; 

        let headerIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].includes('Particulars')) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            throw new Error("Could not find 'Particulars' header in Excel.");
        }

        const headers = rows[headerIndex];
        const idxName = headers.indexOf('Particulars');
        const idxPrice = headers.indexOf('Purchase Price');
        const idxQty = headers.indexOf('Qty'); 
        const idxTicker = headers.indexOf('NSE/BSE'); 

        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            
            if (!row || row.length === 0) continue;

            const name = row[idxName];
            const price = row[idxPrice];
            const qty = row[idxQty];
            let ticker = row[idxTicker];

            if (name && !price && !qty) {
                currentSector = name.replace('Sector', '').trim(); 
                console.log(`📂 Detected Sector: ${currentSector}`);
                continue;
            }

            if (name && price && qty && ticker) {
                
                let exchange = 'NSE';
                if (!isNaN(ticker)) {
                    exchange = 'BSE';
                    ticker = ticker.toString(); 
                }

                stocksToInsert.push({
                    ticker: ticker,
                    exchange: exchange,
                    name: name,
                    purchasePrice: parseFloat(price),
                    quantity: parseInt(qty),
                    sector: currentSector 
                });
            }
        }

        if (stocksToInsert.length > 0) {
            await Stock.deleteMany({}); 
            await Stock.insertMany(stocksToInsert);
            console.log(`\n✅ Successfully seeded ${stocksToInsert.length} stocks from Excel!`);
        } else {
            console.log("⚠️ No valid stock rows found. Check your column headers.");
        }

        process.exit();

    } catch (err) {
        console.error("❌ Seeding Failed:", err.message);
        process.exit(1);
    }
};

seedExcel();