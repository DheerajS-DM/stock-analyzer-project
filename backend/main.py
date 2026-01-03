from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Stock Value Analyzer", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════
# EXPONENTIAL DECAY ALGORITHM (Core Logic)
# ═══════════════════════════════════════════════════════════════════════════

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def calculate_hybrid_value(symbol: str, decay_weight=0.7, tech_weight=0.3) -> dict:
    """
    HYBRID ALGORITHM:
    Combines your 4-year Exponential Decay (Value) with RSI (Timing).
    """
    try:
        # 1. Fetch Data (Enough for both algorithms)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=1460) # 4 Years
        
        data = yf.download(symbol, start=start_date, end=end_date, progress=False)
        
        if data.empty or len(data) < 200:
            return {"error": f"Insufficient data for {symbol}"}
        
        # 2. Fix Data Structure
        close_data = data['Close']
        if isinstance(close_data, pd.DataFrame):
            prices = close_data.iloc[:, 0]
        else:
            prices = close_data
            
        prices_list = prices.tolist()
        current_price = float(prices_list[-1])
        dates = [d.strftime("%Y-%m-%d") for d in data.index]

        # ==========================================================
        # ALGO 1: YOUR EXPONENTIAL DECAY (Long Term Value)
        # ==========================================================
        # Calculate weights based on your original logic
        max_date = datetime.strptime(dates[-1], "%Y-%m-%d")
        ages_days = np.array([(max_date - datetime.strptime(d, "%Y-%m-%d")).days for d in dates])
        ages_years = ages_days / 365.25
        
        # Using decay=1.0 for a balanced 4-year view
        exp_weights = np.exp(-1.0 * ages_years)
        exp_weights = exp_weights / exp_weights.sum()
        
        weighted_avg = np.average(prices_list, weights=exp_weights)
        
        # Decay Score: 0 to 100 (Higher is BETTER Value)
        # If Price < Avg, Score goes UP. If Price > Avg, Score goes DOWN.
        # Example: Price $80, Avg $100 -> Ratio 0.8 -> Score ~70 (Good)
        decay_ratio = current_price / weighted_avg
        decay_score = max(0, min(100, 50 + (1.0 - decay_ratio) * 100))

        # ==========================================================
        # ALGO 2: TECHNICAL ANALYSIS (Short Term Timing)
        # ==========================================================
        # Calculate RSI
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        current_rsi = float(rsi.iloc[-1])
        
        # RSI Score: We want RSI < 30 (Oversold). 
        # Invert RSI so higher is better for our "Buy Score".
        tech_score = 100 - current_rsi

        # ==========================================================
        # FINAL WEIGHED SCORE
        # ==========================================================
        final_score = (decay_score * decay_weight) + (tech_score * tech_weight)
        
        # Generate Human Signal
        if final_score > 70:
            signal = "STRONG BUY"
        elif final_score > 60:
            signal = "BUY"
        elif final_score < 40:
            signal = "SELL"
        else:
            signal = "HOLD"

        # ... inside calculate_exponential_value ...
        
        return {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "final_score": round(final_score, 1),
            "signal": signal,
            
            # --- COMPATIBILITY FIXES (Prevent Frontend Crash) ---
            "weighted_avg": round(weighted_avg, 2),  
            "base_threshold": 50.0,                  
            "weight_recent": 0.0,  # <--- ADD THIS LINE! (The crash culprit)
            # ----------------------------------------------------

            "components": {
                "fundamental_value": f"${weighted_avg:.2f}",
                "fundamental_score": round(decay_score, 1),
                "technical_rsi": round(current_rsi, 1),
                "technical_score": round(tech_score, 1)
            },
            "value_coefficient": round(decay_ratio, 3), 
            "margin": round(final_score - 50, 1) 
        }
    except Exception as e:
        return {"error": f"Hybrid calc failed: {str(e)}"}
# ═══════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "Stock Value Analyzer running", "endpoints": ["/health", "/analyze/{symbol}", "/stocks"]}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/analyze/{symbol}")
def analyze_stock(symbol: str):
    # Use the new hybrid function
    result = calculate_hybrid_value(symbol.upper())
    return result
# ... existing imports ...

@app.get("/history/{symbol}")
def get_stock_history(symbol: str):
    try:
        # Fetch 1 year of history for the chart
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        
        # Format for Recharts (Frontend)
        chart_data = []
        for date, row in hist.iterrows():
            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "price": round(row['Close'], 2)
            })
            
        return {"data": chart_data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/stocks")
def top_stocks():
    """Analyze top 10 stocks."""
    top_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"] # Shortened list for speed
    results = []
    
    for symbol in top_symbols:
        result = calculate_hybrid_value(symbol)
        results.append(result) # <--- Append EVERYTHING, even errors
    
    return {"stocks": results, "total": len(results)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
