const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate a trading decision using OpenAI
 * @param {Object} data Object containing all analysis data
 * @returns {Promise<Object>} Trading decision
 */
async function getAIDecision(data) {
    try {
        const prompt = `
As an AI trading expert, analyze the following market data and provide a trading decision:

Technical Analysis:
- RSI: ${data.technicals.rsi}
- Trend: ${data.technicals.trendSignal}
- MACD: ${JSON.stringify(data.technicals.macd)}
- Current Price: $${data.technicals.currentPrice}

ML Prediction:
- Predicted Price: $${data.prediction.predicted_price}
- Predicted Change: ${data.prediction.predicted_change_percent.toFixed(2)}%
- Confidence Score: ${data.prediction.confidence_score.toFixed(2)}

News Sentiment:
- Score: ${data.sentiment.score}
- Analysis: ${data.sentiment.analysis}

Market Status:
- Is Open: ${data.marketStatus.isOpen}
- Next Close: ${data.marketStatus.nextClose}

Based on this data, provide:
1. Trading action (buy, sell, or hold)
2. Confidence level (high, medium, or low)
3. Price target
4. Stop-loss level
5. Detailed reasoning for the decision
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an expert trading AI that makes precise trading decisions based on multiple data points. Your decisions should be clear, well-reasoned, and risk-aware."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        const analysis = response.choices[0].message.content;

        // Parse the AI response
        const decision = parseAIResponse(analysis);

        return {
            ...decision,
            timestamp: new Date(),
            rawAnalysis: analysis
        };
    } catch (error) {
        console.error('Error getting AI decision:', error);
        throw new Error(`Failed to get AI decision: ${error.message}`);
    }
}

/**
 * Parse the AI response into structured data
 * @param {string} response Raw AI response
 * @returns {Object} Structured decision data
 */
function parseAIResponse(response) {
    try {
        // Extract action (buy, sell, hold)
        const actionMatch = response.match(/action.*?:\s*(buy|sell|hold)/i);
        const action = actionMatch ? actionMatch[1].toLowerCase() : 'hold';

        // Extract confidence (high, medium, low)
        const confidenceMatch = response.match(/confidence.*?:\s*(high|medium|low)/i);
        const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'low';

        // Extract price target
        const priceTargetMatch = response.match(/price target.*?:\s*\$?([\d.]+)/i);
        const priceTarget = priceTargetMatch ? parseFloat(priceTargetMatch[1]) : null;

        // Extract stop-loss
        const stopLossMatch = response.match(/stop-loss.*?:\s*\$?([\d.]+)/i);
        const stopLoss = stopLossMatch ? parseFloat(stopLossMatch[1]) : null;

        // Extract reasoning
        const reasoningMatch = response.match(/reasoning.*?:\s*(.*)/is);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No detailed reasoning provided';

        return {
            action,
            confidence,
            priceTarget,
            stopLoss,
            reasoning
        };
    } catch (error) {
        console.error('Error parsing AI response:', error);
        return {
            action: 'hold',
            confidence: 'low',
            priceTarget: null,
            stopLoss: null,
            reasoning: 'Error parsing AI response'
        };
    }
}

module.exports = {
    getAIDecision
}; 