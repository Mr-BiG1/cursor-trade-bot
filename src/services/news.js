const axios = require('axios');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Fetch latest news for a given stock symbol
 * @param {string} symbol Stock symbol
 * @returns {Promise<Array>} Array of news articles
 */
async function fetchNews(symbol) {
    try {
        const response = await axios.get(`https://newsapi.org/v2/everything`, {
            params: {
                q: symbol,
                language: 'en',
                sortBy: 'publishedAt',
                apiKey: process.env.NEWS_API_KEY,
                pageSize: 5
            }
        });

        return response.data.articles.map(article => ({
            title: article.title,
            description: article.description,
            url: article.url,
            publishedAt: article.publishedAt,
            source: article.source.name
        }));
    } catch (error) {
        console.error('Error fetching news:', error);
        throw new Error(`Failed to fetch news: ${error.message}`);
    }
}

/**
 * Analyze sentiment of news articles using OpenAI
 * @param {Array} news Array of news articles
 * @returns {Promise<Object>} Sentiment analysis results
 */
async function analyzeSentiment(news) {
    try {
        const newsText = news
            .map(article => `${article.title}. ${article.description || ''}`)
            .join('\n\n');

        const prompt = `Analyze the sentiment of these news articles about a stock. Consider the overall market impact and potential trading implications. Rate the sentiment on a scale of 0 to 1, where 0 is extremely negative and 1 is extremely positive. Also provide a brief explanation of your rating.\n\nNews:\n${newsText}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a financial analyst expert in market sentiment analysis."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        const analysis = response.choices[0].message.content;
        
        // Extract sentiment score using regex
        const scoreMatch = analysis.match(/\d+(\.\d+)?/);
        const score = scoreMatch ? parseFloat(scoreMatch[0]) : 0.5;

        return {
            score,
            analysis,
            articles: news.length,
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error analyzing sentiment:', error);
        throw new Error(`Failed to analyze sentiment: ${error.message}`);
    }
}

module.exports = {
    fetchNews,
    analyzeSentiment
}; 