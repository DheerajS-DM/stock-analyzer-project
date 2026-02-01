import os
from pathlib import Path
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

# --- Setup & Configuration ---

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

print(f"Loading .env from: {env_path}")
print(f"URL Found: {'Yes' if os.getenv('SUPABASE_URL') else 'No'}")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = None

if not url or not key:
    print("WARNING: SUPABASE_URL or SUPABASE_ANON_KEY missing. Database features will be disabled.")
else:
    try:
        supabase = create_client(url, key)
        print("Supabase Connected")
    except Exception as e:
        print(f"Supabase Connection Failed: {e}")

app = FastAPI(title="Stock Value Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Core Algorithm ---

def calculate_hybrid_value(symbol: str, decay_weight=0.7, tech_weight=0.3) -> dict:
    """
    Combines 4-year Exponential Decay (Value) with RSI (Timing).
    """
    try:
        # Fetch Data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=1460) 
        
        data = yf.download(symbol, start=start_date, end=end_date, progress=False)
        
        if data.empty or len(data) < 200:
            return {"error": f"Insufficient data for {symbol}"}
        
        # Normalize Data
        close_data = data['Close']
        if isinstance(close_data, pd.DataFrame):
            prices = close_data.iloc[:, 0]
        else:
            prices = close_data
            
        prices_list = prices.tolist()
        current_price = float(prices_list[-1])
        dates = [d.strftime("%Y-%m-%d") for d in data.index]

        # 1. Exponential Decay Model
        max_date = datetime.strptime(dates[-1], "%Y-%m-%d")
        ages_days = np.array([(max_date - datetime.strptime(d, "%Y-%m-%d")).days for d in dates])
        ages_years = ages_days / 365.25
        
        exp_weights = np.exp(-1.0 * ages_years)
        exp_weights = exp_weights / exp_weights.sum()
        
        weighted_avg = np.average(prices_list, weights=exp_weights)
        
        decay_ratio = current_price / weighted_avg
        decay_score = max(0, min(100, 50 + (1.0 - decay_ratio) * 100))

        # 2. Technical Analysis (RSI)
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        current_rsi = float(rsi.iloc[-1])
        
        tech_score = 100 - current_rsi

        # Final Score Calculation
        final_score = (decay_score * decay_weight) + (tech_score * tech_weight)
        
        if final_score > 70:
            signal = "STRONG BUY"
        elif final_score > 60:
            signal = "BUY"
        elif final_score < 40:
            signal = "SELL"
        else:
            signal = "HOLD"

        # Save to Database
        if supabase:
            try:
                db_record = {
                    "symbol": symbol,
                    "current_price": round(current_price, 2),
                    "final_score": round(final_score, 1),
                    "weighted_avg": round(weighted_avg, 2),
                    "signal": signal,
                    "margin": round(final_score - 50, 1),
                    "updated_at": datetime.now().isoformat()
                }
                supabase.table("stocks").upsert(db_record).execute()
                print(f"Saved {symbol} to DB")
            except Exception as db_err:
                print(f"DB Save skipped: {db_err}")

        return {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "final_score": round(final_score, 1),
            "signal": signal,
            "weighted_avg": round(weighted_avg, 2),
            "base_threshold": 50.0,
            "weight_recent": 0.0, 
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
        print(f"Error calculating {symbol}: {e}")
        return {"error": str(e), "symbol": symbol}

# --- Scheduler Logic ---

def scheduled_analysis():
    """Runs daily analysis on top 100 stocks."""
    print("[SCHEDULER] Starting daily analysis...")
    
    top_stocks = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
        "JNJ", "V", "PG", "JPM", "MA", "HD", "DIS", "MCD", "KO", "PEP",
        "NFLX", "INTC", "AMD", "IBM", "ORCL", "QCOM", "CSCO", "ADBE",
        "CRM", "INTU", "NOW", "SNOW", "DDOG", "CRWD", "ZM", "TWLO",
        "SQ", "PYPL", "DASH", "UBER", "LYFT", "SPOT", "ROKU", "TTD",
        "BA", "GE", "F", "GM", "T", "VZ"
    ]
    
    success_count = 0
    error_count = 0
    
    for symbol in top_stocks:
        try:
            result = calculate_hybrid_value(symbol)
            if "error" not in result:
                if supabase:
                    # Duplicate logic inside calculate_hybrid_value handles the save
                    # We just log success here
                    success_count += 1
                    print(f" [OK] {symbol}: {result['final_score']}")
                else:
                    print(f" [OK] {symbol}: Analyzed (DB disconnected)")
            else:
                error_count += 1
                print(f" [ERR] {symbol}: {result.get('error')}")
                
        except Exception as e:
            error_count += 1
            print(f" [ERR] {symbol}: Exception {str(e)}")
    
    print(f"[SCHEDULER] Complete. {success_count} analyzed, {error_count} errors")

# --- API Endpoints ---

@app.get("/")
def root():
    return {"status": "Stock Value Analyzer running", "endpoints": ["/health", "/analyze/{symbol}", "/stocks"]}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/stocks")
def top_stocks():
    top_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX", "INTC"]
    results = []
    
    for symbol in top_symbols:
        result = calculate_hybrid_value(symbol)
        if "error" not in result:
            results.append(result)
    
    return {"stocks": results, "total": len(results)}

@app.get("/analyze/{symbol}")
def analyze_stock(symbol: str):
    return calculate_hybrid_value(symbol.upper())

@app.get("/history/{symbol}")
def get_stock_history(symbol: str):
    try:
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        
        chart_data = []
        for date, row in hist.iterrows():
            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "price": round(row['Close'], 2)
            })
            
        return {"data": chart_data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/trigger-scheduler")
def trigger_scheduler():
    try:
        scheduled_analysis()
        return {"status": "scheduler_triggered", "message": "Check Supabase table"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
