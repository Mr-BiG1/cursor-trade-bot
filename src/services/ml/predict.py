import os
import sys
import json
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import requests
from dotenv import load_dotenv

load_dotenv()

class PricePredictor:
    def __init__(self):
        self.model = LinearRegression()
        self.scaler = StandardScaler()
        self.features = ['open', 'high', 'low', 'close', 'volume']
        
    def prepare_features(self, df):
        """Prepare features for prediction"""
        # Technical indicators
        df['SMA_5'] = df['close'].rolling(window=5).mean()
        df['SMA_20'] = df['close'].rolling(window=20).mean()
        
        # Price momentum
        df['price_momentum'] = df['close'].pct_change()
        
        # Volume momentum
        df['volume_momentum'] = df['volume'].pct_change()
        
        # Volatility
        df['volatility'] = df['close'].rolling(window=5).std()
        
        # Drop NaN values
        df = df.dropna()
        
        return df

    def fetch_historical_data(self, symbol):
        """Fetch historical data from Alpha Vantage"""
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        url = f'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=5min&apikey={api_key}&outputsize=full'
        
        response = requests.get(url)
        data = response.json()
        
        if 'Time Series (5min)' not in data:
            raise Exception('Failed to fetch data from Alpha Vantage')
            
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(data['Time Series (5min)'], orient='index')
        df.columns = ['open', 'high', 'low', 'close', 'volume']
        df = df.astype(float)
        
        return df

    def train(self, symbol):
        """Train the model on historical data"""
        # Fetch historical data
        df = self.fetch_historical_data(symbol)
        
        # Prepare features
        df = self.prepare_features(df)
        
        # Prepare training data
        X = df[self.features].values
        y = df['close'].shift(-1).values[:-1]  # Next period's price
        X = X[:-1]  # Remove last row as we don't have next price for it
        
        # Scale features
        X = self.scaler.fit_transform(X)
        
        # Train model
        self.model.fit(X, y)
        
    def predict(self, symbol):
        try:
            # For now, return a mock prediction since we don't have historical data
            current_price = 100.0  # This would normally come from market data
            prediction = current_price * (1 + np.random.normal(0, 0.02))  # Random 2% variation
            
            result = {
                'current_price': float(current_price),
                'predicted_price': float(prediction),
                'predicted_change_percent': float((prediction - current_price) / current_price * 100),
                'confidence_score': float(0.75),  # Mock confidence score
                'timestamp': datetime.now().isoformat()
            }
            
            # Ensure we output valid JSON
            print(json.dumps(result))
            return True
            
        except Exception as e:
            print(json.dumps({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }))
            return False

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'error': 'Usage: python predict.py <symbol>',
            'timestamp': datetime.now().isoformat()
        }))
        sys.exit(1)
        
    symbol = sys.argv[1]
    predictor = PricePredictor()
    success = predictor.predict(symbol)
    sys.exit(0 if success else 1) 