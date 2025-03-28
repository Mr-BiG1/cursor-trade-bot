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
    const portfolioValue = parseFloat(account.portfolio_value);
    const maxRiskAmount = portfolioValue * (RISK_PERCENTAGE / 100);
    const buyingPower = parseFloat(account.buying_power);
    
    const riskPerShare = Math.abs(params.entryPrice - params.stopLoss);
    let shares = Math.floor(maxRiskAmount / riskPerShare);
    
    // Calculate maximum shares based on buying power
    const maxSharesByBuyingPower = Math.floor(buyingPower / params.entryPrice);
    
    // Take the smaller of the two values
    shares = Math.min(shares, maxSharesByBuyingPower);
    
    // Ensure minimum position size
    if (shares < MIN_POSITION_SIZE) {
        // Try reducing risk percentage until we can afford at least minimum shares
        const minRiskAmount = MIN_POSITION_SIZE * riskPerShare;
        const actualRiskPercentage = (minRiskAmount / portfolioValue) * 100;
        
        if (minRiskAmount <= maxRiskAmount && MIN_POSITION_SIZE * params.entryPrice <= buyingPower) {
            shares = MIN_POSITION_SIZE;
            console.log(`Adjusted risk percentage to ${actualRiskPercentage.toFixed(2)}% for minimum position size`);
        } else {
            return 0; // Can't afford even minimum position
        }
    }
    
    return shares;
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

        const tradeParams = {
            entryPrice: currentPrice,
            stopLoss: decision.stopLoss || currentPrice * 0.98, // Default 2% stop loss if none provided
            priceTarget: decision.priceTarget || currentPrice * 1.04 // Default 4% target if none provided
        };

        // Calculate position size
        const quantity = await calculatePositionSize(tradeParams, account);
        
        if (quantity === 0) {
            return {
                isValid: false,
                reason: 'Insufficient funds for minimum position size',
                details: {
                    minimumShares: MIN_POSITION_SIZE,
                    currentPrice,
                    requiredFunds: MIN_POSITION_SIZE * currentPrice
                }
            };
        }

        // Calculate risk-reward ratio
        const potentialReward = Math.abs(tradeParams.priceTarget - tradeParams.entryPrice);
        const potentialRisk = Math.abs(tradeParams.entryPrice - tradeParams.stopLoss);
        const riskRewardRatio = potentialReward / potentialRisk;

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
                stopLoss: tradeParams.stopLoss,
                priceTarget: tradeParams.priceTarget,
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