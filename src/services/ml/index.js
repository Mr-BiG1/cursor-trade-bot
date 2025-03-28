const { spawn } = require('child_process');
const path = require('path');

/**
 * Get price prediction for a symbol
 * @param {string} symbol Stock symbol
 * @returns {Promise<Object>} Prediction results
 */
async function predictPrice(symbol) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, 'predict.py');
        const pythonProcess = spawn('python', [pythonScript, symbol]);
        
        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python process exited with code ${code}: ${error}`));
                return;
            }

            try {
                // Trim any whitespace and ensure we have valid JSON
                const cleanResult = result.trim();
                const prediction = JSON.parse(cleanResult);
                resolve(prediction);
            } catch (e) {
                console.error('Raw Python output:', result);
                reject(new Error(`Failed to parse prediction result: ${e.message}`));
            }
        });
    });
}

module.exports = {
    predictPrice
}; 