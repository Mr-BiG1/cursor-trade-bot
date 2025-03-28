const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_API_SECRET,
    paper: process.env.ALPACA_PAPER_TRADING === 'true',
    usePolygon: false
});

const RISK_PERCENTAGE = parseFloat(process.env.RISK_PERCENTAGE) || 1; // Default 1% risk per trade
const MIN_RISK_REWARD_RATIO = 2; // Minimum 2:1 reward-to-risk ratio
const MIN_POSITION_SIZE = 1; // Minimum number of shares to trade

/**
 * Calculate position size based on risk parameters
 * @param {Object} params Trade parameters
 * @param {Object} account Account information
 * @returns {Promise<number>} Position size
 */
async function calculatePositionSize(params, account) {
    try {
        const portfolioValue = parseFloat(account.portfolio_value);
        const buyingPower = parseFloat(account.buying_power);
        
        // Add logging to debug values
        console.log('Portfolio Value:', portfolioValue);
        console.log('Buying Power:', buyingPower);
        console.log('Entry Price:', params.entryPrice);
        console.log('Stop Loss:', params.stopLoss);

        // Ensure we have valid numbers
        if (!params.entryPrice || !params.stopLoss) {
            console.error('Missing entry price or stop loss for position sizing');
            return 0;
        }

        const maxRiskAmount = portfolioValue * (RISK_PERCENTAGE / 100);
        const riskPerShare = Math.abs(params.entryPrice - params.stopLoss);
        
        // Ensure we're not dividing by zero
        if (riskPerShare === 0) {
            console.error('Risk per share cannot be zero');
            return 0;
        }

        let shares = Math.floor(maxRiskAmount / riskPerShare);
        
        // Calculate maximum shares based on buying power
        const maxSharesByBuyingPower = Math.floor(buyingPower / params.entryPrice);
        
        // Take the smaller of the two values
        shares = Math.min(shares, maxSharesByBuyingPower);
        
        // Ensure minimum position size
        if (shares < MIN_POSITION_SIZE) {
            if (MIN_POSITION_SIZE * params.entryPrice <= buyingPower) {
                return MIN_POSITION_SIZE;
            }
            return 0;
        }
        
        return shares;
    } catch (error) {
        console.error('Error calculating position size:', error);
        return 0;
    }
}

/**
 * Calculate risk-reward ratio
 * @param {Object} params Trade parameters
 * @returns {number} Risk-reward ratio
 */
function calculateRiskRewardRatio(params) {
    const potentialReward = Math.abs(params.priceTarget - params.entryPrice);
    const potentialRisk = Math.abs(params.entryPrice - params.stopLoss);
    
    return potentialReward / potentialRisk;
}

/**
 * Check if the trade meets margin requirements
 * @param {Object} params Trade parameters
 * @returns {Promise<boolean>} Whether trade meets margin requirements
 */
async function checkMarginRequirements(params) {
    try {
        const account = await alpaca.getAccount();
        const buying_power = parseFloat(account.buying_power);
        const total_cost = params.quantity * params.entryPrice;
        
        return total_cost <= buying_power;
    } catch (error) {
        console.error('Error checking margin requirements:', error);
        return false;
    }
}

/**
 * Validate trade against risk management rules
 * @param {Object} decision Trading decision
 * @returns {Promise<Object>} Validation result
 */
async function validateRisk(decision) {
    try {
        if (!decision.symbol) {
            throw new Error('Stock symbol is required for risk validation');
        }

        if (decision.action === 'hold') {
            return {
                isValid: true,
                reason: 'Hold position - no risk check needed'
            };
        }

        // Get current price and account info
        const [quote, account] = await Promise.all([
            alpaca.getLatestQuote(decision.symbol),
            alpaca.getAccount()
        ]);
        
        const currentPrice = parseFloat(quote.askprice);

        // Ensure we have a valid stop loss
        const stopLoss = decision.stopLoss || currentPrice * 0.98; // Default 2% stop loss
        const priceTarget = decision.priceTarget || currentPrice * 1.04; // Default 4% target

        const tradeParams = {
            entryPrice: currentPrice,
            stopLoss: stopLoss,
            priceTarget: priceTarget
        };

        // Calculate position size
        const quantity = await calculatePositionSize(tradeParams, account);
        
        if (!quantity || quantity === 0) {
            return {
                isValid: false,
                reason: 'Could not calculate valid position size',
                details: {
                    currentPrice,
                    stopLoss,
                    priceTarget,
                    buyingPower: parseFloat(account.buying_power)
                }
            };
        }

        // Calculate risk-reward ratio
        const riskRewardRatio = Math.abs(priceTarget - currentPrice) / Math.abs(currentPrice - stopLoss);

        if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
            return {
                isValid: false,
                reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} below minimum ${MIN_RISK_REWARD_RATIO}`,
                details: { riskRewardRatio }
            };
        }

        return {
            isValid: true,
            quantity,
            riskRewardRatio,
            maxRisk: RISK_PERCENTAGE,
            details: {
                entryPrice: currentPrice,
                stopLoss: stopLoss,
                priceTarget: priceTarget,
                estimatedCost: quantity * currentPrice,
                availableFunds: parseFloat(account.buying_power)
            }
        };

    } catch (error) {
        console.error('Error validating risk:', error);
        return {
            isValid: false,
            reason: `Risk validation error: ${error.message}`
        };
    }
}

module.exports = {
    validateRisk
}; 