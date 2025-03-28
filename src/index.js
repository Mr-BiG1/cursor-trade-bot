require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const cron = require('node-cron');
const { checkMarketStatus } = require('./services/market');
const { fetchNews, analyzeSentiment } = require('./services/news');
const technical = require('./services/technical');
const telegram = require('./services/telegram');
const { getTechnicalIndicators } = require('./services/technical');
const { predictPrice } = require('./services/ml');
const { getAIDecision } = require('./services/ai');
const { validateRisk } = require('./trading/risk');
const { executeTrade } = require('./trading/executor');
const { sendNotification } = require('./services/telegram');

// Debug logging
console.log('API Key exists:', !!process.env.ALPACA_API_KEY);
console.log('API Secret exists:', !!process.env.ALPACA_API_SECRET);

// Configuration
const STOCK_SYMBOL = process.env.STOCK_SYMBOL || 'AAPL';
const MIN_SENTIMENT_SCORE = parseFloat(process.env.MIN_SENTIMENT_SCORE) || 0.3;

async function runTradingCycle() {
    try {
        // Step 1: Check Market Status
        const marketStatus = await checkMarketStatus();
        console.log(`Market Status: ${marketStatus.isOpen ? 'Open' : 'Closed'}`);

        // Step 2: News Analysis
        const news = await fetchNews(STOCK_SYMBOL);
        const sentiment = await analyzeSentiment(news);
        
        if (sentiment.score < MIN_SENTIMENT_SCORE) {
            console.log('Skipping cycle due to low sentiment score');
            return;
        }

        // Step 3: Technical Analysis
        const technicals = await technical.getTechnicalIndicators(STOCK_SYMBOL);

        // Step 4: ML Price Prediction
        const prediction = await predictPrice(STOCK_SYMBOL);

        // Step 5: AI Decision Making
        const decision = await getAIDecision({
            news,
            sentiment,
            technicals,
            prediction,
            marketStatus
        });

        // Step 6: Risk Management
        const riskCheck = await validateRisk(decision);
        
        if (!riskCheck.isValid) {
            await telegram.sendNotification({
                type: 'warning',
                message: `Risk check failed: ${riskCheck.reason}`
            });
            return;
        }

        // Step 7: Trade Execution
        if (marketStatus.isOpen && decision.action !== 'hold') {
            const trade = await executeTrade({
                symbol: STOCK_SYMBOL,
                action: decision.action,
                quantity: riskCheck.quantity,
                price: decision.price,
                stopLoss: decision.stopLoss
            });

            // Step 8: Notification
            await telegram.sendNotification({
                type: 'trade',
                message: `Trade executed: ${trade.action} ${trade.quantity} ${trade.symbol} @ ${trade.price}`
            });
        } else {
            await telegram.sendNotification({
                type: 'info',
                message: `Market closed or hold recommendation. Decision: ${JSON.stringify(decision)}`
            });
        }

    } catch (error) {
        console.error('Error in trading cycle:', error);
        await telegram.sendNotification({
            type: 'error',
            message: `Trading cycle error: ${error.message}`
        });
    }
}

// Schedule the trading cycle every 5 minutes
cron.schedule('*/5 * * * *', runTradingCycle);

// Initial run
runTradingCycle();

// Handle process termination
process.on('SIGTERM', async () => {
    await telegram.sendNotification({
        type: 'system',
        message: 'Bot shutting down'
    });
    process.exit(0);
}); 